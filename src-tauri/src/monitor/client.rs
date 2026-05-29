use std::collections::HashMap;
use std::sync::Arc;

use russh::client;
use russh::ChannelMsg;
use russh_sftp::client::SftpSession;

use crate::error::{AppError, CmdResult};

use crate::ssh::config::ConnectionConfig;
use crate::storage::credential_store;

use super::parser::{self, SystemInfo};

/// SSH 处理器（信任所有主机密钥）
struct MonitorHandler;

impl client::Handler for MonitorHandler {
    type Error = anyhow::Error;

    fn check_server_key(
        &mut self,
        _: &russh::keys::ssh_key::PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}

/// 建立 SSH 连接并完成用户认证（密码或密钥）
async fn connect_and_auth(
    config: &ConnectionConfig,
) -> Result<client::Handle<MonitorHandler>, AppError> {
    let cfg = Arc::new(client::Config::default());
    let mut handle = client::connect(cfg, (&config.host[..], config.port), MonitorHandler)
        .await
        .map_err(|e| AppError::SshError(format!("SSH 连接失败: {}", e)))?;

    // 解析认证信息（支持内嵌和凭证引用）
    let resolved = credential_store::resolve_auth(&config.auth_method)?;

    let result = match resolved {
        credential_store::ResolvedAuth::Password(pw) => handle
            .authenticate_password(&config.username, &pw)
            .await
            .map_err(|e| AppError::SshError(format!("认证失败: {}", e)))?,
        credential_store::ResolvedAuth::Key { path, passphrase } => {
            let key = russh::keys::load_secret_key(&path, passphrase.as_deref())
                .map_err(|e| AppError::SshError(format!("密钥错误: {}", e)))?;
            let kh = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
            handle
                .authenticate_publickey(&config.username, kh)
                .await
                .map_err(|e| AppError::SshError(format!("认证失败: {}", e)))?
        }
    };
    if !result.success() {
        return Err(AppError::AuthFailed);
    }
    Ok(handle)
}

/// 在已有 SSH 连接上打开 SFTP 子系统
async fn open_sftp(handle: &mut client::Handle<MonitorHandler>) -> Result<SftpSession, AppError> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| AppError::SshError(format!("通道打开失败: {}", e)))?;

    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| AppError::SshError(format!("SFTP 子系统初始化失败: {}", e)))?;

    let stream = channel.into_stream();
    let session = SftpSession::new(stream)
        .await
        .map_err(|e| AppError::SftpError(format!("SFTP 会话建立失败: {}", e)))?;
    Ok(session)
}

/// 通过 SFTP 读取远程 /proc 文件内容
async fn read_proc_file(session: &SftpSession, path: &str) -> Result<String, AppError> {
    let data = session.read(path).await.map_err(|e| AppError::SftpError(format!("读取 {} 失败: {}", path, e)))?;
    Ok(String::from_utf8_lossy(&data).to_string())
}

/// 在 SSH 连接上执行 `df -B1` 命令，解析磁盘分区信息
async fn exec_df(handle: &mut client::Handle<MonitorHandler>) -> Vec<parser::DiskInfo> {
    let mut channel = match handle.channel_open_session().await {
        Ok(ch) => ch,
        Err(_) => return Vec::new(),
    };

    if channel
        .exec(true, "df -B1 --exclude-type=tmpfs --exclude-type=devtmpfs --exclude-type=overlay 2>/dev/null | tail -n +2")
        .await
        .is_err()
    {
        return Vec::new();
    }

    let mut output = Vec::new();
    loop {
        match channel.wait().await {
            Some(ChannelMsg::Data { data }) => output.extend_from_slice(&data),
            Some(ChannelMsg::ExitStatus { .. }) | Some(ChannelMsg::Close) | None => break,
            _ => {}
        }
    }

    let raw = String::from_utf8_lossy(&output);
    parser::parse_df_output(&raw)
}

/// 必须读取的 /proc 文件列表（监控功能的基础数据源）
const MANDATORY_FILES: &[&str] = &[
    "/proc/stat",
    "/proc/meminfo",
    "/proc/loadavg",
    "/proc/uptime",
    "/proc/cpuinfo",
    "/proc/sys/kernel/hostname",
];

