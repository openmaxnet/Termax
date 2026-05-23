//! 传输注册表：管理活跃传输的取消信号
//! 每个分块传输在开始时注册一个取消标记（Arc<AtomicBool>），
//! 取消命令通过该标记通知传输循环退出。
//! 传输完成后自动注销，避免内存泄漏。

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// 传输注册表（由 Tauri 的 .manage() 管理，全局单例）
pub struct TransferRegistry {
    pub transfers: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl TransferRegistry {
    pub fn new() -> Self {
        Self {
            transfers: Mutex::new(HashMap::new()),
        }
    }

    /// 注册一个传输，返回其取消标记
    pub fn register(&self, id: String) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.transfers.lock().unwrap().insert(id, flag.clone());
        flag
    }

    /// 注销一个传输（传输完成或失败时调用）
    pub fn unregister(&self, id: &str) {
        self.transfers.lock().unwrap().remove(id);
    }

    /// 触发取消，返回是否找到该传输
    pub fn cancel(&self, id: &str) -> bool {
        if let Some(flag) = self.transfers.lock().unwrap().get(id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }
}
