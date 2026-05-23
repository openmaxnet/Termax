//! 端口转发 Tauri 命令
//!
//! 管理端口转发的生命周期：启动（注册 + spawn）、停止（发取消信号）、列表查询。
//! 每个转发使用独立的 SSH 连接，取消时通过 watch channel 通知转发任务退出。

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tokio::sync::watch;

use crate::error::{AppError, CmdResult};
use crate::ssh::config::{ConnectionConfig, ForwardDirection, PortForwardRule};

/// 活跃转发的状态信息（返回给前端展示）
#[derive(Debug, Clone, Serialize)]
pub struct ForwardInfo {
    pub id: String,
    pub description: String,
    pub listen: String,
    pub target: String,
    pub status: String,
}

/// 单条转发的 Handle：持有取消信号的发送端
pub struct ForwardHandle {
    pub cancel_tx: watch::Sender<bool>,
}

/// 转发状态注册表（Tauri 管理）
pub struct PortForwardState {
    pub forwards: Mutex<HashMap<String, ForwardHandle>>,
}

impl PortForwardState {
    pub fn new() -> Self {
        Self {
            forwards: Mutex::new(HashMap::new()),
        }
    }
}

/// 启动本地端口转发
///
/// 连接到远程服务器，在本地监听指定端口，将入站流量通过 SSH 隧道转发到目标地址。
/// 返回该转发的唯一 ID，可用于停止或查询状态。
#[tauri::command]
pub async fn start_port_forward(
    state: tauri::State<'_, PortForwardState>,
    config: ConnectionConfig,
    rule: PortForwardRule,
) -> CmdResult<String> {
    let forward_id = uuid::Uuid::new_v4().to_string();
    let (cancel_tx, cancel_rx) = watch::channel(false);

    // 注册到状态表
    state.forwards.lock().unwrap().insert(forward_id.clone(), ForwardHandle { cancel_tx });

    // 根据方向选择转发模式
    let fid = forward_id.clone();
    tokio::spawn(async move {
        let result = match rule.direction {
            ForwardDirection::Dynamic => {
                crate::ssh::forward::spawn_dynamic_forward(&config, rule, cancel_rx).await
            }
            _ => {
                crate::ssh::forward::spawn_local_forward(&config, rule, cancel_rx).await
            }
        };
        if let Err(e) = result {
            log::error!("转发 {} 已停止: {}", fid, e);
        }
    });

    Ok(forward_id)
}

/// 停止端口转发
///
/// 发送取消信号，转发任务在 accept 循环中收到后退出并释放端口。
#[tauri::command]
pub async fn stop_port_forward(
    state: tauri::State<'_, PortForwardState>,
    forward_id: String,
) -> CmdResult<()> {
    let mut map = state.forwards.lock().unwrap();
    match map.remove(&forward_id) {
        Some(handle) => {
            // 发取消信号，转发任务的 tokio::select! 会收到并退出
            let _ = handle.cancel_tx.send(true);
            Ok(())
        }
        None => Err(AppError::SessionNotFound(format!("转发 {} 未找到", forward_id))),
    }
}

/// 列出所有活跃端口转发
#[tauri::command]
pub async fn list_port_forwards(
    state: tauri::State<'_, PortForwardState>,
) -> CmdResult<Vec<ForwardInfo>> {
    let map = state.forwards.lock().unwrap();
    // 当前实现仅存储 ID，返回活跃转发列表（后续可扩展为存储更多信息）
    let list: Vec<ForwardInfo> = map
        .iter()
        .map(|(id, _handle)| ForwardInfo {
            id: id.clone(),
            description: String::new(),
            listen: String::new(),
            target: String::new(),
            status: "活跃".to_string(),
        })
        .collect();
    Ok(list)
}
