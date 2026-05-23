//! WSL 发行版检测与连接
//!
//! 仅在 Windows 平台可用。通过 `wsl.exe -l -v` 获取发行版列表，
//! 使用 portable-pty 启动 `wsl.exe -d <distro>` 作为 PTY 子进程。

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tokio::sync::mpsc;

use crate::local::pty::LocalSessionCmd;

/// WSL 发行版信息
#[derive(Debug, Clone, Serialize)]
pub struct WslDistro {
    pub name: String,
    pub state: String,
    pub version: u32,
}

/// 检测已安装的 WSL 发行版
///
/// 执行 `wsl.exe -l -v` 并解析输出，非 Windows 平台返回空列表。
pub fn detect_distros() -> Vec<WslDistro> {
    if !cfg!(windows) {
        return Vec::new();
    }

    let output = std::process::Command::new("wsl.exe")
        .args(["-l", "-v"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok());

    let output = match output {
        Some(o) => o,
        None => return Vec::new(),
    };

    let mut distros = Vec::new();
    for line in output.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // 按空白分割：NAME STATE VERSION
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 {
            continue;
        }

        // 名称可能带有 * 前缀（默认发行版）
        let name = if parts[0] == "*" {
            parts[1].to_string()
        } else {
            parts[0].to_string()
        };

        // 确定 state 和 version 的偏移
        let state_idx = if parts[0] == "*" { 2 } else { 1 };
        let ver_idx = if parts[0] == "*" { 3 } else { 2 };

        let state = parts.get(state_idx).unwrap_or(&"Unknown").to_string();
        let version = parts.get(ver_idx).unwrap_or(&"0").parse().unwrap_or(0);

        distros.push(WslDistro { name, state, version });
    }

    distros
}

/// 启动 WSL 发行版的 PTY 会话
///
/// 通过 portable-pty 创建 PTY 对，以 `wsl.exe -d <distro>` 作为子进程启动。
/// 返回命令通道的发送端，与 local/pty.rs 的 LocalSessionHandle 兼容。
pub fn spawn_wsl<F>(
    distro: &str,
    on_output: F,
) -> Result<mpsc::UnboundedSender<LocalSessionCmd>, String>
where
    F: Fn(Vec<u8>) + Send + 'static,
{
    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<LocalSessionCmd>();
    let distro = distro.to_string();

    std::thread::spawn(move || {
        let pty_system = native_pty_system();
        let pty = match pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        }) {
            Ok(p) => p,
            Err(e) => {
                log::error!("WSL PTY 创建失败: {}", e);
                return;
            }
        };

        let mut cmd = CommandBuilder::new("wsl.exe");
        cmd.arg("-d");
        cmd.arg(&distro);

        let mut child = match pty.slave.spawn_command(cmd) {
            Ok(c) => c,
            Err(e) => {
                log::error!("WSL 子进程启动失败: {}", e);
                return;
            }
        };

        // 获取 PTY 读写句柄（先 clone reader，再 take writer 消费 master）
        let reader = pty.master.try_clone_reader().unwrap();
        let mut writer = pty.master.take_writer().unwrap();

        // 读取线程：PTY 输出 → 前端
        std::thread::spawn(move || {
            use std::io::Read;
            let mut reader = reader;
            let mut buf = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 {
                    break;
                }
                on_output(buf[..n].to_vec());
            }
        });

        // 主轮询循环：接收前端命令 → PTY
        loop {
            std::thread::sleep(std::time::Duration::from_millis(10));
            match cmd_rx.try_recv() {
                Ok(LocalSessionCmd::Input(data)) => {
                    use std::io::Write;
                    let _ = writer.write_all(&data);
                    let _ = writer.flush();
                }
                Ok(LocalSessionCmd::Resize { cols, rows }) => {
                    let _ = pty.master.resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
                Ok(LocalSessionCmd::Close) | Err(mpsc::error::TryRecvError::Disconnected) => {
                    let _ = child.kill();
                    break;
                }
                Err(mpsc::error::TryRecvError::Empty) => {}
            }
        }
    });

    Ok(cmd_tx)
}
