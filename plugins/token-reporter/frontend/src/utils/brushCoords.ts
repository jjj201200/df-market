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

/** Snap a brush-space value to the nearest bar center: i/(N-1) */
export function snapToBar(pct: number, N: number): number {
  if (N <= 1) return 0;
  const Nm1 = N - 1;
  const idx = Math.round(pct * Nm1);
  return Math.max(0, Math.min(Nm1, idx)) / Nm1;
}

/** Snap brushL and brushR to nearest bar centers (midpoint between bars as threshold) */
export function snapBrushRange(l: number, r: number, N: number): [number, number] {
  if (N <= 1) return [0, 1];
  const Nm1 = N - 1;
  let li = Math.round(l * Nm1);
  let ri = Math.round(r * Nm1);
  li = Math.max(0, Math.min(Nm1, li));
  ri = Math.max(li, Math.min(Nm1, ri));  // ensure ri >= li
  return [li / Nm1, ri / Nm1];
}