/// 可选读取的文件（不存在时不影响监控功能）
const OPTIONAL_FILES: &[&str] = &["/etc/os-release"];

/// 通过 SFTP 遍历 /proc 目录，采集前 20 个进程信息
///
/// 读取每个进程的 cmdline、stat、status 文件，解析 CPU/内存使用率。
/// 通过 /etc/passwd 将 UID 映射为用户名。
async fn read_processes(session: &SftpSession, uptime_secs: u64, total_mem_bytes: u64) -> Vec<parser::ProcessInfo> {
    let rd = match session.read_dir("/proc").await {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut pids: Vec<u32> = Vec::new();
    for entry in rd {
        let meta = entry.metadata();
        if meta.file_type().is_dir() {
            if let Ok(pid) = entry.file_name().parse::<u32>() {
                pids.push(pid);
            }
        }
    }

    pids.sort_unstable_by(|a, b| b.cmp(a));

    // Try to read /etc/passwd for UID → username lookup
    let passwd_map = match read_proc_file(session, "/etc/passwd").await {
        Ok(c) => parser::parse_passwd(&c),
        Err(_) => HashMap::new(),
    };

    let mut processes = Vec::new();
    for pid in &pids {
        if processes.len() >= 20 {
            break;
        }
        let pid_str = pid.to_string();

        let cmdline = match read_proc_file(session, &format!("/proc/{}/cmdline", pid_str)).await {
            Ok(c) => parser::parse_cmdline(&c),
            Err(_) => continue,
        };
        if cmdline.is_empty() {
            continue;
        }

        let (state, priority, nice, threads, vsize, utime, stime, starttime, rss_pages) =
            match read_proc_file(session, &format!("/proc/{}/stat", pid_str)).await {
                Ok(c) => parser::parse_proc_stat(&c),
                Err(_) => (String::new(), 0, 0, 0, 0, 0, 0, 0, 0),
            };

        let (_name, uid_str) = match read_proc_file(session, &format!("/proc/{}/status", pid_str)).await {
            Ok(c) => parser::parse_proc_status(&c),
            Err(_) => (String::new(), String::new()),
        };

        // Resolve UID to username
        let user = passwd_map.get(&uid_str).cloned().unwrap_or_else(|| {
            if uid_str.is_empty() { String::new() } else { format!("UID:{}", uid_str) }
        });

        processes.push(parser::ProcessInfo {
            pid: *pid,
            user,
            state,
            priority,
            nice,
            vsize,
            threads,
            cpu_percent: parser::compute_cpu_pct(utime, stime, starttime, uptime_secs),
            mem_percent: parser::compute_mem_pct(rss_pages, total_mem_bytes),
            rss_kb: rss_pages * 4,
            command: cmdline.chars().take(80).collect(),
        });
    }
    processes
}

/// 采集远程主机的全部系统监控指标
///
/// 流程：连接认证 → exec 获取磁盘信息 → 打开 SFTP → 读取 /proc 文件 →
/// 解析 CPU/内存/负载/运行时间/进程 → 组装 SystemInfo 返回。
/// 在远程主机上执行单条命令并返回标准输出
///
/// 建立独立 SSH 连接，认证后打开 channel 执行 exec，收集所有输出后关闭。
pub async fn exec_command(config: &ConnectionConfig, command: &str) -> CmdResult<String> {
    struct ExecHandler;
    impl client::Handler for ExecHandler {
        type Error = anyhow::Error;
        fn check_server_key(&mut self, _: &russh::keys::ssh_key::PublicKey) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
            async { Ok(true) }
        }
    }

    let cfg = Arc::new(client::Config::default());
    let mut handle = client::connect(cfg, (&config.host[..], config.port), ExecHandler)
        .await
        .map_err(|e| AppError::MonitorError(format!("连接失败: {}", e)))?;

    // 解析认证信息（支持内嵌和凭证引用）
    let resolved = credential_store::resolve_auth(&config.auth_method)
        .map_err(|e| AppError::MonitorError(e.to_string()))?;

    let result = match resolved {
        credential_store::ResolvedAuth::Password(pw) => handle
            .authenticate_password(&config.username, &pw)
            .await
            .map_err(|e| AppError::MonitorError(format!("认证失败: {}", e)))?,
        credential_store::ResolvedAuth::Key { path, passphrase } => {
            let key = russh::keys::load_secret_key(&path, passphrase.as_deref())
                .map_err(|e| AppError::MonitorError(format!("密钥错误: {}", e)))?;
            let kh = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
            handle
                .authenticate_publickey(&config.username, kh)
                .await
                .map_err(|e| AppError::MonitorError(format!("认证失败: {}", e)))?
        }
    };
    if !result.success() {
        return Err(AppError::MonitorError("认证失败".into()));
    }

    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| AppError::MonitorError(format!("通道打开失败: {}", e)))?;

    channel
        .exec(true, command)
        .await
        .map_err(|e| AppError::MonitorError(format!("命令执行失败: {}", e)))?;

    let mut output = Vec::new();
    loop {
        match channel.wait().await {
            Some(ChannelMsg::Data { data }) => output.extend_from_slice(&data),
            Some(ChannelMsg::ExitStatus { .. }) | Some(ChannelMsg::Close) | None => break,
            _ => {}
        }
    }

    Ok(String::from_utf8_lossy(&output).to_string())
}

