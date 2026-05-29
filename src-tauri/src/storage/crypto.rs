//! 本地 AES-256-GCM 加密模块
//! 加密密钥存储在 SQLite app_meta 表中，替代原有的 .secret_key 文件。

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::RngCore;

use crate::error::AppError;
use crate::storage::db;

const NONCE_SIZE: usize = 12;

/// 从 SQLite 读取加密密钥
fn load_key() -> Result<Key<Aes256Gcm>, AppError> {
    let conn = db::get_connection()?;
    let bytes: Vec<u8> = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key='secret_key'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| AppError::CryptoError(format!("密钥读取失败: {}", e)))?;

    if bytes.len() != 32 {
        return Err(AppError::CryptoError("密钥数据已损坏".into()));
    }
    Ok(*Key::<Aes256Gcm>::from_slice(&bytes))
}

/// AES-256-GCM 加密，返回 base64(nonce || ciphertext)
pub fn encrypt(plaintext: &str) -> Result<String, AppError> {
    let key = load_key()?;
    let cipher = Aes256Gcm::new(&key);

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::CryptoError(format!("加密失败: {}", e)))?;

    let mut combined = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

/// AES-256-GCM 解密，输入 base64(nonce || ciphertext)，返回明文
pub fn decrypt(encrypted: &str) -> Result<String, AppError> {
    let key = load_key()?;
    let cipher = Aes256Gcm::new(&key);

    let combined = BASE64
        .decode(encrypted)
        .map_err(|e| AppError::CryptoError(format!("Base64 解码失败: {}", e)))?;

    if combined.len() < NONCE_SIZE + 1 {
        return Err(AppError::CryptoError("加密数据格式错误".into()));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::CryptoError(format!("解密失败: {}", e)))?;

    String::from_utf8(plaintext).map_err(|e| AppError::CryptoError(format!("UTF-8 解码失败: {}", e)))
}
