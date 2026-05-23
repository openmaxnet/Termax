/**
 * 主内容区域
 * 根据标签类型路由到终端/传输/空状态，支持分屏模式下的左右面板分发
 * transfer 类型标签页不参与分屏，渲染 SftpWorkspace 替代 TerminalTab
 */
import React, { Suspense, lazy } from 'react';
import { TerminalTab } from '@/features/terminal/TerminalTab';
import { Splash } from '@/app/Splash';
import { SplitPane } from '@/ui/TSplitPane';
import type { ConnectionConfig } from '@/lib/ipc';
import type { TabInfo } from '@/stores/terminalStore';

const SftpWorkspace = lazy(() => import('@/features/sftp/SftpWorkspace').then((m) => ({ default: m.SftpWorkspace })));

/** 分屏状态：方向 + 左右面板的标签页 ID */
interface SplitState { direction: 'horizontal' | 'vertical'; leftTabId: string; rightTabId: string; }

/** 分屏面板包装器 — 无边框，与非分屏视图保持一致的样式 */
const PaneBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>{children}</div>
);

interface MainAreaProps {
  tabs: TabInfo[];
  split: SplitState | null;
  activeTabId: string | null;
  setActive: (id: string) => void;
  closeSplit: (remaining?: 'left' | 'right') => void;
  onConnect: (data: ConnectionConfig) => void;
  onSftpConnect: (config: ConnectionConfig) => void;
}

export const MainArea: React.FC<MainAreaProps> = ({
  tabs, split, activeTabId, setActive, closeSplit, onConnect: _onConnect, onSftpConnect,
}) => {
  if (tabs.length === 0) return <Splash />;

  const activeTabData = tabs.find(t => t.id === activeTabId);

  // transfer 标签页激活时不显示分屏
  if (split && activeTabData?.type !== 'transfer'
      && tabs.some(t => t.id === split.leftTabId)
      && tabs.some(t => t.id === split.rightTabId)) {
    return (
      <SplitPane direction={split.direction} onCloseSplit={closeSplit}>
        <PaneBox>
          {tabs.filter(t => t.id === split.leftTabId).map(t => (
            <div key={t.id} style={{ width: '100%', height: '100%' }} onMouseDown={() => setActive(t.id)}>
              <TerminalTab tabId={t.id} tabType={t.type} config={t.config} focused={activeTabId === t.id} visible shellPath={t.shellPath} onSftpConnect={onSftpConnect} />
            </div>
          ))}
        </PaneBox>
        <PaneBox>
          {tabs.filter(t => t.id === split.rightTabId).map(t => (
            <div key={t.id} style={{ width: '100%', height: '100%' }} onMouseDown={() => setActive(t.id)}>
              <TerminalTab tabId={t.id} tabType={t.type} config={t.config} focused={activeTabId === t.id} visible shellPath={t.shellPath} onSftpConnect={onSftpConnect} />
            </div>
          ))}
        </PaneBox>
      </SplitPane>
    );
  }

  return <>{tabs.map(tab => {
    // transfer 标签页渲染 SftpWorkspace
    if (tab.type === 'transfer') {
      return (
        <div key={tab.id} style={{ width: '100%', height: '100%', display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column' }}>
          <Suspense fallback={null}>
            <SftpWorkspace visible={tab.id === activeTabId} mode="tab" />
          </Suspense>
        </div>
      );
    }
    return <TerminalTab key={tab.id} tabId={tab.id} tabType={tab.type} config={tab.config} visible={tab.id === activeTabId} shellPath={tab.shellPath} onSftpConnect={onSftpConnect} />;
  })}</>;
};
