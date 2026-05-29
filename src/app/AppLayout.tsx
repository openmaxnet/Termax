/**
 * 主布局编排器
 * 应用的主体框架编排：标题栏、侧边栏、主区域、状态栏的布局组合，
 * 负责连接生命周期管理（新建/编辑/删除/连接/重连/关闭）、
 * 分屏管理、SFTP 窗口管理、监控数据轮询
 */
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { MainArea } from './MainArea';
import { DebugPanel } from '@/app/DebugPanel';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { ipc } from '@/lib/ipc';
import type { ConnectionConfig } from '@/lib/ipc';
import { useMonitorPolling } from '@/features/monitoring/useMonitorPolling';
import { useSplitManager } from '@/features/terminal/useSplitManager';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// 懒加载非首屏组件，推迟到首次使用时才加载，减小初始 bundle
const MonitorOverlay = React.lazy(() => import('@/features/monitoring/MonitorOverlay').then((m) => ({ default: m.MonitorOverlay })));
const QuickPanel = React.lazy(() => import('@/features/connection/QuickPanel').then((m) => ({ default: m.QuickPanel })));
const ConnectionManager = React.lazy(() => import('@/features/connection/ConnectionManager').then((m) => ({ default: m.ConnectionManager })));
const SettingsDialog = React.lazy(() => import('@/features/settings/SettingsDialog').then((m) => ({ default: m.SettingsDialog })));
const CredentialManager = React.lazy(() => import('@/features/credential/CredentialManager').then((m) => ({ default: m.CredentialManager })));
const SftpLayout = React.lazy(() => import('@/features/sftp/SftpLayout').then((m) => ({ default: m.SftpLayout })));
const SftpWorkspace = React.lazy(() => import('@/features/sftp/SftpWorkspace').then((m) => ({ default: m.SftpWorkspace })));

