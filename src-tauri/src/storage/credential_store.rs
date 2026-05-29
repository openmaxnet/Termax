//! 凭证持久化存储层
//! 使用 SQLite 数据库存储凭证元信息，敏感数据通过 AES-256-GCM 加密

use crate::error::AppError;
use crate::ssh::config::AuthMethod;
use crate::ssh::credential::{CredentialKind, SshCredential};
use crate::storage::db;

use super::crypto;

/// 从数据库加载所有凭证
pub fn load() -> Vec<SshCredential> {
    let conn = match db::get_connection() {
        Ok(c) => c,
        Err(e) => {
            log::error!("[credential_store] 数据库连接失败: {}", e);
            return Vec::new();
        }
    };
    let mut stmt = match conn.prepare("SELECT data FROM credentials") {
        Ok(s) => s,
        Err(e) => {
            log::error!("[credential_store] 查询失败: {}", e);
            return Vec::new();
        }
    };
    let rows = match stmt.query_map([], |row| row.get::<_, String>(0)) {
        Ok(r) => r,
        Err(e) => {
            log::error!("[credential_store] 查询迭代失败: {}", e);
            return Vec::new();
        }
    };
    rows.filter_map(|r| r.ok())
        .filter_map(|data| serde_json::from_str::<SshCredential>(&data).ok())
        .collect()
}

/// 将全部凭证写入数据库（事务内全量替换）
pub fn save(credentials: &[SshCredential]) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| format!("事务开始失败: {}", e))?;

    let result = (|| {
        conn.execute("DELETE FROM credentials", [])
            .map_err(|e| format!("清空失败: {}", e))?;
        let now = now_timestamp();
        for cred in credentials {
            let data =
                serde_json::to_string(cred).map_err(|e| format!("序列化失败: {}", e))?;
            let kind_type = match &cred.kind {
                CredentialKind::Key { .. } => "key",
                CredentialKind::Password(_) => "password",
            };
            conn.execute(
                "INSERT INTO credentials (id, name, kind_type, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![cred.id, cred.name, kind_type, data, now, now],
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

/// 添加新凭证并保存
pub fn add(credential: SshCredential) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    let now = now_timestamp();
    let data = serde_json::to_string(&credential).map_err(|e| format!("序列化失败: {}", e))?;
    let kind_type = match &credential.kind {
        CredentialKind::Key { .. } => "key",
        CredentialKind::Password(_) => "password",
    };
    conn.execute(
        "INSERT INTO credentials (id, name, kind_type, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![credential.id, credential.name, kind_type, data, now, now],
    )
    .map_err(|e| format!("插入失败: {}", e))?;
    Ok(())
}

/// 按 ID 更新已有凭证
pub fn update(id: &str, credential: SshCredential) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    let now = now_timestamp();
    let data = serde_json::to_string(&credential).map_err(|e| format!("序列化失败: {}", e))?;
    let kind_type = match &credential.kind {
        CredentialKind::Key { .. } => "key",
        CredentialKind::Password(_) => "password",
    };
    let affected = conn
        .execute(
            "UPDATE credentials SET name=?1, kind_type=?2, data=?3, updated_at=?4 WHERE id=?5",
            rusqlite::params![credential.name, kind_type, data, now, id],
        )
        .map_err(|e| format!("更新失败: {}", e))?;
    if affected == 0 {
        return Err(format!("Credential with id '{}' not found", id));
    }
    Ok(())
}

/// 按 ID 删除凭证
pub fn remove_by_id(id: &str) -> Result<(), String> {
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM credentials WHERE id=?1", rusqlite::params![id])
        .map_err(|e| format!("删除失败: {}", e))?;
    if affected == 0 {
        return Err(format!("Credential with id '{}' not found", id));
    }
    Ok(())
}

/// 按 ID 查找凭证
pub fn find_by_id(id: &str) -> Option<SshCredential> {
    let all = load();
    log::info!(
        "[credential_store] 查找凭证 id={}, 凭证总数={}, 可用ID: {:?}",
        id,
        all.len(),
        all.iter().map(|c| &c.id).collect::<Vec<_>>()
    );
    all.into_iter().find(|c| c.id == id)
}

// ═══ 凭证解析 ═══

/// 解析后的认证信息（不包含 Credential 引用，可直接用于 SSH 连接）
#[derive(Debug, Clone)]
pub enum ResolvedAuth {
    Password(String),
    Key {
        path: String,
        passphrase: Option<String>,
    },
}

/// 将 AuthMethod 解析为可直接使用的认证信息
/// 对 Credential 引用，从凭证存储中加载并解密实际值
pub fn resolve_auth(auth: &AuthMethod) -> Result<ResolvedAuth, AppError> {
    match auth {
        AuthMethod::Password(pw) => Ok(ResolvedAuth::Password(pw.clone())),
        AuthMethod::Key { path, passphrase } => Ok(ResolvedAuth::Key {
            path: path.clone(),
            passphrase: passphrase.clone(),
        }),
        AuthMethod::Credential(id) => {
            log::info!("[credential_store] 解析凭证引用 id={}", id);
            let cred = find_by_id(id).ok_or_else(|| {
                log::error!("[credential_store] 凭证未找到 id={}", id);
                AppError::CredentialNotFound(id.clone())
            })?;
            log::info!(
                "[credential_store] 凭证已找到 name={} kind={:?} has_secret={}",
                cred.name,
                cred.kind,
                cred.has_secret
            );
            resolve_credential(&cred)
        }
    }
}

/// 将 SshCredential 解析为 ResolvedAuth
pub fn resolve_credential(cred: &SshCredential) -> Result<ResolvedAuth, AppError> {
    match &cred.kind {
        CredentialKind::Key {
            path,
            passphrase_stored: _,
        } => {
            let passphrase = match &cred.encrypted_secret {
                Some(enc) => {
                    let pw = crypto::decrypt(enc)?;
                    if pw.is_empty() {
                        None
                    } else {
                        Some(pw)
                    }
                }
                None => None,
            };
            Ok(ResolvedAuth::Key {
                path: path.clone(),
                passphrase,
            })
        }
        CredentialKind::Password(_pw) => {
            let password = match &cred.encrypted_secret {
                Some(enc) => crypto::decrypt(enc)?,
                None => {
                    return Err(AppError::CryptoError("凭证未保存密码".into()));
                }
            };
            Ok(ResolvedAuth::Password(password))
        }
    }
}

// ═══ 引用检查 ═══

/// 检查指定凭证被哪些连接配置引用，返回引用该凭证的配置名称列表
pub fn check_usage(cred_id: &str) -> Vec<String> {
    let configs = crate::storage::store::load();
    let mut used_by = Vec::new();

    for config in &configs {
        if matches!(&config.auth_method, AuthMethod::Credential(id) if id == cred_id) {
            used_by.push(config.name.clone());
            continue;
        }
        for bastion in &config.bastion {
            if matches!(&bastion.auth_method, AuthMethod::Credential(id) if id == cred_id) {
                used_by.push(config.name.clone());
                break;
            }
        }
    }

    used_by
}

fn now_timestamp() -> String {
    use std::time::SystemTime;
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
