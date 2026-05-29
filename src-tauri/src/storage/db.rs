//! SQLite 数据库核心模块
//! 统一管理所有本地持久化数据，替代原有的多 JSON 文件方案。
//! 启动时自动检测并迁移旧版本数据，支持增量 schema 升级。

use std::path::PathBuf;
use std::sync::{LazyLock, Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::AppError;

/// 数据库文件名
const DB_FILE: &str = "termax.db";
/// 当前 schema 版本，与 schema_version 表中的 version 对比
const CURRENT_SCHEMA_VERSION: i32 = 1;

/// 全局数据库连接（WAL 模式，支持并发读）
static DB: LazyLock<Mutex<Connection>> =
    LazyLock::new(|| Mutex::new(Connection::open_in_memory().unwrap()));

/// 返回数据库文件完整路径
fn db_path() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Termax");
    std::fs::create_dir_all(&dir).ok();
    dir.join(DB_FILE)
}

/// 返回旧数据目录路径
fn data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("Termax")
}

/// 初始化数据库：创建表、执行迁移、从旧 JSON 文件导入数据
pub fn init_db() -> Result<(), AppError> {
    let path = db_path();
    let db_exists = path.exists();

    let conn = Connection::open(&path)
        .map_err(|e| AppError::CryptoError(format!("数据库打开失败: {}", e)))?;

    // 启用 WAL 模式提升并发性能
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| AppError::CryptoError(format!("数据库配置失败: {}", e)))?;

    if !db_exists {
        // 全新安装：创建表结构 + 初始化密钥
        log::info!("[db] 全新安装，创建数据库表结构");
        create_tables(&conn)?;
        init_encryption_key(&conn)?;
        set_schema_version(&conn, CURRENT_SCHEMA_VERSION)?;
    } else {
        // 数据库已存在，检查是否需要从旧 JSON 文件迁移
        if old_files_exist() {
            log::info!("[db] 检测到旧版本 JSON 文件，开始迁移");
            create_tables(&conn)?;
            migrate_from_json_files(&conn)?;
            set_schema_version(&conn, CURRENT_SCHEMA_VERSION)?;
        } else {
            // 已是 SQLite 版本，检查 schema 升级
            let current = get_schema_version(&conn)?;
            if current < CURRENT_SCHEMA_VERSION {
                log::info!("[db] schema 版本升级 {} → {}", current, CURRENT_SCHEMA_VERSION);
                run_migrations(&conn, current)?;
                set_schema_version(&conn, CURRENT_SCHEMA_VERSION)?;
            }
        }
    }

    // 替换全局连接
    let mut db = DB.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    *db = conn;

    log::info!("[db] 数据库初始化完成 version={}", CURRENT_SCHEMA_VERSION);
    Ok(())
}

/// 获取数据库连接（用于读写操作）
pub fn get_connection() -> Result<MutexGuard<'static, Connection>, AppError> {
    DB.lock().map_err(|e| AppError::Internal(e.to_string()))
}

// ═══ 内部函数 ═══

/// 创建所有表结构
fn create_tables(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS configs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            username TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_configs_name ON configs(name);
        CREATE INDEX IF NOT EXISTS idx_configs_host ON configs(host);

        CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind_type TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials(name);
        CREATE INDEX IF NOT EXISTS idx_credentials_kind ON credentials(kind_type);
        ",
    )
    .map_err(|e| AppError::CryptoError(format!("建表失败: {}", e)))
}

/// 检查是否存在旧 JSON 文件
fn old_files_exist() -> bool {
    data_dir().join("configs.json").exists() || data_dir().join("credentials.json").exists()
}

