use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Config as WatcherConfig, Watcher};
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::error::{AppError, CmdResult};
use crate::sftp::client;
use crate::ssh::config::ConnectionConfig;

// ── Data structures ──

/// 远程编辑会话：记录远程路径、本地缓存路径和文件监听器
pub struct EditSession {
    pub id: String,
    pub remote_path: String,
    pub local_path: PathBuf,
    pub config: ConnectionConfig,
    pub _watcher: RecommendedWatcher,
    pub stop_tx: mpsc::UnboundedSender<()>,
}

/// 编辑会话全局状态：通过 Mutex 管理多会话并发
pub struct EditState {
    pub sessions: Mutex<HashMap<String, EditSession>>,
}

/// 编辑会话摘要信息（序列化传给前端展示）
#[derive(Serialize)]
pub struct EditSessionInfo {
    pub id: String,
    pub remote_path: String,
    pub local_path: String,
    pub file_name: String,
}

// ── Temp dir helpers ──

/// 返回编辑会话的临时文件根目录 (<data_dir>/Termax/sftp-edit)
fn edit_temp_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("Termax").join("sftp-edit")
}

/// 清理主机名字符，确保可用作目录名
fn sanitize_host(host: &str) -> String {
    host.replace(['/', '\\', ':'], "_")
}

/// 生成远程文件对应的本地缓存路径，按 host/session_id 组织目录
fn local_path_for(config: &ConnectionConfig, session_id: &str, remote_path: &str) -> PathBuf {
    let dir = edit_temp_dir()
        .join(sanitize_host(&config.host))
        .join(session_id);
    std::fs::create_dir_all(&dir).ok();
    let filename = remote_path.rsplit('/').next().unwrap_or("file");
    dir.join(filename)
}

/// Clean up all cached edit files. Called on app startup.
/// 使用 std::thread::spawn 避免阻塞主线程
pub fn init() {
    let dir = edit_temp_dir();
    std::thread::spawn(move || {
        if dir.exists() {
            let _ = std::fs::remove_dir_all(&dir);
        }
        std::fs::create_dir_all(&dir).ok();
    });
}

// ── Editor launching ──

/// 使用指定编辑器（或系统默认打开方式）打开本地文件
fn open_in_editor(editor_command: Option<&str>, local_path: &PathBuf) -> Result<(), String> {
    match editor_command {
        Some(cmd) if !cmd.is_empty() => {
            let parts: Vec<&str> = cmd.split_whitespace().collect();
            if parts.is_empty() {
                return open_default(local_path);
            }
            let mut args: Vec<String> = parts[1..].iter().map(|s| s.to_string()).collect();
            args.push(local_path.to_string_lossy().to_string());
            std::process::Command::new(parts[0])
                .args(&args)
                .spawn()
                .map_err(|e| format!("Failed to launch editor '{}': {}", parts[0], e))?;
            Ok(())
        }
        _ => open_default(local_path),
    }
}

/// 使用 OS 默认程序打开文件（Windows 用 start，macOS 用 open，Linux 用 xdg-open）
fn open_default(path: &PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    Ok(())
}

// ── File watching with debounce ──

