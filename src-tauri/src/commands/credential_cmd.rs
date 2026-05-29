//! 凭证管理 IPC 命令
//! 提供凭证的 CRUD 和引用检查功能，敏感数据通过 AES-256-GCM 本地加密存储

use crate::error::{AppError, CmdResult};
use crate::ssh::credential::SshCredential;
use crate::storage::{credential_store, crypto};

/// 列出所有凭证（不含敏感信息明文）
#[tauri::command]
pub fn list_credentials() -> CmdResult<Vec<SshCredential>> {
    Ok(credential_store::load())
}

/// 保存新凭证，secret（密码短语或密码）加密后存入凭证
#[tauri::command]
pub fn save_credential(mut credential: SshCredential, secret: Option<String>) -> CmdResult<()> {
    if let Some(ref s) = secret {
        if !s.is_empty() {
            credential.encrypted_secret = Some(crypto::encrypt(s)?);
            credential.has_secret = true;
        }
    }
    credential_store::add(credential).map_err(AppError::Internal)
}

/// 更新已有凭证，secret 为 None 时保持原加密值；空字符串清除加密值
#[tauri::command]
pub fn update_credential(
    id: String,
    mut credential: SshCredential,
    secret: Option<String>,
) -> CmdResult<()> {
    if let Some(ref s) = secret {
        if s.is_empty() {
            // 空字符串表示清除敏感信息
            credential.encrypted_secret = None;
            credential.has_secret = false;
        } else {
            credential.encrypted_secret = Some(crypto::encrypt(s)?);
            credential.has_secret = true;
        }
    }
    // secret 为 None 时保持原 encrypted_secret 不变
    credential_store::update(&id, credential).map_err(AppError::Internal)
}

/// 删除凭证
#[tauri::command]
pub fn delete_credential(id: String) -> CmdResult<()> {
    credential_store::remove_by_id(&id).map_err(AppError::Internal)
}

/// 获取凭证的敏感信息明文（编辑时使用）
#[tauri::command]
pub fn get_credential_secret(id: String) -> CmdResult<Option<String>> {
    let creds = credential_store::load();
    let cred = creds
        .iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::CredentialNotFound(id))?;

    match &cred.encrypted_secret {
        Some(enc) => {
            let secret = crypto::decrypt(enc)?;
            if secret.is_empty() {
                Ok(None)
            } else {
                Ok(Some(secret))
            }
        }
        None => Ok(None),
    }
}

/// 检查凭证被哪些连接配置引用，返回配置名称列表
#[tauri::command]
pub fn check_credential_usage(id: String) -> CmdResult<Vec<String>> {
    Ok(credential_store::check_usage(&id))
}

/// 打开原生文件选择器选取文件，返回选中文件的绝对路径
#[tauri::command]
pub fn pick_file() -> Option<String> {
    rfd::FileDialog::new()
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}
