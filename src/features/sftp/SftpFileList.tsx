/**
 * SFTP 文件列表
 * 基于 DataTable 组件，支持排序、列宽拖拽、行内编辑、右键菜单
 */
import React, { useMemo, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { useI18n } from '@/i18n';
import { DataTable, type DataTableColumnMeta } from '@/components/ui/data-table';
import { formatSize, formatTime, formatMode, formatOwner, fileIcon } from './utils';
import type { ColumnDef } from '@tanstack/react-table';

interface FileEntry { name: string; path: string; is_dir: boolean; size: number; mtime: number; permissions: number | null; uid: number | null; gid: number | null; user: string | null; group: string | null; }

interface SftpFileListProps {
  entries: FileEntry[];
  sorted: FileEntry[];
  filtered: FileEntry[];
  loading: boolean;
  error: string | null;
  loadedOnce: boolean;
  colW: Record<string, number>;
  onColWChange: (w: Record<string, number>) => void;
  sortKey: 'name' | 'size' | 'date' | 'permissions' | 'uid' | 'gid';
  sortAsc: boolean;
  onSortChange: (key: 'name' | 'size' | 'date' | 'permissions' | 'uid' | 'gid', asc: boolean) => void;
  mode?: 'side' | 'tab';
  editing: { type: 'rename' | 'newFile' | 'newDir'; target?: FileEntry } | null;
  editValue: string;
  setEditValue: (v: string) => void;
  doConfirmEdit: () => void;
  cancelEdit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  activeEdits: Array<{ id: string; path: string }>;
  loadDir: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry?: FileEntry, isBlank?: boolean) => void;
}

/** 新建行标识 key */
const NEW_ITEM_KEY = '__sftp_new__';