fn spawn_watcher(
    app_handle: tauri::AppHandle,
    session_id: String,
    local_path: PathBuf,
    remote_path: String,
    config: ConnectionConfig,
) -> Result<(RecommendedWatcher, mpsc::UnboundedSender<()>), String> {
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<()>();
    let (stop_tx, mut stop_rx) = mpsc::unbounded_channel::<()>();

    let watch_path = local_path.clone();
    let sid = session_id.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Any => {
                        let _ = event_tx.send(());
                    }
                    _ => {}
                }
            }
        },
        WatcherConfig::default(),
    )
    .map_err(|e| format!("Watcher init failed: {}", e))?;

    watcher
        .watch(&watch_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Watch failed: {}", e))?;

    let debounce_dur = std::time::Duration::from_millis(500);
    let app_h = app_handle.clone();

    tokio::spawn(async move {
        let mut deadline = tokio::time::Instant::now();
        let mut pending = false;

        loop {
            tokio::select! {
                _ = event_rx.recv() => {
                    pending = true;
                    deadline = tokio::time::Instant::now() + debounce_dur;
                }
                _ = tokio::time::sleep_until(deadline), if pending => {
                    pending = false;
                    match client::upload_file(&config, &local_path.to_string_lossy(), &remote_path).await {
                        Ok(()) => {
                            let _ = app_h.emit(
                                "sftp-edit-uploaded",
                                serde_json::json!({
                                    "sessionId": &sid,
                                    "remotePath": &remote_path,
                                    "success": true,
                                }),
                            );
                        }
                        Err(e) => {
                            let _ = app_h.emit(
                                "sftp-edit-uploaded",
                                serde_json::json!({
                                    "sessionId": &sid,
                                    "remotePath": &remote_path,
                                    "success": false,
                                    "error": e,
                                }),
                            );
                        }
                    }
                }
                _ = stop_rx.recv() => {
                    break;
                }
            }
        }
    });

    Ok((watcher, stop_tx))
}

// ── Public API ──

/// 查找同一主机同一远程文件是否已有活跃编辑会话
fn find_existing_session(
    state: &Mutex<HashMap<String, EditSession>>,
    host: &str,
    remote_path: &str,
) -> Option<String> {
    state
        .lock()
        .ok()?
        .iter()
        .find(|(_, s)| s.config.host == host && s.remote_path == remote_path)
        .map(|(id, _)| id.clone())
}

/// 开始远程编辑：下载文件 → 启动文件监听 → 打开编辑器
///
/// 如果同一文件已有活跃会话，则直接复用并重新打开编辑器。
pub async fn start_edit(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, EditState>,
    config: ConnectionConfig,
    remote_path: String,
    editor_command: Option<String>,
) -> CmdResult<String> {
    let host = config.host.clone();

    // Re-use existing session for the same file
    if let Some(existing_id) = find_existing_session(&state.sessions, &host, &remote_path) {
        let sessions = state.sessions.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        if let Some(session) = sessions.get(&existing_id) {
            let lp = session.local_path.clone();
            let ed = editor_command.as_deref();
            open_in_editor(ed, &lp).map_err(|e| AppError::Internal(e.to_string()))?;
            return Ok(existing_id);
        }
    }

    let session_id = Uuid::new_v4().to_string();
    let local_path = local_path_for(&config, &session_id, &remote_path);

    // Download file
    client::download_file(&config, &remote_path, &local_path.to_string_lossy())
        .await?;

    // Start watcher
    let (watcher, stop_tx) = spawn_watcher(
        app_handle,
        session_id.clone(),
        local_path.clone(),
        remote_path.clone(),
        config.clone(),
    )
    .map_err(AppError::Internal)?;

    // Open editor
    open_in_editor(editor_command.as_deref(), &local_path).map_err(AppError::Internal)?;

    // Store session
    let session = EditSession {
        id: session_id.clone(),
        remote_path,
        local_path,
        config,
        _watcher: watcher,
        stop_tx,
    };

    state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .insert(session_id.clone(), session);

    Ok(session_id)
}

/// 停止远程编辑会话：停止监听、清理临时文件
pub async fn stop_edit(
    state: tauri::State<'_, EditState>,
    session_id: String,
) -> CmdResult<()> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if let Some(session) = sessions.remove(&session_id) {
        let _ = session.stop_tx.send(());
        if let Some(session_dir) = session.local_path.parent() {
            let _ = std::fs::remove_dir_all(session_dir);
        }
    }

    Ok(())
}

/// 列出所有活跃的远程编辑会话信息
pub async fn list_edits(state: tauri::State<'_, EditState>) -> CmdResult<Vec<EditSessionInfo>> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(sessions
        .values()
        .map(|s| EditSessionInfo {
            id: s.id.clone(),
            remote_path: s.remote_path.clone(),
            local_path: s.local_path.to_string_lossy().to_string(),
            file_name: s
                .remote_path
                .rsplit('/')
                .next()
                .unwrap_or("file")
                .to_string(),
        })
        .collect())
}
