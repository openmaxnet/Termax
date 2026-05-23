/**
 * 缩略监控视图
 * 以 2×N 网格卡片形式展示 CPU、内存、负载、运行时间、主机名、OS 等关键指标
 */
import React from 'react';
import { MetricCard } from './MetricCard';
import { CpuGauge } from './CpuGauge';
import { MemoryBar } from './MemoryBar';
import { useI18n } from '@/i18n';
import type { SystemInfo } from '@/lib/ipc';

interface ThumbnailViewProps {
  data: SystemInfo;
}

export const ThumbnailView: React.FC<ThumbnailViewProps> = ({ data }) => {
  const { t } = useI18n();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <MetricCard icon="solar:cpu-linear" label={t('monitoring.cpu')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CpuGauge percent={data.cpu.usage_percent} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{Math.round(data.cpu.usage_percent)}%</div>
            <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)' }}>{data.cpu.cores} {t('monitoring.cores')}</div>
          </div>
        </div>
      </MetricCard>

      <MetricCard icon="solar:server-linear" label={t('monitoring.memory')}>
        <MemoryBar
          usedBytes={data.memory.used_bytes}
          totalBytes={data.memory.total_bytes}
          availableBytes={data.memory.available_bytes}
        />
      </MetricCard>

      <MetricCard icon="solar:chart-2-linear" label={t('monitoring.loadAvg')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[data.load_avg.one_min, data.load_avg.five_min, data.load_avg.fifteen_min].map((v, i) => (
            <div key={i} style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--tx-font-mono)' }}>
              {v.toFixed(2)}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', marginTop: 1 }}>
          1m / 5m / 15m
        </div>
      </MetricCard>

      <MetricCard icon="solar:clock-circle-linear" label={t('monitoring.uptime')}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{data.uptime.raw}</div>
      </MetricCard>

      <MetricCard icon="solar:laptop-minimalistic-linear" label={t('monitoring.hostname')}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.hostname}</div>
      </MetricCard>

      <MetricCard icon="solar:info-circle-linear" label={t('monitoring.os')}>
        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.os.name || 'Linux'}
          {data.os.version && ` ${data.os.version}`}
        </div>
      </MetricCard>
    </div>
  );
};
