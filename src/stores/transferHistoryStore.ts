/**
 * 传输历史记录 Store（localStorage 持久化）
 * 管理已完成的传输记录归档，上限 100 条（FIFO 淘汰）
 * 用户希望重启后仍能看到传输记录，因此使用 persist 持久化到 localStorage
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 传输状态：pending=排队中 / transferring=传输中 / completed=完成 / failed=失败 / cancelled=取消 */
export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';

/** 传输方向：upload=本地上传至远程 / download=远程下载至本地 */
export type TransferDirection = 'upload' | 'download';

/** 历史归档记录（存入 store 的不可变快照，传输完成后由组件自动生成并写入） */
export interface TransferRecord {
  id: string;
  name: string;
  direction: TransferDirection;
  totalBytes: number;
  status: TransferStatus;
  error?: string;
  localPath?: string;
  startedAt: number;
  completedAt: number;
}

interface TransferHistoryState {
  history: TransferRecord[];
  /** 归档一条记录。超过 MAX_HISTORY 时丢弃最旧的记录 */
  addRecord: (record: TransferRecord) => void;
  /** 从历史中删除单条记录（用户点击"忽略"时触发） */
  removeRecord: (id: string) => void;
  /** 清空全部历史（用户点击"清除全部"时触发） */
  clearHistory: () => void;
}

/** 历史记录上限 —— 避免 localStorage 占用过大 */
const MAX_HISTORY = 100;

export const useTransferHistoryStore = create<TransferHistoryState>()(
  persist(
    (set) => ({
      history: [],

      addRecord: (record) =>
        set((state) => {
          // 新记录插在头部，超出上限时截断尾部（FIFO 淘汰）
          const next = [record, ...state.history];
          if (next.length > MAX_HISTORY) next.length = MAX_HISTORY;
          return { history: next };
        }),

      removeRecord: (id) =>
        set((state) => ({
          history: state.history.filter((r) => r.id !== id),
        })),

      clearHistory: () => set({ history: [] }),
    }),
    {
      // localStorage key，应用重启后恢复历史记录
      name: 'termax-transfer-history',
    },
  ),
);
