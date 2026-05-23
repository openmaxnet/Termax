//! 会话命令通道类型定义
//! SessionCmd 和 SessionHandle 由 ssh/client.rs 定义，在此重导出供 commands 层使用。

pub use super::client::{SessionCmd, SessionHandle};
