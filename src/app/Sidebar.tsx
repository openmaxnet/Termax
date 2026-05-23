/**
 * 侧边栏组件
 * 展示远程连接配置的树形结构，支持分组、搜索、选中、双击连接、
 * 右键菜单操作（编辑/删除），以及从侧边栏拖拽到标签栏打开连接
 */
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Server } from 'lucide-react';
import type { ConnectionConfig } from '@/lib/ipc';
import { ipc } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useClickOutside } from '@/hooks/useClickOutside';

/** 侧边栏属性 */
interface SidebarProps {
  savedConfigs: ConnectionConfig[];
  onConnectTo: (config: ConnectionConfig) => void;
  onDeleteConfig: (id: string) => void;
  onEditConfig: (config: ConnectionConfig) => void;
  onSftpConnect?: (config: ConnectionConfig) => void;
  onClose?: () => void;
  onRefresh?: () => void;
  open: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  savedConfigs, onConnectTo, onDeleteConfig, onEditConfig, onSftpConnect, onClose, onRefresh, open,
}) => {
  const { t } = useI18n();
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const ref = useRef<HTMLElement>(null);

  // 点击侧边栏外部关闭（排除切换按钮），ESC 键关闭
  useClickOutside(ref, () => onClose?.(), open, '[data-sidebar-toggle]');

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside ref={ref} style={{
      position: 'absolute', zIndex: 15,
      top: 8, left: open ? 8 : `calc(-${sidebarWidth}px - 16px)`,
      width: sidebarWidth, maxHeight: 'calc(100% - 16px)',
      transition: 'left 0.15s ease-out, box-shadow 0.15s ease-out',
      background: 'var(--tx-bg-elevated)',
      border: '1px solid var(--tx-border-light)',
      borderRadius: 'var(--tx-radius-lg)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: open ? '0 4px 20px rgba(0,0,0,0.18)' : 'none',
      pointerEvents: open ? 'auto' : 'none',
      whiteSpace: 'nowrap',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--tx-border-light)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        <Icon icon="solar:server-square-linear" width={14} height={14} />
        {t('sidebar.title')}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 2, whiteSpace: 'nowrap' }}>
        <ConnectionTree configs={savedConfigs} onConnect={onConnectTo} onDelete={onDeleteConfig} onEdit={onEditConfig} onSftpConnect={onSftpConnect} onRefresh={onRefresh} open={open} t={t} />
      </div>
      {/* Resize handle */}
      <div onMouseDown={(e) => {
        e.preventDefault();
        const el = (e.currentTarget.parentElement as HTMLElement);
        const origTrans = el.style.transition;
        el.style.transition = 'none';
        const startX = e.clientX;
        const startW = el.getBoundingClientRect().width;
        // 拖拽中实时更新侧边栏宽度（140-400px 范围）
        const onMove = (ev: MouseEvent) => {
          const w = Math.max(140, Math.min(400, startW + ev.clientX - startX));
          el.style.width = w + 'px';
        };
        // 释放后保存最终宽度到 store
        const onUp = () => {
          const finalW = parseInt(el.style.width) || 220;
          useSettingsStore.getState().setSidebarWidth(finalW);
          el.style.transition = origTrans;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 8, cursor: 'col-resize', zIndex: 5 }} />
    </aside>
  );
};

/* ── Tree ── */

/** 连接树组件属性 */
interface TreeProps {
  configs: ConnectionConfig[]; onConnect: (c: ConnectionConfig) => void;
  onDelete: (id: string) => void; onEdit: (c: ConnectionConfig) => void;
  onSftpConnect?: (c: ConnectionConfig) => void;
  onRefresh?: () => void;
  open: boolean;
  t: (k: string, p?: any) => string;
}

