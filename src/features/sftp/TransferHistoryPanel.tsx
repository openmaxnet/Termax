/**
 * 传输历史悬浮面板
 * 浮动窗口，展示活跃传输的实时进度 + 历史归档记录。
 * 上传/下载开始时自动弹出（见 FileBrowser 的 doUpload/doDownload），
 * 用户也可点击底部工具栏的时钟图标手动切换。
 * 面板可拖拽/缩放，点击外部自动关闭（类似侧边栏行为）。
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Clock } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { formatSize, formatSpeed } from './utils';
import { useTransferHistoryStore } from '@/stores/transferHistoryStore';
import type { TransferItem } from './SftpTransferPanel';
import { useFloatWindow } from '@/hooks/useFloatWindow';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

// 面板默认尺寸（用户拖拽后位置会保存到本地 state，刷新页面重置为默认值）
const DEFAULT_W = 360;
const DEFAULT_H = 400;
const MIN_W = 280;
const MIN_H = 200;

interface TransferHistoryPanelProps {
  activeTransfers: TransferItem[];
  visible: boolean;
  onClose: () => void;
  onRetry: (item: TransferItem) => void;
  onDismiss: (id: string) => void;
  onCancel: (id: string) => void;
}

export const TransferHistoryPanel = React.memo(function TransferHistoryPanel({
  activeTransfers,
  visible,
  onClose,
  onRetry,
  onDismiss: _onDismiss,
  onCancel,
}: TransferHistoryPanelProps) {
  const { t } = useI18n();
  const history = useTransferHistoryStore((s) => s.history);
  const removeRecord = useTransferHistoryStore((s) => s.removeRecord);
  const clearHistory = useTransferHistoryStore((s) => s.clearHistory);

  // 面板位置/尺寸状态（默认在右下角偏上位置，避免遮挡底部工具栏）
  const [pos, setPos] = React.useState({
    x: Math.max(0, window.innerWidth - DEFAULT_W - 8),
    y: Math.max(80, window.innerHeight - DEFAULT_H - 100),
  });
  const [size, setSize] = React.useState({ w: DEFAULT_W, h: DEFAULT_H });
  const panelRef = useRef<HTMLDivElement>(null);

  const { handleDrag, handleResize } = useFloatWindow(
    pos.x, pos.y, size.w, size.h,
    (x, y) => setPos({ x, y }),
    (w, h) => setSize({ w, h }),
  );

  // 点击面板外部自动关闭（类似侧边栏行为）
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟添加以避免触发创建面板时的点击事件
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [visible, onClose]);

  // 筛选出当前仍在传输中的项（含 pending 排队中和 transferring 传输中），用于"活跃传输"区段
  const transferring = useMemo(() => activeTransfers.filter((x) => x.status === 'transferring' || x.status === 'pending'), [activeTransfers]);

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.y, left: pos.x,
        width: size.w, height: size.h,
        minWidth: MIN_W, minHeight: MIN_H,
        display: 'flex', flexDirection: 'column',
        background: 'var(--tx-bg-elevated)',
        border: '1px solid var(--tx-border-light)',
        borderRadius: 'var(--tx-radius-lg)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden', zIndex: 30,
        fontSize: 12,
        animation: 'tx-fade-in 0.12s ease-out',
      }}
    >
      {/* 标题栏（拖拽区，点击外部可关闭面板） */}
      <div
        onMouseDown={handleDrag}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          borderBottom: '1px solid var(--tx-border-light)',
          fontSize: 11, fontWeight: 600,
          color: 'var(--tx-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          cursor: 'grab', userSelect: 'none', flexShrink: 0,
        }}
      >
        <Icon icon="solar:clock-circle-linear" width={14} height={14} />
        <span style={{ flex: 1 }}>{t('transfer.history')}</span>
      </div>

      {/* 内容区：上部分显示实时活跃传输，下部分显示已归档的历史记录 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {transferring.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: 'var(--tx-text-tertiary)', padding: '4px 2px 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('transfer.activeTransfers')} ({transferring.length})
            </div>
            {transferring.map((item) => (
              <ActiveTransferRow key={item.id} item={item} onCancel={onCancel} />
            ))}
            <div style={{ height: 4 }} />
          </>
        )}

        {/* 历史记录区段 */}
        {history.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: 'var(--tx-text-tertiary)', padding: '4px 2px 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('transfer.history')} ({history.length})
            </div>
            {history.map((record) => (
              <HistoryRow key={record.id} record={record} onRetry={onRetry} onRemove={removeRecord} />
            ))}
          </>
        )}

        {/* 空状态 */}
        {transferring.length === 0 && history.length === 0 && (
          <Empty className="flex-1 py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Clock size={28} /></EmptyMedia>
              <EmptyTitle className="text-xs">{t('transfer.emptyHistory')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      {/* 底部操作栏 */}
      {history.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 4,
          padding: '4px 8px',
          borderTop: '1px solid var(--tx-border-light)',
          flexShrink: 0,
        }}>
          <button
            onClick={clearHistory}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--tx-text-tertiary)', fontSize: 10, padding: '2px 6px',
            }}
          >
            {t('transfer.clearAll')}
          </button>
        </div>
      )}

      {/* 缩放角 */}
      <div
        onMouseDown={(e) => { handleResize(e); }}
        style={{
          position: 'absolute', right: 0, bottom: 0,
          width: 12, height: 12,
          cursor: 'nwse-resize', zIndex: 5,
        }}
      />
    </div>
  );
});

