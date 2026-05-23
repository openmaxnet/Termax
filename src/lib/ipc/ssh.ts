/**
 * SSH 连接 IPC 封装
 */
import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { ConnectionConfig } from './types';

/** SSH 连接 */
export const ssh = {
  connect: (config: ConnectionConfig) => debugInvoke('connect_ssh', () => invoke<string>('connect_ssh', { config }), { host: config.host, user: config.username }),
  disconnect: (id: string) => debugInvoke('disconnect_ssh', () => invoke<void>('disconnect_ssh', { id })),
  sendInput: (id: string, data: number[]) => debugInvoke('send_ssh_input', () => invoke<void>('send_ssh_input', { id, data })),
  resize: (id: string, cols: number, rows: number) =>
    debugInvoke('resize_terminal', () => invoke<void>('resize_terminal', { id, cols, rows })),
  test: (config: ConnectionConfig) => debugInvoke('test_connection', () => invoke<string>('test_connection', { config }), { host: config.host }),
};
