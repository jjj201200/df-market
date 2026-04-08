import type {Dims, TurnItem} from '../types/state';
import {COLOR_VARS} from '../types/state';

export const DPR = window.devicePixelRatio || 1;

export interface Segment {
  key: string;
  val: number;
  col: string;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Build visible token segments for a turn based on active dimensions */
export function getSegs(d: TurnItem, dims: Dims): Segment[] {
  const s: Segment[] = [];
  if (dims.input && d.input) s.push({key: 'input', val: d.input, col: getCSSVar(COLOR_VARS.input)});
  if (dims.output && d.output) s.push({key: 'output', val: d.output, col: getCSSVar(COLOR_VARS.output)});
  if (dims.cacheR && d.cacheR) s.push({key: 'cacheR', val: d.cacheR, col: getCSSVar(COLOR_VARS.cacheR)});
  if (dims.cacheC && d.cacheC) s.push({key: 'cacheC', val: d.cacheC, col: getCSSVar(COLOR_VARS.cacheC)});
  return s;
}

/** Set up a canvas for DPR-aware rendering */
export function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number, dpr: number): CanvasRenderingContext2D {
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return ctx;
}
