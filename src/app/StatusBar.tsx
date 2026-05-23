/**
 * 状态栏组件
 * 应用窗口底部状态栏，显示：连接数量、当前活动主机、SSH 系统监控数据
 * （CPU/内存/磁盘实时指标）和监控面板切换按钮
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { useI18n } from '@/i18n';
import { useTerminalStore } from '@/stores/terminalStore';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { SystemInfo } from '@/lib/ipc';

/** 状态栏属性 */
interface StatusBarProps {
  connectionCount?: number;
  activeHost?: string;
  monitorActive?: boolean;
  monitorData?: SystemInfo | null;
  monitorError?: string | null;
  hasActiveSsh?: boolean;
  onToggleMonitor?: () => void;
}

/** 百分比格式化 */
function fmtPct(v: number): string {
  return Math.round(v) + '%';
}

/** 监控按钮（无外层 Tooltip，点击切换监控面板） */
const MonitorBtn: React.FC<{ onClick: () => void; active?: boolean; children: React.ReactNode }> = ({ onClick, active, children }) => (
  <button onClick={onClick}
    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--tx-bg-hover)'}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      border: 'none', borderRadius: 'var(--tx-radius-sm)',
      background: active ? 'var(--tx-bg-hover)' : 'transparent',
      color: 'var(--tx-text-secondary)', cursor: 'pointer',
      padding: '2px 8px', fontSize: 11, transition: 'background 0.12s',
    }}>
    {children}
  </button>
);

/* ── StatusBar ── */

export const StatusBar: React.FC<StatusBarProps> = ({
  connectionCount = 0, activeHost, monitorActive, monitorData, monitorError,
  hasActiveSsh, onToggleMonitor,
}) => {
  const { t } = useI18n();
  const broadcastActive = useTerminalStore((s) => s.broadcastActive);
  const broadcastTargets = useTerminalStore((s) => s.broadcastTargets);
  const stopBroadcast = useTerminalStore((s) => s.stopBroadcast);

  // 右侧监控指标区域：根据数据/错误/加载状态显示不同内容
  const rightContent = () => {
    // SSH active + data available
    if (hasActiveSsh && monitorData) {
      return (
        <MonitorBtn onClick={onToggleMonitor!} active={monitorActive}>
          <MonitorBadge
            icon="solar:cpu-linear"
            value={fmtPct(monitorData.cpu.usage_percent)}
            color={monitorData.cpu.usage_percent > 80 ? 'var(--tx-red, #f87171)' : monitorData.cpu.usage_percent > 50 ? 'var(--tx-yellow, #fbbf24)' : 'var(--tx-green, #4ade80)'}
            tip={t('monitoring.cpuTip', { pct: fmtPct(monitorData.cpu.usage_percent), cores: monitorData.cpu.cores })}
          />
          <MonitorBadge
            icon="solar:server-linear"
            value={fmtPct(monitorData.memory.usage_percent)}
            color={monitorData.memory.usage_percent > 80 ? 'var(--tx-red, #f87171)' : monitorData.memory.usage_percent > 50 ? 'var(--tx-yellow, #fbbf24)' : 'var(--tx-green, #4ade80)'}
            tip={t('monitoring.memTip', { pct: fmtPct(monitorData.memory.usage_percent) })}
          />
          {monitorData.disks && monitorData.disks.length > 0 && (
            <MonitorBadge
              icon="solar:archive-down-minimlistic-linear"
              value={fmtPct(Math.max(...monitorData.disks.map(d => d.usage_percent)))}
              color={Math.max(...monitorData.disks.map(d => d.usage_percent)) > 80 ? 'var(--tx-red, #f87171)' : 'var(--tx-green, #4ade80)'}
              tip={t('monitoring.diskTip', { pct: fmtPct(Math.max(...monitorData.disks.map(d => d.usage_percent))) })}
            />
          )}
        </MonitorBtn>
      );
    }

    // SSH active + error
    if (hasActiveSsh && monitorError) {
      return (
        <MonitorBtn onClick={onToggleMonitor!} active={monitorActive}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--tx-red, #f87171)' }}>
            <Icon icon="solar:chart-square-linear" width={13} height={13} />
            <span style={{ fontSize: 10 }}>{t('monitoring.fetchError')}</span>
          </div>
        </MonitorBtn>
      );
    }

    // SSH active + loading (no data yet)
    if (hasActiveSsh && onToggleMonitor) {
      return (
        <MonitorBtn onClick={onToggleMonitor} active={monitorActive}>
          <Icon icon="solar:chart-square-linear" width={13} height={13} />
          <span>{activeHost ?? t('monitoring.title')}</span>
        </MonitorBtn>
      );
    }

    // No SSH tab
    if (activeHost) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon icon="solar:laptop-minimalistic-outline" width={12} height={12} />
          <span>{activeHost}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <footer className="flex items-center justify-between shrink-0" style={{
      height: 26, padding: '0 12px', fontSize: 11,
      background: 'var(--tx-bg-elevated)', color: 'var(--tx-text-tertiary)',
      borderTop: '1px solid var(--tx-border-light)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: connectionCount > 0 ? 'var(--tx-green)' : 'var(--tx-text-tertiary)' }} />
        <span>{connectionCount > 0 ? t('statusBar.connections', { count: connectionCount }) : t('statusBar.noConnections')}</span>
        {broadcastActive && (
          <button onClick={stopBroadcast}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '1px 6px',
              border: 'none', borderRadius: 'var(--tx-radius-sm)', background: 'transparent',
              color: 'var(--tx-accent-default)', cursor: 'pointer', fontSize: 11,
            }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--tx-accent-default)' }} />
            <span>{t('statusBar.broadcasting', { count: String(broadcastTargets.size) })}</span>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {rightContent()}
      </div>
    </footer>
  );
};

/** 监控指标徽章：状态点 + 图标 + 数值 */
const MonitorBadge: React.FC<{ icon: string; value: string; color: string; tip?: string }> = ({ icon, value, color, tip }) => {
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      <Icon icon={icon} width={10} height={10} />
      <span style={{ fontFamily: 'var(--tx-font-mono)', fontSize: 10 }}>{value}</span>
    </div>
  );
  return tip ? (
    <Tooltip>
      <TooltipTrigger render={inner} />
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  ) : inner;
};
