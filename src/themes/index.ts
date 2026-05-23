/**
 * 主题注册
 * 新增主题时需在此处手动导入并添加到 THEME_BUNDLES 数组
 *
 * 注意：曾使用 import.meta.glob 自动扫描，但 Windows 打包后 glob 解析失败导致列表为空
 */
import type { ThemeBundle } from './types';
import termax from './termax';
import oneDark from './one-dark';
import dracula from './dracula';

/** 主题列表（用于设置面板下拉菜单） */
export const THEME_BUNDLES: ThemeBundle[] = [termax, oneDark, dracula];

/** 主题注册表（id → ThemeBundle 快速查找） */
export const THEME_REGISTRY: Record<string, ThemeBundle> = Object.fromEntries(
  THEME_BUNDLES.map((t) => [t.id, t]),
);

/** 所有主题用到的 CSS 变量名集合（用于切换主题时清理旧覆盖） */
export const ALL_THEME_VARS = new Set(
  THEME_BUNDLES.flatMap((t) => [
    ...Object.keys(t.light),
    ...Object.keys(t.dark),
  ]),
);
