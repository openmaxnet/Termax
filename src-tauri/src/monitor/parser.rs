use std::collections::HashMap;
use serde::Serialize;

/// 系统监控信息聚合（与前端 `SystemInfo` 接口对应）
#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub hostname: String,
    pub os: OsInfo,
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub load_avg: LoadAvgInfo,
    pub uptime: UptimeInfo,
    pub disks: Vec<DiskInfo>,
    pub processes: Vec<ProcessInfo>,
    pub fetched_at: u64,
}

/// 操作系统信息
#[derive(Debug, Clone, Serialize)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
}

/// CPU 信息
#[derive(Debug, Clone, Serialize)]
pub struct CpuInfo {
    pub model: String,
    pub cores: u32,
    pub usage_percent: f64,
}

/// 内存信息
#[derive(Debug, Clone, Serialize)]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f64,
}

/// 系统负载均值
#[derive(Debug, Clone, Serialize)]
pub struct LoadAvgInfo {
    pub one_min: f64,
    pub five_min: f64,
    pub fifteen_min: f64,
}

/// 系统运行时长
#[derive(Debug, Clone, Serialize)]
pub struct UptimeInfo {
    pub seconds: u64,
    pub raw: String,
}

/// 磁盘分区信息
#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub filesystem: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub usage_percent: f64,
    pub mount_point: String,
}

/// 进程信息
#[derive(Debug, Clone, Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub user: String,
    pub state: String,
    pub priority: i64,
    pub nice: i64,
    pub vsize: u64,
    pub threads: u32,
    pub cpu_percent: f64,
    pub mem_percent: f64,
    pub rss_kb: u64,
    pub command: String,
}

// ── Parsers ──

/// Parse `/proc/stat` first line: "cpu  user nice system idle iowait irq softirq steal ..."
/// Returns usage_percent = (total - idle) / total * 100
pub fn parse_cpu_stat(content: &str) -> f64 {
    let Some(line) = content.lines().next() else { return 0.0 };
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 5 || parts[0] != "cpu" {
        return 0.0;
    }
    let user: u64 = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(0);
    let nice: u64 = parts.get(2).and_then(|v| v.parse().ok()).unwrap_or(0);
    let system: u64 = parts.get(3).and_then(|v| v.parse().ok()).unwrap_or(0);
    let idle: u64 = parts.get(4).and_then(|v| v.parse().ok()).unwrap_or(0);
    let iowait: u64 = parts.get(5).and_then(|v| v.parse().ok()).unwrap_or(0);
    let irq: u64 = parts.get(6).and_then(|v| v.parse().ok()).unwrap_or(0);
    let softirq: u64 = parts.get(7).and_then(|v| v.parse().ok()).unwrap_or(0);
    let steal: u64 = parts.get(8).and_then(|v| v.parse().ok()).unwrap_or(0);

    let total = user + nice + system + idle + iowait + irq + softirq + steal;
    if total == 0 {
        return 0.0;
    }
    ((total - idle - iowait) as f64 / total as f64) * 100.0
}

/// Parse `/proc/cpuinfo` — count "processor" lines and get first "model name"
pub fn parse_cpu_info(content: &str) -> (u32, String) {
    let mut cores = 0u32;
    let mut model = String::new();

    for line in content.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("processor\t:") {
            if val.trim().parse::<u32>().is_ok() {
                cores += 1;
            }
        }
        if model.is_empty() {
            if let Some(val) = line.strip_prefix("model name\t:") {
                model = val.trim().to_string();
            }
        }
    }

    (cores.max(1), model)
}

/// Parse `/proc/meminfo`: "MemTotal: 123456 kB" etc.
/// Returns (total_bytes, free_bytes, available_bytes)
pub fn parse_meminfo(content: &str) -> (u64, u64, u64) {
    let mut total = 0u64;
    let mut free = 0u64;
    let mut avail = 0u64;

    for line in content.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("MemTotal:") {
            total = parse_kb_value(val);
        } else if let Some(val) = line.strip_prefix("MemFree:") {
            free = parse_kb_value(val);
        } else if let Some(val) = line.strip_prefix("MemAvailable:") {
            avail = parse_kb_value(val);
        }
    }

    (total, free, avail)
}

