/**
 * 分屏管理器 Hook
 * 管理终端标签页的水平/垂直分屏、替换、关闭逻辑
 */
import { useRef, useCallback, useState } from 'react';
import type { ConnectionConfig } from '@/lib/ipc';
import type { TabInfo } from '@/stores/terminalStore';

/** 分屏状态：方向 + 左右两个标签页 id */
interface SplitState { direction: 'horizontal' | 'vertical'; leftTabId: string; rightTabId: string; }

export function useSplitManager(
  tabs: TabInfo[],
  activeTab: TabInfo | undefined,
  addTab: (title: string, config: ConnectionConfig | null, type?: 'ssh' | 'local' | 'transfer') => string,
  setActive: (id: string) => void,
) {
  const [split, setSplit] = useState<SplitState | null>(null);
  // 待替换的标签页 id（用户在分屏模式下点击第三个标签时触发）
  const [pendingReplace, setPendingReplace] = useState<string | null>(null);
  const [pendingSftpConfig, setPendingSftpConfig] = useState<ConnectionConfig | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const doSplit = useCallback((direction: 'horizontal' | 'vertical') => {
    if (!activeTab || !activeTab.config || activeTab.type === 'transfer') return;
    if (split) {
      // 已分屏则只切换方向
      setSplit((prev) => prev ? { ...prev, direction } : null);
      return;
    }
    const currentTabs = tabsRef.current;
    // 优先复用已有同配置的同类型标签，避免重复创建
    const other = currentTabs.find((t) => t.id !== activeTab.id
      && t.config?.id === activeTab.config?.id && t.type === activeTab.type);
    if (other) {
      const origIdx = currentTabs.indexOf(other);
      const actIdx = currentTabs.indexOf(activeTab);
      setSplit({ direction, leftTabId: (actIdx < origIdx ? activeTab : other).id, rightTabId: (actIdx < origIdx ? other : activeTab).id });
      setActive(actIdx < origIdx ? activeTab.id : other.id);
      return;
    }
    // 没有可复用的标签，新建一个同配置的标签
    let title = `${activeTab.title} (2)`;
    if (currentTabs.some((t) => t.title === title)) {
      const n = currentTabs.filter((t) => t.title.startsWith(activeTab.title)).length + 1;
      title = `${activeTab.title} (${n})`;
    }
    const newTabId = addTab(title, activeTab.config!);
    setSplit({ direction, leftTabId: activeTab.id, rightTabId: newTabId });
  }, [activeTab, split, addTab, setActive]);

  const closeSplit = useCallback((remaining?: 'left' | 'right') => {
    if (!split) return;
    if (remaining === 'right') setActive(split.rightTabId);
    else setActive(split.leftTabId);
    setSplit(null);
  }, [split, setActive]);

  // 分屏模式下点击第三个非分屏标签，标记待替换
  const handleTabClick = useCallback((tabId: string) => {
    if (!split) return;
    if (tabId === split.leftTabId || tabId === split.rightTabId) return;
    setPendingReplace(tabId);
  }, [split]);

  const confirmReplace = useCallback(() => {
    if (!split) return;
    if (pendingSftpConfig) {
      const newId = addTab('传输', pendingSftpConfig, 'transfer');
      setSplit((prev) => prev ? { ...prev, rightTabId: newId } : null);
      setPendingSftpConfig(null);
    } else if (pendingReplace) {
      setSplit((prev) => prev ? { ...prev, rightTabId: pendingReplace! } : null);
      setPendingReplace(null);
    }
  }, [pendingReplace, pendingSftpConfig, split, addTab]);

  return { split, doSplit, closeSplit, handleTabClick, confirmReplace, pendingReplace, pendingSftpConfig, setPendingReplace, setPendingSftpConfig };
}
