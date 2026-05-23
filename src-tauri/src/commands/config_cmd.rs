use crate::error::{AppError, CmdResult};
use crate::ssh::config::ConnectionConfig;
use crate::storage::store;

/// 保存新的连接配置到持久化存储
#[tauri::command]
pub fn save_config(config: ConnectionConfig) -> CmdResult<()> {
    store::add(config).map_err(AppError::Internal)
}

/// 更新已有连接配置（按 ID 匹配）
#[tauri::command]
pub fn update_config(id: String, config: ConnectionConfig) -> CmdResult<()> {
    store::update(&id, config).map_err(AppError::Internal)
}

/// 加载所有已保存的连接配置
#[tauri::command]
pub fn load_configs() -> CmdResult<Vec<ConnectionConfig>> {
    Ok(store::load())
}

/// 按名称删除连接配置
#[tauri::command]
pub fn delete_config(name: String) -> CmdResult<()> {
    store::remove_by_name(&name).map_err(AppError::Internal)
}

/// 按 ID 删除连接配置
#[tauri::command]
pub fn delete_config_by_id(id: String) -> CmdResult<()> {
    store::remove_by_id(&id).map_err(AppError::Internal)
}
