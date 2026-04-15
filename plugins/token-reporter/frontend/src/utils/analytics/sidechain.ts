import type {TurnItem} from '../../types/state';
import {computeTurnCost} from '../cost';

export interface SidechainMetrics {
  mainTurns: number;
  sidechainTurns: number;
  sidechainPct: number;
  mainCost: number;
  sidechainCost: number;
  sidechainCostPct: number;
  sidechainToolCounts: Record<string, number>;
}

export function computeSidechainMetrics(turns: TurnItem[]): SidechainMetrics {
  let mainCost = 0;
  let sidechainCost = 0;
  let mainTurns = 0;
  let sidechainTurns = 0;
  const sidechainToolCounts: Record<string, number> = {};

  for (const t of turns) {
    const cost = computeTurnCost(t);
    if (t.isSidechain) {
      sidechainTurns++;
      sidechainCost += cost;
      for (const tool of t.tools) {
        sidechainToolCounts[tool.cls] = (sidechainToolCounts[tool.cls] ?? 0) + 1;
      }
    } else {
      mainTurns++;
      mainCost += cost;
    }
  }

  const total = mainCost + sidechainCost;
  return {
    mainTurns,
    sidechainTurns,
    sidechainPct: turns.length > 0 ? sidechainTurns / turns.length : 0,
    mainCost,
    sidechainCost,
    sidechainCostPct: total > 0 ? sidechainCost / total : 0,
    sidechainToolCounts,
  };
}
