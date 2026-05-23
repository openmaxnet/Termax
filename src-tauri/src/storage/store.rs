use std::path::PathBuf;

use crate::ssh::config::ConnectionConfig;

/// 连接配置文件名
const CONFIG_FILE: &str = "configs.json";

/// 返回配置目录路径（<data_dir>/Termax/），不存在则创建
fn config_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Termax");
    std::fs::create_dir_all(&dir).ok();
    dir
}

/// 返回配置文件完整路径
fn config_path() -> PathBuf {
    config_dir().join(CONFIG_FILE)
}

/// 从 JSON 文件加载所有连接配置，文件不存在时返回空列表
pub fn load() -> Vec<ConnectionConfig> {
    let path = config_path();
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&content).unwrap_or_default()
}

/// 将全部连接配置写入 JSON 文件
pub fn save(configs: &[ConnectionConfig]) -> Result<(), String> {
    let path = config_path();
    let content =
        serde_json::to_string_pretty(configs).map_err(|e| format!("Serialize error: {}", e))?;
    std::fs::write(&path, content).map_err(|e| format!("Write error: {}", e))
}

/// 添加新配置到列表末尾并保存
pub fn add(config: ConnectionConfig) -> Result<(), String> {
    let mut configs = load();
    configs.push(config);
    save(&configs)
}

/// 按 ID 更新已有配置，未找到时返回错误
pub fn update(id: &str, config: ConnectionConfig) -> Result<(), String> {
    let mut configs = load();
    if let Some(existing) = configs.iter_mut().find(|c| c.id == id) {
        *existing = config;
        save(&configs)
    } else {
        Err(format!("Config with id '{}' not found", id))
    }
}

/// 按 ID 删除配置，未找到时返回错误
pub fn remove_by_id(id: &str) -> Result<(), String> {
    let mut configs = load();
    let before = configs.len();
    configs.retain(|c| c.id != id);
    if configs.len() < before {
        save(&configs)
    } else {
        Err(format!("Config with id '{}' not found", id))
    }
}

/// 按名称删除所有匹配的配置并保存
pub fn remove_by_name(name: &str) -> Result<(), String> {
    let mut configs = load();
    configs.retain(|c| c.name != name);
    save(&configs)
}
