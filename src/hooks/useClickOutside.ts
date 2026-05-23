import { useEffect } from 'react';

/**
 * 监听点击元素外部的事件，用于关闭弹出层（下拉菜单、上下文菜单等）
 *
 * @param ref             —— 目标元素的 ref
 * @param handler         —— 点击外部时执行的回调
 * @param enabled         —— 是否启用监听，默认 true，传入 false 可暂时禁用
 * @param excludeSelector —— CSS 选择器，匹配的元素上的点击不会触发 handler（如侧边栏切换按钮）
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
  excludeSelector?: string,
): void {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      if (excludeSelector && (e.target as HTMLElement).closest(excludeSelector)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler, enabled, excludeSelector]);
}
