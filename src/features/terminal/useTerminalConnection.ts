import { useEffect } from 'react';
import { Terminal as XtermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ipc, events } from '@/lib/ipc';
import { getMessage } from '@/i18n';
import { useTerminalStore } from '@/stores/terminalStore';

/**
 * 终端连接 Hook 参数
 */
export interface UseTerminalConnectionParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  termRef: React.MutableRefObject<XtermTerminal | null>;
  fitRef: React.MutableRefObject<FitAddon | null>;
  searchRef: React.MutableRefObject<SearchAddon | null>;
  reconnectRef: React.MutableRefObject<(() => void) | null>;
  tabId: string;
  tabType: 'ssh' | 'local' | 'wsl' | 'transfer';
  config: { username?: string; host?: string; port?: number } | null;
  shellPath?: string;
  setConnected: (tabId: string, connected: boolean) => void;
  setSessionId: (tabId: string, sessionId: string) => void;
  removeTab: (id: string) => void;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  terminalSettings: {
    cursorBlink: boolean;
    cursorStyle: 'block' | 'underline' | 'bar';
    fontSize: number;
    fontFamily: string;
    scrollbackLines: number;
    enableWebLinks: boolean;
  };
  colors: Record<string, string>;
}

/**
 * 终端连接生命周期管理
 * 初始化 xterm.js 实例，建立 SSH/本地连接，监听输出事件和用户输入转发
 */
