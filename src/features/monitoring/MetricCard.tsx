/**
 * 指标卡片组件
 * 带图标和标题的容器，用于在监控面板中展示单项指标
 */
import React from 'react';
import { Icon } from '@iconify/react';

interface MetricCardProps {
  icon: string;
  label: string;
  children: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, children }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: '8px 10px',
    background: 'var(--tx-bg-base)',
    borderRadius: 'var(--tx-radius-sm)',
    border: '1px solid var(--tx-border-light)',
    minWidth: 0,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--tx-text-tertiary)', fontWeight: 500 }}>
      <Icon icon={icon} width={12} height={12} />
      <span>{label}</span>
    </div>
    <div style={{ fontSize: 12, color: 'var(--tx-text-primary)', lineHeight: 1.3 }}>
      {children}
    </div>
  </div>
);
