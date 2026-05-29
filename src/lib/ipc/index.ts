// IPC 统一入口 — 重导出所有类型、ipc 对象和 events 对象

export type {
  BastionConfig,
  ConnectionConfig,
  SshProxyConfig,
  SshProxyType,
  LocalFileEntry,
  SftpEntry,
  TransferDirection,
  TransferProgress,
  ForwardDirection,
  PortForwardRule,
  ForwardInfo,
  DiskInfo,
  ProcessInfo,
  SystemInfo,
  OsInfo,
  CpuInfo,
  MemoryInfo,
  LoadAvgInfo,
  UptimeInfo,
  WslDistro,
  CredentialKind,
  SshCredential,
} from './types';

import { ssh } from './ssh';
import { local } from './local';
import { sftp, edit } from './sftp';
import { config } from './config';
import { credential, debug } from './credential';
import { monitor } from './monitor';
import { forward } from './forward';

export { events } from './events';

/**
 * Tauri IPC 统一调用入口
 * 按领域分组暴露所有后端命令（ssh/local/sftp/edit/config/credential/debug/monitor/forward）
 * 组件中禁止直接调用 invoke()，必须通过此对象访问
 */
export const ipc = {
  ssh,
  local,
  sftp,
  edit,
  config,
  credential,
  debug,
  monitor,
  forward,
};
