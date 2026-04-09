/** Convert brush percent (0~1, index-space: i/(N-1)) to pixel percent (canvas-space: (i+0.5)/N) */
export function brushToPixelPct(pct: number, N: number): number {
  if (N <= 1) return 0.5;
  return (pct * (N - 1) + 0.5) / N;
}

/** Convert pixel percent (canvas-space fraction 0~1) to brush percent (0~1, index-space) */
export function pixelToBrushPct(pixelPct: number, N: number): number {
  if (N <= 1) return 0.5;
  return (pixelPct * N - 0.5) / (N - 1);
}

/** Convert brush-space value (possibly at inter-bar gap) to first visible bar index */
export function brushToFirstIdx(pct: number, N: number): number {
  if (N <= 1) return 0;
  return Math.max(0, Math.min(N - 1, Math.ceil(pct * (N - 1) - 0.001)));
}

/** Convert brush-space value (possibly at inter-bar gap) to last visible bar index */
export function brushToLastIdx(pct: number, N: number): number {
  if (N <= 1) return 0;
  return Math.max(0, Math.min(N - 1, Math.floor(pct * (N - 1) + 0.001)));
}

/**
 * Snap brushL and brushR to midpoints between bars (inter-bar gaps).
 * In brush-space, bar i sits at i/(N-1). The gap between bar i and bar i+1
 * is at (i+0.5)/(N-1). brushL/brushR snap to these gaps so the boundary
 * falls between bars, not at bar centers.
 * At edges: brushL snaps to -0.5/(N-1) (left edge of first bar),
 *           brushR snaps to (N-0.5)/(N-1) (right edge of last bar).
 * These map to pixel 0% and 100% via brushToPixelPct.
 */
export function snapBrushRange(l: number, r: number, N: number): [number, number] {
  if (N <= 1) return [0, 1];
  const Nm1 = N - 1;

  // Gap positions: (i+0.5)/Nm1 for i = -1, 0, 1, ..., Nm1
  // brushL snaps left (floor) to include the bar under the cursor
  // brushR snaps right (ceil) to include the bar under the cursor
  // li/ri = index of bar to the LEFT of the gap
  let li = Math.ceil(l * Nm1) - 1;   // snap left edge leftward
  li = Math.max(-1, Math.min(Nm1 - 1, li));
  const sl = (li + 0.5) / Nm1;

  let ri = Math.floor(r * Nm1);      // snap right edge rightward
  ri = Math.max(li + 1, Math.min(Nm1, ri));  // ensure at least one bar
  const sr = (ri + 0.5) / Nm1;

  return [sl, sr];
}
