/**
 * SFTP 布局容器（side 模式）
 * 纯布局组件——接收 children 并在侧边面板容器中渲染。
 * 负责调整大小手柄、头部标题等外壳逻辑，不包含任何业务内容。
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { useI18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ConnectionConfig } from '@/lib/ipc';

interface SftpLayoutProps {
  config: ConnectionConfig;
  visible: boolean;
  children: React.ReactNode;
  onClose?: () => void;
}

/** 浮动窗口图标按钮样式 */
const iconBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, border: 'none', background: 'transparent',
  color: 'var(--tx-text-tertiary)', cursor: 'pointer',
  borderRadius: 'var(--tx-radius-sm)', transition: 'background 0.12s',
};

const h = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; };
const l = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent'; };

export const SftpLayout: React.FC<SftpLayoutProps> = ({ config, visible, children, onClose }) => {
  const { t } = useI18n();
  const sftpWidth = useSettingsStore((s) => s.sftpWidth);
  const setSftpWidth = useSettingsStore((s) => s.setSftpWidth);

  const hostLabel = config.name || `${config.username}@${config.host}`;

  if (!visible) return null;

  return (
    <div style={{
      width: sftpWidth, display: 'flex', flexDirection: 'column',
      background: 'var(--tx-bg-elevated)',
      borderLeft: '1px solid var(--tx-border-light)',
      fontSize: 12, overflow: 'hidden', flexShrink: 0, position: 'relative',
    }}>
      {/* 左侧拖拽调整大小手柄 */}
      <div onMouseDown={(e) => {
        const el = e.currentTarget.parentElement as HTMLElement;
        const origTrans = el.style.transition; el.style.transition = 'none';
        const startX = e.clientX; const startW = el.getBoundingClientRect().width;
        const onMove = (ev: MouseEvent) => {
          const w = Math.max(180, Math.min(600, startW - (ev.clientX - startX)));
          el.style.width = w + 'px';
        };
        const onUp = () => {
          const finalW = parseInt(el.style.width) || 280;
          setSftpWidth(finalW);
          el.style.transition = origTrans;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 5 }} />

      {/* 头部 */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--tx-border-light)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 600, color: 'var(--tx-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        <Icon icon="solar:folder-with-files-linear" width={14} height={14} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hostLabel}
        </span>
        <button onClick={onClose} title={t('fileBrowser.closePanel')}
          style={iconBtnStyle} onMouseEnter={h} onMouseLeave={l}>
          <Icon icon="solar:close-circle-linear" width={15} height={15} />
        </button>
      </div>
      {children}
    </div>
  );
};
