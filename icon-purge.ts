/**
 * Vite 插件：构建时精简 @iconify-json/solar/icons.json，
 * 仅保留项目中实际使用的图标，将 chunk 从 6.5MB 降至 ~20KB。
 *
 * 新增图标后运行以下命令更新 USED_ICONS：
 *   grep -roh "solar:[a-zA-Z0-9-]*" src/ | sort -u
 */
import { readFileSync } from 'fs'
import type { Plugin } from 'vite'

/** 项目中实际使用的 solar 图标集合 */
export const USED_ICONS = new Set([
  'add-circle-linear', 'add-folder-linear', 'add-square-linear', 'add-square-outline',
  'alt-arrow-down-linear', 'alt-arrow-left-linear', 'alt-arrow-right-linear',
  'alt-arrow-right-outline', 'alt-arrow-up-linear', 'archive-down-minimlistic-linear',
  'archive-linear', 'bug-linear', 'chart-2-linear', 'chart-square-linear',
  'chart-square-outline', 'check-circle-bold', 'check-circle-broken', 'check-circle-linear',
  'check-square-linear', 'clipboard-linear', 'clipboard-text-linear', 'clock-circle-linear',
  'close-circle-bold', 'close-circle-linear', 'close-linear', 'close-square-linear',
  'close-square-outline', 'code-linear', 'code-square-linear', 'compass-square-broken',
  'copy-linear', 'cpu-linear', 'danger-circle-linear', 'danger-triangle-linear',
  'database-linear', 'document-linear', 'document-text-linear', 'download-linear',
  'eraser-linear', 'eye-closed-linear', 'eye-linear', 'file-linear', 'folder-linear',
  'folder-open-linear', 'folder-with-files-linear', 'gallery-wide-linear',
  'headphones-round-linear', 'history-linear', 'info-circle-linear',
  'laptop-minimalistic-linear', 'laptop-minimalistic-outline', 'lock-linear',
  'magnifer-linear', 'maximize-square-3-linear', 'minimize-square-3-linear',
  'minimize-square-linear', 'minimize-square-minimalistic-outline', 'mirror-right-outline',
  'moon-linear', 'notification-remove-outline', 'notification-unread-lines-broken',
  'pause-linear', 'pen-linear', 'pen-new-square-linear', 'pin-bold', 'pin-linear',
  'play-circle-linear', 'play-linear', 'play-stream-linear', 'plug-circle-linear',
  'programming-broken', 'programming-outline', 'refresh-linear', 'server-linear',
  'server-square-linear', 'settings-linear', 'sidebar-minimalistic-linear',
  'sidebar-minimalistic-outline', 'slider-horizontal-outline', 'slider-vertical-linear',
  'sort-vertical-outline', 'stop-circle-linear', 'sun-linear', 'tablet-broken',
  'text-underline-linear', 'transfer-horizontal-linear', 'trash-bin-trash-linear',
  'upload-linear', 'widget-linear',
])

export function iconPurgePlugin(): Plugin {
  return {
    name: 'icon-purge',
    load(id) {
      if (id.includes('@iconify-json/solar/icons.json')) {
        const raw = JSON.parse(readFileSync(id, 'utf-8'))
        const filtered: Record<string, unknown> = {}
        for (const [name, data] of Object.entries(raw.icons ?? {})) {
          if (USED_ICONS.has(name)) filtered[name] = data
        }
        raw.icons = filtered
        raw.width = raw.width ?? 24
        raw.height = raw.height ?? 24
        return JSON.stringify(raw)
      }
    },
  }
}