export const AppLayout: React.FC = () => {
  const { t } = useI18n();
  const [showQuick, setShowQuick] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sftpOpen, setSftpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<ConnectionConfig[]>([]);
  const [editConfig, setEditConfig] = useState<ConnectionConfig | null>(null);
  const [managerEntry, setManagerEntry] = useState<'ssh' | 'wsl'>('ssh');
  const [monitorActive, setMonitorActive] = useState(false);
  const [monitorInterval, setMonitorInterval] = useState(5000);

  const sftpMode = useSettingsStore((s) => s.sftpMode);
  // Subscribe to tabs with order-insensitive comparison so that
  // drag-reorder (moveTab) does NOT trigger AppLayout re-renders.
  // Only count / identity / connection / type changes cause re-renders.
  const tabs = useStoreWithEqualityFn(
    useTerminalStore,
    (s) => s.tabs,
    (a, b) => {
      if (a.length !== b.length) return false;
      // 按 ID 构建 Map 用于无序比较，避免拖拽排序触发重渲染
      const byId = (arr: typeof a) => {
        const m = new Map<string, typeof a[0]>();
        for (const t of arr) m.set(t.id, t);
        return m;
      };
      const aMap = byId(a);
      const bMap = byId(b);
      for (const [id, at] of aMap) {
        const bt = bMap.get(id);
        if (!bt) return false;
        if (at.connected !== bt.connected || at.type !== bt.type || at.sessionId !== bt.sessionId || at.config?.id !== bt.config?.id || at.shellPath !== bt.shellPath || at.title !== bt.title) return false;
      }
      return true;
    },
  );
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const addTab = useTerminalStore((s) => s.addTab);
  const setActive = useTerminalStore((s) => s.setActive);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => { loadConfigs(); }, []);

  // 从后端加载所有已保存的连接配置
  const loadConfigs = async () => {
    try { setSavedConfigs(await ipc.config.load()); } catch {}
  };

  // 处理 SSH 连接：新建标签页、加载配置、关闭侧边栏
  const handleConnect = useCallback(async (data: ConnectionConfig) => {
    addTab(data.name || `${data.username}@${data.host}`, data);
    await loadConfigs();
    setSidebarOpen(false);
  }, [addTab, loadConfigs]);

  // 处理本地终端连接：检测默认 shell，新建本地标签页
  const handleLocalConnect = useCallback(async (shellPath?: string) => {
    let path = shellPath;
    if (!path) {
      try {
        const shells = await ipc.local.detectShells();
        path = shells.find(s => s.default)?.path || shells[0]?.path;
      } catch {}
    }
    const id = addTab(t('quick.local'), null, 'local');
    if (path) useTerminalStore.getState().setShellPath(id, path);
  }, [addTab, t]);

  // 处理 WSL 发行版连接：检测已安装的发行版，使用默认或第一个
  const handleWslConnect = useCallback(async () => {
    try {
      const distros = await ipc.local.detectWslDistros();
      if (distros.length === 0) return;
      const saved = useSettingsStore.getState().wslDistro;
      const distro = saved && distros.some(d => d.name === saved) ? saved : distros[0].name;
      const id = addTab(`WSL: ${distro}`, null, 'wsl');
      useTerminalStore.getState().setShellPath(id, distro);
    } catch {}
  }, [addTab]);

  const { split, doSplit, closeSplit, handleTabClick, confirmReplace, pendingReplace, pendingSftpConfig, setPendingReplace, setPendingSftpConfig } = useSplitManager(tabs, activeTab, addTab, setActive);

  // 处理传输连接：创建/激活 transfer 标签页 + 将主机添加到右侧面板
  const handleSftpConnect = useCallback(async (config: ConnectionConfig) => {
    // 确保 transfer 标签页存在
    const { tabs: curTabs } = useTerminalStore.getState();
    const transferTab = curTabs.find(t => t.type === 'transfer');
    if (!transferTab) {
      addTab('SFTP', null, 'transfer');
    } else {
      setActive(transferTab.id);
    }
    // 将主机添加到右侧面板
    const { useSftpStore } = await import('@/stores/sftpStore');
    useSftpStore.getState().addRightTab(config);
    setSidebarOpen(false);
  }, [addTab, setActive]);

  // 删除连接配置并刷新列表
  const handleDeleteConfig = useCallback(async (id: string) => {
    try { await ipc.config.delete(id); await loadConfigs(); } catch {}
  }, []);

  // If split references a tab that no longer exists, exit split
  useEffect(() => {
    if (!split) return;
    const currentTabs = useTerminalStore.getState().tabs;
    const leftExists = currentTabs.some(t => t.id === split.leftTabId);
    const rightExists = currentTabs.some(t => t.id === split.rightTabId);
    if (!leftExists || !rightExists) setPendingReplace(null);
  }, [tabs.length, split]);

  const connectedCount = useTerminalStore((s) => s.tabs.reduce((n, t) => t.connected ? n + 1 : n, 0));

  // SSH 标签页激活时自动轮询监控数据
  const { data: monitorData, error: monitorError, refresh: handleMonitorRefresh } = useMonitorPolling(
    activeTabId,
    !!(activeTab?.config && activeTab.type === 'ssh' && activeTab.connected),
    activeTab?.config,
    monitorInterval,
  );

  const terminalContent = <MainArea
    tabs={tabs} split={split} activeTabId={activeTabId}
    setActive={setActive} closeSplit={closeSplit}
    onConnect={handleConnect} onSftpConnect={handleSftpConnect}
  />;

  return (
    <Suspense fallback={null}>
    <div className="flex flex-col w-full h-full" onContextMenu={(e) => { e.preventDefault(); }}>
      <TitleBar
        onNewConnection={() => setShowQuick(true)}
        onSftpConnect={handleSftpConnect}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCredentialManager={() => setCredentialOpen(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onTabClick={handleTabClick}
        onSplit={doSplit}
        onCloseSplit={closeSplit}
        isSplit={!!split} sidebarOpen={sidebarOpen}
      />
      <div className="flex flex-1 min-h-0" style={{ position: 'relative' }}>
        <Sidebar savedConfigs={savedConfigs} onConnectTo={handleConnect} onDeleteConfig={handleDeleteConfig} onEditConfig={(c) => { setEditConfig(c); setManagerEntry('ssh'); setShowManager(true); }} onSftpConnect={handleSftpConnect} onRefresh={loadConfigs} onClose={() => setSidebarOpen(false)} open={sidebarOpen} />
        <main className="flex-1 min-h-0">{terminalContent}</main>
        {sftpMode === 'side' && sftpOpen && (
          <Suspense fallback={null}><SftpLayout config={activeTab?.config ?? { id: '', name: '传输', host: '', port: 22, username: '', auth_method: { Password: '' }, bastion: [] }} visible={sftpOpen} onClose={() => setSftpOpen(false)}>
            <SftpWorkspace visible={sftpOpen} mode="side" />
          </SftpLayout></Suspense>
        )}
        {monitorActive && (
          <MonitorOverlay
            data={monitorData}
            loading={!monitorData && !monitorError}
            error={monitorError}
            config={activeTab?.config ?? undefined}
            onRefresh={handleMonitorRefresh}
            onClose={() => setMonitorActive(false)}
            interval={monitorInterval}
            onIntervalChange={setMonitorInterval}
          />
        )}
      </div>
      <QuickPanel open={showQuick} onClose={() => setShowQuick(false)} onNewSSH={() => { setShowQuick(false); setEditConfig(null); setManagerEntry('ssh'); setShowManager(true); }} onLocalConnect={handleLocalConnect} onConnect={handleConnect} onSftpConnect={handleSftpConnect} onWslConnect={handleWslConnect} />
      <ConnectionManager open={showManager} onClose={() => setShowManager(false)} editConfig={editConfig} onConnect={handleConnect} onConfigsChange={loadConfigs} entryType={managerEntry} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CredentialManager open={credentialOpen} onClose={() => setCredentialOpen(false)} />

      {/* Split replace confirm */}
      <AlertDialog open={!!(pendingReplace !== null || pendingSftpConfig) && !!split} onOpenChange={(v) => { if (!v) { setPendingReplace(null); setPendingSftpConfig(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSftpConfig
                ? t('titleBar.replaceSplit', { title: `SFTP: ${pendingSftpConfig.name || pendingSftpConfig.host}` })
                : t('titleBar.replaceSplit', { title: tabs.find(t => t.id === pendingReplace)?.title || '' })
              }
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('titleBar.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>{t('titleBar.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <StatusBar
        connectionCount={connectedCount}
        activeHost={activeTab?.title}
        monitorActive={monitorActive}
        monitorData={monitorData}
        monitorError={monitorError}
        hasActiveSsh={!!(activeTab?.config && activeTab.type === 'ssh' && activeTab.connected)}
        onToggleMonitor={() => setMonitorActive((v) => !v)}
      />
      <DebugPanel />
    </div>
    </Suspense>
  );
};