pub async fn fetch_system_info(config: &ConnectionConfig) -> CmdResult<SystemInfo> {
    let mut handle = connect_and_auth(config).await?;

    // 1. Run df via exec on the same connection
    let disks = exec_df(&mut handle).await;

    // 2. Open SFTP and read /proc files
    let session = open_sftp(&mut handle).await?;

    // Read all /proc files
    let mut contents = Vec::new();
    for path in MANDATORY_FILES {
        let content = read_proc_file(&session, path).await?;
        contents.push((*path, content));
    }
    for path in OPTIONAL_FILES {
        if let Ok(content) = read_proc_file(&session, path).await {
            contents.push((*path, content));
        }
    }

    // Parse uptime and meminfo first (needed for process % computation)
    let mut uptime_secs = 0u64;
    let mut mem_total = 0u64;
    for (path, content) in &contents {
        match *path {
            "/proc/uptime" => uptime_secs = parser::parse_uptime(content).0,
            "/proc/meminfo" => mem_total = parser::parse_meminfo(content).0,
            _ => {}
        }
    }

    // 3. Processes with known uptime/mem
    let processes = read_processes(&session, uptime_secs, mem_total).await;

    drop(session);
    drop(handle);

    // Parse remaining fields
    let mut hostname = String::new();
    let mut os_name = String::new();
    let mut os_version = String::new();
    let mut cpu_usage = 0.0f64;
    let mut cpu_cores = 1u32;
    let mut cpu_model = String::new();
    let mut mem_total = 0u64;
    let mut mem_free = 0u64;
    let mut mem_avail = 0u64;
    let mut la_one = 0.0f64;
    let mut la_five = 0.0f64;
    let mut la_fifteen = 0.0f64;
    let mut uptime_secs = 0u64;
    let mut uptime_raw = String::new();

    for (path, content) in &contents {
        match *path {
            "/proc/stat" => cpu_usage = parser::parse_cpu_stat(content),
            "/proc/meminfo" => {
                let (t, f, a) = parser::parse_meminfo(content);
                mem_total = t;
                mem_free = f;
                mem_avail = a;
            }
            "/proc/loadavg" => {
                let (o, fi, ff) = parser::parse_loadavg(content);
                la_one = o;
                la_five = fi;
                la_fifteen = ff;
            }
            "/proc/uptime" => {
                let (s, r) = parser::parse_uptime(content);
                uptime_secs = s;
                uptime_raw = r;
            }
            "/proc/cpuinfo" => {
                let (c, m) = parser::parse_cpu_info(content);
                cpu_cores = c;
                cpu_model = m;
            }
            "/proc/sys/kernel/hostname" => {
                hostname = content.trim().to_string();
            }
            "/etc/os-release" => {
                let (n, v) = parser::parse_os_release(content);
                os_name = n;
                os_version = v;
            }
            _ => {}
        }
    }

    Ok(parser::build_system_info(
        hostname, os_name, os_version,
        cpu_usage, cpu_cores, cpu_model,
        mem_total, mem_free, mem_avail,
        la_one, la_five, la_fifteen,
        uptime_secs, uptime_raw,
        disks, processes,
    ))
}
