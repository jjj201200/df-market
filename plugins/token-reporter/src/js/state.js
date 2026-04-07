// ── Shared application state ──
// Mutable arrays/objects are exported by reference; primitives use setters.

export const DATA = [];
export const TURNS = [];
export let N = 0;

export const dims = { input: true, output: true, cacheR: true, cacheC: true };

export const COLORS = {
  input: "#1f6feb",
  output: "#3fb950",
  cacheR: "#d29922",
  cacheC: "#bc8cff",
};

export let brushL = 0;
export let brushR = 1;
export let hoveredId = null;
export const DPR = window.devicePixelRatio || 1;

export function setN(val) { N = val; }
export function setBrush(l, r) { brushL = l; brushR = r; }
export function setHovered(id) { hoveredId = id; }
