/**
 * SFTP 传输工作区
 * 双面板布局：左侧默认本地文件（可加远程标签），右侧远程主机标签。
 * 面板顶部使用标签栏（仿 TitleBar 风格），不再使用下拉选择器。
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Server } from 'lucide-react';
import { ipc, events } from '@/lib/ipc';
import type { ConnectionConfig } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useTerminalStore, type TerminalStore } from '@/stores/terminalStore';
import { useTransferHistoryStore } from '@/stores/transferHistoryStore';
import { useSftpStore, type PaneTab, type SftpStoreState } from '@/stores/sftpStore';
import { SftpPane } from './SftpPane';
import { SftpDeleteDialog } from './SftpDeleteDialog';
import { TransferHistoryPanel } from './TransferHistoryPanel';
import type { TransferItem } from './SftpTransferPanel';

interface FileEntry { name: string; path: string; is_dir: boolean; size: number; mtime: number; permissions: number | null; uid: number | null; gid: number | null; user: string | null; group: string | null; }

export interface SftpWorkspaceProps {
  config?: ConnectionConfig; // 可选：初始远程主机配置
  visible: boolean;
  mode?: 'side' | 'tab';
  tabId?: string;
}

export const SftpWorkspace: React.FC<SftpWorkspaceProps> = ({ config: initialConfig, visible, mode = 'side', tabId }) => {
  const { t } = useI18n();
  const setConnected = useTerminalStore((s: TerminalStore) => s.setConnected);
  const leftTabs = useSftpStore((s: SftpStoreState) => s.leftTabs);
  const leftActiveId = useSftpStore((s: SftpStoreState) => s.leftActiveId);
  const rightTabs = useSftpStore((s: SftpStoreState) => s.rightTabs);
  const rightActiveId = useSftpStore((s: SftpStoreState) => s.rightActiveId);
  const removeLeftTab = useSftpStore((s: SftpStoreState) => s.removeLeftTab);
  const setLeftActive = useSftpStore((s: SftpStoreState) => s.setLeftActive);
  const addRightTab = useSftpStore((s: SftpStoreState) => s.addRightTab);
  const removeRightTab = useSftpStore((s: SftpStoreState) => s.removeRightTab);
  const setRightActive = useSftpStore((s: SftpStoreState) => s.setRightActive);

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [showTransferHistory, setShowTransferHistory] = useState(false);
  const [activeEdits, setActiveEdits] = useState<Array<{ id: string; path: string }>>([]);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<ConnectionConfig[]>([]);

  // 下载文件
  const handleDownload = useCallback(async (entry: FileEntry) => {
    const tab = rightTabs.find(t => t.id === rightActiveId) ?? leftTabs.find(t => t.id === leftActiveId);
    const sinkConfig = tab?.config;
    if (!sinkConfig) return;
    try {
      const transferId = crypto.randomUUID();
      setTransfers(prev => [...prev, {
        id: transferId, name: entry.name, direction: 'download' as const,
        bytesWritten: 0, totalBytes: entry.size, speedBps: 0,
        status: 'transferring' as const, startedAt: Date.now(),
      }]);
      setShowTransferHistory(true);
      const localPath = await ipc.sftp.downloadChunked(sinkConfig, entry.path, '', transferId);
      useTransferHistoryStore.getState().addRecord({
        id: transferId, name: entry.name, direction: 'download',
        totalBytes: entry.size, status: 'completed', localPath,
        startedAt: Date.now(), completedAt: Date.now(),
      });
    } catch {}
  }, [rightTabs, rightActiveId, leftTabs, leftActiveId]);
  const [showConfigPicker, setShowConfigPicker] = useState(false);
  const [singlePane, setSinglePane] = useState(false);
  const [activeSingleSide, setActiveSingleSide] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);
  const addRecord = useTransferHistoryStore((s) => s.addRecord);
  const archiveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── 打开配置选择器时加载已保存的远程配置 ──
  useEffect(() => {
    if (showConfigPicker) ipc.config.load().then(setSavedConfigs);
  }, [showConfigPicker]);

  // ── 初始化：有新远程配置时加到右侧面板 ──
  useEffect(() => {
    if (!visible || !initialConfig) return;
    const store = useSftpStore.getState();
    // 右侧去重
    const exists = store.rightTabs.some((t) => t.config?.id === initialConfig.id);
    if (!exists) store.addRightTab(initialConfig);
  }, [visible, initialConfig]);

  // ── 窄屏检测 ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSinglePane(el.clientWidth < 400));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 传输进度事件 ──
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    events.onSftpTransferProgress((payload) => {
      setTransfers(prev => prev.map(x =>
        x.id === payload.transfer_id ? {
          ...x,
          bytesWritten: payload.bytes_written, totalBytes: payload.total_bytes,
          speedBps: payload.speed_bps,
          status: payload.done ? (payload.error ? 'failed' : 'completed') : 'transferring',
          completedAt: payload.done ? Date.now() : undefined,
          error: payload.error ?? undefined,
        } : x,
      ));
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // ── 传输归档 ──
  useEffect(() => {
    for (const tr of transfers) {
      if ((tr.status === 'completed' || tr.status === 'failed') && !archiveTimers.current.has(tr.id)) {
        const timer = setTimeout(() => {
          addRecord({ id: tr.id, name: tr.name, direction: tr.direction, totalBytes: tr.totalBytes, status: tr.status, error: tr.error, localPath: tr.localPath, startedAt: tr.startedAt, completedAt: tr.completedAt ?? Date.now() });
          setTransfers((prev) => prev.filter((x) => x.id !== tr.id));
        }, 3000);
        archiveTimers.current.set(tr.id, timer);
      }
    }
    for (const [id, timer] of archiveTimers.current) {
      if (!transfers.some((x) => x.id === id)) { clearTimeout(timer); archiveTimers.current.delete(id); }
    }
  }, [transfers, addRecord]);

  // ── 卸载时清理 ──
  useEffect(() => () => { activeEdits.forEach((edit) => { ipc.edit.stop(edit.id).catch(() => {}); }); }, []);

  // ── 传输操作 ──
  const handleTransferCancel = useCallback(async (id: string) => {
    try { await ipc.sftp.cancelTransfer(id); } catch {}
    setTransfers(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled' as const, completedAt: Date.now() } : x));
  }, []);

  const handleTransferDismiss = useCallback((id: string) => setTransfers(prev => prev.filter(x => x.id !== id)), []);

  // ── 标签栏渲染 ──
  const renderPaneTabBar = (tabs: PaneTab[], activeId: string | null, onSelect: (id: string) => void, onRemove: (id: string) => void, onAdd: () => void) => (
    <div style={{ display: 'flex', gap: 1, padding: '2px 4px', borderBottom: '1px solid var(--tx-border-light)', flexShrink: 0, alignItems: 'center', overflow: 'hidden' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <div key={tab.id} onClick={() => onSelect(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', height: 24, borderRadius: 'var(--tx-radius-sm)',
              background: isActive ? 'var(--tx-bg-base)' : 'transparent',
              border: isActive ? '1px solid var(--tx-border-light)' : '1px solid transparent',
              color: isActive ? 'var(--tx-text-primary)' : 'var(--tx-text-tertiary)',
              cursor: 'pointer', fontSize: 11, fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap', maxWidth: 120, flexShrink: 0,
              overflow: 'hidden', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--tx-text-primary)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--tx-text-tertiary)'; }}>
            {/* 状态指示器 */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: tab.isLocal ? 'var(--tx-green)' : tab.config ? 'var(--tx-yellow)' : 'var(--tx-text-tertiary)',
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
            {tab.closable && (
              <span onClick={(e) => { e.stopPropagation(); onRemove(tab.id); }} style={{ cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                <Icon icon="solar:close-square-outline" width={12} height={12} color="var(--tx-text-tertiary)" />
              </span>
            )}
          </div>
        );
      })}
      {tabs.length < 10 && (
        <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 24, border: 'none', background: 'transparent', color: 'var(--tx-text-tertiary)', cursor: 'pointer', borderRadius: 'var(--tx-radius-sm)', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <Icon icon="solar:add-square-linear" width={14} height={14} />
        </button>
      )}
    </div>
  );

  if (!visible) return null;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--tx-bg-elevated)', fontSize: 12, overflow: 'hidden' }}>
      {/* 左右面板容器 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 左侧面板（标签栏 + 内容） */}
        {mode !== 'side' && (!singlePane || activeSingleSide === 'left') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderRight: '1px solid var(--tx-border-light)' }}>
            {renderPaneTabBar(leftTabs, leftActiveId, setLeftActive, removeLeftTab, () => setShowConfigPicker(true))}
            <SftpPane
              tabs={leftTabs} activeTabId={leftActiveId} side="left"
              compact={singlePane}
              activeTransfers={transfers} setActiveTransfers={setTransfers}
              onShowHistory={() => setShowTransferHistory(true)}
              activeEdits={activeEdits} setActiveEdits={setActiveEdits}
              onConnected={(ok) => { if (tabId) setConnected(tabId, ok); }}
              onDelete={setDeleteTarget} onDownload={handleDownload}
            />
          </div>
        )}
        {/* 右侧面板（标签栏 + 内容） */}
        {(!singlePane || activeSingleSide === 'right') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
            {renderPaneTabBar(rightTabs, rightActiveId, setRightActive, removeRightTab, () => setShowConfigPicker(true))}
            <SftpPane
              tabs={rightTabs} activeTabId={rightActiveId} side="right"
              compact={singlePane}
              activeTransfers={transfers} setActiveTransfers={setTransfers}
              onShowHistory={() => setShowTransferHistory(true)}
              activeEdits={activeEdits} setActiveEdits={setActiveEdits}
              onDelete={setDeleteTarget} onDownload={handleDownload}
            />
          </div>
        )}
      </div>

      {/* 窄屏切换（docked 模式不需要） */}
      {mode !== 'side' && singlePane && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0', borderTop: '1px solid var(--tx-border-light)', flexShrink: 0 }}>
          <button onClick={() => setActiveSingleSide(s => s === 'left' ? 'right' : 'left')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 12px', border: '1px solid var(--tx-border-light)', borderRadius: 'var(--tx-radius-sm)', background: 'var(--tx-bg-base)', color: 'var(--tx-text-secondary)', cursor: 'pointer', fontSize: 11 }}>
            <Icon icon={activeSingleSide === 'left' ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-left-linear'} width={12} height={12} />
            {activeSingleSide === 'left' ? t('sftpWorkspace.switchRight') : t('sftpWorkspace.switchLeft')}
          </button>
        </div>
      )}

      {/* 传输历史 */}
      <TransferHistoryPanel
        activeTransfers={transfers} visible={showTransferHistory}
        onClose={() => setShowTransferHistory(false)}
        onRetry={() => {}} onDismiss={handleTransferDismiss} onCancel={handleTransferCancel}
      />

      {/* 删除确认 */}
      {deleteTarget && (
        <SftpDeleteDialog target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => setDeleteTarget(null)} />
      )}

      {/* 已保存配置选择器 */}
      {showConfigPicker && (
        <>
          <div onClick={() => setShowConfigPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 40 }}>
            <div style={{
              background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)',
              borderRadius: 'var(--tx-radius-lg)', boxShadow: 'var(--tx-shadow-lg)',
              width: 320, maxHeight: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              animation: 'tx-scale-in 0.12s ease-out',
            }}>
              <div style={{ padding: '12px 16px 8px', fontSize: 13, fontWeight: 600, color: 'var(--tx-text-primary)' }}>选择远程主机</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                {savedConfigs.length === 0 && (
                  <Empty className="py-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Server size={28} /></EmptyMedia>
                      <EmptyTitle className="text-xs">{t('sftpWorkspace.noSavedConfigs')}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
                {savedConfigs.map((cfg) => (
                  <div key={cfg.id} onClick={() => { addRightTab(cfg); setShowConfigPicker(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--tx-radius-md)', cursor: 'pointer', fontSize: 13, transition: 'background 0.12s', color: 'var(--tx-text-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-active)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <Icon icon="solar:server-square-linear" width={16} height={16} color="var(--tx-text-tertiary)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{cfg.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-text-tertiary)', marginTop: 1, lineHeight: 1.4 }}>{cfg.username}@{cfg.host}:{cfg.port}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
