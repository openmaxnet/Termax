/**
 * SFTP 删除确认对话框
 * 显示删除文件/目录的确认信息，确认按钮使用红色警示色
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { useI18n } from '@/i18n';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FileEntry { name: string; path: string; is_dir: boolean; size: number; mtime: number; permissions: number | null; uid: number | null; gid: number | null; user: string | null; group: string | null; }

interface SftpDeleteDialogProps {
  target: FileEntry;
  onCancel: () => void;
  onConfirm: (entry: FileEntry) => void;
}

export const SftpDeleteDialog: React.FC<SftpDeleteDialogProps> = ({ target, onCancel, onConfirm }) => {
  const { t } = useI18n();
  return (
    <AlertDialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target.is_dir ? t('fileBrowser.confirmDeleteDir') : t('fileBrowser.confirmDeleteFile')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 'var(--tx-radius-sm)', background: 'var(--tx-bg-base)', marginTop: 4 }}>
              <Icon icon={target.is_dir ? 'solar:folder-linear' : 'solar:file-linear'} width={16} height={16} color={target.is_dir ? 'var(--tx-accent-default)' : 'var(--tx-text-tertiary)'} />
              <span style={{ fontSize: 12, color: 'var(--tx-text-primary)', wordBreak: 'break-all' }}>{target.name}</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t('settings.cancel')}</AlertDialogCancel>
          <AlertDialogAction className="bg-(--tx-red) hover:bg-(--tx-red)/90" onClick={() => onConfirm(target)}>
            {t('fileBrowser.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
