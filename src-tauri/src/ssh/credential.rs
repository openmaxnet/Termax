//! SSH 凭证数据模型
//! 集中管理的密钥/密码认证信息，敏感数据通过 AES-256-GCM 本地加密存储

use serde::{Deserialize, Serialize};

/// SSH 凭证：集中管理的认证信息
/// 敏感数据（密码短语、密码）AES-256-GCM 加密后存入 encrypted_secret 字段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshCredential {
    pub id: String,
    /// 用户可读名称，如"生产环境跳板机密钥"
    pub name: String,
    /// 凭证类型
    pub kind: CredentialKind,
    /// AES-256-GCM 加密后的敏感数据（密码短语或密码），base64(nonce || ciphertext)
    /// None 表示未保存敏感信息
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encrypted_secret: Option<String>,
    /// 是否已保存敏感信息（用于前端判断状态）
    #[serde(default)]
    pub has_secret: bool,
    /// 创建时间（毫秒时间戳）
    #[serde(default)]
    pub created_at: u64,
    /// 更新时间（毫秒时间戳）
    #[serde(default)]
    pub updated_at: u64,
    /// 分类标签
    #[serde(default)]
    pub tags: Vec<String>,
}

/// 凭证类型：密钥认证或密码认证
/// 密码短语和密码的实际值通过 AES-256-GCM 加密后存储在 encrypted_secret 中
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CredentialKind {
    /// SSH 密钥认证
    Key {
        /// 私钥文件路径
        path: String,
        /// 是否已保存密码短语
        passphrase_stored: bool,
    },
    /// 密码认证，内部 String 为占位值（实际密码存在 encrypted_secret 中）
    Password(String),
}
