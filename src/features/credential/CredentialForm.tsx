/**
 * 凭证表单组件
 * 用于添加/编辑 SSH 凭证（密钥或密码），支持文件选择和标签输入
 * 密钥认证：选择文件后读取内容加密存储，不再依赖文件路径
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
  onSave: (cred: SshCredential, secret?: string, keyContent?: string) => void;
  /** 取消回调 */
  onCancel: () => void;
}

type FormKind = 'key' | 'password';

/** 凭证添加/编辑表单 */
export const CredentialForm: React.FC<CredentialFormProps> = ({ credential, onSave, onCancel }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FormKind>('key');
  const [keyFileName, setKeyFileName] = useState('');
  const [keyContent, setKeyContent] = useState('');
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
      // 显示原文件名（如果有的话）
      setKeyFileName(credential.kind.Key.name || '');
      // 有加密的私钥内容说明已导入
      if (credential.encrypted_key_content) {
        setKeyContent('__loaded__'); // 标记已加载，不传实际内容
      }
    } else {
      setKind('password');
    }
    setHasExistingSecret(credential.has_secret);
    // 加载密码短语/密码
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
    if (kind === 'key' && !keyContent && !keyFileName) errs.add('keyPath');
    if (kind === 'password' && !password && !hasExistingSecret) errs.add('password');
    setErrors(errs);
    return errs.size === 0;
  }, [name, kind, keyContent, keyFileName, password, hasExistingSecret]);

  const handleSave = () => {
    if (!validate()) return;

    const now = Date.now();
    const tags = tagsInput.split(',').map((s) => s.trim()).filter(Boolean);

    let credKind: CredentialKind;
    let secret: string | undefined;
    let keyContentToSave: string | undefined;

    if (kind === 'key') {
      credKind = { Key: { name: keyFileName, passphrase_stored: !!passphrase } };
      secret = passphrase || undefined;
      // 如果是新选择的文件（不是 __loaded__ 标记），传实际内容
      if (keyContent && keyContent !== '__loaded__') {
        keyContentToSave = keyContent;
      }
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

    onSave(cred, secret, keyContentToSave);
  };

  const handleFileSelected = async () => {
    try {
      const result = await ipc.credential.pickKeyFile();
      if (result) {
        const [fileName, content] = result;
        setKeyFileName(fileName);
        setKeyContent(content);
        clearError('keyPath');
      }
    } catch (e) {
      console.error('选择密钥文件失败:', e);
    }
  };

  const kindBtnClass = (type: FormKind) => cn(
    'h-8 px-3 text-xs font-medium rounded-(--tx-radius-md) border transition-colors inline-flex items-center gap-1.5',
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
            <div className="flex items-center gap-2 flex-1">
              {keyFileName ? (
                <div className={cn(
                  'flex items-center gap-1.5 flex-1 h-8 px-2.5 rounded-(--tx-radius-sm) text-xs',
                  'border border-(--tx-border-light) bg-(--tx-bg-base)',
                  errors.has('keyPath') && 'border-(--tx-red)',
                )}>
                  <Icon icon="solar:key-linear" width={14} height={14} color="var(--tx-accent-default)" className="shrink-0" />
                  <span className="truncate">{keyFileName}</span>
                  <span className="shrink-0 text-(--tx-green) text-[10px]">{t('credential.keyImported')}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleFileSelected}
                  className={cn(
                    'flex items-center gap-1.5 flex-1 h-8 px-2.5 rounded-(--tx-radius-sm) text-xs cursor-pointer',
                    'border border-dashed border-(--tx-border-default) text-(--tx-text-tertiary)',
                    'hover:border-(--tx-accent-default) hover:text-(--tx-accent-default) hover:bg-(--tx-accent-muted) transition-colors',
                    errors.has('keyPath') && 'border-(--tx-red)',
                  )}
                >
                  <Icon icon="solar:upload-minimalistic-linear" width={14} height={14} />
                  {t('credential.selectKeyFile')}
                </button>
              )}
              {keyFileName && (
                <button
                  type="button"
                  onClick={handleFileSelected}
                  className="shrink-0 p-1.5 rounded-(--tx-radius-sm) text-(--tx-text-tertiary) hover:text-(--tx-accent-default) hover:bg-(--tx-bg-hover) transition-colors"
                  title={t('credential.reselect')}
                >
                  <Icon icon="solar:refresh-linear" width={14} height={14} />
                </button>
              )}
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
