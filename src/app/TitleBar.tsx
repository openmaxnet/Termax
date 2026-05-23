/**
 * 标题栏组件
 * 应用窗口的顶部标题栏，包含：窗口控制按钮（最小化/最大化/关闭）、
 * 标签页管理（拖拽排序/滚动/右键菜单）、主题切换、设置入口
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useI18n } from '@/i18n';
import { ipc } from '@/lib/ipc';
import type { ConnectionConfig } from '@/lib/ipc';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';

interface TitleBarProps {
  onNewConnection: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onSplit: (direction: 'horizontal' | 'vertical') => void;
  onCloseSplit: () => void;
  onSftpConnect?: (config: ConnectionConfig) => void;
  onTabClick?: (tabId: string) => void;
  isSplit: boolean;
  sidebarOpen: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onNewConnection, onOpenSettings, onToggleSidebar,
  onSplit, onCloseSplit, onSftpConnect, onTabClick, isSplit, sidebarOpen,
}) => {
  const [maximized, setMaximized] = useState(false);
  const [showSplitMenu, setShowSplitMenu] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const appTheme = useSettingsStore((s) => s.appTheme);
  const toggleAppTheme = useSettingsStore((s) => s.toggleAppTheme);
  const { t } = useI18n();
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActive = useTerminalStore((s) => s.setActive);
  const addTab = useTerminalStore((s) => s.addTab);
  const removeTab = useTerminalStore((s) => s.removeTab);
  const moveTab = useTerminalStore((s) => s.moveTab);
  const broadcastActive = useTerminalStore((s) => s.broadcastActive);
  const broadcastSelecting = useTerminalStore((s) => s.broadcastSelecting);
  const broadcastTargets = useTerminalStore((s) => s.broadcastTargets);
  const enterBroadcastSelect = useTerminalStore((s) => s.enterBroadcastSelect);
  const exitBroadcastSelect = useTerminalStore((s) => s.exitBroadcastSelect);
  const toggleBroadcastTarget = useTerminalStore((s) => s.toggleBroadcastTarget);
  const confirmBroadcast = useTerminalStore((s) => s.confirmBroadcast);
  const stopBroadcast = useTerminalStore((s) => s.stopBroadcast);
  const tabsRef = useRef<HTMLDivElement>(null!);
  const [showScrollBtns, setShowScrollBtns] = useState(false);
  const [confirmClose, setConfirmClose] = useState<{ id: string; title: string; sessionId: string | null; type: string; action?: 'closeOthers' | 'closeRight' } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // 拖拽排序结束：将标签从旧位置移到新位置
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentTabs = useTerminalStore.getState().tabs;
    const oldIdx = currentTabs.findIndex((t) => t.id === active.id);
    const newIdx = currentTabs.findIndex((t) => t.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) moveTab(oldIdx, newIdx);
  }, [moveTab]);

  // 切换窗口最大化/还原状态
  const handleMaximize = async () => {
    const w = getCurrentWindow();
    await w.toggleMaximize();
    setMaximized(await w.isMaximized());
  };
  // 最小化窗口
  const handleMinimize = async () => { await getCurrentWindow().minimize(); };
  // 关闭窗口
  const handleClose = async () => { await getCurrentWindow().close(); };

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    // 检测标签栏是否需要滚动按钮（内容超出容器宽度时显示）
    const check = () => setShowScrollBtns(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs.length]);

  // 关闭标签页：根据 confirmTabClose 设置决定是否弹出确认对话框
  const doCloseTab = (tab: { id: string; title: string; type: string; sessionId: string | null; connected: boolean }) => {
    if (useSettingsStore.getState().confirmTabClose) {
      setConfirmClose({ id: tab.id, title: tab.title, sessionId: tab.sessionId, type: tab.type });
      return;
    }
    if (tab.type !== 'transfer' && tab.sessionId) {
      (tab.type === 'local' ? ipc.local.disconnect : ipc.ssh.disconnect)(tab.sessionId).catch(() => {});
    }
    removeTab(tab.id);
  };

  // 水平滚动标签栏（每次滚动 150px）
  const scrollTabs = (dir: 'left' | 'right') => {
    tabsRef.current?.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div style={{ flexShrink: 0 }}>
    <div data-tauri-drag-region style={{
      height: 32, display: 'flex', alignItems: 'center', gap: 2,
      background: 'var(--tx-bg-elevated)', borderBottom: '1px solid var(--tx-border-light)',
      padding: '1px 4px', fontSize: 12,
    }}>
      {/* LEFT */}
      <div className="flex items-center" style={{ gap: 1, height: '100%' }}>
        <span data-sidebar-toggle>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} />}>
              <Icon icon={sidebarOpen ? 'solar:sidebar-minimalistic-linear' : 'solar:sidebar-minimalistic-outline'} width={18} height={18} />
            </TooltipTrigger>
            <TooltipContent>{t('titleBar.toggleSidebar')}</TooltipContent>
          </Tooltip>
        </span>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onNewConnection} />}>
            <Icon icon="solar:add-square-outline" width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{t('titleBar.newConnection')}</TooltipContent>
        </Tooltip>
      </div>

      {/* TABS */}
      {tabs.length > 0 && (
        <div className="flex items-center" style={{ flex: 1, minWidth: 0, height: '100%', gap: 1 } as React.CSSProperties}>
          {showScrollBtns && <Button variant="ghost" size="icon-xs" onClick={() => scrollTabs('left')}><Icon icon="solar:alt-arrow-left-linear" width={14} height={14} /></Button>}
          <div ref={tabsRef} className="flex items-center gap-px overflow-x-auto hide-scrollbar"
            style={{ flex: 1, height: '100%', scrollBehavior: 'smooth', padding: '1px 0' } as React.CSSProperties}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
              <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const showClose = hoveredTab === tab.id;
                  return (
                    <SortableTab key={tab.id} tab={tab} isActive={isActive} showClose={showClose}
                      hoveredTab={hoveredTab} setHoveredTab={setHoveredTab}
                      isSplit={isSplit} onTabClick={onTabClick}
                      setActive={setActive} doCloseTab={doCloseTab} setConfirmClose={setConfirmClose}
                      broadcastSelecting={broadcastSelecting} broadcastActive={broadcastActive}
                      broadcastTargets={broadcastTargets} onToggleBroadcastTarget={toggleBroadcastTarget} />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
          {showScrollBtns && <Button variant="ghost" size="icon-xs" onClick={() => scrollTabs('right')}><Icon icon="solar:alt-arrow-right-linear" width={14} height={14} /></Button>}
        </div>
      )}

      {tabs.length === 0 && <div style={{ flex: 1 }} />}

      {/* RIGHT */}
      <div className="flex items-center" style={{ gap: 1, height: '100%' }}>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm"
            className={activeTab?.type === 'transfer' ? 'bg-accent text-accent-foreground' : undefined}
            onClick={() => {
              if (activeTab?.type === 'transfer') {
                removeTab(activeTab.id);
                return;
              }
              const existing = tabs.find(t => t.type === 'transfer');
              if (existing) { setActive(existing.id); if (isSplit) onTabClick?.(existing.id); return; }
              if (activeTab?.type === 'ssh' && activeTab.config) {
                onSftpConnect?.(activeTab.config);
              } else {
                addTab('SFTP', null, 'transfer');
              }
            }} />}>
            <Icon icon="solar:folder-with-files-linear" width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{activeTab?.type === 'transfer' ? t('titleBar.closeTab') : t('titleBar.sftpBrowser')}</TooltipContent>
        </Tooltip>
        {activeTab && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%' }}>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => setShowSplitMenu(!showSplitMenu)} />}>
                <Icon icon={isSplit ? 'solar:minimize-square-linear' : 'solar:mirror-right-outline'} width={18} height={18} />
              </TooltipTrigger>
              <TooltipContent>{isSplit ? t('titleBar.closeSplit') : t('titleBar.splitTerminal')}</TooltipContent>
            </Tooltip>
            {showSplitMenu && (
              <><div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowSplitMenu(false)} />
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 40, background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)', borderRadius: 'var(--tx-radius-md)', boxShadow: 'var(--tx-shadow-md)', padding: 4, minWidth: 120 }}>
                {isSplit ? (
                  <>
                    <MenuBtn icon="solar:slider-vertical-linear" label={t('titleBar.splitRight')} onClick={() => { setShowSplitMenu(false); onSplit('horizontal'); }} />
                    <MenuBtn icon="solar:slider-horizontal-outline" label={t('titleBar.splitDown')} onClick={() => { setShowSplitMenu(false); onSplit('vertical'); }} />
                    <div style={{ height: 1, background: 'var(--tx-border-light)', margin: '4px 0' }} />
                    <MenuBtn icon="solar:close-square-linear" label={t('titleBar.closeSplit')} onClick={() => { setShowSplitMenu(false); onCloseSplit(); }} />
                  </>
                ) : (
                  <>
                    <MenuBtn icon="solar:slider-vertical-linear" label={t('titleBar.splitRight')} onClick={() => { setShowSplitMenu(false); onSplit('horizontal'); }} />
                    <MenuBtn icon="solar:slider-horizontal-outline" label={t('titleBar.splitDown')} onClick={() => { setShowSplitMenu(false); onSplit('vertical'); }} />
                  </>
                )}
              </div></>
            )}
          </div>
        )}
        {/* 广播输入按钮：仅终端 Tab ≥ 2 时显示 */}
        {tabs.filter(t => t.type !== 'transfer').length >= 2 && (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm"
              className={(broadcastActive || broadcastSelecting) ? 'bg-accent text-accent-foreground' : undefined}
              onClick={() => {
                if (broadcastActive) {
                  stopBroadcast();
                } else if (broadcastSelecting) {
                  exitBroadcastSelect();
                } else {
                  enterBroadcastSelect();
                }
              }} />}>
              <Icon icon="solar:compass-square-broken" width={18} height={18} />
            </TooltipTrigger>
            <TooltipContent>{broadcastActive
              ? t('titleBar.broadcastActive', { count: String(broadcastTargets.size) })
              : broadcastSelecting
                ? t('titleBar.broadcastSelecting')
                : t('titleBar.toggleBroadcast')}</TooltipContent>
          </Tooltip>
        )}
        <div style={{ width: 1, height: 18, background: 'var(--tx-border-light)', margin: '0 4px' }} />
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={toggleAppTheme} />}>
            <Icon icon={appTheme === 'system' ? 'solar:tablet-broken' : appTheme === 'dark' ? 'solar:moon-linear' : 'solar:sun-linear'} width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{t('titleBar.toggleTheme')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onOpenSettings} />}>
            <Icon icon="solar:settings-linear" width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{t('titleBar.settings')}</TooltipContent>
        </Tooltip>
        <div style={{ width: 1, height: 18, background: 'var(--tx-border-light)', margin: '0 4px' }} />
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={handleMinimize} onPointerDown={(e) => e.stopPropagation()} />}>
            <Icon icon="solar:minimize-square-minimalistic-outline" width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{t('titleBar.minimize')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={handleMaximize} onPointerDown={(e) => e.stopPropagation()} />}>
            <Icon icon={maximized ? 'solar:minimize-square-3-linear' : 'solar:maximize-square-3-linear'} width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{maximized ? t('titleBar.restore') : t('titleBar.maximize')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" className="hover:bg-red-500 hover:text-white" onClick={handleClose} onPointerDown={(e) => e.stopPropagation()} />}>
            <Icon icon="solar:notification-remove-outline" width={18} height={18} />
          </TooltipTrigger>
          <TooltipContent>{t('titleBar.closeWindow')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Close confirm dialog */}
      <AlertDialog open={!!confirmClose} onOpenChange={(v) => { if (!v) setConfirmClose(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('titleBar.closeTab')}</AlertDialogTitle>
            <AlertDialogDescription>{t('titleBar.confirmCloseTab', { title: confirmClose?.title || '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('titleBar.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!confirmClose) return;
              const { id, sessionId, type, action } = confirmClose;
              if (type === 'bulk' && action === 'closeOthers') {
                tabs.filter(t => t.id !== id).forEach(t => {
                  if (t.type !== 'transfer' && t.sessionId) { (t.type === 'local' ? ipc.local.disconnect : ipc.ssh.disconnect)(t.sessionId).catch(() => {}); }
                  removeTab(t.id);
                });
              } else if (type === 'bulk' && action === 'closeRight') {
                const idx = tabs.findIndex(t => t.id === id);
                tabs.filter((_, i) => i > idx).forEach(t => {
                  if (t.type !== 'transfer' && t.sessionId) { (t.type === 'local' ? ipc.local.disconnect : ipc.ssh.disconnect)(t.sessionId).catch(() => {}); }
                  removeTab(t.id);
                });
              } else {
                if (type !== 'transfer' && sessionId) {
                  (type === 'local' ? ipc.local.disconnect : ipc.ssh.disconnect)(sessionId).catch(() => {});
                }
                removeTab(id);
              }
              setConfirmClose(null);
            }}>{t('titleBar.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    {/* 广播多选模式浮动操作栏 */}
    {broadcastSelecting && (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        height: 36, background: 'var(--tx-bg-elevated)', borderBottom: '1px solid var(--tx-border-light)',
        fontSize: 12, padding: '0 16px',
      }}>
        <span style={{ color: 'var(--tx-text-secondary)' }}>
          {t('titleBar.broadcastSelected', { count: String(broadcastTargets.size) })}
        </span>
        <button onClick={exitBroadcastSelect}
          style={{
            padding: '4px 12px', borderRadius: 'var(--tx-radius-sm)', border: '1px solid var(--tx-border-light)',
            background: 'var(--tx-bg-surface)', color: 'var(--tx-text-primary)', cursor: 'pointer', fontSize: 12,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--tx-bg-surface)'; }}
        >{t('titleBar.broadcastCancel')}</button>
        <button onClick={confirmBroadcast}
          style={{
            padding: '4px 12px', borderRadius: 'var(--tx-radius-sm)', border: 'none',
            background: broadcastTargets.size > 0 ? 'var(--tx-accent-default)' : 'var(--tx-bg-hover)',
            color: broadcastTargets.size > 0 ? '#fff' : 'var(--tx-text-tertiary)',
            cursor: broadcastTargets.size > 0 ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 500,
          }}
        >{t('titleBar.broadcastConfirm')}</button>
      </div>
    )}
    </div>
  );
};

/* ── 可拖拽排序的标签页 ── */

/** 单个标签页：支持 dnd-kit 拖拽排序、右键菜单、连接状态指示器 */
const SortableTab: React.FC<{
  tab: { id: string; title: string; type: string; connected: boolean; sessionId: string | null; config?: { host?: string } | null };
  isActive: boolean; showClose: boolean; hoveredTab: string | null;
  setHoveredTab: (id: string | null) => void; isSplit: boolean;
  onTabClick?: (id: string) => void;
  setActive: (id: string) => void; doCloseTab: (tab: any) => void;
  setConfirmClose: (v: { id: string; title: string; sessionId: string | null; type: string; action?: 'closeOthers' | 'closeRight' } | null) => void;
  broadcastSelecting: boolean; broadcastActive: boolean; broadcastTargets: Set<string>;
  onToggleBroadcastTarget: (tabId: string) => void;
}> = ({ tab, isActive, showClose, hoveredTab, setHoveredTab, isSplit, onTabClick, setActive, doCloseTab, setConfirmClose,
        broadcastSelecting, broadcastActive, broadcastTargets, onToggleBroadcastTarget }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', height: 28,
    borderRadius: 'var(--tx-radius-sm)', cursor: 'grab', fontSize: 12,
    fontWeight: isActive ? 500 : 400,
    color: isActive || hoveredTab === tab.id ? 'var(--tx-text-primary)' : 'var(--tx-text-tertiary)',
    background: isActive ? 'var(--tx-bg-base)' : hoveredTab === tab.id ? 'var(--tx-bg-hover)' : 'transparent',
    border: isActive ? '1px solid var(--tx-border-light)' : '1px solid transparent',
    whiteSpace: 'nowrap' as const, userSelect: 'none' as const,
    transition: transition || 'background 0.12s, color 0.12s, border-color 0.12s',
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 99 : undefined,
  };

  const canSelect = tab.type !== 'transfer';
  const isTarget = broadcastTargets.has(tab.id);

  const { t } = useI18n();

  const handleCloseOthers = () => {
    const allTabs = useTerminalStore.getState().tabs;
    const others = allTabs.filter(t => t.id !== tab.id);
    if (others.length === 0) return;
    const confirm = useSettingsStore.getState().confirmTabClose;
    if (confirm && others.some(t => t.connected && t.sessionId)) {
      setConfirmClose({ id: tab.id, title: t('titleBar.closeOthers'), sessionId: null, type: 'bulk', action: 'closeOthers' });
      return;
    }
    others.forEach(t => { if (t.type !== 'transfer' && t.sessionId) { (t.type === 'local' ? ipc.local.disconnect : ipc.ssh.disconnect)(t.sessionId).catch(() => {}); } useTerminalStore.getState().removeTab(t.id); });
  };

  const handleCloseRight = () => {
    const allTabs = useTerminalStore.getState().tabs;
    const idx = allTabs.findIndex(t => t.id === tab.id);
    const right = allTabs.filter((_, i) => i > idx);
    if (right.length === 0) return;
    const confirm = useSettingsStore.getState().confirmTabClose;
    if (confirm && right.some(t => t.connected && t.sessionId)) {
      setConfirmClose({ id: '', title: t('titleBar.closeRight'), sessionId: null, type: 'bulk', action: 'closeRight' });
      return;
    }
    right.forEach(t => { if (t.type !== 'transfer' && t.sessionId) { (t.type === 'local' ? ipc.local.disconnect : ipc.ssh.disconnect)(t.sessionId).catch(() => {}); } useTerminalStore.getState().removeTab(t.id); });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">
        <div ref={setNodeRef} data-no-drag
          onClick={(e) => {
            if (broadcastSelecting && canSelect) {
              e.stopPropagation();
              onToggleBroadcastTarget(tab.id);
              return;
            }
            setActive(tab.id);
            if (isSplit) onTabClick?.(tab.id);
          }}
          onMouseEnter={() => setHoveredTab(tab.id)}
          onMouseLeave={() => setHoveredTab(null)}
          {...attributes} {...listeners}
          style={{ ...style, position: 'relative' }}>
      {/* 多选模式：勾选圆点 */}
      {broadcastSelecting ? (
        canSelect ? (
          <div style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isTarget ? 'var(--tx-accent-default)' : 'transparent',
            border: isTarget ? 'none' : '1.5px solid var(--tx-border-default)',
            transition: 'background 0.12s, border-color 0.12s',
          }}>
            {isTarget && <Icon icon="solar:check-circle-broken" width={10} height={10} color="#fff" />}
          </div>
        ) : (
          <Icon icon="solar:folder-with-files-linear" width={13} height={13} color="var(--tx-text-tertiary)" style={{ opacity: 0.5 }} />
        )
      ) : tab.type === 'transfer' ? (
        <Icon icon="solar:folder-with-files-linear" width={13} height={13}
          color={tab.connected ? 'var(--tx-green)' : '#eab308'}
          style={{ animation: !tab.connected ? 'pulse 1.5s ease-in-out infinite' : undefined }} />
      ) : (
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: tab.connected ? 'var(--tx-green)' : tab.sessionId ? 'var(--tx-red)' : '#eab308',
          boxShadow: tab.connected ? '0 0 4px var(--tx-green)' : 'none',
          animation: !tab.connected && !tab.sessionId ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
      )}
      <span style={{ lineHeight: 1 }}>{tab.title}</span>
      {showClose && !broadcastSelecting && (
        <span onClick={(e) => { e.stopPropagation(); doCloseTab(tab); }}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, cursor: 'pointer', color: 'var(--tx-text-tertiary)', borderRadius: 2 }}>
          <Icon icon="solar:close-square-outline" width={12} height={12} />
        </span>
      )}
      {/* 广播模式：底部橙色指示条 */}
      {broadcastActive && isTarget && (
        <div style={{ position: 'absolute', bottom: 0, left: 4, right: 4, height: 2, borderRadius: 1, background: 'var(--tx-accent-default)' }} />
      )}
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem disabled>
      <Icon icon={tab.type === 'transfer' ? 'solar:folder-with-files-linear' : 'solar:laptop-minimalistic-outline'} width={14} height={14} />
      {tab.title}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => doCloseTab(tab)}>
      <Icon icon="solar:close-circle-linear" width={14} height={14} />{t('titleBar.closeTab')}
    </ContextMenuItem>
    <ContextMenuItem onClick={handleCloseOthers}>
      <Icon icon="solar:close-square-linear" width={14} height={14} />{t('titleBar.closeOthers')}
    </ContextMenuItem>
    <ContextMenuItem onClick={handleCloseRight}>
      <Icon icon="solar:close-square-linear" width={14} height={14} />{t('titleBar.closeRight')}
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
  );
};


/* ── 分屏菜单项 ── */

/** 分屏菜单按钮：图标 + 标签 */
const MenuBtn: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', width: '100%', border: 'none', background: 'transparent', color: 'var(--tx-text-primary)', cursor: 'pointer', fontSize: 12, borderRadius: 4, transition: 'background 0.12s' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    <Icon icon={icon} width={15} height={15} color="var(--tx-text-tertiary)" />
    {label}
  </button>
);
