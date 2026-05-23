/**
 * SFTP 传输面板状态管理
 * 管理左右面板各自的标签页，左侧默认包含不可关闭的本地文件标签。
 * 内存级 store，不持久化，重启后重置。
 */
import { create } from 'zustand';
import type { ConnectionConfig } from '@/lib/ipc';

/** 面板标签 */
export interface PaneTab {
  id: string;
  title: string;
  config: ConnectionConfig | null; // null = 本地文件
  isLocal: boolean;
  closable: boolean;
}

export interface SftpStoreState {
  leftTabs: PaneTab[];
  leftActiveId: string | null;
  rightTabs: PaneTab[];
  rightActiveId: string | null;

  addLeftTab: (config?: ConnectionConfig | null, isLocal?: boolean) => string;
  removeLeftTab: (id: string) => void;
  setLeftActive: (id: string) => void;
  addRightTab: (config: ConnectionConfig) => string;
  removeRightTab: (id: string) => void;
  setRightActive: (id: string) => void;
}

function tabTitle(config: ConnectionConfig | null, isLocal: boolean): string {
  if (isLocal) return '本地文件';
  if (!config) return '未连接';
  return config.name || `${config.username}@${config.host}`;
}

function ensureLocalTab(): PaneTab {
  return {
    id: 'local',
    title: '本地文件',
    config: null,
    isLocal: true,
    closable: false,
  };
}

export const useSftpStore = create<SftpStoreState>((set) => ({
  leftTabs: [ensureLocalTab()],
  leftActiveId: 'local',
  rightTabs: [],
  rightActiveId: null,

  addLeftTab: (config = null, isLocal = false) => {
    const id = crypto.randomUUID();
    const tab: PaneTab = { id, title: tabTitle(config, isLocal), config, isLocal, closable: !isLocal };
    set((s) => ({ leftTabs: [...s.leftTabs, tab], leftActiveId: id }));
    return id;
  },

  removeLeftTab: (id) => {
    set((s) => {
      const tab = s.leftTabs.find((t) => t.id === id);
      if (!tab || !tab.closable) return s;
      const next = s.leftTabs.filter((t) => t.id !== id);
      const nextActive = s.leftActiveId === id ? (next[next.length - 1]?.id ?? null) : s.leftActiveId;
      return { leftTabs: next, leftActiveId: nextActive };
    });
  },

  setLeftActive: (id) => set({ leftActiveId: id }),

  addRightTab: (config) => {
    const id = crypto.randomUUID();
    const title = tabTitle(config, false);
    const tab: PaneTab = { id, title, config, isLocal: false, closable: true };
    set((s) => ({ rightTabs: [...s.rightTabs, tab], rightActiveId: id }));
    return id;
  },

  removeRightTab: (id) => {
    set((s) => {
      const next = s.rightTabs.filter((t) => t.id !== id);
      let nextActive = s.rightActiveId;
      if (s.rightActiveId === id) {
        nextActive = next.length > 0 ? next[0]?.id ?? null : null;
      }
      return { rightTabs: next, rightActiveId: nextActive };
    });
  },

  setRightActive: (id) => set({ rightActiveId: id }),
}));
