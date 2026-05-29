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

/// 保存新凭证
/// - `secret`: 密码短语或密码，加密后存入 encrypted_secret
/// - `key_content`: 私钥文件内容（PEM），加密后存入 encrypted_key_content
#[tauri::command]
pub fn save_credential(
    mut credential: SshCredential,
    secret: Option<String>,
    key_content: Option<String>,
) -> CmdResult<()> {
    // 加密密码短语或密码
    if let Some(ref s) = secret {
        if !s.is_empty() {
            credential.encrypted_secret = Some(crypto::encrypt(s)?);
            credential.has_secret = true;
        }
    }
    // 加密私钥内容（仅密钥类型）
    if let Some(ref content) = key_content {
        if !content.is_empty() {
            credential.encrypted_key_content = Some(crypto::encrypt(content)?);
        }
    }
    credential_store::add(credential).map_err(AppError::Internal)
}

/// 更新已有凭证
/// - `secret` 为 None 时保持原加密值；空字符串清除加密值
/// - `key_content` 为 None 时保持原值；空字符串清除
#[tauri::command]
pub fn update_credential(
    id: String,
    mut credential: SshCredential,
    secret: Option<String>,
    key_content: Option<String>,
) -> CmdResult<()> {
    // 处理密码短语/密码
    if let Some(ref s) = secret {
        if s.is_empty() {
            credential.encrypted_secret = None;
            credential.has_secret = false;
        } else {
            credential.encrypted_secret = Some(crypto::encrypt(s)?);
            credential.has_secret = true;
        }
    }
    // 处理私钥内容
    if let Some(ref content) = key_content {
        if content.is_empty() {
            credential.encrypted_key_content = None;
        } else {
            credential.encrypted_key_content = Some(crypto::encrypt(content)?);
        }
    }
    // secret/key_content 为 None 时保持原 encrypted_* 不变
    credential_store::update(&id, credential).map_err(AppError::Internal)
}

/// 删除凭证
#[tauri::command]
pub fn delete_credential(id: String) -> CmdResult<()> {
    credential_store::remove_by_id(&id).map_err(AppError::Internal)
}

/// 获取凭证的敏感信息明文（编辑时使用）
/// 对于密钥类型，同时返回解密后的私钥内容
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

/// 打开原生文件选择器选取私钥文件，返回 (文件名, 文件内容)
/// 用户选择后立即读取私钥内容，后续加密存储到数据库
#[tauri::command]
pub fn pick_key_file() -> CmdResult<Option<(String, String)>> {
    let path = rfd::FileDialog::new()
        .add_filter("Private Key", &["pem", "key", "id_rsa", "id_ed25519", "id_ecdsa", ""])
        .set_title("选择私钥文件")
        .pick_file();

    match path {
        Some(p) => {
            let content = std::fs::read_to_string(&p)
                .map_err(|e| AppError::Io(format!("读取密钥文件失败: {}", e)))?;
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            Ok(Some((name, content)))
        }
        None => Ok(None),
    }
}

/// 打开原生文件选择器选取任意文件，返回绝对路径（兼容旧调用）
#[tauri::command]
pub fn pick_file() -> Option<String> {
    rfd::FileDialog::new()
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}
