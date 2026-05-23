/**
 * 设置对话框
 * 分类展示设置面板（通用/终端），支持拖拽移动和拖拽调整大小。
 * 使用草稿（draft）模式：修改在用户点击"保存"前不生效
 */
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useI18n } from '@/i18n';
import { getMonospaceFonts, type FontInfo } from '@/lib/fonts';
import { THEME_BUNDLES } from '@/themes';
import { GeneralPanel } from './GeneralPanel';
import { TerminalPanel } from './TerminalPanel';
import { AboutPanel } from './AboutPanel';
import { Button } from '@/components/ui/button';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 设置分类 ID */
type CategoryId = 'general' | 'terminal' | 'about';

/** 设置分类定义 */
interface Category { id: CategoryId; icon: string; labelKey: string; }

/** 设置分类标签页定义 */
const CATEGORIES: Category[] = [
  { id: 'general', icon: 'solar:settings-linear', labelKey: 'settings.general' },
  { id: 'terminal', icon: 'solar:code-square-linear', labelKey: 'settings.terminal' },
  { id: 'about', icon: 'solar:info-circle-linear', labelKey: 'settings.about' },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const [activeCat, setActiveCat] = useState<CategoryId>('general');
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [dialogPos, setDialogPos] = useState<{ top: number; left: number } | null>(null);
  const [dialogSize, setDialogSize] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startT: number; startL: number; dir: string } | null>(null);
  const { t } = useI18n();

  const themeOptions = THEME_BUNDLES.map((th) => ({ value: th.id, label: th.name }));

  // 打开对话框时从当前 store 快照初始化草稿
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open) return;
    getMonospaceFonts().then(setFonts);
    // Initialize draft from current store values
    const s = useSettingsStore.getState();
    setDraft({
      appTheme: s.appTheme,
      manualTheme: s.appTheme === 'system' ? 'dark' : s.appTheme,
      terminalThemeDark: s.terminalThemeDark,
      terminalThemeLight: s.terminalThemeLight,
      locale: s.locale,
      uiFontFamily: s.uiFontFamily,
      terminalFont: s.terminalFont, terminalFontFallback: s.terminalFontFallback,
      fontSize: s.fontSize,
      cursorStyle: s.cursorStyle, cursorBlink: s.cursorBlink,
      scrollbackLines: s.scrollbackLines, scrollbarStyle: s.scrollbarStyle,
      copyOnSelect: s.copyOnSelect, rightClickAction: s.rightClickAction,
      enableWebLinks: s.enableWebLinks,
      confirmTabClose: s.confirmTabClose, rememberWindowSize: s.rememberWindowSize,
      sidebarWidth: s.sidebarWidth, localShellPath: s.localShellPath, editorCommand: s.editorCommand, downloadPath: s.downloadPath,
      debugMode: s.debugMode,
    });
  }, [open]);

  // 更新草稿中的单个字段（用户修改未保存时暂存）
  const setD = (key: string, value: any) => setDraft((p) => ({ ...p, [key]: value }));

  // 将草稿设置逐个写入 settingsStore，触发持久化
  const applyDraft = () => {
    const d = draft;
    const store = useSettingsStore.getState();
    store.setAppTheme(d.appTheme);
    d.locale && store.setLocale(d.locale);
    store.setUiFontFamily(d.uiFontFamily);
    store.setTerminalFont(d.terminalFont);
    store.setTerminalFontFallback(d.terminalFontFallback);
    store.setFontSize(d.fontSize);
    store.setCursorStyle(d.cursorStyle);
    store.setCursorBlink(d.cursorBlink);
    store.setScrollbackLines(d.scrollbackLines);
    store.setScrollbarStyle(d.scrollbarStyle);
    store.setCopyOnSelect(d.copyOnSelect);
    store.setRightClickAction(d.rightClickAction);
    store.setEnableWebLinks(d.enableWebLinks);
    store.setConfirmTabClose(d.confirmTabClose);
    store.setRememberWindowSize(d.rememberWindowSize);
    store.setDebugMode(d.debugMode);
    store.setSidebarWidth(d.sidebarWidth);
    store.setLocalShellPath(d.localShellPath);
    store.setEditorCommand(d.editorCommand);
    store.setDownloadPath(d.downloadPath);
    d.terminalThemeDark && store.setTerminalThemeDark(d.terminalThemeDark);
    d.terminalThemeLight && store.setTerminalThemeLight(d.terminalThemeLight);
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...dialogStyle, ...(dialogSize ? { width: dialogSize.w, height: dialogSize.h } : {}), ...(dialogPos ? { position: 'fixed', top: dialogPos.top, left: dialogPos.left, transform: 'none' } : {}) }}>
        {/* Header — draggable */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 24px 0', cursor: 'grab', userSelect: 'none' }}
          onMouseDown={(e) => {
            const rect = e.currentTarget.parentElement?.getBoundingClientRect();
            if (!rect) return;
            dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: rect.top, startLeft: rect.left };
            const onMove = (ev: MouseEvent) => {
              if (!dragRef.current) return;
              setDialogPos({ top: dragRef.current.startTop + ev.clientY - dragRef.current.startY, left: dragRef.current.startLeft + ev.clientX - dragRef.current.startX });
            };
            const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        >
          <Icon icon="solar:settings-linear" width={20} height={20} color="var(--tx-accent-default)" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--tx-text-primary)' }}>
            {t('settings.title')}
          </h2>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingTop: 16 }}>
          {/* Sidebar */}
          <nav style={{ width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
            {CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  border: 'none', borderRadius: 'var(--tx-radius-md)',
                  background: activeCat === cat.id ? 'var(--tx-accent-muted)' : 'transparent',
                  color: activeCat === cat.id ? 'var(--tx-accent-default)' : 'var(--tx-text-secondary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: activeCat === cat.id ? 500 : 400,
                  textAlign: 'left', width: '100%', transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (activeCat !== cat.id) e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { if (activeCat !== cat.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon icon={cat.icon} width={17} height={17} />
                {t(cat.labelKey)}
              </button>
            ))}
          </nav>

          <div style={{ width: 1, background: 'var(--tx-border-light)', margin: '0 8px' }} />

          {/* Content panel */}
          <div style={{ flex: 1, padding: '0 20px 12px 12px', overflowY: 'auto', maxHeight: 360 }}>
            {activeCat === 'general' && <GeneralPanel t={t} draft={draft} setD={setD} fonts={fonts} themeOptions={themeOptions} />}
            {activeCat === 'terminal' && <TerminalPanel t={t} draft={draft} setD={setD} fonts={fonts} themeOptions={themeOptions} />}
            {activeCat === 'about' && <AboutPanel />}
          </div>
        </div>
        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--tx-border-light)', flexShrink: 0 }}>
          <Button variant="outline" onClick={onClose}>{t('settings.cancel')}</Button>
          <Button variant="outline" onClick={applyDraft}>{t('settings.apply')}</Button>
          <Button onClick={() => { applyDraft(); onClose(); }}>{t('settings.save')}</Button>
        </div>

        {/* Resize handles — all edges & corners */}
        {(['n','s','e','w','ne','nw','se','sw'] as const).map((dir) => (
          <div key={dir} onMouseDown={(e) => {
            e.preventDefault();
            const el = e.currentTarget.parentElement;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height, startT: rect.top, startL: rect.left, dir };
            const onMove = (ev: MouseEvent) => {
              if (!resizeRef.current) return;
              const { startX, startY, startW, startH, startT, startL, dir: d } = resizeRef.current;
              let w = startW, h = startH, t = startT, l = startL;
              if (d.includes('e')) w = Math.max(480, startW + ev.clientX - startX);
              if (d.includes('s')) h = Math.max(400, startH + ev.clientY - startY);
              if (d.includes('w')) { const nw = Math.max(480, startW - (ev.clientX - startX)); l = startL + (startW - nw); w = nw; }
              if (d.includes('n')) { const nh = Math.max(400, startH - (ev.clientY - startY)); t = startT + (startH - nh); h = nh; }
              setDialogSize({ w, h });
              setDialogPos({ top: t, left: l });
            };
            const onUp = () => { resizeRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
            style={{
              position: 'absolute', zIndex: 10,
              ...(dir === 'n' ? { top: 0, left: 0, right: 0, height: 4, cursor: 'n-resize' } : {}),
              ...(dir === 's' ? { bottom: 0, left: 0, right: 0, height: 4, cursor: 's-resize' } : {}),
              ...(dir === 'e' ? { top: 0, right: 0, bottom: 0, width: 4, cursor: 'e-resize' } : {}),
              ...(dir === 'w' ? { top: 0, left: 0, bottom: 0, width: 4, cursor: 'w-resize' } : {}),
              ...(dir === 'ne' ? { top: 0, right: 0, width: 8, height: 8, cursor: 'ne-resize' } : {}),
              ...(dir === 'nw' ? { top: 0, left: 0, width: 8, height: 8, cursor: 'nw-resize' } : {}),
              ...(dir === 'se' ? { bottom: 0, right: 0, width: 8, height: 8, cursor: 'se-resize' } : {}),
              ...(dir === 'sw' ? { bottom: 0, left: 0, width: 8, height: 8, cursor: 'sw-resize' } : {}),
            }}
          />
        ))}
      </div>
    </div>
  );
};


const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'var(--tx-bg-overlay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 50, animation: 'fadeIn 0.15s',
};

const dialogStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  width: 620, minWidth: 480, minHeight: 400,
  background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)',
  borderRadius: 'var(--tx-radius-lg)', boxShadow: 'var(--tx-shadow-lg)',
  animation: 'scaleIn 0.15s', position: 'relative',
};
