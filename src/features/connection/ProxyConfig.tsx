/**
 * 代理配置面板
 * 在连接管理器的"代理"标签页中展示，配置 SSH 连接的 HTTP/SOCKS5 代理
 */
import React from 'react';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SshProxyConfig, SshProxyType } from '@/lib/ipc';

type ProxyType = 'none' | SshProxyType;

interface ProxyConfigProps {
  value?: SshProxyConfig | null;
  onChange: (config: SshProxyConfig | null) => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2" style={{ minHeight: 30 }}>
    <Label className="w-17.5 shrink-0 text-xs">{label}</Label>
    <div className="flex-1 flex items-center gap-1.5">{children}</div>
  </div>
);

export const ProxyConfig: React.FC<ProxyConfigProps> = ({ value, onChange }) => {
  const { t } = useI18n();
  const type: ProxyType = value ? value.proxy_type : 'none';
  const host = value?.host || '';
  const port = value?.port || 1080;
  const username = value?.username || '';
  const password = value?.password || '';

  const update = (partial: Partial<SshProxyConfig> | null) => {
    if (partial == null) { onChange(null); return; }
    onChange({ proxy_type: 'http', host: '', port: 1080, ...value, ...partial });
  };

  const typeBtnClass = (pt: ProxyType) => cn(
    'h-8 px-3 text-xs font-medium rounded-(--tx-radius-md) border transition-colors inline-flex items-center gap-1.5',
    type === pt
      ? 'border-(--tx-accent-default) bg-(--tx-accent-muted) text-(--tx-accent-default)'
      : 'border-(--tx-border-light) bg-transparent text-(--tx-text-secondary)',
  );

  return (
    <div className="flex flex-col gap-3">
      <Row label={t('proxy.type')}>
        <div className="flex gap-1">
          {(['none', 'http', 'socks5'] as ProxyType[]).map((pt) => (
            <button key={pt} onClick={() => pt === 'none' ? onChange(null) : update({ proxy_type: pt })}
              className={typeBtnClass(pt)}
            >{t(`proxy.${pt}`)}</button>
          ))}
        </div>
      </Row>

      <Row label={t('proxy.host')}>
        <Input value={host} onChange={(e) => update({ host: e.target.value })} placeholder="127.0.0.1" />
      </Row>
      <Row label={t('proxy.port')}>
        <Input type="number" value={port} onChange={(e) => update({ port: Number(e.target.value) || 0 })} placeholder="1080" className="w-30" />
      </Row>
      <Row label={t('proxy.username')}>
        <Input value={username} onChange={(e) => update({ username: e.target.value || null })} placeholder={t('proxy.usernamePlaceholder')} />
      </Row>
      <Row label={t('proxy.password')}>
        <Input type="password" value={password} onChange={(e) => update({ password: e.target.value || null })} placeholder={t('proxy.passwordPlaceholder')} />
      </Row>
    </div>
  );
};
