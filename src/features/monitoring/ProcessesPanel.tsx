/**
 * 监控进程列表面板
 * 可排序表格、右键菜单（kill/renice/暂停/恢复）、确认对话框
 */
import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Cpu } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/i18n';
import { ipc } from '@/lib/ipc';
import type { ConnectionConfig, SystemInfo, ProcessInfo } from '@/lib/ipc';

/** 进程列表可排序列的 key */
type SortKey = 'pid' | 'cpu' | 'mem' | 'user' | 'command' | 'state' | 'vsize' | 'ni';

/** 进程状态缩写 → 可读标签 */
function stateLabel(s: string): string {
  switch (s) {
    case 'R': return 'RUN';
    case 'S': return 'SLP';
    case 'D': return 'UNI';
    case 'Z': return 'ZOM';
    case 'T': return 'STP';
    default: return s;
  }
}

/** 进程状态 → CSS 颜色映射 */
const STATE_COLORS: Record<string, string> = {
  S: 'var(--blue, #60a5fa)',
  D: 'var(--tx-yellow, #fbbf24)',
  Z: 'var(--tx-red, #f87171)',
  T: 'var(--tx-text-tertiary)',
};

/** 虚拟内存大小格式化（以 MB/KB 显示） */
function fmtVsize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(0) + 'M';
  return (bytes / 1024).toFixed(0) + 'K';
}

/** 进程骨架屏行：模拟表格数据加载中的占位 */
const SkeletonRow: React.FC<{ widths: number[] }> = ({ widths }) => (
  <tr style={{ borderTop: '1px solid var(--tx-border-light)' }}>
    {widths.map((w, i) => (
      <td key={i} style={{ padding: '4px 6px' }}>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--tx-bg-hover)', width: w, animation: 'tx-pulse 1.5s ease-in-out infinite' }} />
      </td>
    ))}
  </tr>
);

