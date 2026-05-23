/**
 * 独立终端组件
 * xterm.js 的轻量封装，用于非标签页场景的终端渲染
 */
import React from 'react';

/** 独立终端容器属性 */
interface TerminalProps {
  /** CSS 类名 */
  className?: string;
}

/**
 * 终端渲染容器
 * 由父组件通过 useTerminal hook 和 ref 控制 xterm.js 生命周期
 */
export const Terminal = React.forwardRef<HTMLDivElement, TerminalProps>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
);

Terminal.displayName = 'Terminal';
