use serde::{Deserialize, Serialize};

/// 远程连接配置（与前端 `ConnectionConfig` 接口对应）
///
/// 包含主机、端口、用户名和认证方式，是前后端共享的核心契约类型。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub group: Option<String>,
    /// 跳板机链，按顺序连接。空列表=直连，多台=多级跳板（ProxyJump）
    #[serde(default)]
    pub bastion: Vec<BastionConfig>,
    /// 代理配置（可选），设置后 SSH 连接通过 HTTP/SOCKS5 代理建立
    pub proxy: Option<ProxyConfig>,
}

/// 跳板机配置：复用 AuthMethod 实现密码/密钥认证
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BastionConfig {
    /// 跳板机名称，用于前端列表展示和去重。兼容旧配置（默认空字符串）
    #[serde(default)]
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
}

/// 代理类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyType {
    Http,
    Socks5,
}

/// SSH 代理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub proxy_type: ProxyType,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// SSH 认证方式：密码认证、密钥认证或引用凭证管理器中的凭证
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthMethod {
    Password(String),
    Key {
        path: String,
        passphrase: Option<String>,
    },
    /// 通过凭证 ID 引用已保存的凭证
    Credential(String),
}

/// 端口转发方向
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ForwardDirection {
    Local,
    Remote,
    Dynamic,
}

/// 端口转发规则：定义一条端口转发的来源和去向
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForwardRule {
    pub description: String,
    pub direction: ForwardDirection,
    /// 本地监听地址（如 "127.0.0.1"）
    pub listen_host: String,
    /// 本地监听端口
    pub listen_port: u16,
    /// 目标主机（如 "internal-db.example.com"）
    pub target_host: String,
    /// 目标端口
    pub target_port: u16,
}
