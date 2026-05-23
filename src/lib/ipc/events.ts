/**
 * Tauri 事件监听封装
 * 提供类型安全的事件监听函数，覆盖终端输出、会话就绪/错误、SFTP 编辑上传、
 * SFTP 分块传输进度等事件。每个监听函数返回 unlisten 函数，组件 unmount 时需调用清理。
 */
import { listen } from '@tauri-apps/api/event';

import type { TransferProgress } from './types';

// ═══ 事件监听 ═══

export const events = {
  onTermOutput: (
    handler: (payload: { sessionId: string; data: number[] }) => void,
  ) => listen<{ sessionId: string; data: number[] }>('term-output', (e) => handler(e.payload)),
  onSessionError: (
    handler: (payload: { sessionId: string; error: string }) => void,
  ) => listen<{ sessionId: string; error: string }>('session-error', (e) => handler(e.payload)),
  onSessionReady: (
    handler: (payload: { sessionId: string }) => void,
  ) => listen<{ sessionId: string }>('session-ready', (e) => handler(e.payload)),
  onSftpEditUploaded: (
    handler: (payload: { sessionId: string; remotePath: string; success: boolean; error?: string }) => void,
  ) => listen<{ sessionId: string; remotePath: string; success: boolean; error?: string }>('sftp-edit-uploaded', (e) => handler(e.payload)),
  /** SFTP 分块传输进度事件 */
  onSftpTransferProgress: (
    handler: (payload: TransferProgress) => void,
  ) => listen<TransferProgress>('sftp-transfer-progress', (e) => handler(e.payload)),
};
