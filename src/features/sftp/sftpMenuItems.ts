/**
 * 构建 SFTP 右键菜单项
 * 根据点击目标（文件/目录/空白区域）动态生成菜单项，
 * 包括上传/下载/编辑/重命名/删除/复制路径/复制名称等操作
 */
import { ipc } from '@/lib/ipc';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ConnectionConfig } from '@/lib/ipc';
import { fmtSftpError, isBinaryExt } from './utils';

interface ContextMenuItem {
  label: string; icon?: string; disabled?: boolean; divider?: boolean; color?: string; onClick: () => void;
}

interface FileEntry { name: string; path: string; is_dir: boolean; size: number; mtime: number; permissions: number | null; uid: number | null; gid: number | null; user: string | null; group: string | null; }

export function buildMenuItems(
  t: (k: string, p?: any) => string,
  menu: { x: number; y: number; entry?: FileEntry; isBlank?: boolean },
  config: ConnectionConfig | null,
  activeEdits: Array<{ id: string; path: string }>,
  callbacks: {
    doUpload: () => void; doDownload: (e: FileEntry) => void;
    startNewFile: (cwd?: string) => void; startNewDir: (cwd?: string) => void; refresh: () => void;
    loadDir: (p: string) => void; startRename: (e: FileEntry) => void;
    setDeleteTarget: (e: FileEntry) => void;
    setActiveEdits: React.Dispatch<React.SetStateAction<Array<{ id: string; path: string }>>>;
    otherPaneConfig?: ConnectionConfig;
    onCopyToOtherPane?: () => void;
  },
): ContextMenuItem[] {
  if (!menu) return [];
  if (menu.isBlank) return [
    { label: t('fileBrowser.upload'), icon: 'solar:upload-linear', onClick: callbacks.doUpload },
    { label: t('fileBrowser.newFile'), icon: 'solar:add-square-linear', onClick: () => callbacks.startNewFile() },
    { label: t('fileBrowser.newFolder'), icon: 'solar:add-folder-linear', onClick: () => callbacks.startNewDir() },
    { label: '', divider: true, onClick: () => {} },
    { label: t('fileBrowser.refresh'), icon: 'solar:refresh-linear', onClick: callbacks.refresh },
  ];

  const e = menu.entry!;
  const isTextEditable = e.is_dir ? false : !isBinaryExt(e.name);
  const isEditing = activeEdits.some((ae) => ae.path === e.path);

  return [
    ...(e.is_dir ? [
      { label: t('fileBrowser.open'), icon: 'solar:folder-open-linear', onClick: () => callbacks.loadDir(e.path) },
    ] : []),
    ...(config && isTextEditable && !isEditing ? [
      { label: t('fileBrowser.editFile'), icon: 'solar:pen-new-square-linear', onClick: async () => {
        try {
          const editorCommand = useSettingsStore.getState().editorCommand || undefined;
          const sessionId = await ipc.edit.start(config, e.path, editorCommand);
          callbacks.setActiveEdits((prev) => [...prev, { id: sessionId, path: e.path }]);
        } catch (err) { alert(fmtSftpError(err)); }
      }},
    ] : []),
    ...(isEditing ? [
      { label: t('fileBrowser.stopEdit'), icon: 'solar:stop-circle-linear', onClick: async () => {
        const edit = activeEdits.find((ae) => ae.path === e.path);
        if (edit) {
          await ipc.edit.stop(edit.id);
          callbacks.setActiveEdits((prev) => prev.filter((ae) => ae.path !== e.path));
        }
      }},
    ] : []),
    { label: t('fileBrowser.download'), icon: 'solar:download-linear', onClick: () => { callbacks.doDownload(e); } },
    ...(e.is_dir ? [
      { label: t('fileBrowser.newFile'), icon: 'solar:add-square-linear', onClick: () => { callbacks.loadDir(e.path); callbacks.startNewFile(e.path); } },
      { label: t('fileBrowser.newFolder'), icon: 'solar:add-folder-linear', onClick: () => { callbacks.loadDir(e.path); callbacks.startNewDir(e.path); } },
    ] : []),
    { label: t('fileBrowser.rename'), icon: 'solar:pen-new-square-linear', onClick: () => callbacks.startRename(e) },
    ...(callbacks.otherPaneConfig && callbacks.onCopyToOtherPane ? [
      { label: t('sftpPane.copyToOther'), icon: 'solar:copy-linear', onClick: callbacks.onCopyToOtherPane },
    ] : []),
    { label: '', divider: true, onClick: () => {} },
    { label: t('fileBrowser.copyPath'), icon: 'solar:clipboard-linear', onClick: () => navigator.clipboard.writeText(e.path) },
    { label: t('fileBrowser.copyName'), icon: 'solar:clipboard-text-linear', onClick: () => navigator.clipboard.writeText(e.name) },
    { label: '', divider: true, onClick: () => {} },
    { label: t('fileBrowser.delete'), icon: 'solar:trash-bin-trash-linear', color: 'var(--tx-red)', onClick: () => callbacks.setDeleteTarget(e) },
  ];
}
