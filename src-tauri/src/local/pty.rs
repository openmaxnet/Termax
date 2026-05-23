use std::io::{Read, Write};
use std::path::Path;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tokio::sync::mpsc;

/// 本地终端会话命令：输入、调整窗口大小、关闭
pub enum LocalSessionCmd {
    Input(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Close,
}

/// 本地终端会话句柄：通过 mpsc channel 发送命令到 PTY 线程
pub struct LocalSessionHandle {
    pub cmd_tx: mpsc::UnboundedSender<LocalSessionCmd>,
}

/// Shell 信息：名称、路径、是否为默认 shell
#[derive(Debug, Clone, Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
    pub default: bool,
}

/// 检测系统已安装的可用 shell，标记默认 shell
pub fn detect_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(windows)]
    {
        // PowerShell 7.x
        let pwsh_paths = [
            r"C:\Program Files\PowerShell\7\pwsh.exe",
            r"C:\Program Files\PowerShell\7-preview\pwsh.exe",
        ];
        for p in &pwsh_paths {
            if Path::new(p).exists() {
                shells.push(ShellInfo {
                    name: format!("PowerShell 7 ({})", p),
                    path: p.to_string(),
                    default: false,
                });
            }
        }

        // Windows PowerShell 5.1
        let sys32 = std::env::var("SYSTEMROOT").unwrap_or_else(|_| r"C:\Windows".into());
        let powershell = format!(r"{}\System32\WindowsPowerShell\v1.0\powershell.exe", sys32);
        if Path::new(&powershell).exists() {
            let is_default = shells.is_empty();
            shells.push(ShellInfo {
                name: "Windows PowerShell".into(),
                path: powershell,
                default: is_default,
            });
        }

        // cmd.exe
        let cmd = format!(r"{}\System32\cmd.exe", sys32);
        if Path::new(&cmd).exists() {
            shells.push(ShellInfo {
                name: "Command Prompt (cmd)".into(),
                path: cmd,
                default: shells.is_empty(),
            });
        }
    }

    #[cfg(not(windows))]
    {
        let candidates = [
            ("zsh", "/bin/zsh"),
            ("bash", "/bin/bash"),
            ("fish", "/usr/bin/fish"),
            ("sh", "/bin/sh"),
        ];

        // Check $SHELL first
        let user_shell = std::env::var("SHELL").ok();
        let mut found_default = false;

        for (name, path) in &candidates {
            if Path::new(path).exists() {
                let is_default = !found_default && user_shell.as_deref() == Some(path);
                if is_default {
                    found_default = true;
                }
                shells.push(ShellInfo {
                    name: name.to_string(),
                    path: path.to_string(),
                    default: is_default,
                });
            }
        }

        // If $SHELL points to something not in the list
        if let Some(ref us) = user_shell {
            if !shells.iter().any(|s| s.path == *us) && Path::new(us).exists() {
                shells.insert(0, ShellInfo {
                    name: us.rsplit('/').next().unwrap_or("shell").to_string(),
                    path: us.clone(),
                    default: true,
                });
            }
        }

        // Mark first as default if none found
        if !shells.is_empty() && !shells.iter().any(|s| s.default) {
            shells[0].default = true;
        }
    }

    shells
}

/// 创建本地 PTY shell 会话，返回 mpsc channel 发送端
///
/// 内部启动独立线程运行 PTY 事件循环：
/// - 读取线程将 shell 输出转发到 on_output 回调
/// - 主循环监听 channel 中的输入/resize/close 指令
/// - 以 10ms 间隔轮询 channel（因在同步线程中无法使用 tokio::select）
pub fn spawn_local_pty<F>(
    shell_path: &str,
    on_output: F,
) -> Result<mpsc::UnboundedSender<LocalSessionCmd>, String>
where
    F: Fn(Vec<u8>) + Send + 'static,
{
    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<LocalSessionCmd>();
    let shell = shell_path.to_string();

    std::thread::spawn(move || {
        let pty_system = native_pty_system();

        let mut pair = pty_system
            .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| format!("PTY: {}", e))
            .unwrap();

        let master = &mut pair.master;

        let cmd = CommandBuilder::new(&shell);
        let mut child = pair.slave.spawn_command(cmd).map_err(|e| format!("Spawn: {}", e)).unwrap();

        let mut buf = [0u8; 4096];

        let reader_handle = std::thread::spawn({
            let mut reader = master.try_clone_reader().unwrap();
            move || {
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => on_output(buf[..n].to_vec()),
                    }
                }
            }
        });

        let mut writer = master.take_writer().unwrap();

        loop {
            match cmd_rx.try_recv() {
                Ok(LocalSessionCmd::Input(data)) => {
                    let _ = writer.write_all(&data);
                    let _ = writer.flush();
                }
                Ok(LocalSessionCmd::Resize { cols, rows }) => {
                    let _ = master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 });
                }
                Ok(LocalSessionCmd::Close) | Err(mpsc::error::TryRecvError::Disconnected) => {
                    let _ = child.kill();
                    break;
                }
                Err(mpsc::error::TryRecvError::Empty) => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
            }
        }

        let _ = reader_handle.join();
    });

    Ok(cmd_tx)
}
