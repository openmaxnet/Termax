use std::sync::Arc;

use russh::client;
use russh::ChannelMsg;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio::sync::watch;

use super::config::{AuthMethod, BastionConfig, ConnectionConfig};
use crate::error::{AppError, CmdResult};

/// Commands sent from Tauri commands to the session task
#[derive(Debug)]
pub enum SessionCmd {
    Input(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Close,
}

/// Handle passed to Tauri commands to control a session
pub struct SessionHandle {
    pub cmd_tx: mpsc::UnboundedSender<SessionCmd>,
}

struct SshHandler;

impl client::Handler for SshHandler {
    type Error = anyhow::Error;

    fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}

/// 生成 SSH 会话任务，返回命令通道的发送端
///
/// 在 tokio 后台任务中运行完整的会话生命周期：
/// 连接 → 认证 → 打开 channel → 请求 PTY → 启动 shell → I/O 循环。
/// 通过 Tauri 事件向前端发送终端输出和错误信息。
pub fn spawn_session(
    app_handle: tauri::AppHandle,
    session_id: String,
    config: ConnectionConfig,
) -> Result<mpsc::UnboundedSender<SessionCmd>, String> {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<SessionCmd>();

    tokio::spawn(async move {
        if let Err(e) = run_session(app_handle.clone(), &session_id, &config, cmd_rx).await {
            let _ = app_handle.emit("session-error", serde_json::json!({
                "sessionId": session_id,
                "error": e.to_string(),
            }));
        }
    });

    Ok(cmd_tx)
}

/// 连接目标服务器并完成认证，返回可用 handle
async fn connect_and_auth(
    host: &str,
    port: u16,
    auth: &AuthMethod,
    username: &str,
) -> Result<client::Handle<SshHandler>, AppError> {
    let cfg = Arc::new(client::Config::default());
    let mut handle = client::connect(cfg, (host, port), SshHandler)
        .await
        .map_err(|e| AppError::SshError(format!("连接失败: {}", e)))?;

    match auth {
        AuthMethod::Password(pw) => {
            let result = handle
                .authenticate_password(username, pw)
                .await
                .map_err(|e| AppError::SshError(format!("认证错误: {}", e)))?;
            if !result.success() {
                return Err(AppError::AuthFailed);
            }
        }
        AuthMethod::Key { path, passphrase } => {
            let key = russh::keys::load_secret_key(path, passphrase.as_deref())
                .map_err(|e| AppError::SshError(format!("密钥错误: {}", e)))?;
            let kh = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
            let result = handle
                .authenticate_publickey(username, kh)
                .await
                .map_err(|e| AppError::SshError(format!("认证错误: {}", e)))?;
            if !result.success() {
                return Err(AppError::AuthFailed);
            }
        }
    }

    Ok(handle)
}

/// 跳板机隧道守卫：drop 时通知 relay 任务退出
pub struct BastionGuard {
    /// 保持 Sender 活跃，drop 时通知 relay 退出
    #[allow(dead_code)]
    cancel_tx: watch::Sender<bool>,
}

/// 链式跳板机隧道：按顺序连接多台跳板机，最终到达目标
///
/// 例如 bastions=[A, B], target=host:22:
///   A → direct-tcpip(B:22) → relay → B → direct-tcpip(host:22) → relay
/// 从后向前遍历，每台跳板机复用 connect_and_auth + tunnel + relay 模式
async fn bastion_tunnel(
    bastions: &[BastionConfig],
    target_host: &str,
    target_port: u16,
) -> Result<((String, u16), BastionGuard), AppError> {
    let mut prev_host = target_host.to_string();
    let mut prev_port = target_port;
    let mut guard: Option<BastionGuard> = None;

    for bastion in bastions.iter().rev() {
        let handle = connect_and_auth(
            &bastion.host, bastion.port,
            &bastion.auth_method, &bastion.username,
        ).await?;

        let channel = handle
            .channel_open_direct_tcpip(
                prev_host.clone(),
                prev_port as u32,
                "127.0.0.1",
                0,
            )
            .await
            .map_err(|e| AppError::SshError(format!("跳板机隧道失败: {}", e)))?;

        let tunnel_stream = channel.into_stream();
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| AppError::Io(format!("绑定端口失败: {}", e)))?;
        let local_port = listener.local_addr().map_err(|e| AppError::Io(e.to_string()))?.port();

        let (cancel_tx, mut cancel_rx) = watch::channel(false);
        tokio::spawn(async move {
            tokio::select! {
                _ = cancel_rx.changed() => {}
                result = listener.accept() => {
                    if let Ok((mut local, _)) = result {
                        if let Err(e) = relay_bastion(&mut local, tunnel_stream).await {
                            log::error!("跳板机 relay 中断: {}", e);
                        }
                    }
                }
            }
            drop(listener);
        });

        prev_host = "127.0.0.1".to_string();
        prev_port = local_port;
        guard = Some(BastionGuard { cancel_tx });
    }

    // bastions 为空时直连，不建隧道
    if let Some(g) = guard {
        Ok((("127.0.0.1".into(), prev_port), g))
    } else {
        Ok(((target_host.to_string(), target_port), BastionGuard { cancel_tx: watch::channel(false).0 }))
    }
}

