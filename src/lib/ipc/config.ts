import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { ConnectionConfig } from './types';

/** 连接配置 */
export const config = {
  load: () => debugInvoke('load_configs', () => invoke<ConnectionConfig[]>('load_configs')),
  save: (cfg: ConnectionConfig) => debugInvoke('save_config', () => invoke<void>('save_config', { config: cfg }), { name: cfg.name }),
  update: (id: string, cfg: ConnectionConfig) => debugInvoke('update_config', () => invoke<void>('update_config', { id, config: cfg })),
  delete: (id: string) => debugInvoke('delete_config_by_id', () => invoke<void>('delete_config_by_id', { id })),
  deleteByName: (name: string) => debugInvoke('delete_config', () => invoke<void>('delete_config', { name })),
};