/**
 * 活跃传输行：实时展示正在传输的文件名、百分比、速度、已传输量。
 * 由后端 sftp-transfer-progress 事件驱动更新（约 100ms 节流），
 * 进度条宽度通过 CSS transition 平滑变化。
 */
const ActiveTransferRow = React.memo(function ActiveTransferRow({
  item, onCancel,
}: {
  item: TransferItem;
  onCancel: (id: string) => void;
}) {
  const { t } = useI18n();
  const pct = item.totalBytes > 0 ? Math.round((item.bytesWritten / item.totalBytes) * 100) : 0;

  return (
    <div style={{ padding: '3px 4px', borderRadius: 'var(--tx-radius-sm)', background: 'var(--tx-bg-hover)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx-text-secondary)' }}>
        <Icon
          icon={item.direction === 'upload' ? 'solar:upload-linear' : 'solar:download-linear'}
          width={16} height={16}
          color="var(--tx-accent-default)"
        />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </span>
        <span style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{pct}%</span>
        <button
          onClick={() => onCancel(item.id)}
          title={t('transfer.cancel')}
          style={iconBtnStyle}
          onMouseEnter={iconBtnHover}
          onMouseLeave={iconBtnLeave}
        >
          <Icon icon="solar:stop-circle-linear" width={16} height={16} />
        </button>
      </div>
      <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--tx-text-tertiary)' }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', background: 'var(--tx-bg-base)' }}>
          <div style={{
            width: `${Math.min(pct, 100)}%`, height: '100%',
            background: 'var(--tx-accent-default)',
            borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
        {item.speedBps > 0 && <span>{formatSpeed(item.speedBps)}</span>}
        <span>{formatSize(item.bytesWritten)}</span>
      </div>
    </div>
  );
});

/**
 * 历史记录行：展示已归档传输的文件名、大小、耗时、保存路径。
 * 已完成项左侧显示绿色勾，失败项显示红色叉 + 重试按钮。
 * 用户可点击"忽略"从历史中删除单条记录。
 */
const HistoryRow = React.memo(function HistoryRow({
  record, onRetry, onRemove,
}: {
  record: import('@/stores/transferHistoryStore').TransferRecord;
  onRetry: (item: TransferItem) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useI18n();

  // 计算耗时：用于在历史行中展示 "耗时 1m 23s"
  const elapsed = record.completedAt - record.startedAt;
  const elapsedStr = elapsed > 0
    ? t('transfer.elapsed', {
        time: elapsed < 60000
          ? `${Math.round(elapsed / 1000)}s`
          : `${Math.floor(elapsed / 60000)}m ${Math.round((elapsed % 60000) / 1000)}s`,
      })
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 4px', fontSize: 10, color: 'var(--tx-text-secondary)',
      borderRadius: 'var(--tx-radius-sm)',
    }}>
      <Icon
        icon={
          record.status === 'completed'
            ? 'solar:check-circle-bold'
            : record.status === 'failed'
              ? 'solar:close-circle-bold'
              : 'solar:clock-circle-linear'
        }
        width={16} height={16}
        color={
          record.status === 'completed' ? 'var(--tx-green)' :
          record.status === 'failed' ? 'var(--tx-red)' :
          'var(--tx-text-tertiary)'
        }
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.name}
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: 9, color: 'var(--tx-text-tertiary)', flexWrap: 'wrap' }}>
          <span>{formatSize(record.totalBytes)}</span>
          {elapsedStr && <span>{elapsedStr}</span>}
          {record.localPath && <span>{t('transfer.savedTo', { path: record.localPath })}</span>}
          {record.status === 'failed' && record.error && (
            <span style={{ color: 'var(--tx-red)' }}>{record.error}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
        {record.status === 'failed' && (
          <button
            onClick={() => onRetry({ ...record, status: 'pending', bytesWritten: 0, speedBps: 0 })}
            title={t('transfer.retry')}
            style={iconBtnStyle}
            onMouseEnter={iconBtnHover}
            onMouseLeave={iconBtnLeave}
          >
            <Icon icon="solar:refresh-linear" width={16} height={16} />
          </button>
        )}
        <Tooltip>
          <TooltipTrigger render={
            <button
              onClick={() => onRemove(record.id)}
              style={iconBtnStyle}
              onMouseEnter={iconBtnHover}
              onMouseLeave={iconBtnLeave}
            >
              <Icon icon="solar:trash-bin-trash-linear" width={16} height={16} />
            </button>
          } />
          <TooltipContent>{t('transfer.delete')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

/** 图标按钮统一样式：无背景无边框，flex 居中，带圆角过渡 */
const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 3, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  borderRadius: 'var(--tx-radius-sm)',
  transition: 'background 0.12s',
  color: 'var(--tx-text-tertiary)',
};

const iconBtnHover = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'var(--tx-bg-hover)';
};

const iconBtnLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'transparent';
};
