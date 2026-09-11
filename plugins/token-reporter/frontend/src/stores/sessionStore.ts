import {create} from 'zustand';
import type {SessionListItem, ApiHookEvent} from '../types/api';
import type {DataItem, TurnItem, SubagentStats} from '../types/state';
import {getSessions, getSession, getLimits} from '../services/api';
import {adaptSession, extractTurns} from '../services/adapter';
import {scrollToTurnById} from '../utils/scroll';
import {useChartStore} from './chartStore';
import {useLimitsStore} from './limitsStore';

const LAST_SESSION_KEY = 'token-reporter:last-session';

/**
 * Hard cap on how many (most recent) turns the charts and the scroll<->brush
 * sync operate on. Without it a multi-thousand-turn session makes every chart
 * interaction and every scroll event O(N) and the page freezes. The list is
 * NOT truncated — only the chart coordinate system is.
 */
export const MAX_CHART_TURNS = 750;

/**
 * Sessions at or below this turn count load fully into the chart space — a
 * slight overflow is not worth windowing. Above it, the chart starts on the
 * most recent MAX_CHART_TURNS turns and a full-range bar lets the user move
 * the window anywhere.
 */
export const FULL_RANGE_THRESHOLD = 1250;

interface SessionStore {
  sessions: SessionListItem[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  activeSessionId: string | null;
  data: DataItem[];
  turns: TurnItem[];
  /**
   * Turns visible to the charts: the full array, or the slice defined by
   * chartWindow when the session exceeds FULL_RANGE_THRESHOLD.
   */
  chartTurns: TurnItem[];
  /** Window into the FULL turn list (indices, end-exclusive). null = full range */
  chartWindow: {start: number; end: number} | null;
  /** data[] index of every turn (full, untruncated), aligned with turns[] */
  turnDataIdx: number[];
  subagents: Record<string, SubagentStats>;
  hooks: ApiHookEvent[];
  stopReasons: Record<string, number>;
  cacheTtl: {ephemeral1h: number; ephemeral5m: number};
  sessionLoading: boolean;
  sessionError: string | null;
  /** session currently being fetched (activeSessionId still points at the old one) */
  loadingSessionId: string | null;
  /** parse progress 0-99 while loading (null = unknown), 100 on completion */
  loadProgress: number | null;
  fetchSessions: () => Promise<void>;
  loadSession: (id: string, opts?: {preserveScroll?: boolean}) => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  /** Move the chart window over the full turn list (full-turn indices). */
  setChartWindow: (start: number, end: number) => void;
  /** Apply an SSE-pushed parse progress event for the loading session */
  applyParseProgress: (sessionId: string, bytes: number, total: number, done: boolean) => void;
  newSessionIds: Set<string>;
  addNewSessionId: (id: string) => void;
  clearNewSessionId: (id: string) => void;
  fetchSessionsQuietly: () => Promise<void>;
}

/** Map a chartTurns[] index to its index in data[] (null when out of range) */
export function chartTurnIdxToDataIdx(chartIdx: number): number | null {
  const {turnDataIdx, chartWindow} = useSessionStore.getState();
  const skip = chartWindow?.start ?? 0;
  return turnDataIdx[chartIdx + skip] ?? null;
}

/** Map a data[] index to its full turn number (null when not a turn) */
export function dataIdxToTurnNo(dataIdx: number): number | null {
  const {turnDataIdx} = useSessionStore.getState();
  let lo = 0;
  let hi = turnDataIdx.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = turnDataIdx[mid]!;
    if (v === dataIdx) return mid;
    if (v < dataIdx) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

/** Map a data[] index to its chartTurns[] index (null when outside the window) */
export function dataIdxToChartTurnIdx(dataIdx: number): number | null {
  const {chartWindow} = useSessionStore.getState();
  const turnNo = dataIdxToTurnNo(dataIdx);
  if (turnNo == null) return null;
  if (!chartWindow) return turnNo;
  return turnNo >= chartWindow.start && turnNo < chartWindow.end ? turnNo - chartWindow.start : null;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  activeSessionId: null,
  data: [],
  turns: [],
  chartTurns: [],
  chartWindow: null,
  turnDataIdx: [],
  subagents: {},
  hooks: [],
  stopReasons: {},
  cacheTtl: {ephemeral1h: 0, ephemeral5m: 0},
  sessionLoading: false,
  sessionError: null,
  loadingSessionId: null,
  loadProgress: null,
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
      set({sessionLoading: true, sessionError: null, loadingSessionId: sessionId, loadProgress: null});
    }

    try {
      const [sessionData, limitsData] = await Promise.all([getSession(sessionId), getLimits(sessionId)]);

      // Generation guard: if the user already switched to another session
      // while this one was loading, drop the stale result — it must not
      // overwrite the newer session's data. (Silent refreshes keep the
      // current session by definition, so they always pass.)
      if (!preserveScroll && get().loadingSessionId !== sessionId) return;

      if (limitsData) {
        useLimitsStore.getState().setLimits(sessionId, limitsData);
      }

      const adapted = adaptSession(sessionData);
      const turns = extractTurns(adapted.items);
      const turnDataIdx: number[] = [];
      adapted.items.forEach((item, i) => {
        if (item.type === 'turn') turnDataIdx.push(i);
      });
      // Chart window: full range up to FULL_RANGE_THRESHOLD, otherwise the
      // most recent MAX_CHART_TURNS turns. A silent refresh (preserveScroll)
      // keeps the window the user has moved.
      let chartWindow: {start: number; end: number} | null;
      if (turns.length > FULL_RANGE_THRESHOLD) {
        const prevWindow = preserveScroll ? get().chartWindow : null;
        if (prevWindow && prevWindow.end <= turns.length) {
          // A window pinned to the tail follows the session as it grows
          const wasPinnedToEnd = prevWindow.end === get().turns.length;
          chartWindow = wasPinnedToEnd
            ? {start: Math.max(0, turns.length - (prevWindow.end - prevWindow.start)), end: turns.length}
            : prevWindow;
        } else {
          chartWindow = {start: Math.max(0, turns.length - MAX_CHART_TURNS), end: turns.length};
        }
      } else {
        chartWindow = null;
      }
      const chartTurns = chartWindow ? turns.slice(chartWindow.start, chartWindow.end) : turns;

      set({
        activeSessionId: sessionId,
        data: adapted.items,
        turns,
        chartTurns,
        chartWindow,
        turnDataIdx,
        subagents: adapted.subagents,
        hooks: adapted.hooks,
        stopReasons: adapted.stopReasons,
        cacheTtl: adapted.cacheTtl,
        sessionLoading: false,
        sessionError: null,
        loadingSessionId: null,
        loadProgress: null,
      });

      localStorage.setItem(LAST_SESSION_KEY, sessionId);
      get().clearNewSessionId(sessionId);

      // Always keep turnCount in sync for brush snapping (chart space only)
      useChartStore.getState().setTurnCount(chartTurns.length);

      if (!preserveScroll) {
        useChartStore.getState().initBrushForTurnCount(chartTurns.length);

        // Scroll to the newest turn (matches brush starting at right end).
        // rAF lets the virtualized list mount before we ask it to scroll.
        if (turns.length > 0) {
          const lastTurn = turns[turns.length - 1]!;
          requestAnimationFrame(() => scrollToTurnById(lastTurn.id));
        }
      }
    } catch (e) {
      if (!preserveScroll && get().loadingSessionId === sessionId) {
        set({
          sessionLoading: false,
          sessionError: e instanceof Error ? e.message : String(e),
          loadingSessionId: null,
          loadProgress: null,
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

  /** SSE 'parse-progress' handler — pushed by the server while parsing */
  applyParseProgress: (sessionId, bytes, total, done) => {
    // Only the session currently being loading shows progress
    if (get().loadingSessionId !== sessionId) return;
    if (done) {
      set({loadProgress: 100});
    } else if (total > 0) {
      set({loadProgress: Math.min(99, Math.floor((bytes / total) * 100))});
    }
  },

  setChartWindow: (start, end) => {
    const {turns} = get();
    if (turns.length <= FULL_RANGE_THRESHOLD) return;
    const s = Math.max(0, Math.min(Math.round(start), turns.length - 1));
    const e = Math.max(s + 1, Math.min(Math.round(end), turns.length));
    const prev = get().chartWindow;
    if (prev && prev.start === s && prev.end === e) return;
    const chartTurns = turns.slice(s, e);
    set({chartWindow: {start: s, end: e}, chartTurns});
    // The window moved: the in-window viewport indicator's coordinates are
    // stale (old window origin) and would render off-canvas. Hide it until
    // the next updateViewRange (RangeBar realigns the list on mouseup).
    // viewFullLo/Hi are window-independent and stay.
    useChartStore.setState({viewLoIdx: -1, viewHiIdx: -1});
    // turnCount must track the window (brush snapping), but the brush itself
    // is NOT reset here — resetting on every drag tick restarts the bar
    // animation continuously. The caller (RangeBar) resets it on mouseup.
    useChartStore.getState().setTurnCount(chartTurns.length);
  },

  addNewSessionId: (id) => {
    if (!id) return;
    set((s) => ({newSessionIds: new Set([...s.newSessionIds, id])}));
  },

  clearNewSessionId: (id) => {
    set((s) => {
      const next = new Set(s.newSessionIds);
      next.delete(id);
      return {newSessionIds: next};
    });
  },

  fetchSessionsQuietly: async () => {
    try {
      const list = await getSessions();
      set({sessions: list});
    } catch {
      // Silent failure — don't disrupt the current session view
    }
  },
}));
