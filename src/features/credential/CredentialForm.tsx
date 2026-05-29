/**
 * 凭证表单组件
 * 用于添加/编辑 SSH 凭证（密钥或密码），支持文件选择和标签输入
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ipc } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import type { SshCredential, CredentialKind } from '@/lib/ipc';

/** 表单行容器 */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2" style={{ minHeight: 30 }}>
    <Label className="w-17.5 shrink-0 text-right text-xs">{label}</Label>
    <div className="flex-1">{children}</div>
  </div>
);

interface CredentialFormProps {
  /** 编辑时传入已有凭证 */
  credential?: SshCredential | null;
  /** 保存回调 */
  onSave: (cred: SshCredential, secret?: string) => void;
  /** 取消回调 */
  onCancel: () => void;
}

type FormKind = 'key' | 'password';

/** 凭证添加/编辑表单 */
export const CredentialForm: React.FC<CredentialFormProps> = ({ credential, onSave, onCancel }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FormKind>('key');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [password, setPassword] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hasExistingSecret, setHasExistingSecret] = useState(false);

  // 编辑模式：加载已有数据
  useEffect(() => {
    if (!credential) return;
    setName(credential.name);
    setTagsInput(credential.tags.join(', '));
    if ('Key' in credential.kind) {
      setKind('key');
      setKeyPath(credential.kind.Key.path);
    } else {
      setKind('password');
    }
    // 直接从凭证元信息判断是否已保存敏感信息（不依赖密钥链读取）
    setHasExistingSecret(credential.has_secret);
    // 尝试从密钥链加载实际值填入表单
    setLoading(true);
    ipc.credential.getSecret(credential.id).then((secret) => {
      if (secret) {
        if ('Key' in credential.kind) {
          setPassphrase(secret);
        } else {
          setPassword(secret);
        }
      }
    }).finally(() => setLoading(false));
  }, [credential]);

  const clearError = (field: string) => {
    setErrors((prev) => { const n = new Set(prev); n.delete(field); return n; });
  };

  const validate = useCallback(() => {
    const errs = new Set<string>();
    if (!name.trim()) errs.add('name');
    if (kind === 'key' && !keyPath.trim()) errs.add('keyPath');
    if (kind === 'password' && !password) errs.add('password');
    setErrors(errs);
    return errs.size === 0;
  }, [name, kind, keyPath, password]);

  const handleSave = () => {
    if (!validate()) return;

    const now = Date.now();
    const tags = tagsInput.split(',').map((s) => s.trim()).filter(Boolean);

    let credKind: CredentialKind;
    let secret: string | undefined;

    if (kind === 'key') {
      credKind = { Key: { path: keyPath, passphrase_stored: !!passphrase } };
      secret = passphrase || undefined;
    } else {
      credKind = { Password: '' };
      secret = password || undefined;
    }

    const cred: SshCredential = {
      id: credential?.id || crypto.randomUUID(),
      name: name.trim(),
      kind: credKind,
      has_secret: !!secret,
      created_at: credential?.created_at || now,
      updated_at: now,
      tags,
    };

    onSave(cred, secret);
  };

  const handleFileSelected = async () => {
    const path = await ipc.credential.pickFile();
    if (path) {
      setKeyPath(path);
      clearError('keyPath');
    }
  };

  const kindBtnClass = (type: FormKind) => cn(
    'h-7 px-3 text-xs font-medium rounded-(--tx-radius-sm) border transition-colors inline-flex items-center gap-1.5',
    kind === type
      ? 'border-(--tx-accent-default) bg-(--tx-accent-muted) text-(--tx-accent-default)'
      : 'border-(--tx-border-light) bg-transparent text-(--tx-text-secondary) hover:text-(--tx-text-primary)',
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-(--tx-text-tertiary) text-xs">
        <Icon icon="solar:refresh-linear" className="animate-spin mr-2" />
        {t('credential.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* 名称 */}
      <Row label={t('credential.name')}>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); clearError('name'); }}
          placeholder={t('credential.namePlaceholder')}
          className={cn(errors.has('name') && 'border-(--tx-red)')}
        />
      </Row>

      {/* 类型选择 */}
      <Row label={t('credential.type')}>
        <div className="flex gap-1.5">
          <button className={kindBtnClass('key')} onClick={() => setKind('key')}>
            <Icon icon="solar:shield-keyhole-minimalistic-broken" className="text-sm" />
            {t('credential.key')}
          </button>
          <button className={kindBtnClass('password')} onClick={() => setKind('password')}>
            <Icon icon="solar:lock-keyhole-linear" className="text-sm" />
            {t('credential.password')}
          </button>
        </div>
      </Row>

      {/* 密钥认证字段 */}
      {kind === 'key' && (
        <>
          <Row label={t('credential.keyPath')}>
            <div className="relative flex-1">
              <Input
                value={keyPath}
                onChange={(e) => { setKeyPath(e.target.value); clearError('keyPath'); }}
                placeholder="~/.ssh/id_rsa"
                className={cn('pr-8', errors.has('keyPath') && 'border-(--tx-red)')}
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-(--tx-bg-hover)"
                onClick={handleFileSelected}
              >
                <Icon icon="solar:folder-linear" className="text-sm text-(--tx-text-tertiary)" />
              </button>
            </div>
          </Row>
          <Row label={t('credential.passphrase')}>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={hasExistingSecret ? t('credential.passphraseSet') : t('credential.passphraseOptional')}
            />
          </Row>
        </>
      )}

      {/* 密码认证字段 */}
      {kind === 'password' && (
        <Row label={t('credential.password')}>
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
            placeholder={hasExistingSecret ? t('credential.passwordSet') : t('credential.passwordPlaceholder')}
            className={cn(errors.has('password') && 'border-(--tx-red)')}
          />
        </Row>
      )}

      {/* 标签 */}
      <Row label={t('credential.tags')}>
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={t('credential.tagsPlaceholder')}
        />
      </Row>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('credential.cancel')}
        </Button>
        <Button size="sm" onClick={handleSave}>
          {t('credential.save')}
        </Button>
      </div>
    </div>
  );
};
