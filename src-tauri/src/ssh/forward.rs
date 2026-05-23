//! 端口转发：本地转发（-L）、远程转发（-R）、动态转发（-D，SOCKS5）
//!
//! 本地转发：监听本地端口，将入站连接通过 SSH 隧道转发到远程目标。
//! 远程转发：请求远程服务器监听端口，将入站连接通过 SSH 隧道转发回本地。
//! 动态转发：监听本地端口作为 SOCKS5 代理，客户端动态指定目标地址。
//!
//! 每个转发规则使用独立的 SSH 连接，互不干扰。
//! 通过 watch channel 实现取消：发送 true 信号后，accept 循环退出并关闭所有 relay。

use std::sync::Arc;

use russh::client;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::watch;

use crate::error::{AppError, CmdResult};
use crate::ssh::config::{AuthMethod, ConnectionConfig, PortForwardRule};

/// SSH 处理器：信任所有主机密钥
struct ForwardHandler;

impl client::Handler for ForwardHandler {
    type Error = anyhow::Error;

    fn check_server_key(&mut self, _: &russh::keys::ssh_key::PublicKey) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}

/// 建立 SSH 连接并完成用户认证（密码或密钥），返回可用于开 channel 的 handle
async fn connect_and_auth(config: &ConnectionConfig) -> Result<client::Handle<ForwardHandler>, AppError> {
    let cfg = Arc::new(client::Config::default());
    let mut handle = client::connect(cfg, (&config.host[..], config.port), ForwardHandler)
        .await
        .map_err(|e| AppError::SshError(format!("转发连接失败: {}", e)))?;

    let result = match &config.auth_method {
        AuthMethod::Password(pw) => handle
            .authenticate_password(&config.username, pw)
            .await
            .map_err(|e| AppError::SshError(format!("认证失败: {}", e)))?,
        AuthMethod::Key { path, passphrase } => {
            let key = russh::keys::load_secret_key(path, passphrase.as_deref())
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

/// 启动本地端口转发
///
/// 1. 建立 SSH 连接到目标服务器
/// 2. 监听本地地址
/// 3. 对每个入站连接开 direct-tcpip channel 并双向 relay
/// 4. 通过 cancel_rx 信号停止转发
pub async fn spawn_local_forward(
    config: &ConnectionConfig,
    rule: PortForwardRule,
    cancel_rx: watch::Receiver<bool>,
) -> CmdResult<()> {
    let handle = connect_and_auth(config).await?;
    let listen_addr = format!("{}:{}", rule.listen_host, rule.listen_port);

    let listener = TcpListener::bind(&listen_addr)
        .await
        .map_err(|e| AppError::ForwardError(format!("绑定 {} 失败: {}", listen_addr, e)))?;

    let mut cancel_rx = cancel_rx;

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                // 收到取消信号，停止 accept
                break;
            }
            result = listener.accept() => {
                let (local_stream, peer_addr) = match result {
                    Ok((s, a)) => (s, a),
                    Err(e) => {
                        log::warn!("转发 accept 错误: {}", e);
                        continue;
                    }
                };

                // 在同一个 SSH 连接上开 direct-tcpip channel
                match handle
                    .channel_open_direct_tcpip(
                        rule.target_host.clone(),
                        rule.target_port as u32,
                        "127.0.0.1",
                        peer_addr.port() as u32,
                    )
                    .await
                {
                    Ok(channel) => {
                        let stream = channel.into_stream();
                        tokio::spawn(async move {
                            if let Err(e) = relay_stream(local_stream, stream).await {
                                log::warn!("转发 relay 中断: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        log::warn!("打开 direct-tcpip channel 失败: {}", e);
                    }
                }
            }
        }
    }

    Ok(())
}

/// SOCKS5 握手：解析客户端发来的 CONNECT 请求，返回目标地址和端口。
/// 协议简述：
///   1. 客户端发送 [ver, nmethods, methods...]
///   2. 服务端回复 [ver, method]
///   3. 客户端发送 [ver, cmd, rsv, atyp, dst_addr, dst_port]
///   4. 服务端回复 [ver, rep, rsv, atyp, bind_addr, bind_port]
async fn socks5_handshake(stream: &mut TcpStream) -> Result<(String, u16), AppError> {
    let mut buf = [0u8; 256];

    // 读取版本号和方法数
    stream.read_exact(&mut buf[..2]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取失败: {}", e)))?;
    if buf[0] != 0x05 {
        return Err(AppError::ForwardError("不支持的 SOCKS 版本".into()));
    }
    let nmethods = buf[1] as usize;
    stream.read_exact(&mut buf[..nmethods]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取方法失败: {}", e)))?;

    // 回复：无认证
    stream.write_all(&[0x05, 0x00]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 回复失败: {}", e)))?;

    // 读取 CONNECT 请求
    stream.read_exact(&mut buf[..4]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取请求失败: {}", e)))?;
    if buf[1] != 0x01 {
        return Err(AppError::ForwardError("仅支持 CONNECT 命令".into()));
    }

    let atyp = buf[3];
    let target_host = match atyp {
        // IPv4
        0x01 => {
            stream.read_exact(&mut buf[..4]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取 IPv4 失败: {}", e)))?;
            format!("{}.{}.{}.{}", buf[0], buf[1], buf[2], buf[3])
        }
        // 域名
        0x03 => {
            stream.read_exact(&mut buf[..1]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取域名长度失败: {}", e)))?;
            let len = buf[0] as usize;
            stream.read_exact(&mut buf[..len]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取域名失败: {}", e)))?;
            String::from_utf8_lossy(&buf[..len]).to_string()
        }
        // IPv6
        0x04 => {
            return Err(AppError::ForwardError("IPv6 暂不支持".into()));
        }
        _ => return Err(AppError::ForwardError(format!("不支持的地址类型: {}", atyp))),
    };

    let mut port_buf = [0u8; 2];
    stream.read_exact(&mut port_buf).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取端口失败: {}", e)))?;
    let target_port = u16::from_be_bytes(port_buf);

    // 回复成功
    stream.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 回复失败: {}", e)))?;

    Ok((target_host, target_port))
}

/// 启动动态端口转发（SOCKS5 代理 -D）
///
/// 监听本地端口作为 SOCKS5 代理，每个入站连接先完成 SOCKS5 握手，
/// 解析出客户端请求的目标地址，再通过 SSH 的 direct-tcpip 通道转发。
pub async fn spawn_dynamic_forward(
    config: &ConnectionConfig,
    rule: PortForwardRule,
    cancel_rx: watch::Receiver<bool>,
) -> CmdResult<()> {
    let handle = connect_and_auth(config).await?;
    let listen_addr = format!("{}:{}", rule.listen_host, rule.listen_port);

    let listener = TcpListener::bind(&listen_addr)
        .await
        .map_err(|e| AppError::ForwardError(format!("绑定 {} 失败: {}", listen_addr, e)))?;

    let mut cancel_rx = cancel_rx;

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => break,
            result = listener.accept() => {
                let (mut local_stream, _) = match result {
                    Ok((s, a)) => (s, a),
                    Err(e) => {
                        log::warn!("动态转发 accept 错误: {}", e);
                        continue;
                    }
                };

                // SOCKS5 握手解析目标地址
                match socks5_handshake(&mut local_stream).await {
                    Ok((target_host, target_port)) => {
                        match handle
                            .channel_open_direct_tcpip(
                                target_host.clone(),
                                target_port as u32,
                                "127.0.0.1",
                                0,
                            )
                            .await
                        {
                            Ok(channel) => {
                                let stream = channel.into_stream();
                                tokio::spawn(async move {
                                    if let Err(e) = relay_stream(local_stream, stream).await {
                                        log::warn!("动态转发 relay 中断: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                log::warn!("动态转发开 channel 失败 ({}:{}): {}", target_host, target_port, e);
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("SOCKS5 握手失败: {}", e);
                    }
                }
            }
        }
    }

    Ok(())
}

/// 双向数据转发：在本地 TCP 连接和 SSH channel stream 之间复制数据
async fn relay_stream(
    mut local: tokio::net::TcpStream,
    stream: impl tokio::io::AsyncRead + tokio::io::AsyncWrite,
) -> Result<(), AppError> {
    // 使用 tokio::pin! 将 stream 固定在栈上，满足 copy_bidirectional 的 Unpin 要求
    tokio::pin!(stream);

    tokio::io::copy_bidirectional(&mut local, &mut stream)
        .await
        .map_err(|e| AppError::ForwardError(format!("转发中断: {}", e)))?;

    Ok(())
}
