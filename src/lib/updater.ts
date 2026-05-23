/**
 * 应用更新检查模块
 * 支持后台静默检查（启动时自动触发）和手动检查（About 面板触发）
 */
import type { Update } from '@tauri-apps/plugin-updater';

/** 最近一次后台检查发现的更新（供 About 面板读取） */
let pendingUpdate: Update | null = null;
let pendingCallbacks: ((update: Update | null) => void)[] = [];

/** 订阅后台更新检查结果 */
export function onBackgroundUpdate(callback: (update: Update | null) => void): () => void {
  pendingCallbacks.push(callback);
  // 如果已有结果，立即回调
  if (pendingUpdate) callback(pendingUpdate);
  return () => {
    pendingCallbacks = pendingCallbacks.filter((cb) => cb !== callback);
  };
}

/** 获取待处理的更新（非阻塞） */
export function getPendingUpdate(): Update | null {
  return pendingUpdate;
}

/** 清除待处理的更新 */
export function clearPendingUpdate(): void {
  pendingUpdate = null;
}

/**
 * 后台静默检查更新
 * 启动时延迟 5 秒执行，不弹窗、不阻塞，仅存储结果
 */
export async function checkForBackgroundUpdate(): Promise<void> {
  try {
    // 仅在生产环境检查（开发版跳过）
    if (window.location.hostname === 'localhost') return;

    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      pendingUpdate = update;
      pendingCallbacks.forEach((cb) => cb(update));
    }
  } catch {
    // 后台检查失败静默忽略
  }
}
