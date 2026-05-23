import React from 'react';
import { useI18n } from '@/i18n';

// ── ASCII 艺术字 ──
const ASCII_ART = `
  ________________  __  ______   _  __
 /_  __/ ____/ __ \\/  |/  /   | | |/ /
  / / / __/ / /_/ / /|_/ / /| | |   /
 / / / /___/ _, _/ /  / / ___ |/   |
/_/ /_____/_/ |_/_/  /_/_/  |_/_/|_|

`;

/**
 * 应用启动/空闲画面
 * 显示 Termax ASCII 艺术字和产品标语
 */
export const Splash = React.memo(function Splash() {
  const { t } = useI18n();
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--tx-bg-elevated)',
      userSelect: 'none',
    }}>
      <pre style={{
        fontFamily: 'var(--tx-font-mono)',
        fontSize: 14,
        lineHeight: 1.3,
        color: 'var(--tx-accent-default)',
        opacity: 0.7,
        margin: 0,
        letterSpacing: 0,
      }}>
        {ASCII_ART}
      </pre>
      <div style={{
        fontSize: 11,
        color: 'var(--tx-text-tertiary)',
        opacity: 0.4,
        letterSpacing: 2,
        fontFamily: 'var(--tx-font-sans)',
      }}>
        {t('splash.title')}
      </div>
    </div>
  );
});
