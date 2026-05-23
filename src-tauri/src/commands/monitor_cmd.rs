use crate::error::CmdResult;
use crate::monitor;
use crate::ssh::config::ConnectionConfig;

/// 采集远程主机的系统监控指标（CPU/内存/磁盘/进程等）
///
/// 前端触发场景：监控面板自动轮询或手动刷新。
/// 返回 SystemInfo 包含主机名、CPU 使用率、内存、磁盘、进程列表等。
#[tauri::command]
pub async fn monitor_fetch(config: ConnectionConfig) -> CmdResult<monitor::parser::SystemInfo> {
    monitor::client::fetch_system_info(&config).await
}

/// 在远程主机上执行单条命令并返回标准输出
///
/// 前端触发场景：进程列表中执行 kill/renice 等操作。
/// 实际逻辑委托给 monitor/client.rs::exec_command。
#[tauri::command]
pub async fn monitor_exec(config: ConnectionConfig, command: String) -> CmdResult<String> {
    crate::monitor::client::exec_command(&config, &command).await
}
