import {create} from 'zustand';
import type {SessionListItem} from '../types/api';
import type {DataItem, TurnItem, SubagentStats} from '../types/state';
import {getSessions, getSession, getLimits} from '../services/api';
import {adaptSession, extractTurns} from '../services/adapter';
import {useChartStore} from './chartStore';
import {useLimitsStore} from './limitsStore';

const LAST_SESSION_KEY = 'token-reporter:last-session';

interface SessionStore {
  sessions: SessionListItem[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  activeSessionId: string | null;
  data: DataItem[];
  turns: TurnItem[];
  subagents: Record<string, SubagentStats>;
  sessionLoading: boolean;
  sessionError: string | null;
  fetchSessions: () => Promise<void>;
  loadSession: (id: string, opts?: {preserveScroll?: boolean}) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  newSessionIds: Set<string>;
  addNewSessionId: (id: string) => void;
  clearNewSessionId: (id: string) => void;
  fetchSessionsQuietly: () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  activeSessionId: null,
  data: [],
  turns: [],
  subagents: {},
  sessionLoading: false,
  sessionError: null,
  newSessionIds: new Set<string>(),

  fetchSessions: async () => {
    set({sessionsLoading: true, sessionsError: null});
    try {
      const list = await getSessions();
      set({sessions: list, sessionsLoading: false});

      if (list.length > 0) {
        const lastSession = localStorage.getItem(LAST_SESSION_KEY);
        const sessionToLoad =
          lastSession && list.some((s) => s.sessionId === lastSession) ? lastSession : list[0]!.sessionId;
        await get().loadSession(sessionToLoad);
      } else {
        set({sessionsLoading: false});
      }
    } catch (e) {
      set({
        sessionsLoading: false,
        sessionsError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  loadSession: async (sessionId, opts) => {
    const preserveScroll = opts?.preserveScroll ?? false;
    if (!preserveScroll) {
      set({sessionLoading: true, sessionError: null});
    }

    try {
      const [sessionData, limitsData] = await Promise.all([getSession(sessionId), getLimits(sessionId)]);

      if (limitsData) {
        useLimitsStore.getState().setLimits(sessionId, limitsData);
      }

      const adapted = adaptSession(sessionData);
      const turns = extractTurns(adapted.items);

      set({
        activeSessionId: sessionId,
        data: adapted.items,
        turns,
        subagents: adapted.subagents,
        sessionLoading: false,
        sessionError: null,
      });

      localStorage.setItem(LAST_SESSION_KEY, sessionId);
      get().clearNewSessionId(sessionId);

      // Always keep turnCount in sync for brush snapping
      useChartStore.getState().setTurnCount(turns.length);

      if (!preserveScroll) {
        useChartStore.getState().initBrushForTurnCount(turns.length);

        // Scroll to the newest turn (matches brush starting at right end)
        if (turns.length > 0) {
          const lastTurn = turns[turns.length - 1]!;
          requestAnimationFrame(() => {
            const el = document.getElementById('turn-' + lastTurn.id);
            if (el) {
              el.scrollIntoView({behavior: 'instant', block: 'start'});
            }
          });
        }
      }
    } catch (e) {
      if (!preserveScroll) {
        set({
          sessionLoading: false,
          sessionError: e instanceof Error ? e.message : String(e),
        });
      }
      console.error('Failed to load session', e);
    }
  },

  refreshCurrentSession: async () => {
    const {activeSessionId} = get();
    if (activeSessionId) {
      await get().loadSession(activeSessionId, {preserveScroll: true});
    }
  },

  addNewSessionId: (id) => {
    if (!id) return;
    set((s) => ({ newSessionIds: new Set([...s.newSessionIds, id]) }));
  },

  clearNewSessionId: (id) => {
    set((s) => {
      const next = new Set(s.newSessionIds);
      next.delete(id);
      return { newSessionIds: next };
    });
  },

  fetchSessionsQuietly: async () => {
    try {
      const list = await getSessions();
      set({ sessions: list });
    } catch {
      // Silent failure — don't disrupt the current session view
    }
  },
}));
