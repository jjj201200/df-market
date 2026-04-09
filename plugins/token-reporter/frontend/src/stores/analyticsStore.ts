import {create} from 'zustand';

export type AnalyticsTab = 'overview' | 'cache' | 'tools' | 'context' | 'subagents' | 'timing';

interface AnalyticsStore {
  drawerOpen: boolean;
  activeTab: AnalyticsTab;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  setActiveTab: (t: AnalyticsTab) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  drawerOpen: false,
  activeTab: 'overview',
  toggleDrawer: () => set((s) => ({drawerOpen: !s.drawerOpen})),
  closeDrawer: () => set({drawerOpen: false}),
  setActiveTab: (activeTab) => set({activeTab}),
}));
