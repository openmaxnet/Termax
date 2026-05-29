/**
 * 用户设置持久化管理（Zustand + persist）
 * 管理所有用户偏好设置：主题、字体、终端行为、SFTP 布局、快捷键等，
 * 通过 localStorage 持久化，partialize 精确控制保存字段
 */
// 注意：默认窗口尺寸已在 tauri.conf.json 中提升到 1100x720，
// 与大多数用户的记忆尺寸接近，因此跳变幅度很小。
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/i18n';

/** 应用主题模式 */
export type AppTheme = 'dark' | 'light' | 'system';
/** 终端光标样式 */
export type CursorStyle = 'block' | 'underline' | 'bar';
/** 右键操作行为 */
export type RightClickAction = 'paste' | 'copyPaste' | 'none';
/** Web 链接点击修饰键 */
export type WebLinksModifier = 'none' | 'ctrl';

/** 用户设置状态结构（所有偏好配置字段） */
interface SettingsState {
  // Appearance
  appTheme: AppTheme;
  windowOpacity: number;
  locale: Locale;
  uiFontFamily: string;

  // Terminal - font
  terminalFont: string;
  terminalFontFallback: string;
  fontSize: number;

  // Terminal - behavior
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  scrollbackLines: number;
  scrollbarStyle: 'visible' | 'hidden' | 'auto';
  copyOnSelect: boolean;
  rightClickAction: RightClickAction;

  // Terminal - links
  enableWebLinks: boolean;
  webLinksModifier: WebLinksModifier;

  // Other
  confirmTabClose: boolean;
  rememberWindowSize: boolean;
  sidebarWidth: number;
  sftpWidth: number;
  sftpMode: 'side' | 'tab';
  localShellPath: string;
  wslDistro: string;

  // External editor
  editorCommand: string;

  // Terminal theme
  terminalThemeDark: string;
  terminalThemeLight: string;

  // Download
  downloadPath: string;

  // Update
  autoCheckUpdate: boolean;

  // Debug
  debugMode: boolean;

