/**
 * 监控概览面板
 * 主机/系统/CPU/内存/磁盘等指标卡片网格 + 加载骨架屏
 */
import React from 'react';
import { HardDrive } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { CpuGauge } from './CpuGauge';
import { MemoryBar } from './MemoryBar';
import { MetricCard } from './MetricCard';
import { useI18n } from '@/i18n';
import type { SystemInfo } from '@/lib/ipc';

/** 字节大小格式化（自动切换 GB/MB/KB） */
export function fmtSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 0.1) return gb.toFixed(1) + ' GB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return mb.toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

/** 骨架屏卡片：加载时显示占位线条 */
const SkeletonCard: React.FC<{ lines: number }> = ({ lines }) => (
  <div style={{ padding: 8, borderRadius: 'var(--tx-radius-md)', background: 'var(--tx-bg-surface)', animation: 'tx-pulse 1.5s ease-in-out infinite' }}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} style={{ height: 8, marginBottom: 6, borderRadius: 4, background: 'var(--tx-bg-hover)', width: `${60 + Math.random() * 35}%` }} />
    ))}
  </div>
);

/** 概览面板骨架屏（2×2 网格布局） */
export const OverviewSkeleton: React.FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
    <SkeletonCard lines={3} />
    <SkeletonCard lines={4} />
    <div style={{ gridColumn: '1 / -1' }}><SkeletonCard lines={2} /></div>
    <div style={{ gridColumn: '1 / -1' }}><SkeletonCard lines={2} /></div>
  </div>
);

/** 概览面板：主机/系统/CPU/内存/磁盘等指标卡片网格 */
export const OverviewTab: React.FC<{ data: SystemInfo }> = ({ data }) => {
  const { t } = useI18n();
  const maxDiskPct = data.disks && data.disks.length > 0
    ? Math.max(...data.disks.map(d => d.usage_percent))
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <MetricCard icon="solar:laptop-minimalistic-linear" label={t('monitoring.hostname')}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{data.hostname || '—'}</div>
      </MetricCard>
      <MetricCard icon="solar:info-circle-linear" label={t('monitoring.os')}>
        <div style={{ fontSize: 12 }}>{data.os.name || 'Linux'} {data.os.version}</div>
      </MetricCard>
      <MetricCard icon="solar:clock-circle-linear" label={t('monitoring.uptime')}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{data.uptime.raw}</div>
      </MetricCard>
      <MetricCard icon="solar:chart-square-outline" label={t('monitoring.loadAvg')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[data.load_avg.one_min, data.load_avg.five_min, data.load_avg.fifteen_min].map((v, i) => (
            <div key={i} style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--tx-font-mono)' }}>
              {v.toFixed(2)}
            </div>
          ))}
        </div>
      </MetricCard>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricCard icon="solar:cpu-linear" label={t('monitoring.cpu')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CpuGauge percent={data.cpu.usage_percent} size={64} strokeWidth={6} />
            <div style={{ fontSize: 11, lineHeight: 1.6, minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.cpu.model || 'Unknown'}</div>
              <div><span style={{ color: 'var(--tx-text-tertiary)' }}>{t('monitoring.cores')}: </span>{data.cpu.cores}</div>
            </div>
          </div>
        </MetricCard>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricCard icon="solar:server-linear" label={t('monitoring.memory')}>
          <MemoryBar usedBytes={data.memory.used_bytes} totalBytes={data.memory.total_bytes} availableBytes={data.memory.available_bytes} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginTop: 6, fontSize: 11 }}>
            <div><span style={{ color: 'var(--tx-text-tertiary)' }}>{t('monitoring.total')}: </span><span style={{ fontFamily: 'var(--tx-font-mono)' }}>{fmtSize(data.memory.total_bytes)}</span></div>
            <div><span style={{ color: 'var(--tx-text-tertiary)' }}>{t('monitoring.used')}: </span><span style={{ fontFamily: 'var(--tx-font-mono)' }}>{fmtSize(data.memory.used_bytes)}</span></div>
            <div><span style={{ color: 'var(--tx-text-tertiary)' }}>{t('monitoring.free')}: </span><span style={{ fontFamily: 'var(--tx-font-mono)' }}>{fmtSize(data.memory.free_bytes)}</span></div>
            <div><span style={{ color: 'var(--tx-text-tertiary)' }}>{t('monitoring.available')}: </span><span style={{ fontFamily: 'var(--tx-font-mono)' }}>{fmtSize(data.memory.available_bytes)}</span></div>
          </div>
        </MetricCard>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricCard icon="solar:notification-unread-lines-broken" label={t('monitoring.disk')}>
          {data.disks && data.disks.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--tx-bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(maxDiskPct, 100)}%`, height: '100%',
                    background: maxDiskPct > 80 ? 'var(--tx-red, #f87171)' : maxDiskPct > 50 ? 'var(--tx-yellow, #fbbf24)' : 'var(--tx-accent-default)',
                    borderRadius: 4, transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--tx-font-mono)' }}>{Math.round(maxDiskPct)}%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.disks.map((d, i) => <DiskRow key={i} disk={d} />)}
              </div>
            </>
          ) : (
            <Empty className="py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><HardDrive size={24} /></EmptyMedia>
                <EmptyTitle className="text-xs">{t('monitoring.noDiskData')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </MetricCard>
      </div>
    </div>
  );
};

/** 磁盘分区行：柱状图 + 使用率 + 详细信息 */
const DiskRow: React.FC<{ disk: { filesystem: string; total_bytes: number; used_bytes: number; free_bytes: number; usage_percent: number; mount_point: string } }> = ({ disk }) => {
  const [h, sH] = React.useState(false);
  const pct = disk.usage_percent;
  return (
    <div onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '3px 4px', borderRadius: 'var(--tx-radius-sm)', background: h ? 'var(--tx-bg-hover)' : 'transparent', transition: 'background 0.12s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx-text-secondary)' }}>
        <span style={{ fontWeight: 500 }}>{disk.mount_point}</span>
        <span style={{ fontFamily: 'var(--tx-font-mono)' }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--tx-bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct > 80 ? 'var(--tx-red, #f87171)' : pct > 50 ? 'var(--tx-yellow, #fbbf24)' : 'var(--tx-accent-default)', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)' }}>{fmtSize(disk.used_bytes)} / {fmtSize(disk.total_bytes)}</div>
    </div>
  );
};
