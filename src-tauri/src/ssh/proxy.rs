//! 代理隧道：通过 HTTP/SOCKS5 代理建立到目标的 TCP 连接
//!
//! 使用与 bastion_tunnel 相同的本地监听 + relay 模式：
//! 连接代理 → 握手 → 本地监听 → relay 入站连接到已建立的隧道

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::watch;

use crate::error::AppError;
use crate::ssh::config::{ProxyConfig, ProxyType};

/// 代理隧道守卫：drop 时关闭 channel 通知 relay 退出
pub struct ProxyGuard {
    // 保留 Sender 以维持 channel 存活；drop 时关闭 channel 通知 relay 退出
    _cancel_tx: watch::Sender<bool>,
}


/// SOCKS5 握手：通过代理连接到目标
async fn socks5_connect(
    stream: &mut TcpStream,
    target_host: &str,
    target_port: u16,
) -> Result<(), AppError> {
    let mut buf = [0u8; 256];

    stream.read_exact(&mut buf[..2]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取失败: {}", e)))?;
    if buf[0] != 0x05 {
        return Err(AppError::ForwardError("不支持的 SOCKS 版本".into()));
    }
    let nmethods = buf[1] as usize;
    if nmethods > 0 {
        stream.read_exact(&mut buf[..nmethods]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取方法失败: {}", e)))?;
    }
    stream.write_all(&[0x05, 0x00]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 回复失败: {}", e)))?;

    stream.read_exact(&mut buf[..4]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取请求失败: {}", e)))?;
    if buf[1] != 0x00 {
        return Err(AppError::ForwardError("SOCKS5 请求被拒绝".into()));
    }

    // 构建 CONNECT 请求（域名方式）
    let host_bytes = target_host.as_bytes();
    let mut req = vec![0x05, 0x01, 0x00, 0x03, host_bytes.len() as u8];
    req.extend_from_slice(host_bytes);
    req.extend_from_slice(&target_port.to_be_bytes());
    stream.write_all(&req).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 发送失败: {}", e)))?;

    stream.read_exact(&mut buf[..10]).await.map_err(|e| AppError::ForwardError(format!("SOCKS5 读取响应失败: {}", e)))?;
    if buf[1] != 0x00 {
        return Err(AppError::ForwardError(format!("SOCKS5 连接被拒绝: {}", buf[1])));
    }

    Ok(())
}

/// HTTP CONNECT 握手：通过代理连接到目标
async fn http_connect(
    stream: &mut TcpStream,
    target_host: &str,
    target_port: u16,
) -> Result<(), AppError> {
    let req = format!("CONNECT {target_host}:{target_port} HTTP/1.1\r\nHost: {target_host}:{target_port}\r\n\r\n");
    stream.write_all(req.as_bytes()).await.map_err(|e| AppError::ForwardError(format!("HTTP 代理发送失败: {}", e)))?;

    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| AppError::ForwardError(format!("HTTP 代理读取失败: {}", e)))?;
    let resp = String::from_utf8_lossy(&buf[..n]);
    if !resp.starts_with("HTTP/1.1 200") && !resp.starts_with("HTTP/1.0 200") {
        return Err(AppError::ForwardError(format!("HTTP 代理拒绝连接: {}", resp.lines().next().unwrap_or(""))));
    }

    Ok(())
}

/// 通过代理建立到目标的 TCP 隧道，返回本地监听地址
pub async fn proxy_tunnel(
    proxy: &ProxyConfig,
    target_host: &str,
    target_port: u16,
) -> Result<((String, u16), ProxyGuard), AppError> {
    let mut stream = TcpStream::connect((proxy.host.as_str(), proxy.port))
        .await
        .map_err(|e| AppError::Io(format!("连接代理服务器失败: {}", e)))?;

    match proxy.proxy_type {
        ProxyType::Socks5 => socks5_connect(&mut stream, target_host, target_port).await?,
        ProxyType::Http => http_connect(&mut stream, target_host, target_port).await?,
    }

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| AppError::Io(format!("绑定本地端口失败: {}", e)))?;
    let local_port = listener.local_addr().map_err(|e| AppError::Io(e.to_string()))?.port();
    let (cancel_tx, mut cancel_rx) = watch::channel(false);

    tokio::spawn(async move {
        tokio::select! {
            _ = cancel_rx.changed() => {}
            result = listener.accept() => {
                if let Ok((mut local, _)) = result {
                    if let Err(e) = tokio::io::copy_bidirectional(&mut local, &mut stream).await {
                        log::error!("代理 relay 中断: {}", e);
                    }
                }
            }
        }
        drop(listener);
    });

    Ok((("127.0.0.1".into(), local_port), ProxyGuard { _cancel_tx: cancel_tx }))
}
