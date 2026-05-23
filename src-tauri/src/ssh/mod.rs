//! SSH 业务逻辑层
//! 提供 SSH 连接生命周期管理（spawn → I/O 循环 → 关闭）、
//! 会话命令通道和连接配置类型定义。

pub mod client;
pub mod channel;
pub mod config;
pub mod forward;
pub mod proxy;
