import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { ConnectionConfig, SystemInfo } from './types';

/** 系统监控 */
export const monitor = {
  fetch: (config: ConnectionConfig) =>
    debugInvoke('monitor_fetch', () => invoke<SystemInfo>('monitor_fetch', { config }), { host: config.host }),
  exec: (config: ConnectionConfig, command: string) =>
    debugInvoke('monitor_exec', () => invoke<string>('monitor_exec', { config, command }), { cmd: command }),
};
