import {create} from 'zustand';

interface UIStore {
  expandedToolGroups: Set<string>;
  expandedToolDetails: Set<string>;
  expandedThinking: Set<string>;
  expandedTexts: Set<string>;
  toggleToolGroup: (id: string) => void;
  toggleToolDetail: (id: string) => void;
  toggleThinking: (id: string) => void;
  toggleText: (id: string) => void;
  resetAll: () => void;
}

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const useUIStore = create<UIStore>((set) => ({
  expandedToolGroups: new Set(),
  expandedToolDetails: new Set(),
  expandedThinking: new Set(),
  expandedTexts: new Set(),

  toggleToolGroup: (id) => set((s) => ({expandedToolGroups: toggleInSet(s.expandedToolGroups, id)})),

  toggleToolDetail: (id) => set((s) => ({expandedToolDetails: toggleInSet(s.expandedToolDetails, id)})),

  toggleThinking: (id) => set((s) => ({expandedThinking: toggleInSet(s.expandedThinking, id)})),

  toggleText: (id) => set((s) => ({expandedTexts: toggleInSet(s.expandedTexts, id)})),

  resetAll: () =>
    set({
      expandedToolGroups: new Set(),
      expandedToolDetails: new Set(),
      expandedThinking: new Set(),
      expandedTexts: new Set(),
    }),
}));
