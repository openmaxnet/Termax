/**
 * 会话元数据状态管理
 * 目前作为预留结构，终端连接状态实际由 terminalStore 管理
 */
import { create } from 'zustand';

/** 会话元数据 */
export interface Session {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  connected: boolean;
}

/** 会话状态结构 */
interface SessionState {
  sessions: Map<string, Session>;
  activeId: string | null;
  setActive: (id: string | null) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setConnected: (id: string, connected: boolean) => void;
}

/**
 * 会话元数据 Store（预留）
 * 管理已有 SSH 会话的元信息，目前为后续功能预留
 */
export const useSessionStore = create<SessionState>((set) => ({
  sessions: new Map(),
  activeId: null,
  setActive: (id) => set({ activeId: id }),
  addSession: (session) =>
    set((state) => {
      const next = new Map(state.sessions);
      next.set(session.id, session);
      return { sessions: next };
    }),
  removeSession: (id) =>
    set((state) => {
      const next = new Map(state.sessions);
      next.delete(id);
      return { sessions: next, activeId: state.activeId === id ? null : state.activeId };
    }),
  setConnected: (id, connected) =>
    set((state) => {
      const session = state.sessions.get(id);
      if (!session) return state;
      const next = new Map(state.sessions);
      next.set(id, { ...session, connected });
      return { sessions: next };
    }),
}));
