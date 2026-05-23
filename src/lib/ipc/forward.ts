/** 端口转发 IPC 封装 */
import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { ConnectionConfig, PortForwardRule, ForwardInfo } from './types';

export const forward = {
  /** 启动本地端口转发，返回 forward_id */
  start: (config: ConnectionConfig, rule: PortForwardRule) =>
    debugInvoke('start_port_forward', () => invoke<string>('start_port_forward', { config, rule }), { host: config.host, listenPort: rule.listen_port }),

  /** 停止端口转发 */
  stop: (forwardId: string) =>
    debugInvoke('stop_port_forward', () => invoke<void>('stop_port_forward', { forwardId })),

  /** 列出所有活跃转发 */
  list: () =>
    debugInvoke('list_port_forwards', () => invoke<ForwardInfo[]>('list_port_forwards')),
};
