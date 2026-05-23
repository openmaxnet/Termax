//! SFTP 业务逻辑层
//! 提供远程文件操作（列表/读写/删除/重命名/上传/下载）
//! 和远程编辑会话管理（下载 → 监听 → 自动上传）。

pub mod client;
pub mod editor;
pub mod transfer;