export function useTerminalConnection(params: UseTerminalConnectionParams) {
  const {
    containerRef, termRef, fitRef, searchRef, reconnectRef,
    tabId, tabType, config, shellPath,
    setConnected, setSessionId, removeTab, setShowSearch,
    terminalSettings, colors,
  } = params;

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const { cursorBlink, cursorStyle, fontSize, fontFamily, scrollbackLines, enableWebLinks } = terminalSettings;

    const term = new XtermTerminal({
      cursorBlink, cursorStyle, fontSize, fontFamily, scrollback: scrollbackLines,
      windowsPty: {
        backend: 'conpty',
        buildNumber: parseInt(navigator.userAgent.match(/Windows NT (\d+)/)?.[1] ?? '10') >= 10 ? 22000 : 19041,
      },
      theme: {
        background: colors.background,
        foreground: colors.foreground,
        cursor: colors.cursor,
        selectionBackground: colors.selectionBackground,
        black: colors.black, red: colors.red, green: colors.green, yellow: colors.yellow,
        blue: colors.blue, magenta: colors.magenta, cyan: colors.cyan, white: colors.white,
        brightBlack: colors.brightBlack, brightRed: colors.brightRed, brightGreen: colors.brightGreen,
        brightYellow: colors.brightYellow, brightBlue: colors.brightBlue, brightMagenta: colors.brightMagenta,
        brightCyan: colors.brightCyan, brightWhite: colors.brightWhite,
      },
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    const webLinksAddon = enableWebLinks ? new WebLinksAddon() : null;
    if (webLinksAddon) term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    // 跟踪 IME 输入状态，避免在输入法激活时调整终端大小
    let isComposing = false;
    const textarea = containerRef.current.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.addEventListener('compositionstart', () => { isComposing = true; });
      textarea.addEventListener('compositionend', () => { isComposing = false; });
    }

    const observer = new ResizeObserver(() => { if (!isComposing) fitAddon.fit(); });
    observer.observe(containerRef.current);

    // ── 连接状态 ──
    let currentSessionId: string | null = null;
    let unlistenOutput: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;
    let unlistenReady: (() => void) | null = null;
    let sessionDisposed = false;
    let connectedShown = false;
    let disposed = false;

    const isLocal = tabType === 'local' || tabType === 'wsl';
    const sendFn = isLocal ? ipc.local.sendInput : ipc.ssh.sendInput;
    const resizeFn = isLocal ? ipc.local.resize : ipc.ssh.resize;

    const connectBackend = () => {
      if (tabType === 'local') return ipc.local.connect(shellPath || 'powershell.exe');
      if (tabType === 'wsl') return ipc.local.connectWsl(shellPath || '');
      if (config) return ipc.ssh.connect(config as any);
      return Promise.reject('No config');
    };

    // 发起连接：显示"正在连接..."提示，连接成功后监听输出事件
    const startConnecting = (isReconnect?: boolean) => {
      sessionDisposed = false;
      if (isReconnect) term.reset();

      term.write(`\r\x1b[K\x1b[0m${getMessage('terminal.connecting', {
        username: config?.username || 'local',
        host: config?.host || 'shell',
        port: String(config?.port ?? ''),
      })}\x1b[0m`);

      connectBackend()
        .then(async (sid) => {
          if (disposed) {
            (isLocal ? ipc.local.disconnect(sid) : ipc.ssh.disconnect(sid)).catch(() => {});
            return;
          }
          currentSessionId = sid;
          setSessionId(tabId, sid);

          // 清除连接行，等待首次输出以确认连接
          term.write(`\r\x1b[K`);

          const unsubOutput = await events.onTermOutput(({ sessionId: s, data: bytes }) => {
            if (s !== currentSessionId || disposed) return;
            if (!connectedShown) { setConnected(tabId, true); connectedShown = true; }
            term.write(new Uint8Array(bytes));
          });
          if (disposed) { unsubOutput(); return; }
          unlistenOutput = unsubOutput;

          const unsubReady = await events.onSessionReady(({ sessionId: s }) => {
            if (s !== currentSessionId || disposed || connectedShown) return;
            setConnected(tabId, true);
            connectedShown = true;
          });
          if (disposed) { unsubReady(); return; }
          unlistenReady = unsubReady;

          const unsubError = await events.onSessionError(({ sessionId: s, error }) => {
            if (s !== currentSessionId || disposed) return;
            setConnected(tabId, false);
            sessionDisposed = true;
            term.write(`\r\n\x1b[31m${getMessage('terminal.connectionLost', { reason: error })}\x1b[0m\r\n`);
          });
          if (disposed) { unsubError(); return; }
          unlistenError = unsubError;

          const dims = fitAddon.proposeDimensions();
          if (dims) resizeFn(sid, dims.cols, dims.rows).catch(() => {});
          term.focus();
        })
        .catch((err) => {
          if (disposed) return;
          term.write(`\r\x1b[K\x1b[31m${getMessage('terminal.connectionFailed', { error: String(err) })}\x1b[0m\r\n`);
          sessionDisposed = true;
        });
    };

    // 重连清理：取消旧的事件订阅，断开旧连接，重新发起连接
    const doReconnect = () => {
      if (unlistenOutput) { unlistenOutput(); unlistenOutput = null; }
      if (unlistenError) { unlistenError(); unlistenError = null; }
      if (unlistenReady) { unlistenReady(); unlistenReady = null; }
      if (currentSessionId) {
        (isLocal ? ipc.local.disconnect(currentSessionId) : ipc.ssh.disconnect(currentSessionId)).catch(() => {});
        currentSessionId = null;
        setConnected(tabId, false);
      }
      startConnecting(true);
    };
    reconnectRef.current = doReconnect;

    startConnecting();

    // ── 用户输入 → 后端 ──
    term.onData((data) => {
      if (!disposed && !sessionDisposed && currentSessionId) {
        const encoder = new TextEncoder();
        const encoded = Array.from(encoder.encode(data));
        sendFn(currentSessionId, encoded).catch(() => {
          setConnected(tabId, false);
          sessionDisposed = true;
          term.write(`\r\n\x1b[31m${getMessage('terminal.connectionLost', { reason: 'connection interrupted' })}\x1b[0m\r\n`);
        });

        // 广播到其他选中的 Tab
        const { broadcastActive, broadcastTargets, tabs } = useTerminalStore.getState();
        if (broadcastActive && broadcastTargets.size > 0) {
          for (const tab of tabs) {
            if (tab.id === tabId) continue;
            if (!broadcastTargets.has(tab.id)) continue;
            if (!tab.sessionId || !tab.connected) continue;
            const fn = (tab.type === 'local' || tab.type === 'wsl') ? ipc.local.sendInput : ipc.ssh.sendInput;
            fn(tab.sessionId, encoded).catch(() => {});
          }
        }
      }
    });

    // ── 快捷键 ──
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F' && e.type === 'keydown') {
        setShowSearch((s) => !s);
        return false;
      }
      if (sessionDisposed && e.type === 'keydown') {
        if (e.key === 'Enter') { startConnecting(true); return false; }
        if (e.key === 'Escape') { removeTab(tabId); return false; }
      }
      return true;
    });

    termRef.current = term;
    fitRef.current = fitAddon;
    searchRef.current = searchAddon;

    // ── 清理 ──
    return () => {
      disposed = true;
      observer.disconnect();
      if (unlistenOutput) unlistenOutput();
      if (unlistenError) unlistenError();
      if (unlistenReady) unlistenReady();
      if (currentSessionId) {
        (isLocal ? ipc.local.disconnect(currentSessionId) : ipc.ssh.disconnect(currentSessionId)).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