export const SftpFileList: React.FC<SftpFileListProps> = ({
  sorted, filtered, loading, error, loadedOnce, colW, onColWChange,
  sortKey, sortAsc, onSortChange, mode,
  editing, editValue, setEditValue, doConfirmEdit, cancelEdit, inputRef, activeEdits,
  loadDir, onContextMenu,
}) => {
  const { t } = useI18n();
  const showExtraCols = mode !== 'side';

  // 新建文件/目录的虚拟条目
  const prependRows = useMemo<FileEntry[]>(() => {
    if (editing && (editing.type === 'newFile' || editing.type === 'newDir')) {
      return [{ name: '', path: NEW_ITEM_KEY, is_dir: editing.type === 'newDir', size: 0, mtime: 0, permissions: null, uid: null, gid: null, user: null, group: null }];
    }
    return [];
  }, [editing]);

  const handleRowDoubleClick = useCallback((row: FileEntry) => {
    if (row.is_dir && row.path !== NEW_ITEM_KEY) loadDir(row.path);
  }, [loadDir]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, row?: FileEntry) => {
    if (row) {
      onContextMenu?.(e, row);
    } else {
      onContextMenu?.(e, undefined, true);
    }
  }, [onContextMenu]);

  const columns = useMemo<ColumnDef<FileEntry>[]>(() => {
    const cols: ColumnDef<FileEntry>[] = [
      {
        id: 'icon',
        header: '',
        size: 24,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => {
          const entry = row.original;
          const isEditingNew = entry.path === NEW_ITEM_KEY;
          return (
            <div className="flex items-center gap-0.5">
              <Icon icon={isEditingNew
                ? (editing?.type === 'newDir' ? 'solar:folder-linear' : 'solar:file-linear')
                : fileIcon(entry.name, entry.is_dir)
              } width={16} height={16} color="var(--tx-text-secondary)" className="shrink-0" />
              {activeEdits.some((ae) => ae.path === entry.path) && (
                <div className="w-1.25 h-1.25 rounded-full bg-(--tx-green) shrink-0" />
              )}
            </div>
          );
        },
      },
      {
        id: 'name',
        header: t('fileBrowser.name'),
        size: colW.name,
        enableSorting: true,
        enableResizing: true,
        cell: ({ row }) => {
          const entry = row.original;
          const isEditingNew = entry.path === NEW_ITEM_KEY;
          const isRenaming = editing?.type === 'rename' && editing.target?.name === entry.name;

          if (isEditingNew) {
            return (
              <input ref={inputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && editValue.trim()) doConfirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                autoFocus placeholder={editing?.type === 'newDir' ? t('fileBrowser.newFolder') : t('fileBrowser.newFile')}
                className="w-full px-1 py-px rounded-sm border border-(--tx-accent-default) bg-(--tx-bg-base) text-(--tx-text-primary) text-xs outline-none"
              />
            );
          }

          if (isRenaming) {
            return (
              <input ref={inputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && editValue.trim()) doConfirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                onBlur={cancelEdit} autoFocus
                className="w-full px-1 py-px rounded-sm border border-(--tx-accent-default) bg-(--tx-bg-base) text-(--tx-text-primary) text-xs outline-none"
              />
            );
          }

          return (
            <span className="block truncate text-(--tx-text-primary) text-xs">{entry.name}</span>
          );
        },
        meta: { headerClassName: '' } as DataTableColumnMeta,
      },
      {
        id: 'size',
        header: t('fileBrowser.size'),
        size: colW.size,
        enableSorting: true,
        enableResizing: true,
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.path === NEW_ITEM_KEY) return null;
          return <span className="block text-right text-(--tx-text-primary) text-xs">{formatSize(entry.size)}</span>;
        },
        meta: { cellClassName: 'text-right' } as DataTableColumnMeta,
      },
      {
        id: 'date',
        header: t('fileBrowser.date'),
        size: colW.date,
        enableSorting: true,
        enableResizing: true,
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.path === NEW_ITEM_KEY) return null;
          return <span className="block text-right text-(--tx-text-primary) text-xs">{formatTime(entry.mtime)}</span>;
        },
        meta: { cellClassName: 'text-right' } as DataTableColumnMeta,
      },
    ];

    if (showExtraCols) {
      cols.push(
        {
          id: 'permissions',
          header: t('fileBrowser.permissions'),
          size: colW.perms,
          enableSorting: true,
          enableResizing: true,
          cell: ({ row }) => {
            if (row.original.path === NEW_ITEM_KEY) return null;
            return <span className="block text-center text-(--tx-text-primary) text-xs">{formatMode(row.original.permissions)}</span>;
          },
          meta: { cellClassName: 'text-center' } as DataTableColumnMeta,
        },
        {
          id: 'owner',
          header: t('fileBrowser.owner'),
          size: colW.owner,
          enableSorting: true,
          enableResizing: true,
          cell: ({ row }) => {
            if (row.original.path === NEW_ITEM_KEY) return null;
            return <span className="block text-center text-(--tx-text-primary) text-xs">{formatOwner(row.original.uid)}</span>;
          },
          meta: { cellClassName: 'text-center' } as DataTableColumnMeta,
        },
        {
          id: 'group',
          header: t('fileBrowser.group'),
          size: colW.group,
          enableSorting: true,
          enableResizing: true,
          cell: ({ row }) => {
            if (row.original.path === NEW_ITEM_KEY) return null;
            return <span className="block text-center text-(--tx-text-primary) text-xs">{formatOwner(row.original.gid)}</span>;
          },
          meta: { cellClassName: 'text-center' } as DataTableColumnMeta,
        },
      );
    }

    return cols;
  }, [colW, showExtraCols, editing, editValue, activeEdits, inputRef, doConfirmEdit, cancelEdit, setEditValue, t]);

  // colW 转 Record<string, number>（用 column id 作为 key）
  const columnWidths = useMemo(() => colW, [colW]);

  return (
    <DataTable
      columns={columns}
      data={filtered.length > 0 || loadedOnce ? sorted : []}
      getRowId={(row) => row.path}
      sorting={{ key: sortKey, asc: sortAsc }}
      onSortingChange={(key, asc) => {
        const mappedKey = key === 'owner' ? 'uid' : key === 'group' ? 'gid' : key;
        onSortChange(mappedKey as typeof sortKey, asc);
      }}
      columnWidths={columnWidths}
      onColumnWidthsChange={onColWChange}
      onRowDoubleClick={handleRowDoubleClick}
      onRowContextMenu={handleRowContextMenu as any}
      loading={loading && sorted.length === 0}
      loadingRowCount={12}
      emptyText={t('fileBrowser.emptyDirectory')}
      error={error}
      prependRows={prependRows}
    />
  );
};