/** 进程列表骨架屏：表头 + 8 行数据占位 */
export const ProcessesSkeleton: React.FC = () => (
  <div style={{ fontSize: 11, overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {[28, 32, 44, 20, 36, 40, 40, 72].map((w, i) => (
            <th key={i} style={{ padding: '3px 6px' }}>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--tx-bg-hover)', width: w, animation: 'tx-pulse 1.5s ease-in-out infinite' }} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[
          [20, 36, 48, 16, 32, 44, 36, 88],
          [24, 28, 40, 20, 40, 36, 44, 64],
          [22, 32, 52, 16, 36, 32, 28, 80],
          [26, 40, 36, 20, 28, 40, 40, 72],
          [20, 24, 44, 16, 44, 36, 32, 56],
          [24, 36, 40, 20, 32, 28, 36, 96],
          [22, 28, 48, 16, 40, 44, 40, 68],
          [26, 32, 36, 20, 36, 32, 28, 84],
        ].map((widths, i) => (
          <SkeletonRow key={i} widths={widths} />
        ))}
      </tbody>
    </table>
  </div>
);

/** 进程列表面板：排序/右键菜单/kill/renice/暂停/恢复 */
export const ProcessesTab: React.FC<{ data: SystemInfo; config?: ConnectionConfig }> = ({ data, config }) => {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number; p: ProcessInfo } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; cmd: string; p: ProcessInfo } | null>(null);

  /** 切换排序列：同列切换升降序，不同列默认升序 */
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortAsc) { setSortAsc(false); } else { setSortKey(null); setSortAsc(true); }
    } else { setSortKey(key); setSortAsc(true); }
  };

  /** 进程列表排序（按当前 sortKey 和方向） */
  const sorted = [...(data.processes || [])].sort((a, b) => {
    if (!sortKey) return 0;
    let cmp = 0;
    switch (sortKey) {
      case 'pid': cmp = a.pid - b.pid; break;
      case 'cpu': cmp = a.cpu_percent - b.cpu_percent; break;
      case 'mem': cmp = a.mem_percent - b.mem_percent; break;
      case 'user': cmp = a.user.localeCompare(b.user); break;
      case 'command': cmp = a.command.localeCompare(b.command); break;
      case 'state': cmp = a.state.localeCompare(b.state); break;
      case 'vsize': cmp = a.vsize - b.vsize; break;
      case 'ni': cmp = a.nice - b.nice; break;
    }
    return sortAsc ? cmp : -cmp;
  });

  /** 排序列图标：活跃列显示箭头，非活跃列显示灰色排序图标 */
  const SortIcon: React.FC<{ k: SortKey }> = ({ k }) => {
    const active = sortKey === k;
    const icon = active ? (sortAsc ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear') : 'solar:sort-vertical-outline';
    return <Icon icon={icon} width={10} height={10} style={{ verticalAlign: 'middle', marginLeft: 2, opacity: active ? 1 : 0.35 }} />;
  };

  /** 可排序列的表头：点击切换排序，悬停高亮 */
  const SortableTh: React.FC<{ k: SortKey; label: string }> = ({ k, label }) => {
    const active = sortKey === k;
    const [h, sH] = useState(false);
    return (
      <th onClick={() => toggleSort(k)} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
        style={{ padding: '3px 6px', fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
          color: active ? 'var(--tx-accent-default)' : h ? 'var(--tx-text-primary)' : 'var(--tx-text-tertiary)', transition: 'color 0.12s' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>{label} <SortIcon k={k} /></span>
      </th>
    );
  };

  // 执行远程命令（kill/renice 等进程操作）
  const doExec = async (cmd: string, _p: ProcessInfo) => {
    if (!config) return;
    try { await ipc.monitor.exec(config, cmd); } catch { }
    setMenu(null);
    setConfirmAction(null);
  };

  if (!data.processes || data.processes.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Cpu size={28} /></EmptyMedia>
          <EmptyTitle className="text-xs">{t('monitoring.noProcessData')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div style={{ fontSize: 11, overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', position: 'sticky', top: 0, background: 'var(--tx-bg-elevated)' }}>
            <SortableTh k="state" label={t('monitoring.state')} />
            <SortableTh k="pid" label="PID" />
            <SortableTh k="user" label={t('monitoring.user')} />
            <SortableTh k="ni" label="NI" />
            <SortableTh k="vsize" label="VSZ" />
            <SortableTh k="cpu" label="CPU%" />
            <SortableTh k="mem" label="MEM%" />
            <SortableTh k="command" label={t('monitoring.command')} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr key={i} onContextMenu={(e) => { if (config) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, p }); } }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{ borderTop: '1px solid var(--tx-border-light)', transition: 'background 0.12s', cursor: config ? 'context-menu' : undefined }}>
              <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>
                <span style={{ color: STATE_COLORS[p.state] || 'var(--tx-text-tertiary)', fontWeight: 600 }}>{stateLabel(p.state)}</span>
              </td>
              <td style={{ padding: '3px 6px', fontFamily: 'var(--tx-font-mono)', whiteSpace: 'nowrap' }}>{p.pid}</td>
              <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{p.user || '—'}</td>
              <td style={{ padding: '3px 6px', fontFamily: 'var(--tx-font-mono)', whiteSpace: 'nowrap' }}>{p.nice}</td>
              <td style={{ padding: '3px 6px', fontFamily: 'var(--tx-font-mono)', whiteSpace: 'nowrap' }}>{fmtVsize(p.vsize)}</td>
              <td style={{ padding: '3px 6px', fontFamily: 'var(--tx-font-mono)', whiteSpace: 'nowrap' }}>{p.cpu_percent.toFixed(1)}</td>
              <td style={{ padding: '3px 6px', fontFamily: 'var(--tx-font-mono)', whiteSpace: 'nowrap' }}>{p.mem_percent.toFixed(1)}</td>
              <td style={{ padding: '3px 6px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Tooltip>
                  <TooltipTrigger render={<span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.command}</span>} />
                  <TooltipContent>{p.command}</TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 右键菜单 */}
      {menu && config && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 40, background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)', borderRadius: 'var(--tx-radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', padding: 4, minWidth: 150, fontSize: 11 }}>
            {[
              { label: t('monitoring.kill'), icon: 'solar:close-circle-linear', danger: false, action: () => setConfirmAction({ label: t('monitoring.kill'), cmd: `kill ${menu.p.pid}`, p: menu.p }) },
              { label: t('monitoring.kill9'), icon: 'solar:danger-triangle-linear', danger: true, action: () => setConfirmAction({ label: t('monitoring.kill9'), cmd: `kill -9 ${menu.p.pid}`, p: menu.p }) },
              ...(menu.p.state === 'T'
                ? [{ label: t('monitoring.resume'), icon: 'solar:play-linear' as const, danger: false, action: () => doExec(`kill -CONT ${menu.p.pid}`, menu.p) }]
                : [{ label: t('monitoring.suspend'), icon: 'solar:pause-linear' as const, danger: false, action: () => setConfirmAction({ label: t('monitoring.suspend'), cmd: `kill -STOP ${menu.p.pid}`, p: menu.p }) }]),
              { label: `${t('monitoring.renice')} (-20~19)`, icon: 'solar:slider-vertical-linear', danger: false, action: () => {
                const val = prompt('Nice value (-20 ~ 19):', '0');
                if (val !== null) doExec(`renice -n ${val} -p ${menu.p.pid}`, menu.p);
              }},
            ].map((item, i) => (
              <button key={i} onClick={item.action}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px', border: 'none', borderRadius: 'var(--tx-radius-sm)', background: 'transparent', color: item.danger ? 'var(--tx-red, #f87171)' : 'var(--tx-text-primary)', cursor: 'pointer', transition: 'background 0.12s', fontSize: 11, textAlign: 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--tx-bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Icon icon={item.icon} width={13} height={13} />{item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 确认对话框 */}
      <AlertDialog open={!!confirmAction} onOpenChange={(v) => { if (!v) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.cmd}<br />PID {confirmAction?.p.pid} — {confirmAction?.p.command}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('titleBar.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.label === t('monitoring.kill9') ? 'bg-(--tx-red,#f87171) hover:bg-(--tx-red,#f87171)/90' : undefined}
              onClick={() => { if (confirmAction) doExec(confirmAction.cmd, confirmAction.p); }}
            >{t('titleBar.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
