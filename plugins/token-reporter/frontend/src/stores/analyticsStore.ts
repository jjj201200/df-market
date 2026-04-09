import {create} from 'zustand';

export type AnalyticsTab = 'overview' | 'cache' | 'tools' | 'context' | 'subagents' | 'timing';

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
  splitView: false,
  activeTab: 'overview',
  toggleDrawer: () => set((s) => ({drawerOpen: !s.drawerOpen})),
  closeDrawer: () => set({drawerOpen: false, splitView: false}),
  toggleSplitView: () =>
    set((s) => ({splitView: !s.splitView, drawerOpen: !s.splitView ? true : s.drawerOpen})),
  setActiveTab: (activeTab) => set({activeTab}),
}));
