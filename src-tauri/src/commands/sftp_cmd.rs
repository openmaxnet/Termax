use tauri::Emitter;

use crate::error::{AppError, CmdResult};
use crate::sftp::client;
use crate::sftp::transfer::TransferRegistry;
use crate::ssh::config::ConnectionConfig;

/// 列出指定远程路径下的文件和目录
#[tauri::command]
pub async fn sftp_list_files(config: ConnectionConfig, path: String) -> CmdResult<Vec<client::FileEntry>> {
    client::list_directory(&config, &path).await
}

/// 读取远程文件内容为字符串（UTF-8）
#[tauri::command]
pub async fn sftp_read_file(config: ConnectionConfig, path: String) -> CmdResult<String> {
    client::read_file(&config, &path).await
}

/// 将字节数组写入远程文件（覆盖写入）
#[tauri::command]
pub async fn sftp_write_file(config: ConnectionConfig, path: String, content: Vec<u8>) -> CmdResult<()> {
    client::write_file(&config, &path, content).await
}

/// 删除远程文件或目录
#[tauri::command]
pub async fn sftp_delete_entry(config: ConnectionConfig, path: String) -> CmdResult<()> {
    client::remove_entry(&config, &path).await
}

/// 重命名远程文件或目录
#[tauri::command]
pub async fn sftp_rename(config: ConnectionConfig, old: String, new: String) -> CmdResult<()> {
    client::rename(&config, &old, &new).await
}

/// 在远程路径创建新目录
#[tauri::command]
pub async fn sftp_create_dir(config: ConnectionConfig, path: String) -> CmdResult<()> {
    client::create_dir(&config, &path).await
}

/// 获取远程路径的状态信息（文件大小、修改时间、权限等）
#[tauri::command]
pub async fn sftp_get_stat(config: ConnectionConfig, path: String) -> CmdResult<client::FileEntry> {
    client::get_stat(&config, &path).await
}

/// 上传本地文件到远程路径
#[tauri::command]
pub async fn sftp_upload_file(config: ConnectionConfig, local: String, remote: String) -> CmdResult<()> {
    client::upload_file(&config, &local, &remote).await
}

/// 下载远程文件到本地路径
#[tauri::command]
pub async fn sftp_download_file(config: ConnectionConfig, remote: String, local: String) -> CmdResult<()> {
    client::download_file(&config, &remote, &local).await
}

/// 下载远程文件到系统下载目录（或指定目录），返回本地保存路径
#[tauri::command]
pub async fn sftp_download_to_downloads(config: ConnectionConfig, remote: String, dir: String) -> CmdResult<String> {
    let base = if dir.is_empty() {
        dirs::download_dir()
            .ok_or_else(|| AppError::Io("无法找到下载目录".into()))?
    } else {
        std::path::PathBuf::from(&dir)
    };
    let filename = remote.rsplit_once('/')
        .map(|(_, f)| f)
        .unwrap_or(&remote);
    let local = base.join(filename);
    client::download_file(&config, &remote, &local.to_string_lossy().as_ref()).await?;
    Ok(local.to_string_lossy().to_string())
}

/// 分块上传文件内容到远程路径，通过 Tauri event 实时上报进度。
///
/// 前端在 doUpload 中生成 transfer_id（UUID），与文件内容一并传入。
/// 命令层创建 mpsc channel 并 spawn forwarder task，将 client 层上报的进度
/// 逐条转发为 `sftp-transfer-progress` Tauri event。前端监听此事件更新进度条。
/// 传输完成后 forwarder 因 tx 被 drop 自动退出，无需显式清理。
#[tauri::command]
pub async fn sftp_upload_chunked(
    app_handle: tauri::AppHandle,
    registry: tauri::State<'_, TransferRegistry>,
    config: ConnectionConfig,
    remote_path: String,
    content: Vec<u8>,
    transfer_id: String,
) -> CmdResult<()> {
    let cancelled = registry.register(transfer_id.clone());
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<client::TransferProgress>();

    let app = app_handle.clone();
    let forwarder = tokio::spawn(async move {
        while let Some(progress) = rx.recv().await {
            let _ = app.emit("sftp-transfer-progress", &progress);
        }
    });

    let result = client::upload_file_content_chunked(&config, &remote_path, content, transfer_id.clone(), tx, cancelled).await;

    registry.unregister(&transfer_id);
    forwarder.await.ok();
    result
}

/// 分块下载远程文件到本地目录，通过 Tauri event 实时上报进度。
///
/// 与 upload_chunked 采用相同的 channel + forwarder 模式，
/// 区别在于返回下载完成后本地文件的完整路径，前端可据此在历史面板中展示保存位置。
/// 下载路径由用户设置中的 downloadPath 决定，默认使用系统的下载目录。
#[tauri::command]
pub async fn sftp_download_chunked(
    app_handle: tauri::AppHandle,
    registry: tauri::State<'_, TransferRegistry>,
    config: ConnectionConfig,
    remote: String,
    dir: String,
    transfer_id: String,
) -> CmdResult<String> {
    let base = if dir.is_empty() {
        dirs::download_dir()
            .ok_or_else(|| AppError::Io("无法找到下载目录".into()))?
    } else {
        std::path::PathBuf::from(&dir)
    };
    let filename = remote.rsplit_once('/')
        .map(|(_, f)| f)
        .unwrap_or(&remote);
    let local = resolve_download_path(&base, filename);
    let cancelled = registry.register(transfer_id.clone());

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<client::TransferProgress>();

    let app = app_handle.clone();
    let forwarder = tokio::spawn(async move {
        while let Some(progress) = rx.recv().await {
            let _ = app.emit("sftp-transfer-progress", &progress);
        }
    });

    let result = client::download_file_with_progress(
        &config, &remote, &local.to_string_lossy(), transfer_id.clone(), tx, cancelled,
    ).await;

    registry.unregister(&transfer_id);
    forwarder.await.ok();
    result?;
    Ok(local.to_string_lossy().to_string())
}

/// 取消正在进行的传输。找到对应的取消标记并触发，
/// 传输循环在下一次块处理时检测到标记后自动退出并清理部分文件。
#[tauri::command]
pub async fn sftp_cancel_transfer(
    registry: tauri::State<'_, TransferRegistry>,
    transfer_id: String,
) -> CmdResult<()> {
    if registry.cancel(&transfer_id) {
        Ok(())
    } else {
        Err(AppError::SessionNotFound(format!("传输 {} 未找到", transfer_id)))
    }
}

/// 确定本地下载路径：如果文件已存在则自动重命名追加 (1) (2) 序号。
/// 例如 `document.pdf` 已存在 → `document(1).pdf` → `document(2).pdf`。
/// 最多尝试 99 个序号，超出则用时间戳兜底防止无限循环。
fn resolve_download_path(dir: &std::path::Path, filename: &str) -> std::path::PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let stem = std::path::Path::new(filename)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let ext = std::path::Path::new(filename)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    for i in 1..100 {
        let renamed = dir.join(format!("{}({}){}", stem, i, ext));
        if !renamed.exists() {
            return renamed;
        }
    }

    // 极端情况：99 个序号全被占用，用时间戳兜底
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    dir.join(format!("{}_{}{}", stem, ts, ext))
}
