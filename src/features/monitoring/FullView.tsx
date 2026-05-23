/**
 * 全量监控视图
 * 包含概览（指标卡片）和进程列表两个标签页
 */
import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import type { ConnectionConfig, SystemInfo } from '@/lib/ipc';
import { OverviewTab, OverviewSkeleton, ProcessesTab, ProcessesSkeleton } from './MonitoringPanels';

interface FullViewProps {
  data: SystemInfo | null;
  config?: ConnectionConfig;
}

/** 标签页切换按钮，选中态带底部边框指示器 */
const TabBtn: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => {
  const [h, sH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        flex: 1, padding: '5px 0', fontSize: 11, fontWeight: active ? 600 : 400,
        border: 'none', borderRadius: active ? 0 : 'var(--tx-radius-sm) var(--tx-radius-sm) 0 0',
        background: h && !active ? 'var(--tx-bg-hover)' : 'transparent',
        color: active ? 'var(--tx-accent-default)' : 'var(--tx-text-tertiary)',
        cursor: 'pointer', borderBottom: active ? '2px solid var(--tx-accent-default)' : '2px solid transparent',
        transition: 'all 0.12s',
      }}>
      {label}
    </button>
  );
};

/**
 * 全量监控面板
 * 包含概览指标卡片和进程列表两个标签页
 */
export const FullView: React.FC<FullViewProps> = ({ data, config }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'overview' | 'processes'>('overview');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--tx-border-light)', marginBottom: 2 }}>
        <TabBtn active={tab === 'overview'} label={t('monitoring.title')} onClick={() => setTab('overview')} />
        <TabBtn active={tab === 'processes'} label={t('monitoring.processes')} onClick={() => setTab('processes')} />
      </div>
      {tab === 'overview' && (data ? <OverviewTab data={data} /> : <OverviewSkeleton />)}
      {tab === 'processes' && (data ? <ProcessesTab data={data} config={config} /> : <ProcessesSkeleton />)}
    </div>
  );
};
