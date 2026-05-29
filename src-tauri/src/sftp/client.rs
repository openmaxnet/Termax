//! SFTP 客户端操作函数
//! 每个函数建立独立的 SSH+SFTP 连接，执行文件操作后保持连接由 drop 自动关闭。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use russh::client;
use russh_sftp::client::SftpSession;
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::error::{AppError, CmdResult};
use crate::ssh::config::ConnectionConfig;
use crate::storage::credential_store;

/// 拼接远程路径：确保 base 和 name 之间只有一个斜杠
fn join_path(base: &str, name: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.is_empty() {
        format!("/{}", name)
    } else {
        format!("{}/{}", base, name)
    }
}

/// SFTP 文件/目录条目
///
/// 与前端 `src/lib/ipc/types.ts` 的 `SftpEntry` 接口保持字段一致。
#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub mtime: u64,
    pub permissions: Option<u32>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
    pub user: Option<String>,
    pub group: Option<String>,
}

/// 传输方向
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Upload,
    Download,
}

/// 传输进度报告：通过 mpsc channel 从 client 层上报，命令层转发为 Tauri event。
/// 前端根据此事件更新 TransferItem 的 bytesWritten/speedBps/status 等字段。
#[derive(Debug, Clone, Serialize)]
pub struct TransferProgress {
    pub transfer_id: String,
    pub file_name: String,
    pub direction: TransferDirection,
    pub bytes_written: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub done: bool,
    pub error: Option<String>,
}

/// 分块传输的块大小：64 KiB
const TRANSFER_CHUNK_SIZE: usize = 64 * 1024;

/// SSH 处理器：接受所有服务器密钥（信任模式）
struct SftpHandler;

impl client::Handler for SftpHandler {
    type Error = anyhow::Error;

