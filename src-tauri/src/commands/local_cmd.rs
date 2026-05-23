use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::Emitter;
use uuid::Uuid;

use crate::error::{AppError, CmdResult};
use crate::local::pty::{spawn_local_pty, LocalSessionCmd, LocalSessionHandle, ShellInfo};
use crate::local::pty;
use crate::local::wsl;

/// 本地文件条目
#[derive(Debug, Clone, Serialize)]
pub struct LocalFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub mtime: u64,
    pub permissions: u32,
}

/// 本地终端共享状态：管理所有本地 PTY 会话的句柄映射
pub struct LocalAppState {
    pub sessions: Mutex<HashMap<String, LocalSessionHandle>>,
}

/// 建立本地终端 PTY 会话，返回新生成的会话 ID
///
/// 前端触发场景：用户在快速面板中点击"本地终端"按钮。
/// 通过 portable-pty 启动本地 shell 进程，通过 mpsc channel 接收输入。
#[tauri::command]
pub async fn connect_local(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, LocalAppState>,
    shell_path: String,
) -> CmdResult<String> {
    let session_id = Uuid::new_v4().to_string();
    let sid = session_id.clone();

    let cmd_tx = spawn_local_pty(&shell_path, move |data| {
        let _ = app_handle.emit("term-output", serde_json::json!({
            "sessionId": &sid,
            "data": data,
        }));
    })
    .map_err(|e| AppError::Internal(format!("PTY 启动失败: {}", e)))?;

    let handle = LocalSessionHandle { cmd_tx };

    state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .insert(session_id.clone(), handle);

    Ok(session_id)
}

/// 检测系统已安装的可用 shell 列表
///
/// 前端触发场景：设置面板中加载本地 shell 下拉选项。
#[tauri::command]
pub fn detect_shells_list() -> CmdResult<Vec<ShellInfo>> {
    Ok(pty::detect_shells())
}

/// 断开本地终端 PTY 会话，关闭 shell 进程
///
/// 前端触发场景：用户关闭本地终端标签页。
#[tauri::command]
pub async fn disconnect_local(
    state: tauri::State<'_, LocalAppState>,
    id: String,
) -> CmdResult<()> {
    let handle = state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .remove(&id);

    if let Some(h) = handle {
        let _ = h.cmd_tx.send(LocalSessionCmd::Close);
    }

    Ok(())
}

/// 向本地终端 PTY 发送用户输入数据
#[tauri::command]
pub async fn send_local_input(
    state: tauri::State<'_, LocalAppState>,
    id: String,
    data: Vec<u8>,
) -> CmdResult<()> {
    let sessions = state.sessions.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let handle = sessions.get(&id).ok_or(AppError::SessionNotFound(id))?;
    handle
        .cmd_tx
        .send(LocalSessionCmd::Input(data))
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// 调整本地终端 PTY 窗口尺寸
#[tauri::command]
pub async fn resize_local(
    state: tauri::State<'_, LocalAppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> CmdResult<()> {
    let sessions = state.sessions.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    let handle = sessions.get(&id).ok_or(AppError::SessionNotFound(id))?;
    handle
        .cmd_tx
        .send(LocalSessionCmd::Resize { cols, rows })
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// 检测已安装的 WSL 发行版列表
///
/// 非 Windows 平台返回空列表。
#[tauri::command]
pub fn detect_wsl_distros() -> CmdResult<Vec<wsl::WslDistro>> {
    Ok(wsl::detect_distros())
}

/// 列出本地文件系统中的目录内容
///
/// path 为空或 "/" 时在 Windows 上返回可用盘符列表，在 Linux/macOS 上返回根目录。
/// show_hidden 控制是否显示以 . 开头的隐藏文件。
#[tauri::command]
pub fn local_list_files(path: String, show_hidden: bool) -> CmdResult<Vec<LocalFileEntry>> {
    let mut entries: Vec<LocalFileEntry> = Vec::new();

    // 空路径或根路径 → 列出盘符（Windows）或根目录（Linux/macOS）
    let effective = if path.is_empty() || path == "/" {
        #[cfg(target_os = "windows")]
        {
            // 返回 Windows 可用盘符
            for letter in b'A'..=b'Z' {
                let drive = format!("{}:\\", letter as char);
                if std::path::Path::new(&drive).exists() {
                    entries.push(LocalFileEntry {
                        name: format!("{}:", letter as char),
                        path: format!("{}:/", letter as char),
                        is_dir: true,
                        size: 0,
                        mtime: 0,
                        permissions: 0,
                    });
                }
            }
            return Ok(entries);
        }
        #[cfg(not(target_os = "windows"))]
        {
            "/".to_string()
        }
    } else {
        path
    };

    if !effective.is_empty() && effective != "/" || cfg!(not(target_os = "windows")) {
        let dir = std::fs::read_dir(&effective).map_err(|e| AppError::Io(e.to_string()))?;
        for entry in dir {
            let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
            let metadata = entry.metadata().map_err(|e| AppError::Io(e.to_string()))?;
            let name = entry.file_name().to_string_lossy().to_string();
            // 隐藏文件过滤：Unix 以 . 开头，Windows 系统目录
            if !show_hidden {
                if name.starts_with('.') { continue; }
                // Windows 系统隐藏目录（即使文件属性非隐藏也需过滤）
                let lower = name.to_lowercase();
                if lower == "$recycle.bin" || lower == "system volume information" { continue; }
            }
            entries.push(LocalFileEntry {
                name,
                path: entry.path().to_string_lossy().to_string().replace('\\', "/"),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                mtime: metadata.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0),
                permissions: 0,
            });
        }
    }

    // 排序：目录在前，按名称排序
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(entries)
}

/// 连接到指定 WSL 发行版
///
/// 通过 portable-pty 启动 `wsl.exe -d <distro>` 作为子进程，
/// 返回会话 ID，复用 LocalAppState 管理。
#[tauri::command]
pub async fn connect_wsl(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, LocalAppState>,
    distro: String,
) -> CmdResult<String> {
    let session_id = Uuid::new_v4().to_string();
    let sid = session_id.clone();

    let cmd_tx = wsl::spawn_wsl(&distro, move |data| {
        let _ = app_handle.emit("term-output", serde_json::json!({
            "sessionId": &sid,
            "data": data,
        }));
    })
    .map_err(|e| AppError::Internal(format!("WSL 启动失败: {}", e)))?;

    let handle = LocalSessionHandle { cmd_tx };

    state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .insert(session_id.clone(), handle);

    Ok(session_id)
}
