/**
 * 凭证管理器对话框
 * 集中管理 SSH 凭证（密钥和密码），支持搜索、添加、编辑、删除
 * 布局与 ConnectionManager / SettingsDialog 一致：左侧导航 + 右侧内容面板
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ipc } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import type { SshCredential } from '@/lib/ipc';
import { CredentialForm } from './CredentialForm';

interface CredentialManagerProps {
  open: boolean;
  onClose: () => void;
}

/** 筛选分类 ID */
type FilterId = 'all' | 'key' | 'password';

/** 筛选分类定义 */
interface FilterCategory { id: FilterId; icon: string; labelKey: string; }

/** 左侧导航筛选标签 */
const FILTER_CATEGORIES: FilterCategory[] = [
  { id: 'all', icon: 'solar:shield-keyhole-minimalistic-broken', labelKey: 'credential.filterAll' },
  { id: 'key', icon: 'solar:key-linear', labelKey: 'credential.filterKey' },
  { id: 'password', icon: 'solar:lock-keyhole-linear', labelKey: 'credential.filterPassword' },
];

/** 格式化日期 */
function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 凭证类型标签 */
function KindBadge({ kind }: { kind: SshCredential['kind'] }) {
  const { t } = useI18n();
  const isKey = 'Key' in kind;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 6px', borderRadius: 'var(--tx-radius-sm)',
        fontSize: 11, fontWeight: 500, lineHeight: '18px',
        background: isKey ? 'var(--tx-accent-muted)' : 'var(--tx-bg-hover)',
        color: isKey ? 'var(--tx-accent-default)' : 'var(--tx-text-secondary)',
        flexShrink: 0,
      }}
    >
      {isKey ? t('credential.key') : t('credential.password')}
    </span>
  );
}

/** 标签 chips */
function TagsChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, overflow: 'hidden', flexShrink: 0 }}>
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag}
          style={{
            padding: '2px 6px', borderRadius: 'var(--tx-radius-sm)',
            fontSize: 11, color: 'var(--tx-text-tertiary)',
            background: 'var(--tx-bg-hover)', lineHeight: '18px',
          }}
        >
          {tag}
        </span>
      ))}
      {tags.length > 2 && (
        <span style={{ fontSize: 11, color: 'var(--tx-text-tertiary)', lineHeight: '18px' }}>+{tags.length - 2}</span>
      )}
    </div>
  );
}

