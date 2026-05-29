/**
 * 跳板机链配置面板
 * 列表形式展示跳板机序列，支持添加/编辑/删除/去重
 * 操作通过右键菜单（TContextMenu）完成
 */
import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Shield } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sel } from '@/features/settings/helpers';
import { ipc } from '@/lib/ipc';
import type { BastionConfig as BastionConfigType, SshCredential } from '@/lib/ipc';

interface BastionConfigProps {
  value: BastionConfigType[];
  onChange: (config: BastionConfigType[]) => void;
}

type AuthType = 'none' | 'password' | 'credential';

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2" style={{ minHeight: 30 }}>
    <Label className="w-17.5 shrink-0 text-xs">{label}</Label>
    <div className="flex-1 flex items-center gap-1.5">{children}</div>
  </div>
);

/** 列宽：主机名/域名列自适应 */
const COL = { order: 28, name: 100, host: 1, username: 80 } as const;

const itemKey = (item: BastionConfigType) => `${item.host}:${item.port}@${item.username}`;

export const BastionConfig: React.FC<BastionConfigProps> = ({ value, onChange }) => {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<BastionConfigType | null>(null);
  const [dupErr, setDupErr] = useState('');
  const addItem = (item: BastionConfigType) => {
    if (value.some((r) => itemKey(r) === itemKey(item))) { setDupErr(t('bastion.dupError')); return; }
    onChange([...value, item]);
    setShowForm(false); setDupErr('');
  };

  const saveEdit = () => {
    if (editItem == null || editIdx == null) return;
    if (value.some((r, i) => i !== editIdx && itemKey(r) === itemKey(editItem))) { setDupErr(t('bastion.dupError')); return; }
    onChange(value.map((r, i) => (i === editIdx ? editItem! : r)));
    setEditIdx(null); setEditItem(null); setDupErr('');
  };

  const removeItem = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const startEdit = (idx: number) => {
    setEditIdx(idx); setEditItem({ ...value[idx] }); setShowForm(false); setDupErr('');
  };

  const closeForm = () => { setShowForm(false); setEditIdx(null); setEditItem(null); setDupErr(''); };

  return (
    <div className="flex flex-col h-full">
      {/* 列表区域 */}
      <div className="flex-1 min-h-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-(--tx-text-tertiary) border-b border-(--tx-border-light)">
          <span style={{ width: COL.order }}></span>
          <span style={{ width: COL.name, textAlign: 'center' }}>{t('manager.name')}</span>
          <span style={{ flex: COL.host, textAlign: 'center' }}>{t('bastion.host')}</span>
          <span style={{ width: COL.username, textAlign: 'center' }}>{t('bastion.username')}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {value.map((b, i) => (
            <ContextMenu key={i}>
              <ContextMenuTrigger className="block">
                <div className="flex items-center gap-1.5 px-2 py-1.25 rounded-(--tx-radius-sm) text-xs hover:bg-(--tx-bg-hover)">
                  <span style={{ width: COL.order, color: 'var(--tx-text-tertiary)', fontSize: 10, textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ width: COL.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-primary)', textAlign: 'center' }}>{b.name || '—'}</span>
                  <span style={{ flex: COL.host, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-secondary)', textAlign: 'center' }}>{b.host}:{b.port}</span>
                  <span style={{ width: COL.username, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-secondary)', textAlign: 'center' }}>{b.username}</span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => startEdit(i)}>
                  <Icon icon="solar:pen-linear" width={14} height={14} />
                  {t('forward.edit')}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => removeItem(i)}>
                  <Icon icon="solar:trash-bin-trash-linear" width={14} height={14} />
                  {t('forward.delete')}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          {value.length === 0 && !showForm && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Shield size={32} /></EmptyMedia>
                <EmptyTitle>{t('bastion.noHosts')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <Dialog open={showForm || editIdx != null} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {dupErr && <div className="text-xs text-(--tx-red) mb-2"><Icon icon="solar:danger-circle-linear" width={12} height={12} className="mr-1 align-middle" />{dupErr}</div>}
          <BastionForm
            initial={editItem}
            existingKeys={new Set(value.map(itemKey))} skipDup={editIdx != null}
            onSave={editIdx != null ? saveEdit : addItem}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>

      <Button variant="outline" className="self-start mt-auto border-dashed" onClick={() => setShowForm(true)}>
        <Icon icon="solar:add-circle-linear" width={16} height={16} />
        {t('bastion.addHost')}
      </Button>
    </div>
  );
};

/** 添加/编辑跳板机表单 */
const BastionForm: React.FC<{
  initial?: BastionConfigType | null;
  existingKeys?: Set<string>;
  skipDup?: boolean;
  onSave: (item: BastionConfigType) => void;
  onCancel: () => void;
}> = ({ initial, existingKeys, skipDup, onSave, onCancel }) => {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [host, setHost] = useState(initial?.host || '');
  const [port, setPort] = useState(initial?.port || 22);
  const [username, setUsername] = useState(initial?.username || '');
  const [authType, setAuthType] = useState<AuthType>(() => {
    if (!initial) return 'none';
    if (initial.auth_method && 'Credential' in initial.auth_method) return 'credential';
    if (initial.auth_method && 'Password' in initial.auth_method && (initial.auth_method as any).Password) return 'password';
    return 'none';
  });
  const [password, setPassword] = useState(() => {
    if (initial?.auth_method && 'Password' in initial.auth_method) return (initial.auth_method as { Password: string }).Password;
    return '';
  });
  const [credentialId, setCredentialId] = useState(() => {
    if (initial?.auth_method && 'Credential' in initial.auth_method) return (initial.auth_method as { Credential: string }).Credential;
    return '';
  });
  const [credentials, setCredentials] = useState<SshCredential[]>([]);
  const [localDup, setLocalDup] = useState('');
  const isEditing = !!initial;

  useEffect(() => {
    ipc.credential.list().then(setCredentials).catch(() => {});
  }, []);

  const handleSave = () => {
    if (!host.trim() || !username.trim()) return;
    if (authType === 'none') return;
    const item: BastionConfigType = {
      name, host, port, username,
      auth_method: authType === 'password'
        ? { Password: password }
        : authType === 'credential'
        ? { Credential: credentialId }
        : { Password: '' },
    };
    if (!skipDup && existingKeys?.has(itemKey(item))) { setLocalDup(t('bastion.dupError')); return; }
    onSave(item);
  };

  const authBtnClass = (at: AuthType) =>
    authType === at
      ? 'h-7 px-3 text-xs font-medium rounded-(--tx-radius-sm) border border-(--tx-accent-default) bg-(--tx-accent-muted) text-(--tx-accent-default) inline-flex items-center gap-1'
      : 'h-7 px-3 text-xs font-medium rounded-(--tx-radius-sm) border border-(--tx-border-light) bg-transparent text-(--tx-text-secondary) inline-flex items-center gap-1';

  const credOptions = credentials.map((c) => ({
    value: c.id,
    label: `${c.name} (${'Key' in c.kind ? t('credential.key') : t('credential.password')})`,
  }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-sm font-semibold text-(--tx-text-primary)">{isEditing ? t('bastion.editHost') : t('bastion.addHost')}</div>
      {localDup && <div className="text-xs text-(--tx-red)"><Icon icon="solar:danger-circle-linear" width={12} height={12} className="mr-1 align-middle" />{localDup}</div>}

      <FormRow label={t('manager.name')}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('bastion.namePlaceholder')} /></FormRow>
      <FormRow label={t('bastion.host')}><Input value={host} onChange={(e) => setHost(e.target.value)} placeholder={t('bastion.hostPlaceholder')} /></FormRow>
      <FormRow label={t('bastion.port')}><Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value) || 22)} className="w-30" /></FormRow>
      <FormRow label={t('bastion.username')}><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('bastion.usernamePlaceholder')} /></FormRow>

      <FormRow label={t('bastion.authType')}>
        <div className="flex gap-1">
          <button onClick={() => setAuthType('none')} className={authBtnClass('none')}>{t('manager.none')}</button>
          <button onClick={() => setAuthType('password')} className={authBtnClass('password')}>{t('manager.password')}</button>
          <button onClick={() => setAuthType('credential')} className={authBtnClass('credential')}>
            {t('credential.fromCredential')}
          </button>
        </div>
      </FormRow>

      {authType === 'credential' && (
        <FormRow label={t('credential.selectCredential')}>
          <Sel value={credentialId} options={credOptions} onChange={setCredentialId} />
        </FormRow>
      )}
      {authType === 'password' && <FormRow label={t('bastion.password')}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('bastion.passwordPlaceholder')} /></FormRow>}

      <div className="flex gap-2 justify-end mt-2">
        <Button variant="outline" onClick={onCancel}>{t('manager.cancel')}</Button>
        <Button onClick={handleSave}>{isEditing ? t('forward.save') : t('forward.add')}</Button>
      </div>
    </div>
  );
};
