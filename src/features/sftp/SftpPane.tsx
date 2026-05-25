/**
 * SFTP 单面板文件浏览器
 * 支持本地文件系统浏览（tab.isLocal）和远程 SFTP 浏览。
 * 通过 tabs + activeTabId props 支持面板内多标签切换。
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Server } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ipc, events } from '@/lib/ipc';
import type { LocalFileEntry } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { fmtSftpError, normalizeSftpPath } from './utils';
import { SftpFileList } from './SftpFileList';
import { buildMenuItems } from './sftpMenuItems';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { PaneTab } from '@/stores/sftpStore';
import type { TransferItem } from './SftpTransferPanel';

interface FileEntry { name: string; path: string; is_dir: boolean; size: number; mtime: number; permissions: number | null; uid: number | null; gid: number | null; user: string | null; group: string | null; }

export interface SftpPaneProps {
  tabs: PaneTab[];
  activeTabId: string | null;
  side: 'left' | 'right';
  compact?: boolean;
  activeTransfers: TransferItem[];
  setActiveTransfers: React.Dispatch<React.SetStateAction<TransferItem[]>>;
  onShowHistory: () => void;
  onContextMenu?: (e: React.MouseEvent, entry?: FileEntry, isBlank?: boolean) => void;
  activeEdits: Array<{ id: string; path: string }>;
  setActiveEdits: React.Dispatch<React.SetStateAction<Array<{ id: string; path: string }>>>;
  onConnected?: (ok: boolean) => void;
  onDelete?: (e: FileEntry) => void;
  onDownload?: (e: FileEntry) => void;
}

export const SftpPane: React.FC<SftpPaneProps> = ({
  tabs, activeTabId, side: _side, compact,
  activeTransfers: _activeTransfers, setActiveTransfers, onShowHistory,
  onContextMenu: _parentContextMenu, activeEdits, setActiveEdits, onConnected,
  onDelete, onDownload,
}) => {
  const { t } = useI18n();
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const config = activeTab?.config ?? null;
  const isLocal = activeTab?.isLocal ?? false;

  const [cwd, setCwd] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'size' | 'date' | 'permissions' | 'uid' | 'gid'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [colW, setColW] = useState<Record<string, number>>({ name: 150, size: 65, date: 130, perms: 85, owner: 50, group: 50 });

  const [editing, setEditing] = useState<{ type: 'rename' | 'newFile' | 'newDir'; target?: FileEntry } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmingRef = useRef(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sftpMenu, setSftpMenu] = useState<{ x: number; y: number; entry?: FileEntry; isBlank?: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setSftpMenu(null), !!sftpMenu);

  const normalizePath = (p: string) => normalizeSftpPath(p);

  // ── 加载目录 ──
  const loadDir = useCallback(async (path: string) => {
    setLoading(true); setError(null);
    try {
      if (isLocal) {
        // 盘符补 /（C: → C:/，避免 Windows 将 C: 解析为当前目录）
        const fixed = path && /^[A-Za-z]:$/.test(path) ? path + '/' : path;
        const result = await ipc.local.listFiles(fixed || '', showHidden);
        setEntries(result.map((e: LocalFileEntry) => ({
          name: e.name, path: e.path, is_dir: e.is_dir,
          size: e.size, mtime: e.mtime, permissions: e.permissions,
          uid: null, gid: null, user: null, group: null,
        })));
        setCwd(path);
        onConnected?.(true);
      } else if (config) {
        const np = normalizePath(path);
        setEntries(await ipc.sftp.listFiles(config, np));
        setCwd(np);
        onConnected?.(true);
      }
    } catch (err) {
      setError(fmtErr(err));
      onConnected?.(false);
    } finally {
      setLoading(false); setLoadedOnce(true);
    }
  }, [config, isLocal, onConnected, showHidden]);

  // 切换标签或连接变化时重新加载
  useEffect(() => {
    if (isLocal) {
      setCwd(''); loadDir(''); // 空路径 → 列出盘符
    } else if (config) {
      setCwd('/'); loadDir('/');
    } else {
      setEntries([]); setLoadedOnce(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, config?.id]);

  // 隐藏文件开关变化时重新加载当前目录
  useEffect(() => {
    if (!loadedOnce) return;
    loadDir(cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  // 编辑会话上传事件（仅远程）
  useEffect(() => {
    if (isLocal) return;
    let unlisten: (() => void) | null = null;
    events.onSftpEditUploaded((payload) => {
      if (payload.success) loadDir(cwd);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, isLocal]);

  // ── 排序 / 过滤 ──
  const filtered = search ? entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase())) : entries;
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'size') cmp = a.size - b.size;
    else if (sortKey === 'date') cmp = a.mtime - b.mtime;
    else if (sortKey === 'permissions') cmp = (a.permissions ?? 0) - (b.permissions ?? 0);
    else if (sortKey === 'uid') cmp = (a.uid ?? 0) - (b.uid ?? 0);
    else if (sortKey === 'gid') cmp = (a.gid ?? 0) - (b.gid ?? 0);
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = useCallback((key: typeof sortKey, asc: boolean) => {
    setSortKey(key);
    setSortAsc(asc);
  }, []);

  const onColWChange = useCallback((w: Record<string, number>) => {
    setColW(w);
  }, []);

  const goUp = () => { const segs = cwd.split(/[/\\]+/).filter(Boolean); const p = segs.slice(0, -1).join('/') || (isLocal ? '' : '/'); loadDir(p || '/'); };
  const refresh = () => loadDir(cwd);
  const pathSegments = cwd.split(/[/\\]+/).filter(Boolean);

  // ── 文件操作 ──
  const startNewFile = () => { setEditing({ type: 'newFile' }); setEditValue(''); setTimeout(() => inputRef.current?.focus(), 50); };
  const startNewDir = () => { setEditing({ type: 'newDir' }); setEditValue(''); setTimeout(() => inputRef.current?.focus(), 50); };
  // 用于菜单回调（忽略 cwd 参数，目录切换由 loadDir 完成）
  const menuStartNewFile = (_cwd?: string) => startNewFile();
  const menuStartNewDir = (_cwd?: string) => startNewDir();
  const startRename = (e: FileEntry) => { setEditing({ type: 'rename', target: e }); setEditValue(e.name); setTimeout(() => inputRef.current?.focus(), 50); };

  const doConfirmEdit = async () => {
    if (confirmingRef.current || !config) return;
    const current = editing;
    const name = editValue.trim();
    if (!current || !name) return;
    confirmingRef.current = true;
    try {
      if (current.type === 'rename' && current.target) {
        const parent = current.target.path.substring(0, current.target.path.length - current.target.name.length);
        await ipc.sftp.rename(config, current.target.path, parent + name);
      } else if (current.type === 'newFile') {
        await ipc.sftp.writeFile(config, normalizePath(cwd + '/' + name), []);
      } else if (current.type === 'newDir') {
        await ipc.sftp.createDir(config, normalizePath(cwd + '/' + name));
      }
      await loadDir(cwd);
      setEditing(null); setEditValue('');
    } catch (err) { console.error(fmtErr(err)); setEditing(null); setEditValue(''); }
    confirmingRef.current = false;
  };

  const cancelEdit = () => { confirmingRef.current = false; setEditing(null); setEditValue(''); };

  const doUpload = async () => {
    if (!config) return;
    try {
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        for (const f of files) {
          const transferId = crypto.randomUUID();
          setActiveTransfers(prev => [...prev, {
            id: transferId, name: f.name, direction: 'upload' as const,
            bytesWritten: 0, totalBytes: f.size, speedBps: 0,
            status: 'transferring' as const, startedAt: Date.now(),
          }]);
          onShowHistory();
          const buf = await f.arrayBuffer();
          try {
            await ipc.sftp.uploadChunked(config, normalizePath(cwd + '/' + f.name), new Uint8Array(buf), transferId);
          } catch (err) {
            setActiveTransfers(prev => prev.map(x =>
              x.id === transferId && x.status !== 'cancelled'
                ? { ...x, status: 'failed' as const, completedAt: Date.now(), error: fmtErr(err) }
                : x,
            ));
          }
        }
        await loadDir(cwd);
      };
      input.click();
    } catch {}
  };

  const fmtErr = (err: unknown): string => fmtSftpError(err);

  // ── 空状态 ──
  if (!activeTab) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Server size={36} /></EmptyMedia>
          <EmptyTitle>{t('sftpPane.noConnection')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      {/* 面包屑 + 操作按钮行 */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--tx-border-light)', display: 'flex', alignItems: 'center', gap: 4, minHeight: 30, overflow: 'hidden' }}>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={goUp}><Icon icon="solar:alt-arrow-up-linear" width={14} height={14} /></Button>} />
          <TooltipContent>{t('fileBrowser.goUp')}</TooltipContent>
        </Tooltip>
        <div style={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden', flexWrap: 'nowrap', alignItems: 'center', fontSize: 11 }}>
          {pathSegments.length === 0 ? (
            <span onClick={() => loadDir(isLocal ? '' : '/')} style={{ color: 'var(--tx-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap', padding: '1px 2px', borderRadius: 2 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >{isLocal ? '计算机' : '/'}</span>
          ) : pathSegments.map((seg, i) => {
            const isDriveRoot = pathSegments[0]?.endsWith(':');
            const joined = pathSegments.slice(0, i + 1).join('/');
            const hasTrailing = joined.endsWith('/') || (isDriveRoot && i === 0);
            const full = isDriveRoot ? (hasTrailing ? joined : joined + '/') : '/' + joined;
            return (
              <React.Fragment key={i}>
                <Icon icon="solar:alt-arrow-right-outline" width={10} height={10} color="var(--tx-text-tertiary)" style={{ flexShrink: 0 }} />
                <span onClick={() => loadDir(full)}
                  style={{ color: full === cwd ? 'var(--tx-text-primary)' : 'var(--tx-text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', padding: '1px 3px', borderRadius: 2, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >{seg}</span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 搜索弹出面板 */}
      {showSearch && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--tx-border-light)', alignItems: 'center' }}>
          <input
            ref={searchInputRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearch(''); } }}
            placeholder={t('fileBrowser.search')}
            style={{ background: 'transparent', border: 'none', color: 'var(--tx-text-primary)', outline: 'none', fontSize: 12, flex: 1, minWidth: 0 }}
          />
          <span style={{ fontSize: 10, color: 'var(--tx-text-tertiary)' }}>{filtered.length}/{entries.length}</span>
          <button onClick={() => { setShowSearch(false); setSearch(''); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, border: 'none', background: 'transparent', color: 'var(--tx-text-tertiary)', cursor: 'pointer', borderRadius: 'var(--tx-radius-sm)' }}>
            <Icon icon="solar:close-circle-linear" width={14} height={14} />
          </button>
        </div>
      )}

      {/* 文件列表 */}
      <SftpFileList
        entries={entries} sorted={sorted} filtered={filtered}
        loading={loading} error={error} loadedOnce={loadedOnce}
        colW={colW} sortKey={sortKey} sortAsc={sortAsc}
        onSortChange={toggleSort} onColWChange={onColWChange}
        mode={compact ? 'side' : 'tab'}
        editing={editing} editValue={editValue} setEditValue={setEditValue}
        doConfirmEdit={doConfirmEdit} cancelEdit={cancelEdit} inputRef={inputRef}
        activeEdits={activeEdits}
        loadDir={loadDir}
        onContextMenu={(e, entry, isBlank) => {
          setSftpMenu({ x: e.clientX, y: e.clientY, entry, isBlank });
          _parentContextMenu?.(e, entry, isBlank);
        }}
      />

      {/* 底部工具栏 */}
      <div style={{ display: 'flex', gap: 2, padding: '4px 6px', borderTop: '1px solid var(--tx-border-light)', flexShrink: 0 }}>
        {!isLocal && (
          <>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={doUpload}><Icon icon="solar:upload-linear" width={14} height={14} /></Button>} />
              <TooltipContent>{t('fileBrowser.upload')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={startNewDir}><Icon icon="solar:add-folder-linear" width={14} height={14} /></Button>} />
              <TooltipContent>{t('fileBrowser.newFolder')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={startNewFile}><Icon icon="solar:add-square-linear" width={14} height={14} /></Button>} />
              <TooltipContent>{t('fileBrowser.newFile')}</TooltipContent>
            </Tooltip>
          </>
        )}
        <div style={{ flex: 1 }} />
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" className={showSearch ? 'bg-accent text-accent-foreground' : ''} onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}><Icon icon="solar:magnifer-linear" width={14} height={14} /></Button>} />
          <TooltipContent>{t('fileBrowser.search')}</TooltipContent>
        </Tooltip>
        {isLocal && (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" className={showHidden ? 'bg-accent text-accent-foreground' : ''} onClick={() => setShowHidden(!showHidden)}><Icon icon={showHidden ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width={14} height={14} /></Button>} />
            <TooltipContent>{showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={refresh}><Icon icon="solar:refresh-linear" width={14} height={14} /></Button>} />
          <TooltipContent>{t('fileBrowser.refresh')}</TooltipContent>
        </Tooltip>
      </div>

      {/* 右键菜单弹出层 */}
      {sftpMenu && (
        <div ref={menuRef} style={{
          position: 'fixed', top: sftpMenu.y, left: sftpMenu.x,
          zIndex: 50, background: 'var(--tx-bg-elevated)',
          border: '1px solid var(--tx-border-light)',
          borderRadius: 'var(--tx-radius-md)',
          boxShadow: 'var(--tx-shadow-md)',
          padding: 4, minWidth: 160, fontSize: 12,
        }}>
          {buildMenuItems(t, sftpMenu, config, activeEdits, {
            doUpload,
            doDownload: (e) => onDownload?.(e),
            startNewFile: menuStartNewFile,
            startNewDir: menuStartNewDir,
            refresh,
            loadDir,
            startRename,
            setDeleteTarget: (e) => onDelete?.(e),
            setActiveEdits,
          }).map((item, i) => {
            if (item.divider) return <div key={i} style={{ height: 1, background: 'var(--tx-border-light)', margin: '4px 0' }} />;
            return (
              <div key={i}
                onClick={() => { if (!item.disabled) { item.onClick(); setSftpMenu(null); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 'var(--tx-radius-sm)', cursor: item.disabled ? 'default' : 'pointer',
                  color: item.color || (item.disabled ? 'var(--tx-text-tertiary)' : 'var(--tx-text-primary)'),
                  opacity: item.disabled ? 0.5 : 1, fontSize: 12,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {item.icon && <Icon icon={item.icon} width={14} height={14} />}
                {item.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
