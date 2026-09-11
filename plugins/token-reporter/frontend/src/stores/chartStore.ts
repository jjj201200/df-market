import {create} from 'zustand';
import type {BarRect, Dims} from '../types/state';
import {snapBrushRange} from '../utils/brushCoords';

interface ChartStore {
  brushL: number;
  brushR: number;
  turnCount: number;
  hoveredId: number | null;
  selectedId: number | null;
  dims: Dims;
  barRects: BarRect[];
  resizeTick: number;
  viewLoIdx: number;
  viewHiIdx: number;
  viewLoPct: number;
  viewHiPct: number;
  /** Viewport position in FULL turn indices (for the range bar); -1 = unknown */
  viewFullLo: number;
  viewFullHi: number;
  setBrush: (l: number, r: number) => void;
  setTurnCount: (n: number) => void;
  setHovered: (id: number | null) => void;
  setSelected: (id: number | null) => void;
  toggleDim: (key: keyof Dims) => void;
  setBarRects: (rects: BarRect[]) => void;
  setViewRange: (lo: number, hi: number, loPct?: number, hiPct?: number, fullLo?: number, fullHi?: number) => void;
  initBrushForTurnCount: (n: number, viewportTurnCount?: number, anchor?: 'left' | 'right') => void;
  triggerResize: () => void;
}

export const useChartStore = create<ChartStore>((set) => ({
  brushL: 0,
  brushR: 1,
  turnCount: 0,
  hoveredId: null,
  selectedId: null,
  dims: {input: true, output: true, cacheR: true, cacheC: true},
  barRects: [],
  resizeTick: 0,
  viewLoIdx: -1,
  viewHiIdx: -1,
  viewLoPct: 0,
  viewHiPct: 1,
  viewFullLo: -1,
  viewFullHi: -1,

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

  setSelected: (id) => set({selectedId: id}),

  toggleDim: (key) => set((s) => ({dims: {...s.dims, [key]: !s.dims[key]}})),

  setBarRects: (rects) => set({barRects: rects}),

  setViewRange: (lo, hi, loPct, hiPct, fullLo, fullHi) =>
    set({
      viewLoIdx: lo,
      viewHiIdx: hi,
      viewLoPct: loPct ?? lo / 100,
      viewHiPct: hiPct ?? hi / 100,
      viewFullLo: fullLo ?? -1,
      viewFullHi: fullHi ?? -1,
    }),

  triggerResize: () => set((s) => ({resizeTick: s.resizeTick + 1})),

  initBrushForTurnCount: (n: number, viewportTurnCount?: number, anchor: 'left' | 'right' = 'right') => {
    if (n <= 0) {
      set({brushL: 0, brushR: 1, turnCount: 0});
      return;
    }
    const vtc = viewportTurnCount ?? 20;
    const initSpan = Math.min(0.25, vtc / n);
    const rawL = anchor === 'left' ? 0 : Math.max(0, 1 - initSpan);
    const rawR = anchor === 'left' ? initSpan : 1;
    const [sl, sr] = snapBrushRange(rawL, rawR, n);
    set({brushL: sl, brushR: sr, turnCount: n});
  },
}));
