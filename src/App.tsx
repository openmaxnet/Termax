/**
 * 应用根组件
 * 负责：主题同步（CSS 变量覆盖 + .dark 类切换）、字体设置同步、
 * 窗口大小持久化、系统主题监听
 */
import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppLayout } from '@/app/AppLayout';
import { useSettingsStore } from '@/stores/settingsStore';
import { ALL_THEME_VARS, THEME_REGISTRY } from '@/themes';
import { checkForBackgroundUpdate } from '@/lib/updater';
import { debugTimeEnd } from '@/lib/debug';
import { TooltipProvider } from '@/components/ui/tooltip';

function App() {
  const locale = useSettingsStore((s) => s.locale);
  const rememberWindowSize = useSettingsStore((s) => s.rememberWindowSize);
  const mqRef = useRef<MediaQueryList | null>(null);

  // 挂载时和语言切换时将持久化设置同步到 DOM（主题/font/窗口尺寸）
  useEffect(() => {
    debugTimeEnd('termax-boot');
    const s = useSettingsStore.getState();

    // 应用主题：system 模式跟随系统偏好，否则强制 dark/light
    const applyTheme = (theme: string) => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      } else {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
    };
    applyTheme(s.appTheme);

    document.documentElement.lang = locale;
    document.documentElement.style.setProperty('--tx-font-sans', s.uiFontFamily);
    document.documentElement.style.setProperty('--tx-font-mono', `${s.terminalFont}, ${s.terminalFontFallback}, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace`);

    // 窗口尺寸恢复已在 main.tsx 中于 React 挂载前完成（窗口初始隐藏，恢复后显示）
  }, [locale, rememberWindowSize]);

  // 窗口缩放时保存尺寸到 localStorage（非最大化状态，且用户开启记忆时）
  useEffect(() => {
    if (!rememberWindowSize) return;

    const win = getCurrentWindow();
    const handler = async () => {
      try {
        if (await win.isMaximized()) return;
        const size = await win.innerSize();
        if (size.width < 640 || size.height < 400) return;
        localStorage.setItem('termax_window_w', String(size.width));
        localStorage.setItem('termax_window_h', String(size.height));
      } catch {}
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [rememberWindowSize]);

  // Sync font settings to CSS variables
  const terminalFont = useSettingsStore((s) => s.terminalFont);
  const terminalFontFallback = useSettingsStore((s) => s.terminalFontFallback);
  useEffect(() => {
    document.documentElement.style.setProperty('--tx-font-mono', `${terminalFont}, ${terminalFontFallback}, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace`);
  }, [terminalFont, terminalFontFallback]);

  // 监听系统主题变化（当 appTheme 为 system 时自动切换 .dark 类）
  useEffect(() => {
    const handler = () => {
      const s = useSettingsStore.getState();
      if (s.appTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      }
    };
    mqRef.current = window.matchMedia('(prefers-color-scheme: dark)');
    mqRef.current.addEventListener('change', handler);
    return () => mqRef.current?.removeEventListener('change', handler);
  }, []);

  // Sync active theme's CSS variable overrides
  // 所有主题（包括 termax）统一通过 JS 应用 token，index.css 不硬编码颜色值
  const terminalThemeDark = useSettingsStore((s) => s.terminalThemeDark);
  const terminalThemeLight = useSettingsStore((s) => s.terminalThemeLight);
  const appTheme = useSettingsStore((s) => s.appTheme);
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const themeId = isDark ? terminalThemeDark : terminalThemeLight;
    const doc = document.documentElement;

    // 清除所有主题变量的 style.setProperty 覆盖，再重新应用
    for (const key of ALL_THEME_VARS) {
      doc.style.removeProperty(key);
    }

    const theme = THEME_REGISTRY[themeId];
    if (theme) {
      const tokens = isDark ? theme.dark : theme.light;
      for (const [key, value] of Object.entries(tokens)) {
        doc.style.setProperty(key, value);
      }
    }
  }, [terminalThemeDark, terminalThemeLight, appTheme]);

  // 自动检查更新（用户开启 autoCheckUpdate 时，启动后延迟 5 秒静默检查）
  useEffect(() => {
    const autoCheck = useSettingsStore.getState().autoCheckUpdate;
    if (!autoCheck) return;
    const timer = setTimeout(checkForBackgroundUpdate, 5000);
    return () => clearTimeout(timer);
  }, []);

  return <TooltipProvider><AppLayout /></TooltipProvider>;
}

export default App;