/// 解析 "123456 kB" 格式的内存值，返回字节数
fn parse_kb_value(s: &str) -> u64 {
    let s = s.trim();
    let val: u64 = s.split_whitespace().next().and_then(|v| v.parse().ok()).unwrap_or(0);
    val * 1024 // kB → bytes
}

/// Parse `/proc/loadavg`: "0.45 0.32 0.21 1/234 5678"
pub fn parse_loadavg(content: &str) -> (f64, f64, f64) {
    let line = content.lines().next().unwrap_or("");
    let parts: Vec<&str> = line.split_whitespace().collect();
    let one = parts.first().and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let five = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let fifteen = parts.get(2).and_then(|v| v.parse().ok()).unwrap_or(0.0);
    (one, five, fifteen)
}

/// Parse `/proc/uptime`: "12345.67 89101.23"
pub fn parse_uptime(content: &str) -> (u64, String) {
    let line = content.lines().next().unwrap_or("");
    let secs: f64 = line.split_whitespace().next()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);
    let secs_u64 = secs as u64;
    let raw = format_uptime(secs_u64);
    (secs_u64, raw)
}

/// 将秒数格式化为可读的 "Xd Xh Xm" 格式
fn format_uptime(secs: u64) -> String {
    let days = secs / 86400;
    let hours = (secs % 86400) / 3600;
    let minutes = (secs % 3600) / 60;
    if days > 0 {
        format!("{}d {}h {}m", days, hours, minutes)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}

/// Parse `/etc/os-release` — extract NAME and VERSION_ID
pub fn parse_os_release(content: &str) -> (String, String) {
    let mut name = String::new();
    let mut version = String::new();
    for line in content.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("NAME=") {
            name = val.trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("VERSION_ID=") {
            version = val.trim_matches('"').to_string();
        }
    }
    (name, version)
}

#[allow(dead_code)]
/// Parse `/proc/mounts` — extract physical mount points (ext4, xfs, btrfs, etc.)
/// Returns list of (device, mount_point, fstype)
pub fn parse_mounts(content: &str) -> Vec<(String, String, String)> {
    let mut mounts = Vec::new();
    for line in content.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 { continue; }
        let device = parts[0].to_string();
        let mount_point = parts[1].to_string();
        let fstype = parts[2].to_string();
        if !device.starts_with('/') { continue; }
        if fstype == "rootfs" || fstype == "proc" || fstype == "sysfs" || fstype == "devtmpfs" || fstype == "tmpfs" {
            continue;
        }
        mounts.push((device, mount_point, fstype));
    }
    mounts
}

/// Parse `df -B1` output — each line: filesystem  total  used  free  pct  mount
pub fn parse_df_output(output: &str) -> Vec<DiskInfo> {
    let mut disks = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 6 { continue; }
        let fs = parts[0].to_string();
        let total: u64 = parts[1].parse().unwrap_or(0);
        let used: u64 = parts[2].parse().unwrap_or(0);
        let _free: u64 = parts[3].parse().unwrap_or(0);
        let pct_str = parts[4].trim_end_matches('%');
        let pct: f64 = pct_str.parse().unwrap_or(0.0);
        let mount = parts[5..].join(" ");
        disks.push(DiskInfo {
            filesystem: fs,
            total_bytes: total,
            used_bytes: used,
            free_bytes: _free,
            usage_percent: pct,
            mount_point: mount,
        });
    }
    disks
}

#[allow(dead_code)]
/// Build DiskInfo from StatVfs result (statvfs@openssh.com)
pub fn build_disk_info(fs: &str, mount: &str, f_bsize: u64, f_blocks: u64, _f_bfree: u64, f_bavail: u64) -> DiskInfo {
    let total = f_blocks.saturating_mul(f_bsize);
    let free = f_bavail.saturating_mul(f_bsize);
    let used = total.saturating_sub(free);
    let pct = if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 };
    DiskInfo {
        filesystem: fs.to_string(),
        total_bytes: total,
        used_bytes: used,
        free_bytes: free,
        usage_percent: pct.round(),
        mount_point: mount.to_string(),
    }
}

