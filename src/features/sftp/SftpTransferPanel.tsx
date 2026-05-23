/**
 * SFTP 传输进度面板（当前版本已由 TransferHistoryPanel 替代，此文件保留 TransferItem 类型导出）
 * 活跃传输的实时进度展示已迁移至悬浮面板，此处仅保留类型定义供其他组件引用
 */
import React, { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useI18n } from '@/i18n';
import { formatSize, formatSpeed } from './utils';
import { useTransferHistoryStore, type TransferStatus } from '@/stores/transferHistoryStore';

/**
 * 当前会话中的传输项。
 * 由 FileBrowser 的 doUpload/doDownload 创建，进度事件更新 bytesWritten/status，
 * 完成后停留在列表中 3s，随后自动归档至 transferHistoryStore。
 */
export interface TransferItem {
  id: string;
  name: string;
  direction: 'upload' | 'download';
  bytesWritten: number;
  totalBytes: number;
  speedBps: number;
  status: TransferStatus;
  error?: string;
  /** 下载完成后记录本地路径，历史面板中会展示给用户 */
  localPath?: string;
  startedAt: number;
  completedAt?: number;
}

interface SftpTransferPanelProps {
  transfers: TransferItem[];
  onRetry: (item: TransferItem) => void;
  onDismiss: (id: string) => void;
  onClearCompleted: () => void;
}

export const SftpTransferPanel = React.memo(function SftpTransferPanel({
  transfers,
  onRetry,
  onDismiss,
  onClearCompleted,
}: SftpTransferPanelProps) {
  const { t } = useI18n();

  // 延迟 3s 后将已完成/失败的传输从活跃列表移除并归档到历史 store
  // 之所以不立即删除，是让用户在内联面板中短暂看到完成状态再消失
  const archiveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const addRecord = useTransferHistoryStore((s) => s.addRecord);

  useEffect(() => {
    for (const tr of transfers) {
      if ((tr.status === 'completed' || tr.status === 'failed') && !archiveTimers.current.has(tr.id)) {
        const timer = setTimeout(() => {
          addRecord({
            id: tr.id, name: tr.name, direction: tr.direction,
            totalBytes: tr.totalBytes, status: tr.status,
            error: tr.error, localPath: tr.localPath,
            startedAt: tr.startedAt,
            completedAt: tr.completedAt ?? Date.now(),
          });
          onDismiss(tr.id);
        }, 3000);
        archiveTimers.current.set(tr.id, timer);
      }
    }
    // 清理定时器：已从列表中移除或状态变更（如被手动重试）的记录不再需要归档
    for (const [id, timer] of archiveTimers.current) {
      const exists = transfers.find((x) => x.id === id);
      if (!exists || (exists.status !== 'completed' && exists.status !== 'failed')) {
        clearTimeout(timer);
        archiveTimers.current.delete(id);
      }
    }
  }, [transfers, onDismiss, addRecord]);

  useEffect(() => {
    return () => {
      for (const timer of archiveTimers.current.values()) clearTimeout(timer);
    };
  }, []);

  if (transfers.length === 0) return null;

  const active = transfers.filter((x) => x.status !== 'completed' && x.status !== 'failed' && x.status !== 'cancelled');
  const completed = transfers.filter((x) => x.status === 'completed');
  const failed = transfers.filter((x) => x.status === 'failed');

  return (
    <div style={{
      borderTop: '1px solid var(--tx-border-light)',
      padding: '4px 8px',
      maxHeight: 160,
      overflowY: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {active.map((item) => (
        <TransferRow key={item.id} item={item} />
      ))}
      {completed.map((item) => (
        <TransferRow key={item.id} item={item} />
      ))}
      {failed.map((item) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, color: 'var(--tx-text-secondary)',
          padding: '2px 0',
        }}>
          <Icon icon="solar:close-circle-bold" width={12} height={12} color="var(--tx-red)" />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </span>
          <span style={{ color: 'var(--tx-red)', fontSize: 9 }}>{item.error || t('transfer.failed')}</span>
          <button
            onClick={() => onRetry(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-accent-default)', fontSize: 9, padding: 0 }}
          >
            {t('transfer.retry')}
          </button>
          <button
            onClick={() => onDismiss(item.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-text-tertiary)', padding: 0, display: 'flex' }}
          >
            <Icon icon="solar:close-linear" width={10} height={10} />
          </button>
        </div>
      ))}
      {active.length === 0 && failed.length === 0 && completed.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', padding: '4px 0', textAlign: 'center' }}>
          {t('transfer.allCompleted')}
        </div>
      )}
      {(completed.length > 0 || failed.length > 0) && (
        <div style={{ textAlign: 'right', padding: '2px 0' }}>
          <button
            onClick={onClearCompleted}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--tx-text-tertiary)', fontSize: 9, padding: '1px 4px',
            }}
          >
            {t('transfer.clearCompleted')}
          </button>
        </div>
      )}
    </div>
  );
});

/** 单条传输行。第一行展示方向/文件名/大小/速度，第二行展示 4px 彩色进度条 */
const TransferRow = React.memo(function TransferRow({ item }: { item: TransferItem }) {
  const pct = item.totalBytes > 0 ? Math.round((item.bytesWritten / item.totalBytes) * 100) : 0;

  // 进度条颜色随状态变化：传输中=强调色，完成=绿色，失败=红色
  const barColor =
    item.status === 'completed' ? 'var(--tx-green)' :
    item.status === 'failed' ? 'var(--tx-red)' :
    'var(--tx-accent-default)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '3px 0',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, color: 'var(--tx-text-secondary)',
      }}>
        <Icon
          icon={item.direction === 'upload' ? 'solar:upload-linear' : 'solar:download-linear'}
          width={12} height={12}
          color="var(--tx-accent-default)"
        />
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', minWidth: 0,
        }}>
          {item.name}
        </span>
        <span style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
          {formatSize(item.bytesWritten)} / {formatSize(item.totalBytes)}
        </span>
        {item.speedBps > 0 && (
          <span style={{ whiteSpace: 'nowrap', fontSize: 9, color: 'var(--tx-text-tertiary)' }}>
            {formatSpeed(item.speedBps)}
          </span>
        )}
        {item.status === 'completed' && (
          <Icon icon="solar:check-circle-bold" width={12} height={12} color="var(--tx-green)" />
        )}
        {item.status === 'failed' && (
          <Icon icon="solar:close-circle-bold" width={12} height={12} color="var(--tx-red)" />
        )}
        {item.status === 'pending' && (
          <span style={{ fontSize: 9, color: 'var(--tx-text-tertiary)' }}>{pct}%</span>
        )}
      </div>

      {item.totalBytes > 0 && (
        <div style={{
          width: '100%', height: 4,
          background: 'var(--tx-bg-hover)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(pct, 100)}%`, height: '100%',
            background: barColor,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}
    </div>
  );
});
