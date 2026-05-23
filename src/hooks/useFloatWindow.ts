import { useCallback } from 'react';

/**
 * 浮动窗口的拖拽和角落缩放逻辑
 */
export function useFloatWindow(
  x: number, y: number, width: number, height: number,
  setPosition: (x: number, y: number) => void,
  setSize: (w: number, h: number) => void,
) {
  const handleDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startPosX = x, startPosY = y;
    const onMove = (ev: MouseEvent) => {
      const nx = Math.max(0, Math.min(window.innerWidth - width, startPosX + (ev.clientX - startX)));
      const ny = Math.max(0, Math.min(window.innerHeight - height, startPosY + (ev.clientY - startY)));
      setPosition(nx, ny);
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [x, y, width, height, setPosition]);

  const handleResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = width, startH = height;
    const MIN_W = 300, MIN_H = 200;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(MIN_W, startW + (ev.clientX - startX));
      const h = Math.max(MIN_H, startH + (ev.clientY - startY));
      setSize(Math.min(w, window.innerWidth - x), Math.min(h, window.innerHeight - y));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }, [x, y, width, height, setSize]);

  return { handleDrag, handleResize };
}
