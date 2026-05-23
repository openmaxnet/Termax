/**
 * 通用设置面板
 * 主题、语言、UI 字体、窗口行为等偏好设置
 */
import React from 'react';
import { Section, Sel, type PanelProps } from './helpers';

export const GeneralPanel: React.FC<PanelProps> = ({ t, draft, setD, fonts, themeOptions }) => {
  const followSystem = draft.appTheme === 'system';
  const manualTheme = draft.manualTheme || 'dark';

  const setThemeMode = (mode: string) => {
    setD('manualTheme', mode);
    if (!followSystem) setD('appTheme', mode);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Section label={t('settings.language')}>
        <Sel value={draft.locale} options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]} onChange={(v) => setD('locale', v)} />
      </Section>

      <Section label={t('settings.theme')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Sel
            value={followSystem ? 'system' : manualTheme}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'dark', label: t('settings.themeDarkLabel') },
              { value: 'light', label: t('settings.themeLightLabel') },
            ]}
            onChange={(v) => {
              if (v === 'system') setD('appTheme', 'system');
              else { setD('manualTheme', v); setD('appTheme', v); }
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--tx-text-tertiary)', marginBottom: 4 }}>{t('settings.themeDarkLabel')}</div>
              <Sel value={draft.terminalThemeDark || 'termax'} options={themeOptions} onChange={(v) => { setD('terminalThemeDark', v); setThemeMode('dark'); }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--tx-text-tertiary)', marginBottom: 4 }}>{t('settings.themeLightLabel')}</div>
              <Sel value={draft.terminalThemeLight || 'termax'} options={themeOptions} onChange={(v) => { setD('terminalThemeLight', v); setThemeMode('light'); }} />
            </div>
          </div>
        </div>
      </Section>

      <Section label={t('settings.uiFont')}>
        <Sel value={draft.uiFontFamily} options={fonts.map((f) => ({ value: f.value, label: f.label }))} onChange={(v) => setD('uiFontFamily', v)} />
      </Section>

      <Section label={t('settings.rememberWindowSize')}>
        <Sel value={draft.rememberWindowSize ? 'yes' : 'no'} options={[{ value: 'yes', label: t('settings.yes') }, { value: 'no', label: t('settings.no') }]} onChange={(v) => setD('rememberWindowSize', v === 'yes')} />
      </Section>

      <Section label={t('settings.confirmTabClose')}>
        <Sel value={draft.confirmTabClose ? 'yes' : 'no'} options={[{ value: 'yes', label: t('settings.yes') }, { value: 'no', label: t('settings.no') }]} onChange={(v) => setD('confirmTabClose', v === 'yes')} />
      </Section>

      <Section label={t('settings.debugMode')}>
        <Sel value={draft.debugMode ? 'yes' : 'no'} options={[{ value: 'yes', label: t('settings.yes') }, { value: 'no', label: t('settings.no') }]} onChange={(v) => setD('debugMode', v === 'yes')} />
      </Section>
    </div>
  );
};
