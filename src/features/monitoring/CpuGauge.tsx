/**
 * CPU 仪表盘 SVG 组件
 * 环形进度条，根据使用率显示绿/黄/红三色阈值
 */
import React from 'react';

interface CpuGaugeProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

export const CpuGauge: React.FC<CpuGaugeProps> = ({ percent, size = 56, strokeWidth = 5 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  // 使用率 > 80% 红色，> 50% 黄色，其余绿色
  const color = percent > 80 ? 'var(--tx-red, #f87171)' : percent > 50 ? 'var(--tx-yellow, #fbbf24)' : 'var(--tx-green, #4ade80)';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--tx-bg-hover)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600, color: 'var(--tx-text-primary)',
      }}>
        {Math.round(percent)}%
      </div>
    </div>
  );
};