    fn check_server_key(
        &mut self,
        _: &russh::keys::ssh_key::PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}

/// 建立 SSH 连接并打开 SFTP 子系统
///
/// 返回 (SSH handle, SFTP session, 规范化后的远程路径)。
/// 注意：handle 必须保持存活，否则 SFTP session 会被关闭。
async fn connect_sftp(
    config: &ConnectionConfig,
    path: &str,
) -> Result<(client::Handle<SftpHandler>, SftpSession, String), AppError> {
    let cfg = Arc::new(client::Config::default());
    let mut handle = client::connect(cfg, (&config.host[..], config.port), SftpHandler)
        .await
        .map_err(|e| AppError::SshError(format!("连接失败: {}", e)))?;

    // 解析认证信息（支持内嵌和凭证引用）
    let resolved = credential_store::resolve_auth(&config.auth_method)?;

    let result = match resolved {
        credential_store::ResolvedAuth::Password(pw) => {
            handle
                .authenticate_password(&config.username, &pw)
                .await
                .map_err(|e| AppError::SshError(format!("认证失败: {}", e)))?
        }
        credential_store::ResolvedAuth::Key { key_content, passphrase } => {
            let key = russh::keys::decode_secret_key(&key_content, passphrase.as_deref())
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

    let abs = session
        .canonicalize(path)
        .await
        .unwrap_or_else(|_| path.to_string());

    Ok((handle, session, abs))
}

/// 列出远程目录下的文件和子目录（返回排序结果：目录在前）
pub async fn list_directory(
    config: &ConnectionConfig,
    path: &str,
) -> CmdResult<Vec<FileEntry>> {
    let (_handle, session, cwd) = connect_sftp(config, path).await?;
    let rd = session.read_dir(&cwd).await.map_err(|e| AppError::SftpError(format!("读取目录失败: {}", e)))?;

    let mut files = Vec::new();
    for entry in rd {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let meta = entry.metadata();
        let file_path = join_path(&cwd, &name);
        files.push(FileEntry {
            name,
            path: file_path,
            is_dir: meta.file_type().is_dir(),
            size: meta.size.unwrap_or(0),
            mtime: meta.mtime.unwrap_or(0) as u64,
            permissions: meta.permissions,
            uid: meta.uid,
            gid: meta.gid,
            user: meta.user.clone(),
            group: meta.group.clone(),
        });
    }

    files.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(files)
}

/// 读取远程文件全部内容为 UTF-8 字符串
pub async fn read_file(config: &ConnectionConfig, path: &str) -> CmdResult<String> {
    let (_handle, session, cwd) = connect_sftp(config, path).await?;
    let data = session
        .read(&cwd)
        .await
        .map_err(|e| AppError::SftpError(format!("文件读取失败: {}", e)))?;
    Ok(String::from_utf8_lossy(&data).to_string())
}

/// 递归删除远程文件或目录（目录非空时先删除子项）
pub async fn remove_entry(config: &ConnectionConfig, path: &str) -> CmdResult<()> {
    let (_handle, session, cwd) = connect_sftp(config, path).await?;
    let meta = session.metadata(&cwd).await.map_err(|e| AppError::SftpError(format!("获取状态失败: {}", e)))?;

    if meta.file_type().is_dir() {
        let rd = session.read_dir(&cwd).await.map_err(|e| AppError::SftpError(format!("读取目录失败: {}", e)))?;
        for entry in rd {
            let name = entry.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let child = join_path(&cwd, &name);
            let child_meta = entry.metadata();
            if child_meta.file_type().is_dir() {
                Box::pin(remove_entry(config, &child)).await?;
            } else {
                session.remove_file(&child).await.map_err(|e| AppError::SftpError(format!("删除文件失败: {}", e)))?;
            }
        }
        session.remove_dir(&cwd).await.map_err(|e| AppError::SftpError(format!("删除目录失败: {}", e)))?;
    } else {
        session.remove_file(&cwd).await.map_err(|e| AppError::SftpError(format!("删除文件失败: {}", e)))?;
    }
    Ok(())
}

/// 将字节数组写入远程文件（覆盖写入，自动创建并关闭）
pub async fn write_file(config: &ConnectionConfig, path: &str, content: Vec<u8>) -> CmdResult<()> {
    let (_handle, session, cwd) = connect_sftp(config, path).await?;
    let mut file = session.create(&cwd).await.map_err(|e| AppError::SftpError(format!("创建文件失败: {}", e)))?;
    file.write_all(&content).await.map_err(|e| AppError::SftpError(format!("写入失败: {}", e)))?;
    file.shutdown().await.map_err(|e| AppError::SftpError(format!("关闭文件失败: {}", e)))?;
    Ok(())
}

/// 重命名远程文件或目录
pub async fn rename(config: &ConnectionConfig, old: &str, new: &str) -> CmdResult<()> {
    let (_handle, session, _cwd) = connect_sftp(config, old).await?;
    session.rename(old, new).await.map_err(|e| AppError::SftpError(format!("重命名失败: {}", e)))
}

/// 在远程路径创建新目录
pub async fn create_dir(config: &ConnectionConfig, path: &str) -> CmdResult<()> {
    let (_handle, session, cwd) = connect_sftp(config, path).await?;
    session.create_dir(&cwd).await.map_err(|e| AppError::SftpError(format!("创建目录失败: {}", e)))
}

/// 获取远程路径的状态信息（文件大小、修改时间、权限等）
pub async fn get_stat(config: &ConnectionConfig, path: &str) -> CmdResult<FileEntry> {
    let (_handle, session, cwd) = connect_sftp(config, path).await?;
    let meta = session.metadata(&cwd).await.map_err(|e| AppError::SftpError(format!("获取状态失败: {}", e)))?;
    let name = cwd.trim_end_matches('/').rsplit('/').next().unwrap_or(&cwd).to_string();
    Ok(FileEntry {
        name,
        path: cwd,
        is_dir: meta.file_type().is_dir(),
        size: meta.size.unwrap_or(0),
        mtime: meta.mtime.unwrap_or(0) as u64,
        permissions: meta.permissions,
        uid: meta.uid,
        gid: meta.gid,
        user: meta.user,
        group: meta.group,
    })
}

/// 上传本地文件到远程路径（读取本地 → 写入远程）
pub async fn upload_file(config: &ConnectionConfig, local: &str, remote: &str) -> CmdResult<()> {
    let data = tokio::fs::read(local).await.map_err(|e| AppError::Io(format!("读取本地文件失败: {}", e)))?;
    write_file(config, remote, data).await
}

/// 下载远程文件到本地路径（读取远程 → 写入本地）
pub async fn download_file(config: &ConnectionConfig, remote: &str, local: &str) -> CmdResult<()> {
    let (_handle, session, cwd) = connect_sftp(config, remote).await?;
    let data = session.read(&cwd).await.map_err(|e| AppError::SftpError(format!("文件读取失败: {}", e)))?;
    tokio::fs::write(local, data).await.map_err(|e| AppError::Io(format!("写入本地文件失败: {}", e)))
}

/// 分块上传文件内容到远程路径，每写入一块通过 channel 上报一次进度。
///
/// 前端通过 `<input type="file">` 读取文件为 ArrayBuffer 后以 Uint8Array 形式发送给 Rust，
/// 此处将已收到的完整内容分块（64KB）写入远程 SFTP 文件。
/// channel 中的进度消息由命令层的 forwarder task 转发为 Tauri event，
/// 前端据此更新进度条和传输速度。约 100ms 节流避免高频刷新。
pub async fn upload_file_content_chunked(
    config: &ConnectionConfig,
    remote_path: &str,
    content: Vec<u8>,
    transfer_id: String,
    progress_tx: tokio::sync::mpsc::UnboundedSender<TransferProgress>,
    cancelled: Arc<AtomicBool>,
) -> CmdResult<()> {
    let (_handle, session, cwd) = connect_sftp(config, remote_path).await?;
    let mut file = session
        .create(&cwd)
        .await
        .map_err(|e| AppError::SftpError(format!("创建远程文件失败: {}", e)))?;

    let total = content.len() as u64;
    let file_name = cwd.rsplit('/').next().unwrap_or("file").to_string();
    let mut written: u64 = 0;
    let start = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();
    let min_interval = std::time::Duration::from_millis(100);

    for chunk in content.chunks(TRANSFER_CHUNK_SIZE) {
        if cancelled.load(Ordering::SeqCst) {
            // 取消后删除远程部分文件
            let _ = session.remove_file(&cwd).await;
            return Err(AppError::Cancelled);
        }
        file.write_all(chunk)
            .await
            .map_err(|e| AppError::SftpError(format!("分块写入失败: {}", e)))?;
        written += chunk.len() as u64;

        // 节流：至少间隔 100ms 发一次事件，避免高频刷新
        let now = std::time::Instant::now();
        if now.duration_since(last_emit) >= min_interval {
            let elapsed = start.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (written as f64 / elapsed) as u64
            } else {
                0
            };
            let _ = progress_tx.send(TransferProgress {
                transfer_id: transfer_id.clone(),
                file_name: file_name.clone(),
                direction: TransferDirection::Upload,
                bytes_written: written,
                total_bytes: total,
                speed_bps: speed,
                done: false,
                error: None,
            });
            last_emit = now;
        }
    }

    file.shutdown()
        .await
        .map_err(|e| AppError::SftpError(format!("关闭远程文件失败: {}", e)))?;

    // 发送最终 100% 完成事件
    let _ = progress_tx.send(TransferProgress {
        transfer_id,
        file_name,
        direction: TransferDirection::Upload,
        bytes_written: total,
        total_bytes: total,
        speed_bps: 0,
        done: true,
        error: None,
    });

    Ok(())
}

/// 分块下载远程文件到本地路径，每读取一块通过 channel 上报一次进度。
///
/// 使用 session.open() 以只读模式打开远程文件（AsyncRead），
/// 循环读取 64KB 块并写入本地文件。每块处理完后上报进度事件，
/// 包含已写入字节数、总字节数、瞬时速度。
/// 读取发生错误时发送带 error 的完成事件，前端由此将状态置为 failed。
pub async fn download_file_with_progress(
    config: &ConnectionConfig,
    remote_path: &str,
    local_path: &str,
    transfer_id: String,
    progress_tx: tokio::sync::mpsc::UnboundedSender<TransferProgress>,
    cancelled: Arc<AtomicBool>,
) -> CmdResult<()> {
    let (_handle, session, cwd) = connect_sftp(config, remote_path).await?;

    // 获取文件总大小（用于进度计算）
    let meta = session
        .metadata(&cwd)
        .await
        .map_err(|e| AppError::SftpError(format!("获取文件状态失败: {}", e)))?;
    let total = meta.size.unwrap_or(0);
    let file_name = cwd.rsplit('/').next().unwrap_or("file").to_string();

    // 以只读模式打开远程文件，获取 AsyncRead 句柄
    let mut remote_file = session
        .open(&cwd)
        .await
        .map_err(|e| AppError::SftpError(format!("打开远程文件失败: {}", e)))?;

    let mut local_file = tokio::fs::File::create(local_path)
        .await
        .map_err(|e| AppError::Io(format!("创建本地文件失败: {}", e)))?;

    let mut buffer = vec![0u8; TRANSFER_CHUNK_SIZE];
    let mut written: u64 = 0;
    let start = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();
    let min_interval = std::time::Duration::from_millis(100);

    loop {
        if cancelled.load(Ordering::SeqCst) {
            // 取消后删除本地部分文件
            let _ = tokio::fs::remove_file(local_path).await;
            return Err(AppError::Cancelled);
        }
        match remote_file.read(&mut buffer).await {
            Ok(0) => break, // EOF
            Ok(n) => {
                local_file
                    .write_all(&buffer[..n])
                    .await
                    .map_err(|e| AppError::Io(format!("写入本地文件失败: {}", e)))?;
                written += n as u64;

                // 节流：至少间隔 100ms 发一次事件
                let now = std::time::Instant::now();
                if now.duration_since(last_emit) >= min_interval {
                    let elapsed = start.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (written as f64 / elapsed) as u64
                    } else {
                        0
                    };
                    let _ = progress_tx.send(TransferProgress {
                        transfer_id: transfer_id.clone(),
                        file_name: file_name.clone(),
                        direction: TransferDirection::Download,
                        bytes_written: written,
                        total_bytes: total,
                        speed_bps: speed,
                        done: false,
                        error: None,
                    });
                    last_emit = now;
                }
            }
            Err(e) => {
                let err_msg = format!("分块读取失败: {}", e);
                // 发送失败事件
                let _ = progress_tx.send(TransferProgress {
                    transfer_id: transfer_id.clone(),
                    file_name: file_name.clone(),
                    direction: TransferDirection::Download,
                    bytes_written: written,
                    total_bytes: total,
                    speed_bps: 0,
                    done: true,
                    error: Some(err_msg.clone()),
                });
                return Err(AppError::SftpError(err_msg));
            }
        }
    }

    // 发送最终 100% 完成事件
    let _ = progress_tx.send(TransferProgress {
        transfer_id,
        file_name,
        direction: TransferDirection::Download,
        bytes_written: total,
        total_bytes: total,
        speed_bps: 0,
        done: true,
        error: None,
    });

    Ok(())
}