/** 连接树：按分组展示已保存的配置，支持展开/折叠/右键菜单 */
const ConnectionTree: React.FC<TreeProps> = ({ configs, onConnect, onDelete, onEdit, onSftpConnect, onRefresh, open, t }) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { if (!open) setSelectedId(null); }, [open]);

  const groups = new Map<string, ConnectionConfig[]>();
  const ungrouped: ConnectionConfig[] = [];
  for (const cfg of configs) { const g = cfg.group || ''; if (g) { (groups.get(g) || groups.set(g, []).get(g))!.push(cfg); } else { ungrouped.push(cfg); } }

  if (expanded.size === 0 && groups.size > 0) setExpanded(new Set(groups.keys()));

  // 展开/折叠分组
  const toggle = (name: string) => setExpanded((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from(groups.entries()).map(([groupName, items]) => {
        const isOpen = expanded.has(groupName);
        return (
          <div key={groupName}>
            <ContextMenu>
              <ContextMenuTrigger className="block">
                <div onClick={() => toggle(groupName)}
                  style={groupHeadStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon icon={isOpen ? 'solar:folder-open-linear' : 'solar:folder-linear'} width={14} height={14} color="var(--tx-accent-default)" />
                  <span style={{ flex: 1 }}>{groupName}</span>
                  <span style={{ fontSize: 10, color: 'var(--tx-text-tertiary)' }}>{items.length}</span>
                  <Icon icon={isOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} width={12} height={12} />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => setExpanded(new Set(groups.keys()))}>
                  <Icon icon="solar:folder-open-linear" width={14} height={14} />Expand All
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setExpanded(new Set())}>
                  <Icon icon="solar:folder-linear" width={14} height={14} />Collapse All
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => navigator.clipboard.writeText(groupName)}>
                  <Icon icon="solar:copy-linear" width={14} height={14} />Copy "{groupName}"
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {isOpen && items.map((cfg) => <Item key={cfg.id} config={cfg} onConnect={onConnect} onDelete={onDelete} onEdit={onEdit} onSftpConnect={onSftpConnect} onRefresh={onRefresh} open={open} indent={8} selected={cfg.id === selectedId} onSelect={(c) => setSelectedId(c.id)} />)}
          </div>
        );
      })}
      {ungrouped.map((cfg) => <Item key={cfg.id} config={cfg} onConnect={onConnect} onDelete={onDelete} onEdit={onEdit} onSftpConnect={onSftpConnect} onRefresh={onRefresh} open={open} indent={0} selected={cfg.id === selectedId} onSelect={(c) => setSelectedId(c.id)} />)}
      {configs.length === 0 && (
        <div style={{ padding: '20px 0' }}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Server size={36} /></EmptyMedia>
              <EmptyTitle>{t('sidebar.noSavedConnections')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </div>
      )}

    </div>
  );
};

/* ── Item ── */

/** 连接项属性 */
interface ItemProps { config: ConnectionConfig; onConnect: (c: ConnectionConfig) => void; onDelete: (id: string) => void; onEdit: (c: ConnectionConfig) => void; onSftpConnect?: (c: ConnectionConfig) => void; onRefresh?: () => void; open: boolean; indent: number; selected: boolean; onSelect: (c: ConnectionConfig) => void; }

/** 连接项：选中高亮、双击连接、右键菜单（连接/SFTP/编辑/复制/删除） */
const Item: React.FC<ItemProps> = ({ config: cfg, onConnect, onDelete, onEdit, onSftpConnect, onRefresh, open: _open, indent, selected, onSelect }) => {
  const [hover, setHover] = useState(false);
  const { t } = useI18n();

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">
        <div onClick={() => onSelect(cfg)} onDoubleClick={() => onConnect(cfg)}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', paddingLeft: 8 + indent, cursor: 'pointer', fontSize: 12, borderRadius: 'var(--tx-radius-sm)', color: selected ? 'var(--tx-accent-default)' : 'var(--tx-text-primary)', background: selected ? 'var(--tx-accent-muted)' : hover ? 'var(--tx-bg-hover)' : 'transparent', borderLeft: selected ? '2px solid var(--tx-accent-default)' : '2px solid transparent', transition: 'all 0.12s' }}
        >
          <Icon icon="solar:laptop-minimalistic-outline" width={14} height={14} color={selected ? 'var(--tx-accent-default)' : 'var(--tx-text-tertiary)'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: selected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.name}</div>
            {hover && <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', marginTop: 1 }}>{cfg.username}@{cfg.host}:{cfg.port}</div>}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onConnect(cfg)}>
          <Icon icon="solar:plug-circle-linear" width={14} height={14} />{t('sidebar.connect')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onEdit(cfg)}>
          <Icon icon="solar:settings-linear" width={14} height={14} />{t('sidebar.edit')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSftpConnect?.(cfg)}>
          <Icon icon="solar:folder-with-files-linear" width={14} height={14} />{t('sidebar.browseFiles')}
        </ContextMenuItem>
        <ContextMenuItem onClick={async () => { await ipc.config.save({ ...cfg, id: crypto.randomUUID(), name: `${cfg.name} ${t('sidebar.duplicateSuffix')}` }); onRefresh?.(); }}>
          <Icon icon="solar:copy-linear" width={14} height={14} />{t('sidebar.duplicate')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete(cfg.id)}>
          <Icon icon="solar:trash-bin-trash-linear" width={14} height={14} />
          <span style={{ color: 'var(--tx-red)' }}>{t('sidebar.delete')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const groupHeadStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'background 0.12s' };
