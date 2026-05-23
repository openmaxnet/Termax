/**
 * 终端设置面板
 * 字体、光标样式、滚动、右键行为、本地 Shell、编辑器等终端相关配置
 */
import React, { useEffect, useState } from 'react';
import { ipc } from '@/lib/ipc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Section, Sel, type PanelProps } from './helpers';

export const TerminalPanel: React.FC<PanelProps> = ({ t, draft, setD, fonts }) => {
  const [shells, setShells] = useState<{ name: string; path: string }[]>([]);

  useEffect(() => { ipc.local.detectShells().then(setShells); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section label={t('settings.primary')}>
        <div className="flex gap-2 items-center">
          <div className="flex-1"><Sel value={draft.terminalFont} options={fonts.map((f) => ({ value: f.label, label: f.label }))} onChange={(v) => setD('terminalFont', v)} /></div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="outline" size="icon-sm" onClick={() => setD('fontSize', draft.fontSize - 1)}>−</Button>
            <Input
              type="number" min={10} max={24}
              value={draft.fontSize}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setD('fontSize', Math.max(10, Math.min(24, v))); }}
              className="w-14 text-center h-8 text-xs"
            />
            <Button variant="outline" size="icon-sm" onClick={() => setD('fontSize', draft.fontSize + 1)}>+</Button>
          </div>
        </div>
      </Section>
      <Section label={t('settings.fallback')}>
        <Sel value={draft.terminalFontFallback} options={fonts.map((f) => ({ value: f.label, label: f.label }))} onChange={(v) => setD('terminalFontFallback', v)} />
      </Section>
      <Section label={t('settings.cursorStyle')}>
        <Sel value={draft.cursorStyle} options={[
          { value: 'block', label: t('settings.cursorStyleBlock') + '  ▮' },
          { value: 'underline', label: t('settings.cursorStyleUnderline') + '  _' },
          { value: 'bar', label: t('settings.cursorStyleBar') + '  │' },
        ]} onChange={(v) => setD('cursorStyle', v)} />
      </Section>
      <Section label={t('settings.cursorBlink')}>
        <Sel value={draft.cursorBlink ? 'yes' : 'no'} options={[{ value: 'yes', label: t('settings.yes') }, { value: 'no', label: t('settings.no') }]} onChange={(v) => setD('cursorBlink', v === 'yes')} />
      </Section>
      <Section label={t('settings.copyOnSelect')}>
        <Sel value={draft.copyOnSelect ? 'yes' : 'no'} options={[{ value: 'yes', label: t('settings.yes') }, { value: 'no', label: t('settings.no') }]} onChange={(v) => setD('copyOnSelect', v === 'yes')} />
      </Section>
      <Section label={t('settings.scrollbackLines')}>
        <Input
          type="number" min={500} max={50000} step={500}
          value={draft.scrollbackLines}
          onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setD('scrollbackLines', Math.max(500, Math.min(50000, v))); }}
        />
      </Section>
      <Section label={t('settings.scrollbarStyle')}>
        <Sel value={draft.scrollbarStyle} options={[
          { value: 'visible', label: t('settings.scrollbarVisible') },
          { value: 'hidden', label: t('settings.scrollbarHidden') },
          { value: 'auto', label: t('settings.scrollbarAuto') },
        ]} onChange={(v) => setD('scrollbarStyle', v)} />
      </Section>
      <Section label={t('settings.rightClickAction')}>
        <Sel value={draft.rightClickAction} options={[
          { value: 'paste', label: t('settings.rightClickPaste') },
          { value: 'copyPaste', label: t('settings.rightClickCopyPaste') },
          { value: 'none', label: t('settings.rightClickNone') },
        ]} onChange={(v) => setD('rightClickAction', v)} />
      </Section>
      <Section label={t('settings.enableWebLinks')}>
        <Sel value={draft.enableWebLinks ? 'yes' : 'no'} options={[{ value: 'yes', label: t('settings.yes') }, { value: 'no', label: t('settings.no') }]} onChange={(v) => setD('enableWebLinks', v === 'yes')} />
      </Section>
      <Section label={t('settings.localShell')}>
        {shells.length > 0 ? (
          <Sel value={draft.localShellPath || shells[0]?.path || ''} options={shells.map((s) => ({ value: s.path, label: s.name }))} onChange={(v) => setD('localShellPath', v)} />
        ) : (
          <Input
            placeholder={t('manager.shellPath')}
            value={draft.localShellPath}
            onChange={(e) => setD('localShellPath', e.target.value)}
          />
        )}
      </Section>
      <Section label={t('settings.editorCommand')}>
        <div>
          <Input
            placeholder={t('settings.editorCommandPlaceholder')}
            value={draft.editorCommand || ''}
            onChange={(e) => setD('editorCommand', e.target.value)}
          />
          <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', marginTop: 4 }}>{t('settings.editorCommandHint')}</div>
        </div>
      </Section>
      <Section label={t('settings.downloadPath')}>
        <div>
          <Input
            placeholder={t('settings.downloadPathPlaceholder')}
            value={draft.downloadPath || ''}
            onChange={(e) => setD('downloadPath', e.target.value)}
          />
          <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', marginTop: 4 }}>{t('settings.downloadPathHint')}</div>
        </div>
      </Section>
    </div>
  );
};
