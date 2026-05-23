/**
 * 快速连接面板
 * 输入主机地址和端口即可快速建立 SSH 连接，不保存到配置列表
 */
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { SearchX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ipc } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ConnectionConfig } from '@/lib/ipc';

interface QuickPanelProps {
  open: boolean;
  onClose: () => void;
  onNewSSH: () => void;
  onLocalConnect: (shellPath?: string) => void;
  onConnect: (config: ConnectionConfig) => void;
  onSftpConnect?: (config: ConnectionConfig) => void;
  onWslConnect?: () => void;
}

export const QuickPanel: React.FC<QuickPanelProps> = ({ open, onClose, onNewSSH, onLocalConnect, onConnect, onSftpConnect, onWslConnect }) => {
  const { t } = useI18n();
  const [saved, setSaved] = useState<ConnectionConfig[]>([]);
  const [recent, setRecent] = useState<ConnectionConfig[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) { setSearch(''); return; }
    ipc.config.load().then(setSaved);
    try {
      const raw = sessionStorage.getItem('termax_recent');
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, [open]);

  // Merge saved and recent, dedup by id
  const allIds = new Set(saved.map((c) => c.id));
  const recentOnly = recent.filter((c) => !allIds.has(c.id));

  const actions = [
    { icon: 'solar:programming-broken', label: t('quick.newSSH'), desc: t('quick.newSSHDesc'), onClick: () => { onClose(); onNewSSH(); } },
    { icon: 'solar:laptop-minimalistic-outline', label: t('quick.local'), desc: t('quick.localDesc'), onClick: async () => { onClose(); const savedPath = useSettingsStore.getState().localShellPath; if (savedPath) { onLocalConnect(savedPath); return; } const shells = await ipc.local.detectShells(); const def = shells.find(s => s.default) || shells[0]; onLocalConnect(def?.path); } },
    { icon: 'solar:cpu-linear', label: t('quick.wsl'), desc: t('quick.wslDesc'), onClick: () => { onClose(); onWslConnect?.(); } },
  ];

  const filteredActions = actions.filter((a) =>
    !search || a.label.toLowerCase().includes(search.toLowerCase()) || (a.desc && a.desc.toLowerCase().includes(search.toLowerCase())),
  );
  const filteredSaved = saved.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.host.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredRecent = recentOnly.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.host.toLowerCase().includes(search.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        {/* Search */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--tx-border-light)' }}>
          <div className="flex items-center gap-1.5 bg-(--tx-bg-base) rounded-(--tx-radius-md) px-2.5 py-1 border border-(--tx-border-light) focus-within:border-(--tx-border-focus) focus-within:ring-2 focus-within:ring-(--tx-border-focus)/20 transition-colors">
            <Icon icon="solar:magnifer-linear" width={14} height={14} color="var(--tx-text-tertiary)" />
            <Input placeholder={t('quick.search')} value={search} onChange={(e) => setSearch(e.target.value)}
              autoFocus className="flex-1 h-7 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none" />
          </div>
        </div>

        {/* Actions: 横向均匀排列 */}
        {filteredActions.length > 0 && (
          <div style={{ padding: '10px 8px', borderBottom: '1px solid var(--tx-border-light)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {filteredActions.map((a, i) => (
              <button key={i} onClick={a.onClick}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 'var(--tx-radius-md)', background: 'transparent', color: 'var(--tx-text-primary)', cursor: 'pointer', fontSize: 12, textAlign: 'center', transition: 'background 0.12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon icon={a.icon} width={22} height={22} color="var(--tx-accent-default)" />
                <div>
                  <div style={{ fontWeight: 500 }}>{a.label}</div>
                  {a.desc && <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', marginTop: 2 }}>{a.desc}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
          {/* Saved */}
          {filteredSaved.length > 0 && (
            <>
              <div style={{ padding: '5px 6px', fontSize: 10, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('quick.saved')}</div>
              {filteredSaved.map((cfg) => (
                <QuickItem key={cfg.id} config={cfg} onClick={() => { onClose(); onConnect(cfg); }} onSftpClick={onSftpConnect ? () => { onClose(); onSftpConnect(cfg); } : undefined} />
              ))}
            </>
          )}

          {/* Recent */}
          {filteredRecent.length > 0 && (
            <>
              <div style={{ padding: '5px 6px', fontSize: 10, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{t('quick.recent')}</div>
              {filteredRecent.map((cfg) => (
                <QuickItem key={cfg.id} config={cfg} recent onClick={() => { onClose(); onConnect(cfg); }} />
              ))}
            </>
          )}

          {/* Empty */}
          {filteredSaved.length === 0 && filteredRecent.length === 0 && filteredActions.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><SearchX size={36} /></EmptyMedia>
                <EmptyTitle>{t('quick.noResults')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
};

/** 快速连接列表项：配置名、用户名@主机、SFTP 按钮 */
const QuickItem: React.FC<{ config: ConnectionConfig; recent?: boolean; onClick: () => void; onSftpClick?: () => void }> = ({ config: cfg, recent, onClick, onSftpClick }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', borderRadius: 'var(--tx-radius-sm)', transition: 'background 0.12s' }}>
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 8px', border: 'none', borderRadius: 'var(--tx-radius-sm)', background: 'transparent', color: 'var(--tx-text-primary)', cursor: 'pointer', fontSize: 12, textAlign: 'left', transition: 'background 0.12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon icon={recent ? 'solar:history-linear' : 'solar:laptop-minimalistic-outline'} width={15} height={15} color="var(--tx-text-tertiary)" style={{ opacity: recent ? 0.5 : 1 }} />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.name}</div>
      <span style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', flexShrink: 0 }}>{cfg.username}@{cfg.host}</span>
    </button>
    {!recent && onSftpClick && (
      <button onClick={onSftpClick} title="SFTP"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 'var(--tx-radius-sm)', background: 'transparent', color: 'var(--tx-text-tertiary)', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon icon="solar:folder-with-files-linear" width={14} height={14} />
      </button>
    )}
  </div>
);

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'transparent',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 48, zIndex: 50,
};

const panel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  width: 380, maxHeight: '60vh',
  background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)',
  borderRadius: 'var(--tx-radius-lg)', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
  animation: 'scaleIn 0.12s',
};
