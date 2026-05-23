// IPC 类型定义 — 与 Rust 后端的共享契约

/** 远程连接配置：主机、端口、用户名、认证方式 */
export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: { Password: string } | { Key: { path: string; passphrase?: string } };
  group?: string | null;
  /** 跳板机链，按顺序连接。空数组=直连 */
  bastion: BastionConfig[];
  /** 代理配置（可选） */
  proxy?: SshProxyConfig | null;
}

/** 跳板机配置 */
export interface BastionConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: { Password: string } | { Key: { path: string; passphrase?: string } };
}

/** 本地文件/目录条目 */
export interface LocalFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mtime: number;
  permissions: number;
}

/** SFTP 文件/目录条目 */
export interface SftpEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mtime: number;
  permissions: number | null;
  uid: number | null;
  gid: number | null;
  user: string | null;
  group: string | null;
}

/** SFTP 传输方向 */
export type TransferDirection = 'upload' | 'download';

/** 端口转发方向 */
export type ForwardDirection = 'local' | 'remote' | 'dynamic';

/** 端口转发规则 */
export interface PortForwardRule {
  description: string;
  direction: ForwardDirection;
  listen_host: string;
  listen_port: number;
  target_host: string;
  target_port: number;
}

/** 活跃端口转发状态 */
export interface ForwardInfo {
  id: string;
  description: string;
  listen: string;
  target: string;
  status: string;
}

/** SFTP 传输进度报告（从 Rust event 反序列化，字段保持 snake_case） */
export interface TransferProgress {
  transfer_id: string;
  file_name: string;
  direction: TransferDirection;
  bytes_written: number;
  total_bytes: number;
  speed_bps: number;
  done: boolean;
  error: string | null;
}

// ── 监控类型 ──

/** 磁盘分区信息：总量、已用、可用、挂载点 */
export interface DiskInfo {
  filesystem: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percent: number;
  mount_point: string;
}

/** 进程信息：PID、CPU/内存占用、命令 */
export interface ProcessInfo {
  pid: number;
  user: string;
  state: string;
  priority: number;
  nice: number;
  vsize: number;
  threads: number;
  cpu_percent: number;
  mem_percent: number;
  rss_kb: number;
  command: string;
}

/** 系统监控信息聚合：CPU、内存、磁盘、进程等 */
export interface SystemInfo {
  hostname: string;
  os: OsInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  load_avg: LoadAvgInfo;
  uptime: UptimeInfo;
  disks: DiskInfo[];
  processes: ProcessInfo[];
  fetched_at: number;
}

/** 操作系统信息：名称和版本 */
export interface OsInfo {
  name: string;
  version: string;
}

/** CPU 信息：型号、核心数、使用率 */
export interface CpuInfo {
  model: string;
  cores: number;
  usage_percent: number;
}

/** 内存信息：总量、已用、可用、使用率 */
export interface MemoryInfo {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  available_bytes: number;
  usage_percent: number;
}

/** 系统负载均值（1/5/15 分钟） */
export interface LoadAvgInfo {
  one_min: number;
  five_min: number;
  fifteen_min: number;
}

/** 系统运行时长 */
export interface UptimeInfo {
  seconds: number;
  raw: string;
}

/** SSH 代理类型 */
export type SshProxyType = 'http' | 'socks5';

/** SSH 代理配置 */
export interface SshProxyConfig {
  proxy_type: SshProxyType;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
}

/** WSL 发行版信息 */
export interface WslDistro {
  name: string;
  state: string;
  version: number;
}
