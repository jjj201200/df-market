import {create} from 'zustand';

export type AnalyticsTab = 'overview' | 'cache' | 'tools' | 'context' | 'subagents' | 'timing';

const SPLIT_VIEW_KEY = 'token-reporter:analytics-split-view';
const SPLIT_WIDTH_KEY = 'token-reporter:split-width';

function getInitialSplitView(): boolean {
  try {
    return localStorage.getItem(SPLIT_VIEW_KEY) === 'true';
  } catch {
    return false;
  }
}

export function getInitialSplitWidth(): number {
  try {
    const raw = localStorage.getItem(SPLIT_WIDTH_KEY);
    if (raw) return parseInt(raw, 10);
  } catch {}
  return Math.round(window.innerWidth * 0.6);
}

export function persistSplitWidth(width: number): void {
  try {
    localStorage.setItem(SPLIT_WIDTH_KEY, String(width));
  } catch {}
}

interface AnalyticsStore {
  drawerOpen: boolean;
  splitView: boolean;
  activeTab: AnalyticsTab;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  toggleSplitView: () => void;
  setActiveTab: (t: AnalyticsTab) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  drawerOpen: false,
  splitView: getInitialSplitView(),
  activeTab: 'overview',
  toggleDrawer: () => set((s) => ({drawerOpen: !s.drawerOpen})),
  closeDrawer: () => set({drawerOpen: false, splitView: false}),
  toggleSplitView: () =>
    set((s) => {
      const next = !s.splitView;
      try {
        localStorage.setItem(SPLIT_VIEW_KEY, String(next));
      } catch {}
      return {splitView: next, drawerOpen: !next ? true : s.drawerOpen};
    }),
  setActiveTab: (activeTab) => set({activeTab}),
}));
