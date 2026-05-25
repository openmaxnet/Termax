import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * 统一的剪贴板工具模块
 * 使用 Tauri clipboard-manager 插件替代 navigator.clipboard Web API，
 * 避免在 WebView2 中触发浏览器原生权限弹窗。
 */

export async function copyToClipboard(text: string): Promise<void> {
  await writeText(text);
}

export async function pasteFromClipboard(): Promise<string> {
  return await readText();
}
