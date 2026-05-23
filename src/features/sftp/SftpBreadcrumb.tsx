/**
 * SFTP 路径面包屑
 * 显示当前目录层级，支持点击跳转和返回上级
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SftpBreadcrumbProps {
  cwd: string;
  pathSegments: string[];
  onNavigate: (path: string) => void;
  onGoUp: () => void;
}

export const SftpBreadcrumb: React.FC<SftpBreadcrumbProps> = ({ cwd, pathSegments, onNavigate, onGoUp }) => {
  const { t } = useI18n();
  return (
    <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--tx-border-light)', display: 'flex', alignItems: 'center', gap: 2, minHeight: 30, overflow: 'hidden' }}>
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onGoUp}><Icon icon="solar:alt-arrow-up-linear" width={14} height={14} /></Button>} />
        <TooltipContent>{t('fileBrowser.goUp')}</TooltipContent>
      </Tooltip>
      <div style={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden', flexWrap: 'nowrap', alignItems: 'center', fontSize: 11 }}>
        {pathSegments.length === 0 ? (
          <span onClick={() => onNavigate('/')} style={{ color: 'var(--tx-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap', padding: '1px 2px', borderRadius: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >/</span>
        ) : pathSegments.map((seg, i) => {
          const isDrive = seg.endsWith(':');
          const joined = pathSegments.slice(0, i + 1).join('/');
          const full = isDrive ? joined : '/' + joined;
          return (
            <React.Fragment key={i}>
              <span style={{ color: 'var(--tx-text-tertiary)', fontSize: 10, margin: '0 1px' }}>→</span>
              {/* 当前所在目录高亮，其余灰色 */}
              <span onClick={() => onNavigate(full)}
                style={{ color: full === cwd ? 'var(--tx-text-primary)' : 'var(--tx-text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', padding: '1px 3px', borderRadius: 2, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >{seg}</span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