/// 从旧 JSON 文件迁移数据到 SQLite
fn migrate_from_json_files(conn: &Connection) -> Result<(), AppError> {
    let dir = data_dir();

    // 迁移连接配置
    let configs_path = dir.join("configs.json");
    if configs_path.exists() {
        log::info!("[db] 迁移 configs.json");
        if let Ok(content) = std::fs::read_to_string(&configs_path) {
            if let Ok(configs) =
                serde_json::from_str::<Vec<crate::ssh::config::ConnectionConfig>>(&content)
            {
                let now = now_timestamp();
                for config in &configs {
                    let data = serde_json::to_string(config).unwrap_or_default();
                    conn.execute(
                        "INSERT OR IGNORE INTO configs (id, name, host, username, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![config.id, config.name, config.host, config.username, data, now, now],
                    )
                    .ok();
                }
                log::info!("[db] 已迁移 {} 条连接配置", configs.len());
            }
        }
    }

    // 迁移凭证
    let creds_path = dir.join("credentials.json");
    if creds_path.exists() {
        log::info!("[db] 迁移 credentials.json");
        if let Ok(content) = std::fs::read_to_string(&creds_path) {
            if let Ok(creds) =
                serde_json::from_str::<Vec<crate::ssh::credential::SshCredential>>(&content)
            {
                let now = now_timestamp();
                for cred in &creds {
                    let data = serde_json::to_string(cred).unwrap_or_default();
                    let kind_type = match &cred.kind {
                        crate::ssh::credential::CredentialKind::Key { .. } => "key",
                        crate::ssh::credential::CredentialKind::Password(_) => "password",
                    };
                    conn.execute(
                        "INSERT OR IGNORE INTO credentials (id, name, kind_type, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        rusqlite::params![cred.id, cred.name, kind_type, data, now, now],
                    )
                    .ok();
                }
                log::info!("[db] 已迁移 {} 条凭证", creds.len());
            }
        }
    }

    // 迁移加密密钥
    let key_path = dir.join(".secret_key");
    if key_path.exists() {
        log::info!("[db] 迁移 .secret_key");
        if let Ok(key_bytes) = std::fs::read(&key_path) {
            conn.execute(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('secret_key', ?1)",
                rusqlite::params![key_bytes],
            )
            .ok();
        }
    }

    // 数据迁移成功后清理旧文件
    cleanup_old_files(&dir);

    Ok(())
}

/// 清理旧格式文件
fn cleanup_old_files(dir: &PathBuf) {
    for file in &[
        "configs.json",
        "credentials.json",
        ".secret_key",
        ".credential-migrated",
    ] {
        let path = dir.join(file);
        if path.exists() {
            if let Err(e) = std::fs::remove_file(&path) {
                log::warn!("[db] 无法删除旧文件 {:?}: {}", path, e);
            } else {
                log::info!("[db] 已删除旧文件 {:?}", path);
            }
        }
    }
}

/// 初始化加密密钥（只在全新安装时调用）
fn init_encryption_key(conn: &Connection) -> Result<(), AppError> {
    use rand::RngCore;
    let mut key_bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key_bytes);
    conn.execute(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('secret_key', ?1)",
        rusqlite::params![key_bytes.to_vec()],
    )
    .map_err(|e| AppError::CryptoError(format!("密钥初始化失败: {}", e)))?;
    log::info!("[db] 已生成加密密钥");
    Ok(())
}

/// 读取 schema_version 表，表为空时返回 0
fn get_schema_version(conn: &Connection) -> Result<i32, AppError> {
    let result: Result<i32, _> =
        conn.query_row("SELECT MAX(version) FROM schema_version", [], |row| row.get(0));
    match result {
        Ok(v) => Ok(v),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
        Err(e) => Err(AppError::CryptoError(format!("schema 版本查询失败: {}", e))),
    }
}

/// 写入 schema 版本
fn set_schema_version(conn: &Connection, version: i32) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO schema_version (version) VALUES (?1)",
        rusqlite::params![version],
    )
    .map_err(|e| AppError::CryptoError(format!("schema 版本写入失败: {}", e)))?;
    Ok(())
}

/// 执行增量 schema 迁移
fn run_migrations(conn: &Connection, _current_version: i32) -> Result<(), AppError> {
    // 当前为 v1，暂无增量迁移。后续版本升级在此添加：
    // if current_version < 2 {
    //     conn.execute_batch("ALTER TABLE configs ADD COLUMN ...")?;
    // }
    let _ = conn;
    Ok(())
}

/// 获取 UNIX 时间戳字符串
fn now_timestamp() -> String {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
