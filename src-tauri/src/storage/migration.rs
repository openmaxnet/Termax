//! 凭证自动迁移
//! 启动时将现有内嵌密钥的连接配置迁移到凭证管理器。
//! 幂等操作：通过检查配置中是否还存在 AuthMethod::Key 来判断是否需要迁移。

use std::collections::HashMap;

use crate::ssh::config::AuthMethod;
use crate::ssh::credential::{CredentialKind, SshCredential};
use crate::storage::{credential_store, crypto, store};

/// 执行一次性凭证迁移
/// 将连接配置中内嵌的密钥提取为独立凭证，并将 auth_method 替换为凭证引用
/// 幂等：如果所有配置中都没有 AuthMethod::Key 则跳过
pub fn migrate_credentials() {
    let configs = store::load();
    if configs.is_empty() {
        return;
    }

    // 收集所有唯一的密钥路径及其密码短语
    let mut unique_keys: HashMap<String, Option<String>> = HashMap::new();
    for config in &configs {
        collect_keys(&config.auth_method, &mut unique_keys);
        for bastion in &config.bastion {
            collect_keys(&bastion.auth_method, &mut unique_keys);
        }
    }

    // 无内嵌密钥则跳过
    if unique_keys.is_empty() {
        return;
    }

    log::info!("[migration] 检测到 {} 个内嵌密钥，开始迁移到凭证管理器", unique_keys.len());

    // 为每个唯一路径创建凭证（检查是否已存在同名凭证）
    let mut path_to_cred_id: HashMap<String, String> = HashMap::new();
    let mut credentials = credential_store::load();

    for (path, passphrase) in &unique_keys {
        // 检查该路径是否已有对应凭证
        let existing = credentials.iter().find(|c| {
            if let CredentialKind::Key { name: p, .. } = &c.kind {
                p == path
            } else {
                false
            }
        });

        if let Some(cred) = existing {
            path_to_cred_id.insert(path.clone(), cred.id.clone());
            continue;
        }

        let file_name = std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "key".to_string());

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let cred_id = uuid::Uuid::new_v4().to_string();
        let has_passphrase = passphrase.is_some();

        // 加密密码短语
        let encrypted = if let Some(ref pw) = passphrase {
            if !pw.is_empty() {
                crypto::encrypt(pw).ok()
            } else {
                None
            }
        } else {
            None
        };

        let cred = SshCredential {
            id: cred_id.clone(),
            name: file_name,
            kind: CredentialKind::Key {
                name: path.clone(),
                passphrase_stored: has_passphrase,
            },
            encrypted_secret: encrypted,
            // 迁移时读取私钥文件内容并加密存储
            encrypted_key_content: std::fs::read_to_string(&path)
                .ok()
                .and_then(|content| crypto::encrypt(&content).ok()),
            has_secret: has_passphrase,
            created_at: now,
            updated_at: now,
            tags: vec!["migrated".to_string()],
        };

        credentials.push(cred);
        path_to_cred_id.insert(path.clone(), cred_id);
    }

    // 保存凭证
    if credential_store::save(&credentials).is_err() {
        log::error!("[migration] 凭证保存失败");
        return;
    }

    // 替换连接配置中的 auth_method
    let mut updated_configs = configs;
    let mut changed = false;
    for config in &mut updated_configs {
        if replace_with_credential(&mut config.auth_method, &path_to_cred_id) {
            changed = true;
        }
        for bastion in &mut config.bastion {
            if replace_with_credential(&mut bastion.auth_method, &path_to_cred_id) {
                changed = true;
            }
        }
    }

    if changed {
        if store::save(&updated_configs).is_err() {
            log::error!("[migration] 配置保存失败");
            return;
        }
        log::info!("[migration] 已将 {} 个内嵌密钥迁移为凭证引用", unique_keys.len());
    }
}

/// 从 auth_method 中收集密钥路径
fn collect_keys(auth: &AuthMethod, keys: &mut HashMap<String, Option<String>>) {
    if let AuthMethod::Key { path, passphrase } = auth {
        keys.entry(path.clone())
            .or_insert_with(|| passphrase.clone());
    }
}

/// 将内嵌密钥的 auth_method 替换为凭证引用
fn replace_with_credential(
    auth: &mut AuthMethod,
    path_to_cred_id: &HashMap<String, String>,
) -> bool {
    if let AuthMethod::Key { path, .. } = auth {
        if let Some(cred_id) = path_to_cred_id.get(path) {
            *auth = AuthMethod::Credential(cred_id.clone());
            return true;
        }
    }
    false
}
