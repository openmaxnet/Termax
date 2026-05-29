/**
 * 调试日志系统
 * 提供结构化日志记录、IPC 计时、性能指标采集。
 * debugMode=false 时所有函数直接 return，零开销。
 */
import { ipc } from '@/lib/ipc';
import { useSettingsStore } from '@/stores/settingsStore';

// ═══ 类型定义 ═══

export type LogCategory = 'STARTUP' | 'IPC' | 'MEMORY' | 'RENDER' | 'ERROR' | 'LIFECYCLE' | 'SYSTEM';

export interface LogEntry {
  ts: number;
  cat: LogCategory;
  msg: string;
  dur?: number;
  ok?: boolean;
  err?: string;
  meta?: Record<string, any>;
}

interface DebugState {
  logs: LogEntry[];
  timings: Map<string, number>;
  fps: number;
  memoryMB: number;
  heapMB: number;
  listeners: Set<() => void>;
}

// ═══ 内部状态 ═══

const MAX_LOGS = 200;
const MEMORY_SAMPLE_INTERVAL = 5000;

const state: DebugState = {
  logs: [],
  timings: new Map(),
  fps: 0,
  memoryMB: 0,
  heapMB: 0,
  listeners: new Set(),
};

let memoryTimer: ReturnType<typeof setInterval> | null = null;
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let fpsRafId = 0;

// ═══ 订阅机制（供面板组件使用）═══

export function subscribeDebug(callback: () => void): () => void {
  state.listeners.add(callback);
  return () => { state.listeners.delete(callback); };
}

function notify() {
  for (const fn of state.listeners) fn();
}

// ═══ 核心 API ═══

/** 记录一条日志 */
export function recordLog(entry: LogEntry): void {
  if (!useSettingsStore.getState().debugMode) return;
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) state.logs.shift();
  notify();
}

/** 调试日志（分类为 SYSTEM） */
export function debugLog(msg: string, meta?: Record<string, any>): void {
  recordLog({ ts: Date.now(), cat: 'SYSTEM', msg, meta });
}

/** 开始计时 */
export function debugTime(label: string): void {
  if (!useSettingsStore.getState().debugMode) return;
  state.timings.set(label, performance.now());
}

/** 结束计时并记录 */
export function debugTimeEnd(label: string): number {
  if (!useSettingsStore.getState().debugMode) return 0;
  const start = state.timings.get(label);
  if (start === undefined) return 0;
  const dur = Math.round(performance.now() - start);
  state.timings.delete(label);
  recordLog({ ts: Date.now(), cat: 'STARTUP', msg: label, dur });
  return dur;
}

/** IPC 调用计时包装 */
export async function debugInvoke<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, any>,
): Promise<T> {
  if (!useSettingsStore.getState().debugMode) return fn();
  const start = performance.now();
  try {
    const result = await fn();
    recordLog({ ts: Date.now(), cat: 'IPC', msg: name, dur: Math.round(performance.now() - start), ok: true, meta });
    return result;
  } catch (err) {
    recordLog({ ts: Date.now(), cat: 'IPC', msg: name, dur: Math.round(performance.now() - start), ok: false, meta });
    throw err;
  }
}

/** 记录生命周期事件 */
export function debugLifecycle(msg: string, meta?: Record<string, any>): void {
  recordLog({ ts: Date.now(), cat: 'LIFECYCLE', msg, meta });
}

// ═══ 性能指标 ═══

/** FPS 计数器（RAF 循环） */
function fpsLoop(): void {
  fpsFrameCount++;
  const now = performance.now();
  if (now - fpsLastTime >= 1000) {
    state.fps = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = now;
    notify();
  }
  fpsRafId = requestAnimationFrame(fpsLoop);
}

/** 采样内存 */
function sampleMemory(): void {
  const perf = (performance as any).memory;
  if (perf) {
    state.heapMB = Math.round(perf.usedJSHeapSize / 1024 / 1024 * 10) / 10;
    state.memoryMB = Math.round(perf.totalJSHeapSize / 1024 / 1024 * 10) / 10;
  }
  notify();
}

// ═══ 生命周期 ═══

/** 启动性能采集（debugMode 开启时调用） */
export function startProfiling(): void {
  if (memoryTimer) return;
  fpsFrameCount = 0;
  fpsLastTime = performance.now();
  fpsRafId = requestAnimationFrame(fpsLoop);
  sampleMemory();
  memoryTimer = setInterval(sampleMemory, MEMORY_SAMPLE_INTERVAL);
}

/** 停止性能采集 */
export function stopProfiling(): void {
  if (fpsRafId) { cancelAnimationFrame(fpsRafId); fpsRafId = 0; }
  if (memoryTimer) { clearInterval(memoryTimer); memoryTimer = null; }
}

// ═══ 日志导出 ═══

/** 获取当前日志快照 */
export function getLogs(): readonly LogEntry[] {
  return state.logs;
}

/** 获取当前性能指标 */
export function getMetrics(): { fps: number; memoryMB: number; heapMB: number } {
  return { fps: state.fps, memoryMB: state.memoryMB, heapMB: state.heapMB };
}

/** 清空日志 */
export function clearLogs(): void {
  state.logs = [];
  notify();
}

/** 导出日志到文件（通过原生"另存为"对话框选择保存路径） */
export async function exportLogs(): Promise<void> {
  if (state.logs.length === 0) return;

  const data = {
    version: 1,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    system: {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      memory: `${Math.round((performance as any).memory?.totalJSHeapSize / 1024 / 1024 || 0)}MB`,
    },
    entries: state.logs,
  };

  const json = JSON.stringify(data, null, 2);

  try {
    const savedPath = await ipc.debug.saveLogFile(json);
    console.log(`[Termax Debug] 日志已导出: ${savedPath}`);
  } catch (e) {
    console.error('[Termax Debug] 日志导出失败:', e);
    throw e;
  }
}

// ═══ debugMode 切换监听 ═══

let prevDebugMode = false;

export function onDebugModeChange(debugMode: boolean): void {
  if (debugMode && !prevDebugMode) {
    // 开启：开始采集
    startProfiling();
    recordLog({ ts: Date.now(), cat: 'SYSTEM', msg: 'debugMode enabled' });
  } else if (!debugMode && prevDebugMode) {
    // 关闭：导出并清空
    recordLog({ ts: Date.now(), cat: 'SYSTEM', msg: 'debugMode disabled' });
    exportLogs().catch(() => {});
    stopProfiling();
    state.logs = [];
    state.fps = 0;
    state.memoryMB = 0;
    state.heapMB = 0;
    notify();
  }
  prevDebugMode = debugMode;
}
