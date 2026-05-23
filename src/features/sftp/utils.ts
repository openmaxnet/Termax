/** SFTP 文件相关格式化工具 */

/** 根据文件名返回 Solar 图标名（仅使用项目中已验证存在的图标） */
export function fileIcon(name: string, isDir: boolean): string {
  if (isDir) return 'solar:folder-linear';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    // 图片
    jpg: 'solar:gallery-wide-linear', jpeg: 'solar:gallery-wide-linear', png: 'solar:gallery-wide-linear',
    gif: 'solar:gallery-wide-linear', bmp: 'solar:gallery-wide-linear', ico: 'solar:gallery-wide-linear',
    svg: 'solar:gallery-wide-linear', webp: 'solar:gallery-wide-linear',
    // 视频
    mp4: 'solar:play-stream-linear', avi: 'solar:play-stream-linear', mkv: 'solar:play-stream-linear',
    mov: 'solar:play-stream-linear', webm: 'solar:play-stream-linear',
    // 音频
    mp3: 'solar:headphones-round-linear', wav: 'solar:headphones-round-linear',
    flac: 'solar:headphones-round-linear', aac: 'solar:headphones-round-linear', ogg: 'solar:headphones-round-linear',
    // 文档
    pdf: 'solar:document-text-linear', doc: 'solar:document-text-linear', docx: 'solar:document-text-linear',
    xls: 'solar:document-text-linear', xlsx: 'solar:document-text-linear',
    ppt: 'solar:document-text-linear', pptx: 'solar:document-text-linear',
    txt: 'solar:document-linear', md: 'solar:document-linear', csv: 'solar:document-linear',
    // 代码
    ts: 'solar:code-linear', tsx: 'solar:code-linear', js: 'solar:code-linear', jsx: 'solar:code-linear',
    py: 'solar:code-linear', rs: 'solar:code-linear', go: 'solar:code-linear', java: 'solar:code-linear',
    c: 'solar:code-linear', cpp: 'solar:code-linear', h: 'solar:code-linear',
    css: 'solar:code-linear', html: 'solar:code-linear', json: 'solar:code-linear',
    xml: 'solar:code-linear', yaml: 'solar:code-linear', yml: 'solar:code-linear', toml: 'solar:code-linear',
    sh: 'solar:code-linear', bash: 'solar:code-linear', ps1: 'solar:code-linear',
    // 压缩
    zip: 'solar:archive-linear', tar: 'solar:archive-linear', gz: 'solar:archive-linear',
    rar: 'solar:archive-linear', '7z': 'solar:archive-linear',
    // 可执行
    exe: 'solar:widget-linear', dll: 'solar:widget-linear', so: 'solar:widget-linear',
    msi: 'solar:widget-linear', app: 'solar:widget-linear',
    // 字体
    ttf: 'solar:text-underline-linear', otf: 'solar:text-underline-linear',
    woff: 'solar:text-underline-linear', woff2: 'solar:text-underline-linear',
    // 数据库
    db: 'solar:database-linear', sqlite: 'solar:database-linear',
    // 配置
    env: 'solar:settings-linear', cfg: 'solar:settings-linear', conf: 'solar:settings-linear', ini: 'solar:settings-linear',
    lock: 'solar:lock-linear',
  };
  return map[ext] || 'solar:file-linear';
}

/** 字节数 → 可读大小（B/KB/MB/GB） */
export function formatSize(b: number): string {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

/** 字节/秒 → 可读速度（B/s / KB/s / MB/s / GB/s） */
export function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.min(Math.floor(Math.log(bps) / Math.log(1024)), u.length - 1);
  return (bps / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

/** Unix 时间戳 → 本地日期时间字符串 */
export function formatTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 权限位 → rwx 字符串 */
export function formatMode(mode: number | null): string {
  if (mode == null) return '';
  const chars = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const type = mode & 0o170000;
  const prefix = type === 0o040000 ? 'd' : type === 0o120000 ? 'l' : '-';
  return prefix + chars[(mode >> 6) & 7] + chars[(mode >> 3) & 7] + chars[mode & 7];
}

/** UID → 用户名（含已知映射） */
export function formatOwner(id: number | null): string {
  if (id == null) return '';
  const known: Record<number, string> = {
    0: 'root', 1: 'daemon', 2: 'bin', 3: 'sys', 4: 'adm',
    5: 'tty', 6: 'lp', 7: 'man', 8: 'mail', 9: 'news',
    10: 'uucp', 11: 'proxy', 13: 'www-data', 34: 'backup',
    38: 'mysql', 65534: 'nobody',
  };
  return known[id] ?? String(id);
}

/** SFTP 错误信息提取 */
export function fmtSftpError(err: unknown): string {
  if (!err) return '未知错误';
  if (typeof err === 'string') {
    // Tauri invoke 可能返回 JSON 字符串包裹的错误
    try { const p = JSON.parse(err); if (typeof p === 'string') return p; if (p?.message) return String(p.message); } catch {}
    return err;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
    if (typeof o.toString === 'function' && o.toString !== Object.prototype.toString) return o.toString();
  }
  return String(err);
}

/** 判断文件是否为二进制（不可编辑） */
export function isBinaryExt(filename: string): boolean {
  const BINARY_EXTS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'webp', 'tiff', 'tif', 'raw', 'heic',
    'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp',
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
    'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'dmg', 'iso', 'tgz', 'zst', 'cab', 'cpio', 'deb', 'rpm', 'apk', 'msi',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'obj', 'class', 'pyc', 'pyo', 'wasm',
    'ko', 'sys', 'drv', 'efi', 'elf', 'out', 'app', 'gadget', 'scr',
    'lib', 'a', 'la', 'lo', 'slo', 'nav', 'pi', 'rlib',
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    'db', 'sqlite', 'sqlite3', 'mdb',
    'pkg', 'snap', 'flatpak', 'nupkg', 'whl', 'egg', 'gem', 'jar', 'war', 'ear', 'crate',
    'dat', 'pak', 'node', 'dex', 'nk2', 'pst', 'ost',
  ]);
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return BINARY_EXTS.has(ext);
}

/** 标准化路径：确保以 / 开头 */
export function normalizeSftpPath(p: string) {
  return '/' + p.split('/').filter(Boolean).join('/');
}
