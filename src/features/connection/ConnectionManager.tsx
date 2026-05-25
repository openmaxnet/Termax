/**
 * 连接管理器对话框
 * 远程连接配置的 CRUD 管理，支持 SSH/WSL 切换、测试连接、保存配置
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import { ArrowLeftRight } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ConnectionForm, type ConnectionFormHandle } from './ConnectionForm';
import { ForwardConfig } from '@/features/forward/ForwardConfig';
import { ProxyConfig } from './ProxyConfig';
import { BastionConfig } from './BastionConfig';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ipc } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import type { BastionConfig as BastionConfigType, ConnectionConfig, PortForwardRule, SshProxyConfig } from '@/lib/ipc';

/** 连接管理器设置标签页类型 */
type SettingTab = 'general' | 'bastion' | 'proxy' | 'tunnel';

interface ConnectionManagerProps {
  open: boolean;
  onClose: () => void;
  editConfig?: ConnectionConfig | null;
  onConnect: (config: ConnectionConfig) => void;
  onConfigsChange: () => void;
  /** Entry type for title: 'ssh' | 'wsl' */
  entryType?: 'ssh' | 'wsl';
}

/** 设置标签页定义（通用/代理/隧道） */
const SETTING_TABS: { id: SettingTab; icon: string; labelKey: string }[] = [
  { id: 'general', icon: 'solar:settings-linear', labelKey: 'manager.settingGeneral' },
  { id: 'bastion', icon: 'solar:server-square-linear', labelKey: 'manager.settingBastion' },
  { id: 'proxy', icon: 'solar:plug-circle-linear', labelKey: 'manager.settingProxy' },
  { id: 'tunnel', icon: 'solar:transfer-horizontal-linear', labelKey: 'manager.settingTunnel' },
];

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  open, onClose, editConfig, onConnect, onConfigsChange, entryType = 'ssh',
}) => {
  const { t } = useI18n();
  const [settingTab, setSettingTab] = useState<SettingTab>('general');
  const [allConfigs, setAllConfigs] = useState<ConnectionConfig[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [forwardRules, setForwardRules] = useState<PortForwardRule[]>([]);
  const [bastionConfigs, setBastionConfigs] = useState<BastionConfigType[]>(
    () => editConfig?.bastion ?? [],
  );
  const [proxyConfig, setProxyConfig] = useState<SshProxyConfig | null>(
    () => editConfig?.proxy ?? null,
  );
  const formRef = useRef<ConnectionFormHandle>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<{ data: ConnectionConfig; existing: ConnectionConfig } | null>(null);

  useEffect(() => {
    if (!open) return;
    ipc.config.load().then(setAllConfigs);
  }, [open]);

  // 从后端加载所有已保存的连接配置
  const loadConfigs = useCallback(async () => {
    setAllConfigs(await ipc.config.load());
    onConfigsChange();
  }, [onConfigsChange]);

  // 保存连接配置到 sessionStorage（最近连接列表，最多 10 条）
  const saveRecent = (data: ConnectionConfig) => {
    try {
      const raw = sessionStorage.getItem('termax_recent');
      const recent: ConnectionConfig[] = raw ? JSON.parse(raw) : [];
      const updated = [data, ...recent.filter((c) => c.id !== data.id)].slice(0, 10);
      sessionStorage.setItem('termax_recent', JSON.stringify(updated));
    } catch {}
  };

  // 保存配置并建立连接（检测重名时弹出 AlertDialog 确认覆盖）
  const handleSaveAndConnect = useCallback(async (data: ConnectionConfig) => {
    const existing = allConfigs.find((c) => c.name === data.name && c.id !== data.id);
    if (existing) {
      setOverwriteTarget({ data, existing });
      return;
    }
    await ipc.config.save(data).catch(() => {});
    await loadConfigs();
    saveRecent(data);
    onConnect(data);
    onClose();
  }, [allConfigs, loadConfigs, onConnect, onClose]);

  // 确认覆盖重名配置
  const handleOverwriteConfirm = useCallback(async () => {
    if (!overwriteTarget) return;
    const { data, existing } = overwriteTarget;
    setOverwriteTarget(null);
    await ipc.config.update(existing.id, { ...data, id: existing.id }).catch(() => {});
    await loadConfigs();
    saveRecent(data);
    onConnect(data);
    onClose();
  }, [overwriteTarget, loadConfigs, onConnect, onClose]);

  // 更新已保存的配置并连接
  const handleSavedUpdate = useCallback(async (data: ConnectionConfig) => {
    if (data.id && allConfigs.some((c) => c.id === data.id)) {
      await ipc.config.update(data.id, data).catch(() => {});
    }
    await loadConfigs();
    saveRecent(data);
    onConnect(data);
    onClose();
  }, [allConfigs, loadConfigs, onConnect, onClose]);

  // 测试连接：调用后端 SSH 测试，根据错误信息显示友好的中文提示
  const handleTest = useCallback(async (data: ConnectionConfig) => {
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await ipc.ssh.test(data);
      setTestResult({ ok: true, message: msg });
    } catch (err) {
      const raw = String(err);
      let message: string;
      if (raw.includes('timed out')) message = t('manager.testTimeout');
      else if (raw.includes('incorrect password') || raw.includes('key rejected')) message = t('manager.testAuthFailed');
      else if (raw.includes('Key error')) message = t('manager.testKeyError');
      else if (raw.includes('Auth error')) message = t('manager.testAuthFailed');
      else if (raw.includes('Connection failed')) message = t('manager.testConnFailed');
      else message = t('manager.testFail');
      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  }, [t]);

  const isEditing = !!editConfig;
  const [dialogPos, setDialogPos] = useState<{ top: number; left: number } | null>(null);
  const [dialogSize, setDialogSize] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startT: number; startL: number; dir: string } | null>(null);

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={{ ...dialogStyle, ...(dialogSize ? { width: dialogSize.w, height: dialogSize.h } : {}), ...(dialogPos ? { position: 'fixed', top: dialogPos.top, left: dialogPos.left, transform: 'none' } : {}) }}>
        {/* Header — draggable */}
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
          <Icon icon="solar:programming-outline" width={18} height={18} color="var(--tx-accent-default)" />
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--tx-text-primary)', flex: 1 }}>
            {editConfig ? t('manager.editTitle') : entryType === 'wsl' ? t('manager.wsl') : t('manager.sshTitle')}
          </h2>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Settings sidebar */}
          <nav style={{ width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px', borderRight: '1px solid var(--tx-border-light)' }}>
            {SETTING_TABS.map((st) => (
              <button key={st.id} onClick={() => setSettingTab(st.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px',
                  border: 'none', borderRadius: 'var(--tx-radius-sm)',
                  background: settingTab === st.id ? 'var(--tx-accent-muted)' : 'transparent',
                  color: settingTab === st.id ? 'var(--tx-accent-default)' : 'var(--tx-text-secondary)',
                  cursor: 'pointer', fontSize: 12, fontWeight: settingTab === st.id ? 500 : 400,
                  textAlign: 'left', transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { if (settingTab !== st.id) e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { if (settingTab !== st.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon icon={st.icon} width={15} height={15} />
                {t(st.labelKey)}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
            {settingTab === 'general' && (
              <ConnectionForm ref={formRef} config={editConfig} t={t} />
            )}
            {settingTab === 'bastion' && (
              <BastionConfig value={bastionConfigs} onChange={setBastionConfigs} />
            )}
            {settingTab === 'proxy' && <ProxyConfig value={proxyConfig} onChange={setProxyConfig} />}
            {settingTab === 'tunnel' && (editConfig ? <ForwardConfig config={editConfig} rules={forwardRules} onRulesChange={setForwardRules} /> : (
  <Empty className="h-full">
    <EmptyHeader>
      <EmptyMedia variant="icon"><ArrowLeftRight size={28} /></EmptyMedia>
      <EmptyTitle>{t('manager.saveBeforeTunnel')}</EmptyTitle>
    </EmptyHeader>
  </Empty>
))}
          </div>
        </div>

        {/* Bottom action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid var(--tx-border-light)', flexShrink: 0 }}>
          {testResult && (
            <span style={{ fontSize: 12, color: testResult.ok ? 'var(--tx-green)' : 'var(--tx-red)', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon icon={testResult.ok ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} width={14} height={14} />
              {testResult.ok ? t('manager.testSuccess') : testResult.message}
            </span>
          )}
          <Button variant="outline" onClick={onClose}>{t('manager.cancel')}</Button>
          <Button variant="outline" onClick={() => {
            const data = formRef.current?.validateAndGet();
            if (!data) return;
            handleTest({ ...data, bastion: bastionConfigs, proxy: proxyConfig || null });
          }} disabled={testing}>{testing ? t('manager.testing') : t('manager.test')}</Button>
          <Button onClick={() => {
            const data = formRef.current?.validateAndGet();
            if (!data) return;
            const merged = { ...data, bastion: bastionConfigs, proxy: proxyConfig || null };
            if (isEditing) handleSavedUpdate(merged);
            else handleSaveAndConnect(merged);
          }}>{isEditing ? t('manager.saveChanges') : t('manager.saveAndConnect')}</Button>
        </div>
        {/* Resize handles */}
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

      {/* 重名覆盖确认弹窗 */}
      <AlertDialog open={overwriteTarget !== null} onOpenChange={(open) => { if (!open) setOverwriteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('manager.overwriteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              "{overwriteTarget?.data.name}" {t('manager.overwriteMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('manager.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm}>{t('manager.overwrite')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'var(--tx-bg-overlay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn 0.15s',
};

const dialogStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  width: 600, maxWidth: '92vw', height: 500, maxHeight: '85vh',
  background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)',
  borderRadius: 'var(--tx-radius-lg)', boxShadow: 'var(--tx-shadow-lg)', animation: 'scaleIn 0.15s',
};

