/**
 * 通用工具函数集合
 * 包含 className 拼接、视口位置钳制、唯一 ID 生成
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind className 条件拼接（兼容 shadcn/ui） */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 将弹出框位置钳制在视口边界内，确保不超出屏幕
 *
 * @param x       —— 期望的左边距
 * @param y       —— 期望的上边距
 * @param width   —— 弹出框宽度
 * @param height  —— 弹出框高度
 * @param padding —— 视口边距，默认 4px
 * @returns 钳制后的 { left, top }
 */
export function clampToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = 4,
): { left: number; top: number } {
  let left = x;
  let top = y;

  // 右侧溢出 → 向左推移
  if (left + width > window.innerWidth - padding) {
    left = window.innerWidth - width - padding;
  }
  // 左侧溢出 → 向右推移
  if (left < padding) {
    left = padding;
  }
  // 底部溢出 → 翻转到上方
  if (top + height > window.innerHeight - padding) {
    top = top - height - padding;
  }
  // 顶部溢出 → 向下推移
  if (top < padding) {
    top = padding;
  }

  return { left, top };
}

/** 生成唯一 ID（优先使用 crypto API，降级到时间戳+随机数） */
export function generateId(): string {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}
