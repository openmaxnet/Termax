/**
 * 浮动调试面板
 * 显示实时性能指标（FPS/Memory）、启动耗时、IPC 日志。
 * 仅在 debugMode=true 时渲染，关闭后自动导出日志并卸载。
 * 样式风格与 MonitorOverlay 保持统一。
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { ScrollText } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useSettingsStore } from '@/stores/settingsStore';
import { useI18n } from '@/i18n';
import { subscribeDebug, getLogs, getMetrics, clearLogs, exportLogs, onDebugModeChange } from '@/lib/debug';
import type { LogEntry } from '@/lib/debug';

export const DebugPanel: React.FC = () => {
  const debugMode = useSettingsStore((s) => s.debugMode);
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 400 });
  const [logs, setLogs] = useState<readonly LogEntry[]>([]);
  const [metrics, setMetrics] = useState({ fps: 0, memoryMB: 0, heapMB: 0 });
  const [lastExport, setLastExport] = useState('');
  const logListRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  // 订阅 debug 状态变化
  useEffect(() => {
    return subscribeDebug(() => {
      setLogs(getLogs());
      setMetrics(getMetrics());
    });
  }, []);

  // 监听 debugMode 切换
  useEffect(() => {
    onDebugModeChange(debugMode);
  }, [debugMode]);

  // 自动滚动日志到底部
  useEffect(() => {
    const el = logListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  // 拖拽
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: pos.x, startTop: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.startLeft + ev.clientX - dragRef.current.startX,
        y: dragRef.current.startTop + ev.clientY - dragRef.current.startY,
      });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos]);

  if (!debugMode) return null;

  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, width: 320,
      background: 'var(--tx-bg-elevated)',
      border: '1px solid var(--tx-border-light)',
      borderRadius: 'var(--tx-radius-md)',
      boxShadow: 'var(--tx-shadow-md)',
      zIndex: 100, fontSize: 12,
      userSelect: 'none', overflow: 'hidden',
    }}>
      {/* Header — matches MonitorOverlay style */}
      <div onMouseDown={onDragStart} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 8px', cursor: 'grab',
        borderBottom: '1px solid var(--tx-border-light)',
        background: 'var(--tx-bg-elevated)',
      }}>
        <Icon icon="solar:bug-linear" width={14} height={14} color="var(--tx-accent-default)" />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 11,
          color: 'var(--tx-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Debug
        </span>
        <button onClick={() => setCollapsed(!collapsed)}
          style={headerBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Icon icon={collapsed ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'} width={12} height={12} />
        </button>
        <button onClick={() => { useSettingsStore.getState().setDebugMode(false); }}
          style={headerBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Icon icon="solar:close-square-linear" width={12} height={12} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 10px', maxHeight: 350, overflowY: 'auto' }}>
          {/* 实时指标 */}
          <SectionTitle>{t('debug.metrics')}</SectionTitle>
          <MetricRow label="FPS" value={String(metrics.fps)} color={metrics.fps < 30 ? 'var(--tx-red)' : 'var(--tx-green)'} />
          <MetricRow label="Memory" value={`${metrics.memoryMB} MB`} />
          <MetricRow label="JS Heap" value={`${metrics.heapMB} MB`} />

          {/* IPC 日志 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
            <SectionTitle style={{ margin: 0 }}>{t('debug.ipcLogs')} ({logs.filter(l => l.cat === 'IPC').length})</SectionTitle>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { clearLogs(); setLastExport(''); }}
                style={actionBtnStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >{t('debug.clear')}</button>
              <button onClick={async () => { await exportLogs(); setLastExport(new Date().toLocaleTimeString()); }}
                style={actionBtnStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >{t('debug.export')}</button>
            </div>
          </div>
          <div ref={logListRef} style={{
            maxHeight: 150, overflowY: 'auto',
            background: 'var(--tx-bg-surface)',
            border: '1px solid var(--tx-border-light)',
            borderRadius: 'var(--tx-radius-sm)', padding: '4px 0',
          }}>
            {logs.length === 0 && (
              <Empty className="py-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ScrollText size={20} /></EmptyMedia>
                  <EmptyTitle className="text-xs">{t('debug.noLogs')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {logs.map((entry, i) => (
              <div key={i} style={{ padding: '2px 8px', display: 'flex', gap: 6, lineHeight: 1.6 }}>
                <span style={{ color: 'var(--tx-text-tertiary)', flexShrink: 0 }}>{formatTs(entry.ts)}</span>
                <span style={{ color: catColor(entry.cat), flexShrink: 0, width: 52, textAlign: 'right', fontSize: 10 }}>{entry.cat}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-primary)' }}>{entry.msg}</span>
                {entry.dur !== undefined && <span style={{ color: 'var(--tx-text-secondary)', flexShrink: 0 }}>{entry.dur}ms</span>}
                {entry.ok === false && <span style={{ color: 'var(--tx-red)', flexShrink: 0 }}>✗</span>}
                {entry.ok === true && entry.cat === 'IPC' && <span style={{ color: 'var(--tx-green)', flexShrink: 0 }}>✓</span>}
              </div>
            ))}
          </div>
          {lastExport && (
            <div style={{ marginTop: 4, color: 'var(--tx-green)', fontSize: 10 }}>{t('debug.exported', { time: lastExport })}</div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══ 子组件 ═══

const SectionTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 4, ...style }}>
    {children}
  </div>
);

const MetricRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
    <span style={{ color: 'var(--tx-text-secondary)' }}>{label}</span>
    <span style={{ color: color || 'var(--tx-text-primary)', fontWeight: 500, fontFamily: 'var(--tx-font-mono)' }}>{value}</span>
  </div>
);

// ═══ 样式常量 ═══

const headerBtnStyle: React.CSSProperties = {
  border: 'none', borderRadius: 'var(--tx-radius-sm)',
  background: 'transparent', color: 'var(--tx-text-tertiary)',
  cursor: 'pointer', display: 'flex', padding: 3,
  transition: 'background 0.12s',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '2px 6px', border: '1px solid var(--tx-border-light)',
  borderRadius: 'var(--tx-radius-sm)',
  background: 'transparent', color: 'var(--tx-text-secondary)',
  cursor: 'pointer', fontSize: 10, transition: 'background 0.12s',
};

function catColor(cat: string): string {
  switch (cat) {
    case 'IPC': return 'var(--tx-text-link)';
    case 'STARTUP': return 'var(--tx-magenta)';
    case 'ERROR': return 'var(--tx-red)';
    case 'LIFECYCLE': return 'var(--tx-yellow)';
    case 'MEMORY': return 'var(--tx-green)';
    default: return 'var(--tx-text-tertiary)';
  }
}
