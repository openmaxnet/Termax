use crate::error::CmdResult;
use crate::sftp::editor::{self, EditSessionInfo};
use crate::ssh::config::ConnectionConfig;

/// 开始远程编辑：下载文件到临时目录，用本地编辑器打开，并启动文件监听
///
/// 前端触发场景：用户在 SFTP 文件浏览器中右键选择"编辑"。
/// 返回编辑会话 ID，用于后续停止编辑或查询状态。
#[tauri::command]
pub async fn sftp_start_edit(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, crate::sftp::editor::EditState>,
    config: ConnectionConfig,
    remote_path: String,
    editor_command: Option<String>,
) -> CmdResult<String> {
    editor::start_edit(app_handle, state, config, remote_path, editor_command).await
}

/// 停止远程编辑会话，不再监听文件变更
#[tauri::command]
pub async fn sftp_stop_edit(
    state: tauri::State<'_, crate::sftp::editor::EditState>,
    session_id: String,
) -> CmdResult<()> {
    editor::stop_edit(state, session_id).await
}

/// 列出所有活跃的远程编辑会话
#[tauri::command]
pub async fn sftp_list_edits(
    state: tauri::State<'_, crate::sftp::editor::EditState>,
) -> CmdResult<Vec<EditSessionInfo>> {
    editor::list_edits(state).await
}
