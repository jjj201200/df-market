import type {TurnItem, DataItem} from '../../types/state';
import {computeContextGrowth} from './context';

export interface PressureMetrics {
  peakTokens: number;
  peakTurnId: number;
  compactionCount: number;
  avgTurnsBetweenCompact: number;
  highSpikeTurns: {turnId: number; delta: number}[];
  growthRatePer10Turns: number;
  estimatedTurnsToLimit: number | null;
}

const CONTEXT_LIMIT = 200_000;
const HIGH_SPIKE_THRESHOLD = 20_000;

export function computePressureMetrics(data: DataItem[], turns: TurnItem[]): PressureMetrics {
  const context = computeContextGrowth(data, turns);
  const points = context.points;

  let peakTokens = 0;
  let peakTurnId = -1;
  for (const p of points) {
    if (p.cumulative > peakTokens) {
      peakTokens = p.cumulative;
      peakTurnId = p.turnId;
    }
  }

  const compactionCount = context.compactEvents.length;
  const avgTurnsBetweenCompact =
    compactionCount > 0 && points.length > 0 ? points.length / (compactionCount + 1) : points.length;

  const highSpikeTurns = points
    .filter((p) => p.delta > HIGH_SPIKE_THRESHOLD)
    .map((p) => ({turnId: p.turnId, delta: p.delta}))
    .slice(0, 10);

  let growthRatePer10Turns = 0;
  if (points.length >= 10) {
    const first = points[0]!.cumulative;
    const tenth = points[9]!.cumulative;
    growthRatePer10Turns = tenth - first;
  } else if (points.length > 1) {
    const first = points[0]!.cumulative;
    const last = points[points.length - 1]!.cumulative;
    growthRatePer10Turns = ((last - first) / points.length) * 10;
  }

  let estimatedTurnsToLimit: number | null = null;
  if (points.length > 1 && growthRatePer10Turns > 0) {
    const remaining = CONTEXT_LIMIT - peakTokens;
    estimatedTurnsToLimit = Math.round((remaining / growthRatePer10Turns) * 10);
    if (estimatedTurnsToLimit < 0) estimatedTurnsToLimit = 0;
  }

  return {
    peakTokens,
    peakTurnId,
    compactionCount,
    avgTurnsBetweenCompact,
    highSpikeTurns,
    growthRatePer10Turns,
    estimatedTurnsToLimit,
  };
}
