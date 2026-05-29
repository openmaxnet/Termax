/**
 * 连接表单组件
 * 远程连接配置编辑表单，支持密码/密钥/凭证库认证方式切换、
 * 主机/端口/用户名等字段录入和基础验证
 */
import React, { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Sel } from '@/features/settings/helpers';
import { ipc } from '@/lib/ipc';
import type { ConnectionConfig, SshCredential } from '@/lib/ipc';

/** 认证方式：无/密码/凭证库（密钥文件已合并到凭证库中管理） */
type AuthType = 'none' | 'password' | 'credential';

/**
 * 连接表单实例句柄
 * 父组件通过 ref 调用表单的校验和取值方法
 */
export interface ConnectionFormHandle {
  /** 校验表单并返回配置数据，校验失败返回 null */
  validateAndGet: () => ConnectionConfig | null;
}

/** 连接表单属性 */
interface ConnectionFormProps {
  config?: ConnectionConfig | null;
  t: (k: string, p?: any) => string;
}

/** 表单行容器：标签 + 内容 */
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2" style={{ minHeight: 30 }}>
    <Label className="w-17.5 shrink-0 text-right text-xs">{label}</Label>
    <div className="flex-1">{children}</div>
  </div>
);

/**
 * 远程连接配置表单
 * 支持密码、密钥和凭证库三种认证方式，含字段校验
 */
export const ConnectionForm = forwardRef<ConnectionFormHandle, ConnectionFormProps>(({
  config, t,
}, ref) => {
  const [f, setF] = useState({
    name: '', host: '', port: 22, username: '',
    authType: 'none' as AuthType, password: '',
    credentialId: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [credentials, setCredentials] = useState<SshCredential[]>([]);

  useEffect(() => {
    ipc.credential.list().then(setCredentials).catch(() => {});

    if (config) {
      const isCred = config.auth_method && 'Credential' in config.auth_method;
      const pw = config.auth_method && 'Password' in config.auth_method ? config.auth_method.Password : '';
      const credId = isCred ? (config.auth_method as { Credential: string }).Credential : '';
      setF({
        name: config.name || '', host: config.host, port: config.port, username: config.username,
        authType: isCred ? 'credential' : (pw ? 'password' : 'none'),
        password: pw,
        credentialId: credId,
      });
    } else {
      setF({ name: '', host: '', port: 22, username: '', authType: 'none', password: '', credentialId: '' });
    }
    setErrors(new Set());
  }, [config]);

  const buildConfig = (): ConnectionConfig => ({
    id: config?.id || crypto.randomUUID(),
    name: f.name || `${f.username}@${f.host}`,
    host: f.host, port: f.port, username: f.username,
    auth_method: f.authType === 'password'
      ? { Password: f.password }
      : f.authType === 'credential'
      ? { Credential: f.credentialId }
      : { Password: '' },
    group: config?.group || undefined,
    bastion: config?.bastion || [],
  });

  const validate = useCallback(() => {
    const errs = new Set<string>();
    if (!f.host.trim()) errs.add('host');
    if (!f.username.trim()) errs.add('username');
    if (f.authType === 'password' && !f.password) errs.add('password');
    if (f.authType === 'none') errs.add('authType');
    if (f.authType === 'credential' && !f.credentialId) errs.add('credentialId');
    setErrors(errs);
    return errs.size === 0;
  }, [f]);

  useImperativeHandle(ref, () => ({
    validateAndGet: () => validate() ? buildConfig() : null,
  }), [validate, buildConfig]);

  const set = (k: string, v: string | number | AuthType) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((prev) => { const n = new Set(prev); n.delete(k); return n; });
  };

  const authBtnClass = (type: AuthType) => cn(
    'h-7 px-3 text-xs font-medium rounded-(--tx-radius-sm) border transition-colors inline-flex items-center',
    f.authType === type
      ? 'border-(--tx-accent-default) bg-(--tx-accent-muted) text-(--tx-accent-default)'
      : 'border-(--tx-border-light) bg-transparent text-(--tx-text-secondary)',
  );

  // 凭证下拉选项
  const credOptions = credentials.map((c) => ({
    value: c.id,
    label: `${c.name} (${'Key' in c.kind ? t('credential.key') : t('credential.password')})`,
  }));

  return (
    <div className="flex flex-col gap-3.5">
      {/* ═══ Basic ═══ */}
      <div className="flex flex-col gap-1.5">
        <Row label={t('manager.name')}>
          <Input placeholder={t('manager.namePlaceholder')} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Row>
        <Row label={t('manager.host')}>
          <div className="flex gap-2 items-center flex-1">
            <Input placeholder={t('manager.hostPlaceholder')} value={f.host} onChange={(e) => set('host', e.target.value)} className={cn('flex-1', errors.has('host') && 'border-(--tx-red)')} />
            <span className="text-xs text-(--tx-text-tertiary) shrink-0">{t('manager.port')}</span>
            <Input type="number" placeholder="22" value={f.port} onChange={(e) => set('port', Number(e.target.value) || 22)} className="w-17.5" />
          </div>
        </Row>
        <Row label={t('manager.username')}>
          <Input placeholder={t('manager.usernamePlaceholder')} value={f.username} onChange={(e) => set('username', e.target.value)} className={cn(errors.has('username') && 'border-(--tx-red)')} />
        </Row>
      </div>

      {/* ═══ Authentication ═══ */}
      <div className="flex flex-col gap-1.5">
        <Row label={t('manager.authType')}>
          <div className={cn('flex gap-1', errors.has('authType') && 'ring-1 ring-(--tx-red) rounded-(--tx-radius-sm)')}>
            <button onClick={() => set('authType', 'none')} className={authBtnClass('none')}>{t('manager.none')}</button>
            <button onClick={() => set('authType', 'password')} className={authBtnClass('password')}>{t('manager.password')}</button>
            <button onClick={() => set('authType', 'credential')} className={authBtnClass('credential')}>
              {t('credential.fromCredential')}
            </button>
          </div>
        </Row>
        {f.authType === 'credential' && (
          <Row label={t('credential.selectCredential')}>
            <div className={cn(errors.has('credentialId') && '[&>button]:border-(--tx-red)')}>
              <Sel
                value={f.credentialId}
                options={credOptions}
                onChange={(v) => { setF((p) => ({ ...p, credentialId: v })); setErrors((prev) => { const n = new Set(prev); n.delete('credentialId'); return n; }); }}
              />
            </div>
          </Row>
        )}
        {f.authType === 'password' && (
          <Row label={t('manager.password')}>
            <div className="relative flex-1">
              <Input type={showPw ? 'text' : 'password'} placeholder={t('manager.passwordPlaceholder')} value={f.password} onChange={(e) => set('password', e.target.value)} className={cn('pr-8', errors.has('password') && 'border-(--tx-red)')} />
              <button onClick={() => setShowPw(!showPw)} tabIndex={-1}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-(--tx-text-tertiary) hover:text-(--tx-text-secondary)">
                <Icon icon={showPw ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width={16} height={16} />
              </button>
            </div>
          </Row>
        )}
      </div>
    </div>
  );
});
