import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { ConnectionConfig, SftpEntry } from './types';

/** SFTP 文件操作 */
export const sftp = {
  downloadToDownloads: (config: ConnectionConfig, remote: string, dir: string) =>
    debugInvoke('sftp_download_to_downloads', () => invoke<string>('sftp_download_to_downloads', { config, remote, dir })),
  listFiles: (config: ConnectionConfig, path: string) =>
    debugInvoke('sftp_list_files', () => invoke<SftpEntry[]>('sftp_list_files', { config, path }), { path }),
  readFile: (config: ConnectionConfig, path: string) =>
    debugInvoke('sftp_read_file', () => invoke<string>('sftp_read_file', { config, path }), { path }),
  writeFile: (config: ConnectionConfig, path: string, content: number[]) =>
    debugInvoke('sftp_write_file', () => invoke<void>('sftp_write_file', { config, path, content }), { path }),
  deleteEntry: (config: ConnectionConfig, path: string) =>
    debugInvoke('sftp_delete_entry', () => invoke<void>('sftp_delete_entry', { config, path }), { path }),
  rename: (config: ConnectionConfig, oldPath: string, newPath: string) =>
    debugInvoke('sftp_rename', () => invoke<void>('sftp_rename', { config, old: oldPath, new: newPath }), { old: oldPath, new: newPath }),
  createDir: (config: ConnectionConfig, path: string) =>
    debugInvoke('sftp_create_dir', () => invoke<void>('sftp_create_dir', { config, path }), { path }),
  getStat: (config: ConnectionConfig, path: string) =>
    debugInvoke('sftp_get_stat', () => invoke<SftpEntry>('sftp_get_stat', { config, path }), { path }),
  uploadFile: (config: ConnectionConfig, local: string, remote: string) =>
    debugInvoke('sftp_upload_file', () => invoke<void>('sftp_upload_file', { config, local, remote })),
  downloadFile: (config: ConnectionConfig, remote: string, local: string) =>
    debugInvoke('sftp_download_file', () => invoke<void>('sftp_download_file', { config, remote, local })),
  /** 分块上传文件内容（带进度事件） */
  uploadChunked: (config: ConnectionConfig, remotePath: string, content: Uint8Array, transferId: string) =>
    debugInvoke('sftp_upload_chunked', () => invoke<void>('sftp_upload_chunked', { config, remotePath, content, transferId })),
  /** 分块下载远程文件到本地目录（带进度事件），返回本地路径 */
  downloadChunked: (config: ConnectionConfig, remote: string, dir: string, transferId: string) =>
    debugInvoke('sftp_download_chunked', () => invoke<string>('sftp_download_chunked', { config, remote, dir, transferId })),
  /** 取消正在进行的传输（通过 transferId 查找并触发取消标记） */
  cancelTransfer: (transferId: string) =>
    debugInvoke('sftp_cancel_transfer', () => invoke<void>('sftp_cancel_transfer', { transferId })),
};

/** SFTP 远程编辑 */
export const edit = {
  start: (config: ConnectionConfig, remotePath: string, editorCommand?: string) =>
    debugInvoke('sftp_start_edit', () => invoke<string>('sftp_start_edit', { config, remotePath, editorCommand: editorCommand || null }), { path: remotePath }),
  stop: (sessionId: string) =>
    debugInvoke('sftp_stop_edit', () => invoke<void>('sftp_stop_edit', { sessionId })),
};
