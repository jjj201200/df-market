import type {TurnItem} from '../../types/state';
import {getModelPricing} from '../cost';

export interface CacheMetrics {
  totalCacheR: number;
  totalCacheC: number;
  totalInput: number;
  hitRate: number;
  efficiencyRatio: number;
  estimatedSavings: number;
  perTurnHitRate: {turnId: number; rate: number}[];
}

export function computeCacheMetrics(turns: TurnItem[]): CacheMetrics {
  let totalCacheR = 0;
  let totalCacheC = 0;
  let totalInput = 0;
  const perTurnHitRate: {turnId: number; rate: number}[] = [];

  for (const t of turns) {
    totalCacheR += t.cacheR;
    totalCacheC += t.cacheC;
    totalInput += t.input;
    const denom = t.cacheR + t.input;
    perTurnHitRate.push({turnId: t.id, rate: denom > 0 ? t.cacheR / denom : 0});
  }

  const totalDenom = totalCacheR + totalInput;
  const hitRate = totalDenom > 0 ? totalCacheR / totalDenom : 0;
  const efficiencyRatio = totalCacheC > 0 ? totalCacheR / totalCacheC : 0;

  let estimatedSavings = 0;
  for (const t of turns) {
    const p = getModelPricing(t.model);
    estimatedSavings += (t.cacheR * (p.input - p.cacheRead)) / 1_000_000;
  }

  return {totalCacheR, totalCacheC, totalInput, hitRate, efficiencyRatio, estimatedSavings, perTurnHitRate};
}
