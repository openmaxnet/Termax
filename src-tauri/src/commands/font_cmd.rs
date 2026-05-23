use serde::Serialize;

use crate::error::{AppError, CmdResult};

/// 字体信息
#[derive(Debug, Clone, Serialize)]
pub struct FontInfo {
    pub family: String,
    pub full_name: String,
}

/// 检测系统已安装字体列表（通过 font-kit 枚举所有 family，不做过滤）
#[tauri::command]
pub async fn detect_fonts() -> CmdResult<Vec<FontInfo>> {
    use font_kit::source::SystemSource;

    let source = SystemSource::new();
    let families = source
        .all_families()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let fonts = families
        .into_iter()
        .map(|family| FontInfo {
            family: family.clone(),
            full_name: family,
        })
        .collect();

    Ok(fonts)
}