  // Actions
  setAppTheme: (theme: AppTheme) => void;
  toggleAppTheme: () => void;
  setWindowOpacity: (opacity: number) => void;
  setLocale: (locale: Locale) => void;
  setUiFontFamily: (family: string) => void;
  setTerminalFont: (font: string) => void;
  setTerminalFontFallback: (font: string) => void;
  setFontSize: (size: number) => void;
  setCursorStyle: (style: CursorStyle) => void;
  setCursorBlink: (blink: boolean) => void;
  setScrollbackLines: (lines: number) => void;
  setScrollbarStyle: (style: 'visible' | 'hidden' | 'auto') => void;
  setCopyOnSelect: (on: boolean) => void;
  setRightClickAction: (action: RightClickAction) => void;
  setEnableWebLinks: (on: boolean) => void;
  setWebLinksModifier: (mod: WebLinksModifier) => void;
  setConfirmTabClose: (on: boolean) => void;
  setRememberWindowSize: (on: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setSftpWidth: (w: number) => void;
  setSftpMode: (mode: 'side' | 'tab') => void;
  setLocalShellPath: (path: string) => void;
  setWslDistro: (distro: string) => void;
  setEditorCommand: (cmd: string) => void;
  setDownloadPath: (p: string) => void;
  setAutoCheckUpdate: (on: boolean) => void;
  setDebugMode: (on: boolean) => void;
  setTerminalThemeDark: (id: string) => void;
  setTerminalThemeLight: (id: string) => void;
}

/**
 * 用户设置持久化 Store
 * 管理所有偏好设置（主题、字体、终端行为、布局等），
 * 通过 Zustand persist 中间件自动同步到 localStorage
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      appTheme: 'dark',
      windowOpacity: 1.0,
      locale: 'zh-CN',
      uiFontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      terminalFont: 'JetBrains Mono',
      terminalFontFallback: 'Consolas',
      fontSize: 14,
      cursorStyle: 'bar' as CursorStyle,
      cursorBlink: true,
      scrollbackLines: 5000,
      scrollbarStyle: 'auto',
      copyOnSelect: false,
      rightClickAction: 'paste' as RightClickAction,
      enableWebLinks: true,
      webLinksModifier: 'ctrl' as WebLinksModifier,
      confirmTabClose: false,
      rememberWindowSize: true,
      sidebarWidth: 220,
      sftpWidth: 280,
      sftpMode: 'side',
      localShellPath: '',
      wslDistro: '',
      editorCommand: '',
      terminalThemeDark: 'termax',
      terminalThemeLight: 'termax',
      downloadPath: '',
      autoCheckUpdate: false,
      debugMode: false,

      setAppTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
        set({ appTheme: theme });
      },
      toggleAppTheme: () => set((s) => {
        const order: AppTheme[] = ['dark', 'light', 'system'];
        const next = order[(order.indexOf(s.appTheme) + 1) % 3];
        const isDark = next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
        return { appTheme: next };
      }),
      setWindowOpacity: (v) => set({ windowOpacity: Math.max(0.1, Math.min(1, v)) }),
      setLocale: (locale) => {
        document.documentElement.lang = locale;
        set({ locale });
      },
      setUiFontFamily: (family) => {
        document.documentElement.style.setProperty('--tx-font-sans', family);
        set({ uiFontFamily: family });
      },
      setTerminalFont: (f) => set({ terminalFont: f }),
      setTerminalFontFallback: (f) => set({ terminalFontFallback: f }),
      setFontSize: (s) => set({ fontSize: Math.max(10, Math.min(24, s)) }),
      setCursorStyle: (s) => set({ cursorStyle: s }),
      setCursorBlink: (b) => set({ cursorBlink: b }),
      setScrollbackLines: (n) => set({ scrollbackLines: Math.max(500, Math.min(50000, n)) }),
      setScrollbarStyle: (s) => set({ scrollbarStyle: s }),
      setCopyOnSelect: (o) => set({ copyOnSelect: o }),
      setRightClickAction: (a) => set({ rightClickAction: a }),
      setEnableWebLinks: (o) => set({ enableWebLinks: o }),
      setWebLinksModifier: (m) => set({ webLinksModifier: m }),
      setConfirmTabClose: (o) => set({ confirmTabClose: o }),
      setRememberWindowSize: (o) => set({ rememberWindowSize: o }),
      setSidebarWidth: (w) => set({ sidebarWidth: w }),
      setSftpWidth: (w) => set({ sftpWidth: w }),
      setSftpMode: (mode) => set({ sftpMode: mode }),
      setLocalShellPath: (p) => set({ localShellPath: p }),
      setWslDistro: (d) => set({ wslDistro: d }),
      setEditorCommand: (cmd) => set({ editorCommand: cmd }),
      setDownloadPath: (p) => set({ downloadPath: p }),
      setAutoCheckUpdate: (o) => set({ autoCheckUpdate: o }),
      setDebugMode: (o) => set({ debugMode: o }),
      setTerminalThemeDark: (id) => set({ terminalThemeDark: id }),
      setTerminalThemeLight: (id) => set({ terminalThemeLight: id }),
    }),
    {
      name: 'termax-settings',
      partialize: (state) => ({
        appTheme: state.appTheme,
        windowOpacity: state.windowOpacity,
        locale: state.locale,
        uiFontFamily: state.uiFontFamily,
        terminalFont: state.terminalFont,
        terminalFontFallback: state.terminalFontFallback,
        fontSize: state.fontSize,
        cursorStyle: state.cursorStyle,
        cursorBlink: state.cursorBlink,
        scrollbackLines: state.scrollbackLines,
        scrollbarStyle: state.scrollbarStyle,
        copyOnSelect: state.copyOnSelect,
        rightClickAction: state.rightClickAction,
        enableWebLinks: state.enableWebLinks,
        webLinksModifier: state.webLinksModifier,
        confirmTabClose: state.confirmTabClose,
        rememberWindowSize: state.rememberWindowSize,
        sidebarWidth: state.sidebarWidth,
        sftpWidth: state.sftpWidth,
        sftpMode: state.sftpMode,
        localShellPath: state.localShellPath,
        wslDistro: state.wslDistro,
        editorCommand: state.editorCommand,
        terminalThemeDark: state.terminalThemeDark,
        terminalThemeLight: state.terminalThemeLight,
        downloadPath: state.downloadPath,
        autoCheckUpdate: state.autoCheckUpdate,
        debugMode: state.debugMode,
      }),
    },
  ),
);
