/**
 * 监控浮动面板
 * SSH 系统监控的浮动显示窗口，支持缩略/全量视图切换、
 * 轮询间隔设置、手动刷新、拖拽移动和缩放
 */
import React, { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { ConnectionConfig, SystemInfo } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import { FullView } from './FullView';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/** 监控浮动面板属性 */
interface MonitorOverlayProps {
  data: SystemInfo | null;
  loading?: boolean;
  error?: string | null;
  config?: ConnectionConfig;
  onRefresh: () => void;
  onClose: () => void;
  interval: number;
  onIntervalChange: (ms: number) => void;
}

/** 轮询间隔选项列表（显示标签 / 毫秒值） */
const INTERVAL_OPTIONS = [
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
];

export const MonitorOverlay: React.FC<MonitorOverlayProps> = ({
  data, loading, error, config, onRefresh, onClose, interval, onIntervalChange,
}) => {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — click outside closes, leaves StatusBar area clickable */}
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, bottom: 26, zIndex: 19, background: 'transparent' }} />

      <div ref={panelRef} style={{
        position: 'absolute', bottom: 34, right: 8, zIndex: 20,
        width: 520, maxHeight: 480,
        background: 'var(--tx-bg-elevated)',
        border: '1px solid var(--tx-border-light)',
        borderRadius: 'var(--tx-radius-md)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        overflow: 'hidden', fontSize: 12,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 8px', borderBottom: '1px solid var(--tx-border-light)',
          background: 'var(--tx-bg-elevated)',
        }}>
          <Icon icon="solar:chart-square-linear" width={14} height={14} color="var(--tx-accent-default)" />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 11,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('monitoring.title')}
          </span>

          {/* Loading dot */}
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: loading ? 'var(--tx-yellow, #fbbf24)' : error ? 'var(--tx-red, #f87171)' : data ? 'var(--tx-green, #4ade80)' : 'var(--tx-text-tertiary)',
            transition: 'background 0.3s',
          }} />

          {/* Interval dropdown */}
          <select value={interval} onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="h-7 w-14 text-[10px] px-1 rounded-(--tx-radius-sm) border border-(--tx-border-light) bg-(--tx-bg-elevated) text-(--tx-text-secondary) outline-none cursor-pointer">
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Refresh */}
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onRefresh} />}>
              <Icon icon="solar:refresh-linear" width={13} height={13} />
            </TooltipTrigger>
            <TooltipContent>{t('monitoring.refresh')}</TooltipContent>
          </Tooltip>

          {/* Close */}
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onClose} />}>
              <Icon icon="solar:close-circle-linear" width={13} height={13} />
            </TooltipTrigger>
            <TooltipContent>{t('monitoring.close')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Body */}
        <div style={{ padding: 8, overflowY: 'auto', maxHeight: 400 }}>
          {error && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--tx-red, #f87171)', fontSize: 11 }}>
              {t('monitoring.fetchError')}: {error}
            </div>
          )}
          <FullView data={data} config={config} />
        </div>
      </div>
    </>
  );
};
