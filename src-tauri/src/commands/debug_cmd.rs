//! 调试工具 IPC 命令

use crate::error::{AppError, CmdResult};

/// 生成默认日志文件名（含时间戳）
fn default_filename() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("termax-debug-{}.json", secs)
}

/// 打开原生"另存为"对话框，将内容写入用户选择的文件
#[tauri::command]
pub fn save_log_file(content: String) -> CmdResult<String> {
    let path = rfd::FileDialog::new()
        .set_title("导出调试日志")
        .set_file_name(default_filename())
        .add_filter("JSON", &["json"])
        .add_filter("Text", &["txt", "log"])
        .save_file()
        .ok_or_else(|| AppError::Internal("用户取消了保存".into()))?;

    std::fs::write(&path, &content)
        .map_err(|e| AppError::Io(format!("日志文件写入失败: {}", e)))?;

    let file_path = path.to_string_lossy().to_string();
    log::info!("[debug] 日志已导出: {}", file_path);
    Ok(file_path)
}
