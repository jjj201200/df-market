import type {TurnItem} from '../../types/state';
import {getModelPricing} from '../cost';

export interface ThinkingMetrics {
  turnsWithThinking: number;
  turnsTotal: number;
  thinkingPct: number;
  totalThinkingChars: number;
  avgThinkingLength: number;
  estimatedThinkingTokens: number;
  estimatedThinkingCost: number;
  perTurn: {turnId: number; chars: number}[];
}

export function computeThinkingMetrics(turns: TurnItem[], dominantModel?: string): ThinkingMetrics {
  let turnsWithThinking = 0;
  let totalThinkingChars = 0;
  const perTurn: {turnId: number; chars: number}[] = [];

  for (const t of turns) {
    const chars = t.thinking ? t.thinking.length : 0;
    perTurn.push({turnId: t.id, chars});
    if (chars > 0) {
      turnsWithThinking++;
      totalThinkingChars += chars;
    }
  }

  const estimatedThinkingTokens = Math.round(totalThinkingChars / 4);
  const p = getModelPricing(dominantModel ?? turns[0]?.model ?? '');
  const estimatedThinkingCost = (estimatedThinkingTokens * p.output) / 1_000_000;

  return {
    turnsWithThinking,
    turnsTotal: turns.length,
    thinkingPct: turns.length > 0 ? turnsWithThinking / turns.length : 0,
    totalThinkingChars,
    avgThinkingLength: turnsWithThinking > 0 ? totalThinkingChars / turnsWithThinking : 0,
    estimatedThinkingTokens,
    estimatedThinkingCost,
    perTurn,
  };
}