/// Parse `/etc/passwd` — build UID → username map
pub fn parse_passwd(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in content.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() >= 3 {
            let name = parts[0].to_string();
            let uid = parts[2].trim().to_string();
            map.insert(uid, name);
        }
    }
    map
}

/// Parse `/proc/[pid]/cmdline` — null-byte separated args → single string
pub fn parse_cmdline(content: &str) -> String {
    let s = content.trim_end_matches('\0');
    s.replace('\0', " ")
}

/// Parse `/proc/[pid]/status` — extract Name and Uid fields
pub fn parse_proc_status(content: &str) -> (String, String) {
    let mut name = String::new();
    let mut uid = String::new();
    for line in content.lines() {
        if let Some(val) = line.strip_prefix("Name:") {
            name = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("Uid:") {
            uid = val.trim().split_whitespace().next().unwrap_or("0").to_string();
        }
    }
    (name, uid)
}

/// Parse `/proc/[pid]/stat` — extract key scheduling/memory fields
/// Fields after comm (field indices 1-based): state(3) ppid(4) ... utime(14) stime(15) ... priority(18) nice(19) num_threads(20) starttime(22) vsize(23) rss(24)
pub fn parse_proc_stat(content: &str) -> (String, i64, i64, u32, u64, u64, u64, u64, u64) {
    let Some(end) = content.rfind(')') else { return (String::new(), 0, 0, 0, 0, 0, 0, 0, 0) };
    let rest: Vec<&str> = content[end + 1..].split_whitespace().collect();
    if rest.len() < 24 { return (String::new(), 0, 0, 0, 0, 0, 0, 0, 0); }
    let state = rest.get(0).unwrap_or(&"").to_string();
    let utime: u64 = rest.get(11).and_then(|v| v.parse().ok()).unwrap_or(0);
    let stime: u64 = rest.get(12).and_then(|v| v.parse().ok()).unwrap_or(0);
    let priority: i64 = rest.get(15).and_then(|v| v.parse().ok()).unwrap_or(0);
    let nice: i64 = rest.get(16).and_then(|v| v.parse().ok()).unwrap_or(0);
    let num_threads: u32 = rest.get(17).and_then(|v| v.parse().ok()).unwrap_or(1);
    let starttime: u64 = rest.get(19).and_then(|v| v.parse().ok()).unwrap_or(0);
    let vsize: u64 = rest.get(20).and_then(|v| v.parse().ok()).unwrap_or(0);
    let rss: u64 = rest.get(21).and_then(|v| v.parse().ok()).unwrap_or(0);
    (state, priority, nice, num_threads, vsize, utime, stime, starttime, rss)
}

/// Compute CPU% for a process: (utime + stime) / uptime_secs / CLK_TCK * 100
/// CLK_TCK is typically 100 on Linux
pub fn compute_cpu_pct(utime: u64, stime: u64, _starttime: u64, uptime_secs: u64) -> f64 {
    const CLK_TCK: u64 = 100;
    let total_ticks = utime + stime;
    if uptime_secs == 0 { return 0.0; }
    let cpu_secs = total_ticks as f64 / CLK_TCK as f64;
    (cpu_secs / uptime_secs as f64) * 100.0
}

/// Compute MEM% for a process: rss_pages * PAGE_SIZE / total_mem_bytes * 100
/// PAGE_SIZE is typically 4096 on Linux
pub fn compute_mem_pct(rss_pages: u64, total_mem_bytes: u64) -> f64 {
    if total_mem_bytes == 0 { return 0.0; }
    let rss_bytes = rss_pages * 4096;
    (rss_bytes as f64 / total_mem_bytes as f64) * 100.0
}

/// Build final SystemInfo from parsed raw values
pub fn build_system_info(
    hostname: String,
    os_name: String,
    os_version: String,
    cpu_usage: f64,
    cpu_cores: u32,
    cpu_model: String,
    mem_total: u64,
    mem_free: u64,
    mem_avail: u64,
    la_one: f64,
    la_five: f64,
    la_fifteen: f64,
    uptime_secs: u64,
    uptime_raw: String,
    disks: Vec<DiskInfo>,
    processes: Vec<ProcessInfo>,
) -> SystemInfo {
    let used_bytes = if mem_total > mem_free {
        mem_total - mem_free
    } else {
        0
    };
    let usage_percent = if mem_total > 0 {
        (used_bytes as f64 / mem_total as f64) * 100.0
    } else {
        0.0
    };
    let fetched_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    SystemInfo {
        hostname,
        os: OsInfo {
            name: os_name,
            version: os_version,
        },
        cpu: CpuInfo {
            model: cpu_model,
            cores: cpu_cores,
            usage_percent: cpu_usage,
        },
        memory: MemoryInfo {
            total_bytes: mem_total,
            used_bytes,
            free_bytes: mem_free,
            available_bytes: mem_avail,
            usage_percent,
        },
        load_avg: LoadAvgInfo {
            one_min: la_one,
            five_min: la_five,
            fifteen_min: la_fifteen,
        },
        uptime: UptimeInfo {
            seconds: uptime_secs,
            raw: uptime_raw,
        },
        disks,
        processes,
        fetched_at,
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cpu_stat() {
        let content = "cpu  12345 0 6789 98765 321 0 0 0 0 0";
        let pct = parse_cpu_stat(content);
        // user(12345) + nice(0) + system(6789) = 19134
        // idle(98765) + iowait(321) = 99086
        // total = 19134 + 99086 = 118220
        // usage = (118220 - 98765 - 321) / 118220 = 19134/118220 = 16.18%
        assert!((pct - 16.18).abs() < 0.1);
    }

    #[test]
    fn test_parse_cpu_info() {
        let content = "processor\t: 0\nmodel name\t: Intel(R) Core(TM) i7\nprocessor\t: 1\nprocessor\t: 2";
        let (cores, model) = parse_cpu_info(content);
        assert_eq!(cores, 3);
        assert_eq!(model, "Intel(R) Core(TM) i7");
    }

    #[test]
    fn test_parse_meminfo() {
        let content = "MemTotal:       8166148 kB\nMemFree:        1234567 kB\nMemAvailable:   4567890 kB";
        let (total, free, avail) = parse_meminfo(content);
        assert_eq!(total, 8166148 * 1024);
        assert_eq!(free, 1234567 * 1024);
        assert_eq!(avail, 4567890 * 1024);
    }

    #[test]
    fn test_parse_loadavg() {
        let content = "0.45 0.32 0.21 1/234 5678\n";
        let (one, five, fifteen) = parse_loadavg(content);
        assert!((one - 0.45).abs() < 0.01);
        assert!((five - 0.32).abs() < 0.01);
        assert!((fifteen - 0.21).abs() < 0.01);
    }

    #[test]
    fn test_parse_uptime() {
        let content = "123456.78 98765.43\n";
        let (secs, raw) = parse_uptime(content);
        assert_eq!(secs, 123456);
        assert!(raw.contains("d") || raw.contains("h")); // 123456s ≈ 1.4 days
    }

    #[test]
    fn test_parse_os_release() {
        let content = "NAME=\"Ubuntu\"\nVERSION_ID=\"22.04\"\nID=ubuntu\n";
        let (name, version) = parse_os_release(content);
        assert_eq!(name, "Ubuntu");
        assert_eq!(version, "22.04");
    }

    #[test]
    fn test_format_uptime() {
        assert_eq!(format_uptime(90061), "1d 1h 1m"); // 86400 + 3600 + 60
        assert_eq!(format_uptime(3661), "1h 1m");
        assert_eq!(format_uptime(61), "1m");
    }
}
