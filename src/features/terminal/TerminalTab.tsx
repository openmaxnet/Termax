/**
 * 终端标签页
 * xterm.js 终端实例的创建、配置、生命周期管理。
 * 包含工具栏（复制/粘贴/搜索/重连等）、搜索栏、和 SSH/本地终端连接管理
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XtermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Icon } from '@iconify/react';

import type { ConnectionConfig } from '@/lib/ipc';
import { copyToClipboard, pasteFromClipboard } from '@/lib/clipboard';
import { useTerminalStore, type TabType, type TerminalStore } from '@/stores/terminalStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useI18n, getMessage } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useTerminalConnection } from './useTerminalConnection';

interface TerminalTabProps {
  tabId: string;
  tabType: TabType;
  config: ConnectionConfig | null;
  visible: boolean;
  shellPath?: string;
  onSftpConnect?: (config: ConnectionConfig) => void;
  focused?: boolean;
}

export const TerminalTab = React.memo(function TerminalTab({ tabId, tabType, config, visible, shellPath, onSftpConnect, focused }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null!);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [toolbarPinned, setToolbarPinned] = useState(false);
  const toolbarVisibleRef = useRef(false);
  const toolbarElRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null!);
  const toolbarTimerRef = useRef<number | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);

  // 根据悬停/固定/搜索状态更新工具栏的显示与隐藏
  const updateToolbarDisplay = useCallback(() => {
    const el = toolbarElRef.current;
    if (!el) return;
    const show = toolbarVisibleRef.current || toolbarPinned || showSearch;
    el.style.opacity = show ? '1' : '0';
    el.style.pointerEvents = show ? 'auto' : 'none';
  }, [toolbarPinned, showSearch]);

  useEffect(() => { updateToolbarDisplay(); }, [updateToolbarDisplay]);

  const setSessionId = useTerminalStore((s: TerminalStore) => s.setSessionId);
  const setConnected = useTerminalStore((s: TerminalStore) => s.setConnected);
  const removeTab = useTerminalStore((s: TerminalStore) => s.removeTab);
  const { t } = useI18n();
  const appTheme = useSettingsStore((s) => s.appTheme);
  const terminalFont = useSettingsStore((s) => s.terminalFont);
  const terminalFontFallback = useSettingsStore((s) => s.terminalFontFallback);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const cursorStyle = useSettingsStore((s) => s.cursorStyle);
  const cursorBlink = useSettingsStore((s) => s.cursorBlink);
  const scrollbackLines = useSettingsStore((s) => s.scrollbackLines);
  const copyOnSelect = useSettingsStore((s) => s.copyOnSelect);
  const rightClickAction = useSettingsStore((s) => s.rightClickAction);
  const scrollbarStyle = useSettingsStore((s) => s.scrollbarStyle);
  const enableWebLinks = useSettingsStore((s) => s.enableWebLinks);
  const webLinksModifier = useSettingsStore((s) => s.webLinksModifier);
  const fontFamily = `'${terminalFont}', '${terminalFontFallback}', monospace`;
  const terminalThemeDark = useSettingsStore((s) => s.terminalThemeDark);
  const terminalThemeLight = useSettingsStore((s) => s.terminalThemeLight);

  // 从 CSS 变量中读取终端配色，使其与应用界面保持一致
  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  const colors = {
    foreground: css('--tx-text-primary'),
    background: css('--tx-bg-elevated'),
    cursor: css('--tx-accent-default'),
    selectionBackground: css('--tx-accent-muted'),
    black: css('--tx-bg-surface'),
    red: css('--tx-red'),
    green: css('--tx-green'),
    yellow: css('--tx-yellow'),
    blue: css('--tx-accent-default'),
    magenta: css('--tx-magenta'),
    cyan: css('--tx-cyan'),
    white: css('--tx-text-secondary'),
    brightBlack: css('--tx-border-default'),
    brightRed: css('--tx-red'),
    brightGreen: css('--tx-green'),
    brightYellow: css('--tx-yellow'),
    brightBlue: css('--tx-accent-hover'),
    brightMagenta: css('--tx-magenta'),
    brightCyan: css('--tx-cyan'),
    brightWhite: css('--tx-text-primary'),
  };

  // ── 连接生命周期（初始化 xterm.js + SSH/本地连接 + I/O 事件） ──
  useTerminalConnection({
    containerRef, termRef, fitRef, searchRef, reconnectRef,
    tabId, tabType, config, shellPath,
    setConnected, setSessionId, removeTab, setShowSearch,
    terminalSettings: { cursorBlink, cursorStyle, fontSize, fontFamily, scrollbackLines, enableWebLinks, webLinksModifier },
    colors,
  });

  // Update font live
  useEffect(() => {
    const t = termRef.current;
    if (!t) return;
    t.options.fontFamily = fontFamily;
    t.options.fontSize = fontSize;
  }, [fontFamily, fontSize]);

  // Update cursor / scrollback / copyOnSelect
  useEffect(() => {
    const t = termRef.current;
    if (!t) return;
    t.options.cursorStyle = cursorStyle;
    t.options.cursorBlink = cursorBlink;
    t.options.scrollback = scrollbackLines;
    (t.options as any).copyOnSelect = copyOnSelect;
  }, [cursorStyle, cursorBlink, scrollbackLines, copyOnSelect]);

  useEffect(() => {
    const t = termRef.current;
    if (!t) return;
    // 在 effect 内实时读取 CSS 变量，确保 App.tsx 已先更新覆盖值
    const cs = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
    t.options.theme = {
      background: cs('--tx-bg-elevated'),
      foreground: cs('--tx-text-primary'),
      cursor: cs('--tx-accent-default'),
      selectionBackground: cs('--tx-accent-muted'),
      black: cs('--tx-bg-surface'),
      red: cs('--tx-red'),
      green: cs('--tx-green'),
      yellow: cs('--tx-yellow'),
      blue: cs('--tx-accent-default'),
      magenta: cs('--tx-magenta'),
      cyan: cs('--tx-cyan'),
      white: cs('--tx-text-secondary'),
      brightBlack: cs('--tx-border-default'),
      brightRed: cs('--tx-red'),
      brightGreen: cs('--tx-green'),
      brightYellow: cs('--tx-yellow'),
      brightBlue: cs('--tx-accent-hover'),
      brightMagenta: cs('--tx-magenta'),
      brightCyan: cs('--tx-cyan'),
      brightWhite: cs('--tx-text-primary'),
    };
    // 强制重绘，否则 xterm 不会用新颜色刷新屏幕
    t.refresh(0, t.rows - 1);
  }, [appTheme, terminalThemeDark, terminalThemeLight]);

  // Fit on visibility change
  useEffect(() => {
    if (visible && fitRef.current) {
      setTimeout(() => { fitRef.current?.fit(); termRef.current?.focus(); }, 50);
    }
  }, [visible]);

  // Focus when this pane becomes active (split mode)
  useEffect(() => {
    if (focused && termRef.current) termRef.current.focus();
  }, [focused]);

  // Scrollbar style
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.setAttribute('data-scrollbar', scrollbarStyle);
    const vp = el.querySelector('.xterm-viewport') as HTMLElement | null;
    if (vp) vp.style.overflowY = scrollbarStyle === 'hidden' ? 'hidden' : 'auto';

    if (scrollbarStyle !== 'auto' || !vp) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const slider = el.querySelector('.xterm-slider') as HTMLElement | null;
      if (slider) slider.classList.add('xterm-slider--scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (slider) slider.classList.remove('xterm-slider--scrolling');
      }, 600);
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      vp.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [scrollbarStyle]);

  // 选中文本时自动复制到剪贴板（copyOnSelect 选项）
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (!copyOnSelect) return;
    const handler = () => {
      const sel = term.getSelection();
      if (sel) copyToClipboard(sel).catch(() => {});
    };
    term.onSelectionChange(handler);
    return () => { /* cleanup handled by term disposal */ };
  }, [copyOnSelect]);

  // 执行搜索：在终端内容中查找下一个/上一个匹配项
  const doSearch = useCallback((dir: 'next' | 'prev') => {
    if (!searchText || !searchRef.current) return;
    if (dir === 'next') searchRef.current.findNext(searchText);
    else searchRef.current.findPrevious(searchText);
  }, [searchText]);

  // 搜索输入框的键盘事件：Enter 查找下一个、Escape 关闭搜索
  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch('next'); }
    if (e.key === 'Escape') { setShowSearch(false); setSearchText(''); }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: visible ? 'flex' : 'none', flexDirection: 'column', position: 'relative' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const zoneRight = rect.width * 0.5;
        const zoneTop = rect.height * 0.25;
        const inZone = (e.clientX - rect.left) > (rect.width - zoneRight) && (e.clientY - rect.top) < zoneTop;
        if (inZone) {
          if (!toolbarVisibleRef.current) { toolbarVisibleRef.current = true; updateToolbarDisplay(); }
          if (toolbarTimerRef.current) { clearTimeout(toolbarTimerRef.current); toolbarTimerRef.current = null; }
        } else if (!toolbarPinned) {
          if (!toolbarTimerRef.current) {
            toolbarTimerRef.current = window.setTimeout(() => { toolbarVisibleRef.current = false; updateToolbarDisplay(); toolbarTimerRef.current = null; }, 500);
          }
        }
      }}
      onMouseLeave={() => { if (!toolbarPinned) { toolbarVisibleRef.current = false; updateToolbarDisplay(); } }}
    >
      {/* Terminal container */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (rightClickAction === 'none') return;
          if (rightClickAction === 'paste') {
            pasteFromClipboard().then(t => termRef.current?.paste(t)).catch(() => {});
          } else if (rightClickAction === 'copyPaste') {
            const sel = termRef.current?.getSelection();
            if (sel) {
              copyToClipboard(sel).catch(() => {});
            } else {
              pasteFromClipboard().then(t => termRef.current?.paste(t)).catch(() => {});
            }
          }
        }}
      />

      {/* Toolbar */}
      <div ref={toolbarElRef} style={{
        position: 'absolute', top: 4, right: 8, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
        opacity: 0, pointerEvents: 'none', transition: 'opacity 0.1s',
      }}>
        <div style={{
          display: 'flex', gap: 2, padding: 2,
          background: 'var(--tx-bg-elevated)',
          border: '1px solid var(--tx-border-light)',
          borderRadius: 'var(--tx-radius-md)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => { const s = termRef.current?.getSelection(); if (s) copyToClipboard(s); }}><Icon icon="solar:copy-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('terminal.copy')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => pasteFromClipboard().then(t => termRef.current?.paste(t)).catch(() => {})}><Icon icon="solar:clipboard-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('terminal.paste')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => termRef.current?.selectAll()}><Icon icon="solar:check-square-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('terminal.selectAll')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => termRef.current?.clear()}><Icon icon="solar:eraser-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('terminal.clear')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}><Icon icon="solar:magnifer-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('terminal.search')}</TooltipContent>
          </Tooltip>
          {config && onSftpConnect && <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => onSftpConnect(config)}><Icon icon="solar:folder-with-files-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('terminal.sftp')}</TooltipContent>
          </Tooltip>}
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => reconnectRef.current?.()}><Icon icon="solar:refresh-linear" width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage('titleBar.reconnect')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => setToolbarPinned(!toolbarPinned)}><Icon icon={toolbarPinned ? 'solar:pin-bold' : 'solar:pin-linear'} width={16} height={16} /></Button>} />
            <TooltipContent>{getMessage(toolbarPinned ? 'terminal.unpin' : 'terminal.pin')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div style={{
            display: 'flex', gap: 4, padding: '4px 8px', width: '100%',
            background: 'var(--tx-bg-elevated)',
            border: '1px solid var(--tx-border-light)',
            borderRadius: 'var(--tx-radius-md)', alignItems: 'center',
          }}>
            <input
              ref={searchInputRef}
              autoFocus
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder={t('terminal.searchPlaceholder')}
              style={{
                background: 'transparent', border: 'none', color: colors.foreground,
                outline: 'none', fontSize: 12, flex: 1, minWidth: 0,
              }}
            />
            <Button variant="ghost" size="icon" onClick={() => doSearch('prev')}><Icon icon="solar:alt-arrow-up-linear" width={14} height={14} /></Button>
            <Button variant="ghost" size="icon" onClick={() => doSearch('next')}><Icon icon="solar:alt-arrow-down-linear" width={14} height={14} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setShowSearch(false); setSearchText(''); }}><Icon icon="solar:close-circle-linear" width={14} height={14} /></Button>
          </div>
        )}
      </div>
    </div>
  );
});
