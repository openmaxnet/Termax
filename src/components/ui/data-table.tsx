import React, { useState, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  flexRender,
} from "@tanstack/react-table"
import { Icon } from "@iconify/react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./table"

/* ═══ 扩展列定义：附加 UI 元信息 ═══ */

export interface DataTableColumnMeta {
  headerClassName?: string
  cellClassName?: string
}

/* ═══ Props ═══ */

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[] & { meta?: DataTableColumnMeta }
  data: TData[]
  /** 行唯一键 */
  getRowId: (row: TData) => string
  /** 排序状态（外部受控） */
  sorting?: { key: string; asc: boolean }
  onSortingChange?: (key: string, asc: boolean) => void
  /** 列宽状态（外部受控，key → px） */
  columnWidths?: Record<string, number>
  onColumnWidthsChange?: (widths: Record<string, number>) => void
  /** 行交互 */
  onRowClick?: (row: TData) => void
  onRowDoubleClick?: (row: TData) => void
  onRowContextMenu?: (e: React.MouseEvent, row: TData) => void
  /** 状态 */
  loading?: boolean
  loadingRowCount?: number
  emptyText?: string
  error?: string | null
  /** 额外行（插入到 data 前面） */
  prependRows?: TData[]
}

/* ═══ 骨架行 ═══ */

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-full rounded-(--tx-radius-sm) bg-(--tx-bg-hover) animate-pulse" />
        </TableCell>
      ))}
    </TableRow>
  )
}

/* ═══ 组件 ═══ */

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  sorting: externalSorting,
  onSortingChange,
  columnWidths: externalWidths,
  onColumnWidthsChange,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  loading = false,
  loadingRowCount = 8,
  emptyText = "暂无数据",
  error,
  prependRows,
}: DataTableProps<TData>) {
  // 排序
  const [internalSorting, setInternalSorting] = useState<SortingState>(() => {
    if (externalSorting) return [{ id: externalSorting.key, desc: !externalSorting.asc }]
    return []
  })
  const sorting = externalSorting
    ? [{ id: externalSorting.key, desc: !externalSorting.asc }]
    : internalSorting

  // 列宽
  const [internalSizing, setInternalSizing] = useState<ColumnSizingState>(() => {
    if (externalWidths) {
      const s: ColumnSizingState = {}
      for (const [k, v] of Object.entries(externalWidths)) s[k] = v
      return s
    }
    return {}
  })
  const columnSizing = externalWidths
    ? (() => { const s: ColumnSizingState = {}; for (const [k, v] of Object.entries(externalWidths)) s[k] = v; return s })()
    : internalSizing

  // 合并 prepend 行
  const resolvedData = React.useMemo(() => {
    if (!prependRows?.length) return data
    return [...prependRows, ...data]
  }, [data, prependRows])

  const table = useReactTable({
    data: resolvedData,
    columns,
    getRowId,
    state: { sorting, columnSizing },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      if (onSortingChange) {
        const col = next[0]
        if (col) onSortingChange(col.id, !col.desc)
      } else {
        setInternalSorting(next)
      }
    },
    onColumnSizingChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnSizing) : updater
      if (onColumnWidthsChange) {
        const record: Record<string, number> = {}
        for (const [k, v] of Object.entries(next)) record[k] = v as number
        onColumnWidthsChange(record)
      } else {
        setInternalSizing(next)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enableSorting: true,
    enableMultiSort: false,
    manualSorting: !!externalSorting,
  })

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!onRowContextMenu) return
      // 检查是否在行上
      const target = e.target as HTMLElement
      const rowEl = target.closest("tr[data-row-id]") as HTMLElement | null
      if (rowEl) {
        const id = rowEl.dataset.rowId
        // 跳过 prepend 行
        if (id && !prependRows?.some((r) => getRowId(r) === id)) {
          const row = data.find((r) => getRowId(r) === id)
          if (row) onRowContextMenu(e, row)
          return
        }
      }
      // 点击在空白区域 → 传递 isBlank
      (onRowContextMenu as any)(e, undefined)
    },
    [data, getRowId, onRowContextMenu, prependRows]
  )

  return (
    <div className="w-full h-full overflow-auto" onContextMenu={onContextMenu}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-(--tx-bg-elevated)">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const meta = (header.column.columnDef.meta || {}) as DataTableColumnMeta
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      canSort && "cursor-pointer",
                      meta.headerClassName
                    )}
                    style={{ width: header.getSize(), position: "relative" }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {sorted && (
                        <Icon
                          icon={sorted === "asc" ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                          width={10} height={10} color="var(--tx-accent-default)"
                          className="shrink-0"
                        />
                      )}
                    </div>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-(--tx-accent-default) z-10"
                      />
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading && data.length === 0
            ? Array.from({ length: loadingRowCount }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            : error
            ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-(--tx-red) text-xs">
                    {error}
                  </TableCell>
                </TableRow>
              )
            : resolvedData.length === 0
            ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-(--tx-text-tertiary) text-xs">
                    {emptyText}
                  </TableCell>
                </TableRow>
              )
            : table.getRowModel().rows.map((row) => {
                const isPrepend = prependRows?.some((r) => getRowId(r) === row.id)
                return (
                  <TableRow
                    key={row.id}
                    data-row-id={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      !isPrepend && onRowClick && "cursor-pointer",
                      isPrepend && "border-b border-(--tx-border-light)"
                    )}
                    onClick={() => { if (!isPrepend) onRowClick?.(row.original); }}
                    onDoubleClick={() => { if (!isPrepend) onRowDoubleClick?.(row.original); }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = (cell.column.columnDef.meta || {}) as DataTableColumnMeta
                      return (
                        <TableCell
                          key={cell.id}
                          className={meta.cellClassName}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
    </div>
  )
}
