import {create} from 'zustand';

export type AnalyticsView = 'session' | 'analytics';
export type AnalyticsTab = 'overview' | 'cache' | 'tools' | 'context' | 'subagents';

interface AnalyticsStore {
  activeView: AnalyticsView;
  activeTab: AnalyticsTab;
  setActiveView: (v: AnalyticsView) => void;
  setActiveTab: (t: AnalyticsTab) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  activeView: 'session',
  activeTab: 'overview',
  setActiveView: (activeView) => set({activeView}),
  setActiveTab: (activeTab) => set({activeTab}),
}));
