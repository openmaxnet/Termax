/**
 * 通用分屏容器
 * 支持水平/垂直方向、拖拽调整面板大小、拖拽超出阈值自动关闭面板
 */
import React, { useRef, useState, useCallback } from 'react';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  initialSizes?: number[];
  children: React.ReactNode[];
  className?: string;
  /** 拖拽将面板关闭时的回调，remaining 指出保留哪一侧 */
  onCloseSplit?: (remaining: 'left' | 'right') => void;
}

/**
 * 分屏容器组件
 * @param direction 分屏方向（horizontal=左右，vertical=上下）
 * @param children 子面板数组，必须至少 2 个
 */
export const SplitPane: React.FC<SplitPaneProps> = ({
  direction, initialSizes, children, className, onCloseSplit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>(
    initialSizes ?? children.map(() => 100 / children.length),
  );
  // 当前拖拽状态：面板索引、起始像素、起始百分比
  const dragging = useRef<{ idx: number; startPx: number; startSizes: number[] } | null>(null);
  // 用 requestAnimationFrame 节流拖拽计算，避免高频触发布局抖动
  const rafId = useRef<number | null>(null);

  const count = children.length;
  const isHorizontal = direction === 'horizontal';

  // 分隔条鼠标按下：初始化拖拽状态，注册全局 mousemove/mouseup 事件
  const handleMouseDown = useCallback(
    (idx: number, e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const startPx = isHorizontal ? e.clientX : e.clientY;
      dragging.current = { idx, startPx, startSizes: [...sizes] };

      // 拖拽中实时计算两侧面板百分比，超出阈值触发关闭
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        if (rafId.current) return;
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          if (!dragging.current) return;
          const { idx: i, startPx: sp, startSizes: ss } = dragging.current!;
          const currentPx = isHorizontal ? ev.clientX : ev.clientY;
          const delta = currentPx - sp;
          const totalSize = isHorizontal ? rect.width : rect.height;
          const deltaPercent = (delta / totalSize) * 100;

          const leftVal = ss[i] + deltaPercent;
          const rightVal = ss[i + 1] - deltaPercent;

          // 拖拽超出 -5% 阈值时触发关闭面板，避免无意识轻微拖动误关
          if (rightVal < -5) {
            onCloseSplit?.('left');
            cleanup();
            return;
          }
          if (leftVal < -5) {
            onCloseSplit?.('right');
            cleanup();
            return;
          }

          const minSize = 10;
          const newSizes = [...ss];
          newSizes[i] = Math.max(minSize, leftVal);
          newSizes[i + 1] = Math.max(minSize, rightVal);

          // 归一化确保两侧百分比之和为 100
          const sum = newSizes.reduce((a, b) => a + b, 0);
          setSizes(newSizes.map((s) => (s / sum) * 100));
        });
      };

      // 释放鼠标：清理拖拽状态和事件监听
      const onMouseUp = () => cleanup();
      const cleanup = () => {
        if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
        dragging.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [sizes, isHorizontal, onCloseSplit],
  );

  /** 双击分隔条重置面板为均分 */
  const handleDoubleClick = useCallback(() => {
    setSizes(children.map(() => 100 / children.length));
  }, [children.length]);

  if (count < 2) return <>{children}</>;

  return (
    <div ref={containerRef} className={className} style={{
      display: 'flex', flexDirection: isHorizontal ? 'row' : 'column',
      width: '100%', height: '100%', overflow: 'hidden',
    }}>
      {children.slice(0, -1).map((child, i) => (
        <React.Fragment key={i}>
          <div style={{
            flex: `0 0 ${sizes[i]}%`, overflow: 'hidden',
            minWidth: isHorizontal ? 80 : undefined,
            minHeight: isHorizontal ? undefined : 60,
          }}>
            {child}
          </div>
          {/* 分隔条：4px 宽，拖拽时自动高亮 */}
          <div onMouseDown={(e) => handleMouseDown(i, e)} onDoubleClick={handleDoubleClick}
            style={{
              flex: '0 0 4px', cursor: isHorizontal ? 'col-resize' : 'row-resize',
              background: 'var(--tx-border-light)', transition: 'background 0.12s', zIndex: 5,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--tx-accent-muted)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--tx-border-light)'}
          />
        </React.Fragment>
      ))}
      <div style={{
        flex: `0 0 ${sizes[count - 1]}%`, overflow: 'hidden',
        minWidth: isHorizontal ? 80 : undefined,
        minHeight: isHorizontal ? undefined : 60,
      }}>
        {children[count - 1]}
      </div>
    </div>
  );
};
