//! 系统监控层
//! 通过 SSH 采集远程主机的系统指标，包括 CPU/内存/磁盘/进程等。
//! 通过 Linux /proc 文件系统解析系统状态。

pub mod client;
pub mod parser;
