import type {TurnItem, DataItem, CompactItem} from '../../types/state';

export interface ContextGrowth {
  points: {turnId: number; cumulative: number; delta: number}[];
  compactEvents: {timestamp: string; preTokens: number; afterTurnIdx: number}[];
  avgGrowthPerTurn: number;
}

export function computeContextGrowth(data: DataItem[], turns: TurnItem[]): ContextGrowth {
  const points: ContextGrowth['points'] = [];
  let cumulative = 0;

  for (const t of turns) {
    const delta = t.input + t.cacheC + t.output;
    cumulative += delta;
    points.push({turnId: t.id, cumulative, delta});
  }

  const compactEvents: ContextGrowth['compactEvents'] = [];
  for (const item of data) {
    if (item.type === 'compact') {
      const ci = item as CompactItem;
      let afterIdx = 0;
      for (let i = 0; i < turns.length; i++) {
        if (turns[i]!.timestamp <= ci.timestamp) afterIdx = i;
      }
      compactEvents.push({timestamp: ci.timestamp, preTokens: ci.preTokens, afterTurnIdx: afterIdx});
    }
  }

  const avgGrowthPerTurn = points.length > 0 ? cumulative / points.length : 0;

  return {points, compactEvents, avgGrowthPerTurn};
}
