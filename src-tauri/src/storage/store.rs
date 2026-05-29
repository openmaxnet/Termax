//! 连接配置持久化存储层
//! 使用 SQLite 数据库替代原有的 configs.json 文件，支持事务性读写。

use crate::ssh::config::ConnectionConfig;
use crate::storage::db;

/// 加载所有连接配置
pub fn load() -> Vec<ConnectionConfig> {
    let conn = match db::get_connection() {
        Ok(c) => c,
        Err(e) => {
            log::error!("[store] 数据库连接失败: {}", e);
            return Vec::new();
        }
    };
    let mut stmt = match conn.prepare("SELECT data FROM configs") {
        Ok(s) => s,
        Err(e) => {
            log::error!("[store] 查询失败: {}", e);
            return Vec::new();
        }
    };
    let rows = match stmt.query_map([], |row| row.get::<_, String>(0)) {
        Ok(r) => r,
        Err(e) => {
            log::error!("[store] 查询迭代失败: {}", e);
            return Vec::new();
        }
    };
    rows.filter_map(|r| r.ok())
        .filter_map(|data| serde_json::from_str::<ConnectionConfig>(&data).ok())
        .collect()
}

/// 保存所有连接配置（事务内全量替换）
pub fn save(all: &[ConnectionConfig]) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| format!("事务开始失败: {}", e))?;

    let result = (|| {
        conn.execute("DELETE FROM configs", [])
            .map_err(|e| format!("清空失败: {}", e))?;
        let now = now_timestamp();
        for config in all {
            let data =
                serde_json::to_string(config).map_err(|e| format!("序列化失败: {}", e))?;
            conn.execute(
                "INSERT INTO configs (id, name, host, username, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![config.id, config.name, config.host, config.username, data, now, now],
            )
            .map_err(|e| format!("插入失败: {}", e))?;
        }
        Ok(())
    })();

    match result {
        Ok(()) => conn.execute_batch("COMMIT").map_err(|e| format!("提交失败: {}", e))?,
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }
    Ok(())
}

/// 添加单个连接配置
pub fn add(config: ConnectionConfig) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;
    let now = now_timestamp();
    let data = serde_json::to_string(&config).map_err(|e| format!("序列化失败: {}", e))?;
    conn.execute(
        "INSERT INTO configs (id, name, host, username, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![config.id, config.name, config.host, config.username, data, now, now],
    )
    .map_err(|e| format!("插入失败: {}", e))?;
    Ok(())
}

/// 按 ID 更新已有配置
pub fn update(id: &str, config: ConnectionConfig) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;
    let now = now_timestamp();
    let data = serde_json::to_string(&config).map_err(|e| format!("序列化失败: {}", e))?;
    let affected = conn
        .execute(
            "UPDATE configs SET name=?1, host=?2, username=?3, data=?4, updated_at=?5 WHERE id=?6",
            rusqlite::params![config.name, config.host, config.username, data, now, id],
        )
        .map_err(|e| format!("更新失败: {}", e))?;
    if affected == 0 {
        return Err(format!("Config with id '{}' not found", id));
    }
    Ok(())
}

/// 按 ID 删除配置
pub fn remove_by_id(id: &str) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;
    let affected = conn
        .execute("DELETE FROM configs WHERE id=?1", rusqlite::params![id])
        .map_err(|e| format!("删除失败: {}", e))?;
    if affected == 0 {
        return Err(format!("Config with id '{}' not found", id));
    }
    Ok(())
}

/// 按名称删除配置
pub fn remove_by_name(name: &str) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;
    conn.execute("DELETE FROM configs WHERE name=?1", rusqlite::params![name])
        .map_err(|e| format!("删除失败: {}", e))?;
    Ok(())
}

fn now_timestamp() -> String {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
