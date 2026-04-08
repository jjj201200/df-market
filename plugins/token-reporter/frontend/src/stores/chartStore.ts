import {create} from 'zustand';
import type {BarRect, Dims} from '../types/state';

interface ChartStore {
  brushL: number;
  brushR: number;
  hoveredId: number | null;
  dims: Dims;
  barRects: BarRect[];
  resizeTick: number;
  setBrush: (l: number, r: number) => void;
  setHovered: (id: number | null) => void;
  toggleDim: (key: keyof Dims) => void;
  setBarRects: (rects: BarRect[]) => void;
  initBrushForTurnCount: (n: number) => void;
  triggerResize: () => void;
}

export const useChartStore = create<ChartStore>((set) => ({
  brushL: 0,
  brushR: 1,
  hoveredId: null,
  dims: {input: true, output: true, cacheR: true, cacheC: true},
  barRects: [],
  resizeTick: 0,

  setBrush: (l, r) => set({brushL: l, brushR: r}),

  setHovered: (id) => set({hoveredId: id}),

  toggleDim: (key) => set((s) => ({dims: {...s.dims, [key]: !s.dims[key]}})),

  setBarRects: (rects) => set({barRects: rects}),

  triggerResize: () => set((s) => ({resizeTick: s.resizeTick + 1})),

  initBrushForTurnCount: (n) => {
    if (n <= 0) {
      set({brushL: 0, brushR: 1});
      return;
    }
    const initSpan = Math.min(0.25, 20 / n);
    set({brushL: Math.max(0, 1 - initSpan), brushR: 1});
  },
}));
