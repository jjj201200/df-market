import type {TurnItem} from '../../types/state';
import {parseDur} from '../format';

export const IDLE_THRESHOLD_MS = 60_000;

export interface TimingMetrics {
  sessionDurationMs: number;
  totalToolDurationMs: number;
  avgTurnIntervalMs: number;
  idleTimeMs: number;
  idlePct: number;
  costPerMinute: number;
  toolDurByClass: Record<string, {totalMs: number; count: number; avgMs: number}>;
  slowestTools: {turnId: number; toolName: string; durationMs: number}[];
  turnIntervals: {turnId: number; intervalMs: number; isIdle: boolean}[];
}

export function computeTimingMetrics(turns: TurnItem[], totalCost: number): TimingMetrics {
  let sessionDurationMs = 0;
  if (turns.length >= 2) {
    const first = new Date(turns[0]!.timestamp).getTime();
    const last = new Date(turns[turns.length - 1]!.timestamp).getTime();
    sessionDurationMs = last - first;
  }

  const turnIntervals: TimingMetrics['turnIntervals'] = [];
  let idleTimeMs = 0;

  for (let i = 1; i < turns.length; i++) {
    const prev = new Date(turns[i - 1]!.timestamp).getTime();
    const curr = new Date(turns[i]!.timestamp).getTime();
    const intervalMs = curr - prev;
    const isIdle = intervalMs > IDLE_THRESHOLD_MS;
    if (isIdle) idleTimeMs += intervalMs;
    turnIntervals.push({turnId: turns[i]!.id, intervalMs, isIdle});
  }

  const avgTurnIntervalMs =
    turnIntervals.length > 0 ? turnIntervals.reduce((s, t) => s + t.intervalMs, 0) / turnIntervals.length : 0;

  const toolDurByClass: Record<string, {totalMs: number; count: number; avgMs: number}> = {};
  const allTools: {turnId: number; toolName: string; durationMs: number}[] = [];
  let totalToolDurationMs = 0;

  for (const t of turns) {
    for (const tool of t.tools) {
      const ms = parseDur(tool.dur);
      if (ms > 0) {
        totalToolDurationMs += ms;
        if (!toolDurByClass[tool.cls]) toolDurByClass[tool.cls] = {totalMs: 0, count: 0, avgMs: 0};
        toolDurByClass[tool.cls]!.totalMs += ms;
        toolDurByClass[tool.cls]!.count++;
        allTools.push({turnId: t.id, toolName: tool.name, durationMs: ms});
      }
    }
  }

  for (const v of Object.values(toolDurByClass)) {
    v.avgMs = v.count > 0 ? v.totalMs / v.count : 0;
  }

  allTools.sort((a, b) => b.durationMs - a.durationMs);
  const slowestTools = allTools.slice(0, 10);

  const costPerMinute = sessionDurationMs > 0 ? totalCost / (sessionDurationMs / 60_000) : 0;

  return {
    sessionDurationMs,
    totalToolDurationMs,
    avgTurnIntervalMs,
    idleTimeMs,
    idlePct: sessionDurationMs > 0 ? idleTimeMs / sessionDurationMs : 0,
    costPerMinute,
    toolDurByClass,
    slowestTools,
    turnIntervals,
  };
}
