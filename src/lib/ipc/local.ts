import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { LocalFileEntry, WslDistro } from './types';

/** 本地终端 */
export const local = {
  detectShells: () => debugInvoke('detect_shells_list', () => invoke<{name: string; path: string; default: boolean}[]>('detect_shells_list')),
  detectFonts: () => debugInvoke('detect_fonts', () => invoke<{family: string; full_name: string}[]>('detect_fonts')),
  connect: (shellPath: string) => debugInvoke('connect_local', () => invoke<string>('connect_local', { shellPath }), { shell: shellPath }),
  disconnect: (id: string) => debugInvoke('disconnect_local', () => invoke<void>('disconnect_local', { id })),
  sendInput: (id: string, data: number[]) => debugInvoke('send_local_input', () => invoke<void>('send_local_input', { id, data })),
  resize: (id: string, cols: number, rows: number) =>
    debugInvoke('resize_local', () => invoke<void>('resize_local', { id, cols, rows })),
  /** 检测 WSL 发行版列表 */
  detectWslDistros: () => debugInvoke('detect_wsl_distros', () => invoke<WslDistro[]>('detect_wsl_distros')),
  /** 连接 WSL 发行版 */
  connectWsl: (distro: string) => debugInvoke('connect_wsl', () => invoke<string>('connect_wsl', { distro }), { distro }),
  /** 列出本地目录内容（path 为空时列出盘符），showHidden 控制隐藏文件 */
  listFiles: (path: string, showHidden?: boolean) => debugInvoke('local_list_files', () => invoke<LocalFileEntry[]>('local_list_files', { path, showHidden: showHidden ?? false }), { path }),
};
