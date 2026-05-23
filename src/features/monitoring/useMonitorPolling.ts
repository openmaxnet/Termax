import { useState, useEffect, useRef, useCallback } from 'react';
import { ipc } from '@/lib/ipc';
import type { ConnectionConfig, SystemInfo } from '@/lib/ipc';

/**
 * SSH 标签页激活时自动轮询系统监控数据
 */
export function useMonitorPolling(
  activeTabId: string | null,
  isSshActive: boolean,
  config: ConnectionConfig | null | undefined,
  intervalMs: number,
) {
  const [data, setData] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!config || !isSshActive) return;

    const FETCH_TIMEOUT = 3000;
    let cancelled = false;

    const fetch = async () => {
      if (cancelled) return;
      const timeoutId = setTimeout(() => {
        if (!cancelled) setError(null);
      }, FETCH_TIMEOUT);
      try {
        const result = await ipc.monitor.fetch(config);
        if (!cancelled) { clearTimeout(timeoutId); setData(result); setError(null); }
      } catch (e) {
        if (!cancelled) { clearTimeout(timeoutId); setError(String(e)); }
      }
    };
    fetchRef.current = fetch;
    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeTabId, intervalMs, isSshActive]);

  const refresh = useCallback(() => { fetchRef.current?.(); }, []);

  return { data, error, refresh };
}
