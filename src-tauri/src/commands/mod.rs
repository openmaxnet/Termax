//! Tauri IPC 命令处理器
//! 薄命令层，负责参数校验、状态查询和调用业务层。
//! 不含 SSH/SFTP 协议细节，每个命令函数不超过 50 行。

pub mod ssh_cmd;
pub mod sftp_cmd;
pub mod config_cmd;
pub mod local_cmd;
pub mod edit_cmd;
pub mod monitor_cmd;
pub mod font_cmd;
pub mod forward_cmd;
