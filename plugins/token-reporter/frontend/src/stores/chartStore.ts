import {create} from 'zustand';
import type {BarRect, Dims} from '../types/state';
import {snapBrushRange} from '../utils/brushCoords';

interface ChartStore {
  brushL: number;
  brushR: number;
  turnCount: number;
  hoveredId: number | null;
  dims: Dims;
  barRects: BarRect[];
  resizeTick: number;
  viewLoIdx: number;
  viewHiIdx: number;
  viewLoPct: number;
  viewHiPct: number;
  setBrush: (l: number, r: number) => void;
  setTurnCount: (n: number) => void;
  setHovered: (id: number | null) => void;
  toggleDim: (key: keyof Dims) => void;
  setBarRects: (rects: BarRect[]) => void;
  setViewRange: (lo: number, hi: number, loPct?: number, hiPct?: number) => void;
  initBrushForTurnCount: (n: number, viewportTurnCount?: number) => void;
  triggerResize: () => void;
}

export const useChartStore = create<ChartStore>((set) => ({
  brushL: 0,
  brushR: 1,
  turnCount: 0,
  hoveredId: null,
  dims: {input: true, output: true, cacheR: true, cacheC: true},
  barRects: [],
  resizeTick: 0,
  viewLoIdx: -1,
  viewHiIdx: -1,
  viewLoPct: 0,
  viewHiPct: 1,

  setBrush: (l, r) => {
    const N = useChartStore.getState().turnCount;
    if (N > 1) {
      const [sl, sr] = snapBrushRange(l, r, N);
      set({brushL: sl, brushR: sr});
    } else {
      set({brushL: l, brushR: r});
    }
  },

  setTurnCount: (n) => set({turnCount: n}),

  setHovered: (id) => set({hoveredId: id}),

  toggleDim: (key) => set((s) => ({dims: {...s.dims, [key]: !s.dims[key]}})),

  setBarRects: (rects) => set({barRects: rects}),

  setViewRange: (lo, hi, loPct, hiPct) => set({
    viewLoIdx: lo,
    viewHiIdx: hi,
    viewLoPct: loPct ?? lo / 100,
    viewHiPct: hiPct ?? hi / 100,
  }),

  triggerResize: () => set((s) => ({resizeTick: s.resizeTick + 1})),

  initBrushForTurnCount: (n: number, viewportTurnCount?: number) => {
    if (n <= 0) {
      set({brushL: 0, brushR: 1, turnCount: 0});
      return;
    }
    const vtc = viewportTurnCount ?? 20;
    const initSpan = Math.min(0.25, vtc / n);
    const rawL = Math.max(0, 1 - initSpan);
    const [sl, sr] = snapBrushRange(rawL, 1, n);
    set({brushL: sl, brushR: sr, turnCount: n});
  },
}));