/// 双向转发：本地 TCP ↔ 隧道 stream
async fn relay_bastion(
    local: &mut tokio::net::TcpStream,
    stream: impl tokio::io::AsyncRead + tokio::io::AsyncWrite,
) -> Result<(), AppError> {
    tokio::pin!(stream);
    tokio::io::copy_bidirectional(local, &mut stream)
        .await
        .map_err(|e| AppError::Io(format!("跳板机转发中断: {}", e)))?;
    // 确保关闭双向写入
    let _ = local.shutdown().await;
    Ok(())
}

/// SSH 会话主循环：连接认证 → PTY 请求 → 双向 I/O 转发
///
/// 支持跳板机：当 config.bastion 为 Some 时自动通过跳板机隧道连接目标。
async fn run_session(
    app_handle: tauri::AppHandle,
    session_id: &str,
    config: &ConnectionConfig,
    mut cmd_rx: mpsc::UnboundedReceiver<SessionCmd>,
) -> Result<(), anyhow::Error> {
    let sid = session_id.to_string();

    use crate::ssh::proxy::{proxy_tunnel, ProxyGuard};

    // 确定连接目标：代理 → 跳板机 → 直连
    let (target_host, target_port, _proxy_guard) = if let Some(ref proxy) = config.proxy {
        let ((h, p), g) = proxy_tunnel(proxy, &config.host, config.port).await?;
        (h, p, Some(g))
    } else {
        (config.host.to_string(), config.port, None::<ProxyGuard>)
    };

    let (target_host, target_port, _bastion_guard) = if !config.bastion.is_empty() {
        let ((h, p), g) = bastion_tunnel(&config.bastion[..], &target_host, target_port).await?;
        (h, p, Some(g))
    } else {
        (target_host, target_port, None::<BastionGuard>)
    };

    // 连接（直连或通过本地隧道端口）
    let handle = connect_and_auth(&target_host, target_port, &config.auth_method, &config.username).await?;

    // Open channel
    let mut channel = handle.channel_open_session().await?;

    // Request PTY
    channel
        .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
        .await?;

    // Start shell
    channel.request_shell(false).await?;

    // Notify frontend that connection is ready
    let _ = app_handle.emit(
        "session-ready",
        serde_json::json!({ "sessionId": &sid }),
    );

    // ── I/O 循环：同时监听前端命令通道和 SSH 数据通道 ──
    loop {
        tokio::select! {
            Some(cmd) = cmd_rx.recv() => {
                match cmd {
                    SessionCmd::Input(data) => {
                        if let Err(e) = channel.data(&data[..]).await {
                            log::error!("[{}] 写入错误: {}", sid, e);
                            break;
                        }
                    }
                    SessionCmd::Resize { cols, rows } => {
                        let _ = channel
                            .window_change(cols as u32, rows as u32, 0, 0)
                            .await;
                    }
                    SessionCmd::Close => {
                        let _ = channel.eof().await;
                        break;
                    }
                }
            }
            msg = channel.wait() => {
                match msg {
                    Some(ChannelMsg::Data { ref data }) => {
                        let bytes = data.to_vec();
                        let _ = app_handle.emit("term-output", serde_json::json!({
                            "sessionId": &sid,
                            "data": bytes,
                        }));
                    }
                    Some(ChannelMsg::Close) | None => break,
                    _ => {}
                }
            }
        }
    }

    Ok(())
}

/// 测试 SSH 连接是否可达（含认证），返回中文结果消息
///
/// 内部完成 TCP 连接、密钥交换和用户认证全流程，10 秒超时。
pub async fn test_connection(config: &ConnectionConfig) -> CmdResult<String> {
    struct TestHandler;
    impl client::Handler for TestHandler {
        type Error = anyhow::Error;
        fn check_server_key(&mut self, _: &russh::keys::ssh_key::PublicKey) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
            async { Ok(true) }
        }
    }

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        async {
            let cfg = Arc::new(client::Config::default());
            let mut handle = client::connect(cfg, (&config.host[..], config.port), TestHandler)
                .await
                .map_err(|e| AppError::SshError(format!("连接失败: {}", e)))?;

            match &config.auth_method {
                AuthMethod::Password(pw) => {
                    let result = handle.authenticate_password(&config.username, pw)
                        .await
                        .map_err(|e| AppError::SshError(format!("认证错误: {}", e)))?;
                    if !result.success() {
                        return Err(AppError::AuthFailed);
                    }
                }
                AuthMethod::Key { path, passphrase } => {
                    let key = russh::keys::load_secret_key(path, passphrase.as_deref())
                        .map_err(|e| AppError::SshError(format!("密钥错误: {}", e)))?;
                    let kh = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
                    let result = handle.authenticate_publickey(&config.username, kh)
                        .await
                        .map_err(|e| AppError::SshError(format!("认证错误: {}", e)))?;
                    if !result.success() {
                        return Err(AppError::AuthFailed);
                    }
                }
            }

            drop(handle);
            Ok(())
        },
    ).await;

    match result {
        Ok(Ok(())) => Ok("连接成功".into()),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(AppError::SshError("连接超时（10秒）".into())),
    }
}
