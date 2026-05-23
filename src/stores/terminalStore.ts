/**
 * 标签页状态管理（Zustand）
 * 管理终端/SFTP 标签页的增删改查、切换、排序、连接状态追踪
 */
import { create } from 'zustand';
import type { ConnectionConfig } from '@/lib/ipc';

/** 标签页类型：SSH 远程连接/本地终端/WSL 发行版/传输文件 */
export type TabType = 'ssh' | 'local' | 'wsl' | 'transfer';

/** 标签页信息 */
export interface TabInfo {
  id: string;
  title: string;
  type: TabType;
  config: ConnectionConfig | null;
  sessionId: string | null;
  connected: boolean;
  shellPath?: string;
}

/** 标签页状态结构 */
export interface TerminalStore {
  tabs: TabInfo[];
  activeTabId: string | null;

  // ── 广播输入 ──
  /** 广播是否生效 */
  broadcastActive: boolean;
  /** 是否处于多选选择态 */
  broadcastSelecting: boolean;
  /** 参与广播的 Tab ID 集合 */
  broadcastTargets: Set<string>;

  /** 创建新标签页，返回生成的 id */
  addTab: (title: string, config: ConnectionConfig | null, type?: TabType) => string;
  /** 关闭标签页，如果关闭的是当前活动页则自动切换到上一个 */
  removeTab: (id: string) => void;
  setActive: (id: string) => void;
  setSessionId: (tabId: string, sessionId: string) => void;
  setConnected: (tabId: string, connected: boolean) => void;
  setShellPath: (tabId: string, shellPath: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;

  // ── 广播 Actions ──
  /** 进入多选模式，默认选中所有已连接的非 SFTP Tab */
  enterBroadcastSelect: () => void;
  /** 取消选择，退出多选模式 */
  exitBroadcastSelect: () => void;
  /** 切换某个 Tab 的选中状态 */
  toggleBroadcastTarget: (tabId: string) => void;
  /** 确认选择，激活广播 */
  confirmBroadcast: () => void;
  /** 停止广播 */
  stopBroadcast: () => void;
}

/** 生成唯一 ID，优先使用 crypto.randomUUID */
function genId(): string {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * 标签页状态 Store
 * 管理终端/SFTP 标签页的增删改查、切换排序和连接状态追踪
 */
export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  broadcastActive: false,
  broadcastSelecting: false,
  broadcastTargets: new Set<string>(),

  addTab: (title, config, type = 'ssh') => {
    // 传输类型去重：最多 1 个传输标签页
    if (type === 'transfer') {
      const existing = get().tabs.find((t) => t.type === 'transfer');
      if (existing) {
        set({ activeTabId: existing.id });
        return existing.id;
      }
    }
    const id = genId();
    const tab: TabInfo = {
      id,
      title,
      type,
      config,
      sessionId: null,
      connected: false,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    }));
    return id;
  },

  removeTab: (id) => {
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      // 关闭当前页时自动切换到最后一个标签，避免出现无标签的空白状态
      const activeTabId = state.activeTabId === id
        ? tabs.length > 0 ? tabs[tabs.length - 1].id : null
        : state.activeTabId;
      return { tabs, activeTabId };
    });
  },

  setActive: (id) => set({ activeTabId: id }),

  setSessionId: (tabId, sessionId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, sessionId } : t)),
    }));
  },

  setConnected: (tabId, connected) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, connected } : t)),
    }));
  },
  setShellPath: (tabId, shellPath) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, shellPath } : t)),
    }));
  },
  moveTab: (fromIndex, toIndex) => {
    set((state) => {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { tabs };
    });
  },

  // ── 广播 Actions ──

  enterBroadcastSelect: () => {
    set((state) => {
      // 默认选中所有已连接的非 SFTP Tab
      const targets = new Set<string>();
      for (const tab of state.tabs) {
        if (tab.type !== 'transfer' && tab.connected && tab.sessionId) {
          targets.add(tab.id);
        }
      }
      return { broadcastSelecting: true, broadcastTargets: targets };
    });
  },

  exitBroadcastSelect: () => set({ broadcastSelecting: false, broadcastTargets: new Set() }),

  toggleBroadcastTarget: (tabId) => {
    set((state) => {
      const targets = new Set(state.broadcastTargets);
      if (targets.has(tabId)) {
        targets.delete(tabId);
      } else {
        targets.add(tabId);
      }
      return { broadcastTargets: targets };
    });
  },

  confirmBroadcast: () => set({ broadcastActive: true, broadcastSelecting: false }),

  stopBroadcast: () => set({ broadcastActive: false, broadcastTargets: new Set() }),
}));
