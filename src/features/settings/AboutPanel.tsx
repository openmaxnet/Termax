/**
 * 关于面板
 * 显示应用信息、技术栈版本、更新检查与下载
 */
import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { useI18n } from '@/i18n';
import appLogo from '@/assets/app-ico.png';
import { Section, InfoRow } from './helpers';
import reactPkg from '../../../node_modules/react/package.json';
import xtermPkg from '../../../node_modules/@xterm/xterm/package.json';

interface Update {
  version: string;
  body?: string | null;
  downloadAndInstall: (onEvent?: (event: any) => void) => Promise<void>;
}

const TECH_STACK = [
  { label: 'React', version: reactPkg.version },
  { label: 'xterm.js', version: xtermPkg.version },
];

type UpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'installing' | 'ready' | 'error';

export const AboutPanel: React.FC = () => {
  const { t } = useI18n();
  const [appVersion, setAppVersion] = useState('');
  const [tauriVer, setTauriVer] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [latestUpdate, setLatestUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    import('@tauri-apps/api/app').then(({ getVersion, getTauriVersion }) => {
      getVersion().then(setAppVersion).catch(() => {});
      getTauriVersion().then(setTauriVer).catch(() => {});
    }).catch(() => {});
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setErrorMsg('');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setLatestUpdate(update);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('latest');
      }
    } catch (err) {
      setErrorMsg(String(err));
      setUpdateStatus('error');
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!latestUpdate) return;
    setUpdateStatus('downloading');
    setDownloadProgress(0);
    try {
      let downloaded = 0;
      let contentLength = 0;
      await latestUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            setDownloadProgress(contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0);
            break;
          case 'Finished':
            break;
        }
      });
      setUpdateStatus('installing');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setErrorMsg(String(err));
      setUpdateStatus('error');
    }
  };

  const techItems = [
    { label: 'Tauri', value: tauriVer ? `v${tauriVer}` : '—' },
    ...TECH_STACK.map((s) => ({ label: s.label, value: `v${s.version}` })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 应用信息卡片 */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '16px 12px', borderRadius: 'var(--tx-radius-md)',
        background: 'var(--tx-bg-surface)', border: '1px solid var(--tx-border-light)',
      }}>
        <img src={appLogo} alt="Termax" style={{ width: 48, height: 48, borderRadius: 'var(--tx-radius-md)' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-text-primary)' }}>Termax</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--tx-font-mono)', color: 'var(--tx-text-secondary)' }}>
            v{appVersion || '—'}
          </span>
          <span onClick={updateStatus === 'checking' ? undefined : handleCheckUpdate}
            style={{
              fontSize: 11, color: 'var(--tx-text-link)', cursor: updateStatus === 'checking' ? 'wait' : 'pointer',
              opacity: updateStatus === 'checking' ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (updateStatus !== 'checking') e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >{updateStatus === 'checking' ? t('about.updateChecking') : t('about.checkUpdate')}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx-text-tertiary)' }}>{t('about.description')}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--tx-text-tertiary)', marginTop: 2 }}>
          <span>Termax Team</span>
          <span style={{ cursor: 'pointer', color: 'var(--tx-text-link)' }}
            onClick={() => { open('https://github.com/termax/termax'); }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >GitHub</span>
        </div>
      </div>

      {/* 技术栈 */}
      <Section label={t('about.technology')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {techItems.map((item) => (
            <InfoRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </Section>

      {/* 更新状态反馈 */}
      {updateStatus === 'latest' && (
        <div style={{ fontSize: 12, color: 'var(--tx-green)', textAlign: 'center', padding: '4px 0' }}>
          {t('about.updateLatest')}
        </div>
      )}
      {updateStatus === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--tx-red)', textAlign: 'center', padding: '4px 0' }}>
          {t('about.updateError')}{errorMsg ? `: ${errorMsg}` : ''}
        </div>
      )}

      {/* 更新弹窗 */}
      {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'installing') && latestUpdate && (
        <UpdateDialog
          version={latestUpdate.version}
          notes={latestUpdate.body}
          status={updateStatus}
          progress={downloadProgress}
          onDownload={handleDownloadAndInstall}
          onClose={() => { setUpdateStatus('idle'); setLatestUpdate(null); }}
        />
      )}
    </div>
  );
};

/** 更新弹窗：显示新版本信息、下载进度、重启按钮 */
const UpdateDialog: React.FC<{
  version: string;
  notes?: string | null;
  status: 'available' | 'downloading' | 'installing';
  progress: number;
  onDownload: () => void;
  onClose: () => void;
}> = ({ version, notes, status, progress, onDownload, onClose }) => {
  const { t } = useI18n();

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'var(--tx-bg-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      animation: 'tx-fade-in 0.15s',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 400, maxHeight: 360, overflowY: 'auto',
        background: 'var(--tx-bg-elevated)', border: '1px solid var(--tx-border-light)',
        borderRadius: 'var(--tx-radius-lg)', boxShadow: 'var(--tx-shadow-lg)',
        animation: 'tx-scale-in 0.15s',
      }}>
        <div style={{ padding: '16px 20px 0', fontSize: 14, fontWeight: 600, color: 'var(--tx-text-primary)' }}>
          {t('about.updateAvailable')}
        </div>
        <div style={{ padding: '8px 20px 0', fontSize: 12, color: 'var(--tx-text-secondary)' }}>
          {t('about.updateVersion', { version })}
        </div>
        {notes && (
          <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--tx-text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {notes}
          </div>
        )}
        {status === 'downloading' && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--tx-bg-hover)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--tx-accent-default)', borderRadius: 2, transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx-text-tertiary)', marginTop: 4, textAlign: 'center' }}>
              {t('about.updateDownloading')} {progress}%
            </div>
          </div>
        )}
        {status === 'installing' && (
          <div style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--tx-text-secondary)', textAlign: 'center' }}>
            {t('about.updateRestart')}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 16px 12px', borderTop: '1px solid var(--tx-border-light)' }}>
          <button onClick={onClose}
            style={{
              padding: '6px 14px', borderRadius: 'var(--tx-radius-md)', border: '1px solid var(--tx-border-light)',
              background: 'var(--tx-bg-surface)', color: 'var(--tx-text-primary)', cursor: 'pointer', fontSize: 12,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--tx-bg-surface)'; }}
          >{t('about.updateLater')}</button>
          {status === 'available' && (
            <button onClick={onDownload}
              style={{
                padding: '6px 14px', borderRadius: 'var(--tx-radius-md)', border: 'none',
                background: 'var(--tx-accent-default)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tx-accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--tx-accent-default)'; }}
            >{t('about.updateDownload')}</button>
          )}
        </div>
      </div>
    </div>
  );
};
