//! Termax Tauri 后端入口
//! 组装 Tauri 应用：注册插件、注入状态、注册 IPC 命令。
//! 分层架构：commands/（薄命令层）→ 业务层 → storage/（持久化层）。

mod commands;
mod error;
mod local;
mod monitor;
mod session;
mod sftp;
mod ssh;
mod storage;

use std::collections::HashMap;
use std::sync::Mutex;

use commands::config_cmd::{delete_config, delete_config_by_id, load_configs, save_config, update_config};
use commands::edit_cmd::{sftp_start_edit, sftp_stop_edit, sftp_list_edits};
use commands::sftp_cmd::{sftp_cancel_transfer, sftp_create_dir, sftp_delete_entry, sftp_download_chunked, sftp_download_file, sftp_download_to_downloads, sftp_get_stat, sftp_list_files, sftp_read_file, sftp_rename, sftp_upload_chunked, sftp_upload_file, sftp_write_file};
use commands::local_cmd::LocalAppState;
use commands::font_cmd::detect_fonts;
use commands::local_cmd::{connect_local, connect_wsl, detect_shells_list, detect_wsl_distros, disconnect_local, local_list_files, resize_local, send_local_input};
use commands::monitor_cmd::{monitor_exec, monitor_fetch};
use commands::forward_cmd::{start_port_forward, stop_port_forward, list_port_forwards, PortForwardState};
use commands::ssh_cmd::AppState;
use commands::ssh_cmd::{connect_ssh, disconnect_ssh, resize_terminal, send_ssh_input, test_connection};

/// 启动 Tauri 应用：注册状态、命令处理器和初始化逻辑
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
        })
        .manage(LocalAppState {
            sessions: Mutex::new(HashMap::new()),
        })
        .manage(sftp::editor::EditState {
            sessions: Mutex::new(HashMap::new()),
        })
        .manage(sftp::transfer::TransferRegistry::new())
        .manage(PortForwardState::new())
        .invoke_handler(tauri::generate_handler![
            connect_ssh,
            disconnect_ssh,
            send_ssh_input,
            resize_terminal,
            test_connection,
            connect_local,
            detect_fonts,
            detect_shells_list,
            detect_wsl_distros,
            connect_wsl,
            disconnect_local,
            send_local_input,
            resize_local,
            local_list_files,
            monitor_fetch,
            monitor_exec,
            save_config,
            update_config,
            load_configs,
            delete_config,
            delete_config_by_id,
            sftp_start_edit,
            sftp_stop_edit,
            sftp_list_edits,
            sftp_list_files,
            sftp_read_file,
            sftp_write_file,
            sftp_delete_entry,
            sftp_rename,
            sftp_create_dir,
            sftp_get_stat,
            start_port_forward,
            stop_port_forward,
            list_port_forwards,
            sftp_cancel_transfer,
            sftp_upload_chunked,
            sftp_upload_file,
            sftp_download_chunked,
            sftp_download_file,
            sftp_download_to_downloads,
        ])
        .setup(|app| {
            // 清理历史编辑缓存文件，初始化临时目录
            sftp::editor::init();
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
