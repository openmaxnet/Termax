/**
 * 内存使用条组件
 * 显示已用/可用/缓存三段的水平进度条
 */
import React from 'react';

interface MemoryBarProps {
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
}

/** 字节格式化：自动切换到 GB/MB 单位 */
function fmt(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return gb.toFixed(1) + ' GB';
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(0) + ' MB';
}

export const MemoryBar: React.FC<MemoryBarProps> = ({ usedBytes, totalBytes, availableBytes }) => {
  const usedPct = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const availPct = totalBytes > 0 ? (availableBytes / totalBytes) * 100 : 0;
  const otherPct = Math.max(0, 100 - usedPct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx-text-secondary)' }}>
        <span>{fmt(usedBytes)} / {fmt(totalBytes)}</span>
        <span>{Math.round(usedPct)}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--tx-bg-hover)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${usedPct}%`, background: 'var(--tx-accent-default)', transition: 'width 0.3s' }} />
        <div style={{ width: `${otherPct - (100 - availPct)}%`, background: 'var(--tx-border-light)', transition: 'width 0.3s' }} />
        <div style={{ flex: 1, background: 'var(--tx-green, #4ade80)', opacity: 0.3 }} />
      </div>
    </div>
  );
};
