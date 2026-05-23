use std::collections::HashMap;
use std::sync::Mutex;

use uuid::Uuid;

use crate::error::{AppError, CmdResult};
use crate::ssh::channel::{SessionCmd, SessionHandle};
use crate::ssh::client::spawn_session;
use crate::ssh::config::ConnectionConfig;

/// 应用共享状态：管理所有 SSH 会话的句柄映射
pub struct AppState {
    pub sessions: Mutex<HashMap<String, SessionHandle>>,
}

/// 建立 SSH 远程连接，返回新生成的会话 ID
///
/// 前端触发场景：用户点击连接按钮或通过快速面板发起 SSH 连接。
/// 参数 config 包含主机、端口、用户名和认证方式。
#[tauri::command]
pub async fn connect_ssh(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    config: ConnectionConfig,
) -> CmdResult<String> {
    let session_id = Uuid::new_v4().to_string();

    let cmd_tx = spawn_session(app_handle, session_id.clone(), config)
        .map_err(|e| AppError::SshError(e))?;

    let handle = SessionHandle { cmd_tx };

    state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .insert(session_id.clone(), handle);

    Ok(session_id)
}

/// 断开指定会话的 SSH 连接，清理服务端会话资源
///
/// 前端触发场景：用户关闭标签页或点击断开按钮。
/// 通过向会话任务发送 Close 指令来安全关闭。
#[tauri::command]
pub async fn disconnect_ssh(
    state: tauri::State<'_, AppState>,
    id: String,
) -> CmdResult<()> {
    let handle = state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .remove(&id);

    if let Some(h) = handle {
        let _ = h.cmd_tx.send(SessionCmd::Close);
    }

    Ok(())
}

/// 向 SSH 会话发送用户终端输入数据
///
/// 前端触发场景：用户在终端中键入字符时，
/// xterm.js 的 onData 回调将编码后的字节数组传入。
#[tauri::command]
pub async fn send_ssh_input(
    state: tauri::State<'_, AppState>,
    id: String,
    data: Vec<u8>,
) -> CmdResult<()> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let handle = sessions.get(&id).ok_or(AppError::SessionNotFound(id))?;

    handle
        .cmd_tx
        .send(SessionCmd::Input(data))
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// 调整 SSH 终端窗口尺寸，通知服务端更新 PTY 行列数
///
/// 前端触发场景：终端容器 resize（窗口缩放、分屏拖拽等）。
#[tauri::command]
pub async fn resize_terminal(
    state: tauri::State<'_, AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> CmdResult<()> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let handle = sessions.get(&id).ok_or(AppError::SessionNotFound(id))?;

    handle
        .cmd_tx
        .send(SessionCmd::Resize { cols, rows })
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// 测试 SSH 连接是否可达（含认证），返回中文结果消息
///
/// 前端触发场景：连接管理器中点击"测试连接"按钮。
/// 实际逻辑委托给 ssh/client.rs::test_connection。
#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> CmdResult<String> {
    crate::ssh::client::test_connection(&config).await
}
