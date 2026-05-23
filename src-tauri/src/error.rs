//! 统一错误类型
//! 所有 Tauri 命令返回 CmdResult<T>，通过枚举变体区分错误来源。
//! 错误信息对用户友好（中文），不暴露内部调用栈。

use serde::Serialize;
use thiserror::Error;

/// 应用统一错误类型，所有 Tauri 命令返回此 enum
#[derive(Error, Debug, Serialize)]
pub enum AppError {
    #[error("SSH 连接失败: {0}")]
    SshError(String),
    #[error("认证失败")]
    AuthFailed,
    #[error("会话未找到: {0}")]
    SessionNotFound(String),
    #[error("SFTP 错误: {0}")]
    SftpError(String),
    #[error("端口转发错误: {0}")]
    ForwardError(String),
    #[error("IO 错误: {0}")]
    Io(String),
    #[error("监控错误: {0}")]
    MonitorError(String),
    #[error("内部错误: {0}")]
    Internal(String),
    #[error("传输已取消")]
    Cancelled,
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<russh::Error> for AppError {
    fn from(e: russh::Error) -> Self {
        AppError::SshError(e.to_string())
    }
}

/// Tauri 命令统一返回值类型
pub type CmdResult<T> = Result<T, AppError>;
