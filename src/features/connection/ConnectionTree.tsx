/**
 * 连接树形列表
 * 按分组展示远程连接配置，支持展开/折叠、选中高亮、双击连接
 */
import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { FolderSearch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { ConnectionConfig } from '@/lib/ipc';

interface ConnectionTreeProps {
  configs: ConnectionConfig[];
  savedIds: Set<string>;
  selectedId: string | null;
  onSelect: (config: ConnectionConfig) => void;
  onDelete: (id: string) => void;
  t: (k: string, p?: any) => string;
}

/**
 * 连接配置树形列表
 * 按分组展开/折叠展示已保存的配置，支持搜索过滤、选中高亮和删除
 */
export const ConnectionTree: React.FC<ConnectionTreeProps> = ({ configs, savedIds, selectedId, onSelect, onDelete, t }) => {
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filtered = configs.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.host.toLowerCase().includes(search.toLowerCase()),
  );

  const saved = filtered.filter((c) => savedIds.has(c.id));
  const recent = filtered.filter((c) => !savedIds.has(c.id));

  // Build groups for saved
  const groups = new Map<string, ConnectionConfig[]>();
  const ungrouped: ConnectionConfig[] = [];
  for (const c of saved) {
    const g = c.group || '';
    if (g) {
      const list = groups.get(g) || [];
      list.push(c);
      groups.set(g, list);
    } else {
      ungrouped.push(c);
    }
  }

  // Expand all groups by default
  if (expandedGroups.size === 0 && groups.size > 0) {
    setExpandedGroups(new Set(groups.keys()));
  }

  // 展开/折叠分组
  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div className="pb-2">
        <Input placeholder={t('manager.search')} value={search}
          onChange={(e) => setSearch(e.target.value)} className="text-xs" />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Saved section */}
        {saved.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
              {t('manager.saved')} ({saved.length})
            </div>
            {Array.from(groups.entries()).map(([groupName, items]) => (
              <div key={groupName}>
                <div onClick={() => toggleGroup(groupName)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', cursor: 'pointer', fontSize: 10, color: 'var(--tx-text-tertiary)', fontWeight: 500 }}
                >
                  <Icon icon={expandedGroups.has(groupName) ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} width={10} height={10} />
                  {groupName}
                </div>
                {expandedGroups.has(groupName) && items.map((cfg) => (
                  <CItem key={cfg.id} config={cfg} selected={cfg.id === selectedId} onSelect={onSelect} onDelete={onDelete} />
                ))}
              </div>
            ))}
            {ungrouped.map((cfg) => (
              <CItem key={cfg.id} config={cfg} selected={cfg.id === selectedId} onSelect={onSelect} onDelete={onDelete} />
            ))}
          </div>
        )}

        {/* Recent section */}
        {recent.length > 0 && (
          <div>
            <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
              {t('manager.recent')} ({recent.length})
            </div>
            {recent.map((cfg) => (
              <CItem key={cfg.id} config={cfg} selected={cfg.id === selectedId} onSelect={onSelect} onDelete={onDelete} recent />
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><FolderSearch size={36} /></EmptyMedia>
              <EmptyTitle>{t('manager.noConnections')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
};

/** 连接列表项：图标、名称、悬停删除按钮 */
const CItem: React.FC<{ config: ConnectionConfig; selected: boolean; onSelect: (c: ConnectionConfig) => void; onDelete: (id: string) => void; recent?: boolean }> = ({ config: cfg, selected, onSelect, onDelete, recent }) => {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={() => onSelect(cfg)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', borderRadius: 'var(--tx-radius-sm)',
        background: selected ? 'var(--tx-accent-muted)' : hover ? 'var(--tx-bg-hover)' : 'transparent',
        color: selected ? 'var(--tx-accent-default)' : 'var(--tx-text-primary)', fontSize: 12, fontWeight: selected ? 500 : 400,
        borderLeft: selected ? '2px solid var(--tx-accent-default)' : '2px solid transparent',
        transition: 'all 0.12s', marginBottom: 1,
      }}
    >
      <Icon icon={recent ? 'solar:history-linear' : 'solar:laptop-minimalistic-outline'} width={14} height={14} color={recent ? 'var(--tx-text-tertiary)' : 'var(--tx-text-tertiary)'} style={{ opacity: recent ? 0.5 : 1 }} />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cfg.name}
      </div>
      {hover && !recent && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(cfg.id); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, border: 'none', background: 'none', color: 'var(--tx-text-tertiary)', cursor: 'pointer', padding: 0, borderRadius: 3 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-red-bg)'; e.currentTarget.style.color = 'var(--tx-red)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-text-tertiary)'; }}
        >
          <Icon icon="solar:close-circle-linear" width={13} height={13} />
        </button>
      )}
    </div>
  );
};