export const CredentialManager: React.FC<CredentialManagerProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [credentials, setCredentials] = useState<SshCredential[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SshCredential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SshCredential | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<string[]>([]);
  const [dialogPos, setDialogPos] = useState<{ top: number; left: number } | null>(null);
  const [dialogSize, setDialogSize] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startT: number; startL: number; dir: string } | null>(null);

  const loadCredentials = useCallback(async () => {
    try {
      const list = await ipc.credential.list();
      setCredentials(list);
    } catch (e) {
      console.error('加载凭证失败:', e);
    }
  }, []);

  useEffect(() => {
    if (open) loadCredentials();
  }, [open, loadCredentials]);

  // 按筛选分类 + 搜索关键词过滤
  const filtered = credentials.filter((c) => {
    // 按分类筛选
    if (activeFilter === 'key' && !('Key' in c.kind)) return false;
    if (activeFilter === 'password' && !('Password' in c.kind)) return false;
    // 按搜索关键词筛选
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      ('Key' in c.kind && c.kind.Key.name.toLowerCase().includes(q))
    );
  });

  const handleAdd = () => { setEditTarget(null); setShowForm(true); };
  const handleEdit = (cred: SshCredential) => { setEditTarget(cred); setShowForm(true); };

  const handleSave = async (cred: SshCredential, secret?: string, keyContent?: string) => {
    try {
      if (editTarget) {
        await ipc.credential.update(editTarget.id, cred, secret, keyContent);
      } else {
        await ipc.credential.save(cred, secret, keyContent);
      }
      setShowForm(false);
      setEditTarget(null);
      await loadCredentials();
    } catch (e) {
      console.error('保存凭证失败:', e);
      alert(typeof e === 'string' ? e : '保存凭证失败，请检查系统密钥链是否可用');
    }
  };

  const handleDeleteCheck = async (cred: SshCredential) => {
    try {
      const usage = await ipc.credential.checkUsage(cred.id);
      setDeleteUsage(usage);
      setDeleteTarget(cred);
    } catch (e) {
      console.error('检查引用失败:', e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await ipc.credential.delete(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteUsage([]);
      await loadCredentials();
    } catch (e) {
      console.error('删除凭证失败:', e);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* 遮罩层 — 点击关闭 */}
      <div onClick={onClose} style={overlayStyle}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...dialogStyle, ...(dialogSize ? { width: dialogSize.w, height: dialogSize.h } : {}), ...(dialogPos ? { position: 'fixed', top: dialogPos.top, left: dialogPos.left, transform: 'none' } : {}) }}>

          {/* Header — 可拖拽 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', cursor: 'grab', userSelect: 'none' }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left };
              const onMove = (ev: MouseEvent) => {
                if (!dragRef.current) return;
                setDialogPos({ top: dragRef.current.startTop + ev.clientY - dragRef.current.startY, left: dragRef.current.startLeft + ev.clientX - dragRef.current.startX });
              };
              const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <Icon icon="solar:shield-keyhole-minimalistic-broken" width={18} height={18} color="var(--tx-accent-default)" />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--tx-text-primary)', flex: 1 }}>
              {t('credential.title')}
            </h2>
          </div>

          {/* Body — 左侧导航 + 右侧内容 */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* 左侧导航 — 与 ConnectionManager 一致 */}
            <nav style={{ width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px', borderRight: '1px solid var(--tx-border-light)' }}>
              {FILTER_CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => { setActiveFilter(cat.id); setSearch(''); setShowForm(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px',
                    border: 'none', borderRadius: 'var(--tx-radius-sm)',
                    background: activeFilter === cat.id ? 'var(--tx-accent-muted)' : 'transparent',
                    color: activeFilter === cat.id ? 'var(--tx-accent-default)' : 'var(--tx-text-secondary)',
                    cursor: 'pointer', fontSize: 12, fontWeight: activeFilter === cat.id ? 500 : 400,
                    textAlign: 'left', transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => { if (activeFilter !== cat.id) e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                  onMouseLeave={(e) => { if (activeFilter !== cat.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon icon={cat.icon} width={15} height={15} />
                  {t(cat.labelKey)}
                </button>
              ))}
            </nav>

            {/* 右侧内容区域 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {showForm ? (
                /* ── 编辑/添加表单视图 ── */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--tx-border-light)' }}>
                    <button onClick={() => { setShowForm(false); setEditTarget(null); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--tx-text-secondary)', fontSize: 12, borderRadius: 'var(--tx-radius-sm)', transition: 'color 0.12s, background 0.12s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tx-accent-default)'; e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--tx-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Icon icon="solar:arrow-left-linear" width={14} height={14} />
                      {t('credential.backToList')}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--tx-text-tertiary)' }}>
                      {editTarget ? t('credential.edit') : t('credential.add')}
                    </span>
                  </div>
                  <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
                    <CredentialForm
                      credential={editTarget}
                      onSave={handleSave}
                      onCancel={() => { setShowForm(false); setEditTarget(null); }}
                    />
                  </div>
                </>
              ) : (
                /* ── 列表视图 ── */
                <>
                  {/* 搜索栏 */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--tx-border-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="flex items-center gap-1.5 bg-(--tx-bg-base) rounded-(--tx-radius-md) px-2.5 py-1 border border-(--tx-border-light) focus-within:border-(--tx-border-focus) focus-within:ring-2 focus-within:ring-(--tx-border-focus)/20 transition-colors" style={{ flex: 1 }}>
                      <Icon icon="solar:magnifer-linear" width={14} height={14} color="var(--tx-text-tertiary)" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('credential.search')}
                        className="flex-1 h-7 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none text-xs" />
                    </div>
                  </div>

                  {/* 凭证列表 */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 2 }}>
                    {filtered.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tx-text-tertiary)', fontSize: 12 }}>
                        {search ? t('credential.noMatch') : t('credential.empty')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filtered.map((cred) => (
                          <ContextMenu key={cred.id}>
                            <ContextMenuTrigger className="block">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--tx-radius-md)', cursor: 'default', transition: 'background 0.12s', minHeight: 36 }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Icon icon={'Key' in cred.kind ? 'solar:shield-keyhole-minimalistic-broken' : 'solar:lock-keyhole-linear'} width={16} height={16} color="var(--tx-text-tertiary)" className="shrink-0" />
                                <span className="truncate min-w-0 flex-1" style={{ color: 'var(--tx-text-primary)' }}>{cred.name}</span>
                                <KindBadge kind={cred.kind} />
                                <TagsChips tags={cred.tags} />
                                <span className="shrink-0" style={{ fontSize: 11, color: 'var(--tx-text-tertiary)', width: 64, textAlign: 'right' }}>{formatDate(cred.updated_at)}</span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleEdit(cred)}>
                                <Icon icon="solar:pen-linear" className="mr-2 text-xs" />
                                {t('credential.edit')}
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleDeleteCheck(cred)} className="text-(--tx-red) focus:text-(--tx-red)">
                                <Icon icon="solar:trash-bin-trash-linear" className="mr-2 text-xs" />
                                {t('credential.delete')}
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 底部栏 — 与 ConnectionManager 一致 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid var(--tx-border-light)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--tx-text-tertiary)', marginRight: 'auto' }}>
              {t('credential.totalCount', { count: credentials.length })}
            </span>
            <Button variant="outline" onClick={onClose}>{t('credential.close')}</Button>
            <Button onClick={handleAdd} disabled={showForm}>
              <Icon icon="solar:add-circle-linear" className="text-sm" />
              {t('credential.add')}
            </Button>
          </div>

          {/* Resize handles — 与其他弹窗一致 */}
          {(['n','s','e','w','ne','nw','se','sw'] as const).map((dir) => (
            <div key={dir} onMouseDown={(e) => {
              e.preventDefault();
              const el = e.currentTarget.parentElement;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height, startT: rect.top, startL: rect.left, dir };
              const onMove = (ev: MouseEvent) => {
                if (!resizeRef.current) return;
                const { startX, startY, startW, startH, startT, startL, dir: d } = resizeRef.current;
                let w = startW, h = startH, t = startT, l = startL;
                if (d.includes('e')) w = Math.max(400, startW + ev.clientX - startX);
                if (d.includes('s')) h = Math.max(400, startH + ev.clientY - startY);
                if (d.includes('w')) { const nw = Math.max(400, startW - (ev.clientX - startX)); l = startL + (startW - nw); w = nw; }
                if (d.includes('n')) { const nh = Math.max(400, startH - (ev.clientY - startY)); t = startT + (startH - nh); h = nh; }
                setDialogSize({ w, h });
                setDialogPos({ top: t, left: l });
              };
              const onUp = () => { resizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
              style={{
                position: 'absolute', zIndex: 10,
                ...(dir === 'n' ? { top: 0, left: 0, right: 0, height: 4, cursor: 'n-resize' } : {}),
                ...(dir === 's' ? { bottom: 0, left: 0, right: 0, height: 4, cursor: 's-resize' } : {}),
                ...(dir === 'e' ? { top: 0, right: 0, bottom: 0, width: 4, cursor: 'e-resize' } : {}),
                ...(dir === 'w' ? { top: 0, left: 0, bottom: 0, width: 4, cursor: 'w-resize' } : {}),
                ...(dir === 'ne' ? { top: 0, right: 0, width: 8, height: 8, cursor: 'ne-resize' } : {}),
                ...(dir === 'nw' ? { top: 0, left: 0, width: 8, height: 8, cursor: 'nw-resize' } : {}),
                ...(dir === 'se' ? { bottom: 0, right: 0, width: 8, height: 8, cursor: 'se-resize' } : {}),
                ...(dir === 'sw' ? { bottom: 0, left: 0, width: 8, height: 8, cursor: 'sw-resize' } : {}),
              }}
            />
          ))}
        </div>
      </div>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteUsage([]); } }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('credential.deleteConfirm', { name: deleteTarget?.name || '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUsage.length > 0
                ? t('credential.deleteUsedWarning', { count: deleteUsage.length })
                : t('credential.deleteHint')}
              {deleteUsage.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 96, overflowY: 'auto' }}>
                  {deleteUsage.map((name) => (
                    <div key={name} style={{ fontSize: 12, color: 'var(--tx-text-secondary)' }}>- {name}</div>
                  ))}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('credential.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>{t('credential.confirmDelete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'var(--tx-bg-overlay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 50, animation: 'fadeIn 0.15s',
};

const dialogStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  width: 600, maxWidth: '92vw', height: 500, maxHeight: '85vh',
  background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)',
  borderRadius: 'var(--tx-radius-lg)', boxShadow: 'var(--tx-shadow-lg)',
  animation: 'scaleIn 0.15s', position: 'relative',
};
