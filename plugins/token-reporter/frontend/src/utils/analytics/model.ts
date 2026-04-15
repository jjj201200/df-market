import type {TurnItem} from '../../types/state';
import {computeTurnCost, getModelDisplayName} from '../cost';

export interface ModelBreakdownEntry {
  model: string;
  displayName: string;
  turns: number;
  tokens: {input: number; output: number; cacheR: number; cacheC: number};
  cost: number;
  costPct: number;
  avgCostPerTurn: number;
  avgOutputPerTurn: number;
}

export interface ModelBreakdown {
  models: ModelBreakdownEntry[];
  modelSwitches: number;
  dominantModel: string;
  dominantModelId: string;
}

export function computeModelBreakdown(turns: TurnItem[]): ModelBreakdown {
  const byModel = new Map<
    string,
    {turns: number; tokens: {input: number; output: number; cacheR: number; cacheC: number}; cost: number}
  >();

  for (const t of turns) {
    const key = t.model || 'unknown';
    if (!byModel.has(key)) byModel.set(key, {turns: 0, tokens: {input: 0, output: 0, cacheR: 0, cacheC: 0}, cost: 0});
    const entry = byModel.get(key)!;
    entry.turns++;
    entry.tokens.input += t.input;
    entry.tokens.output += t.output;
    entry.tokens.cacheR += t.cacheR;
    entry.tokens.cacheC += t.cacheC;
    entry.cost += computeTurnCost(t);
  }

  const totalCost = Array.from(byModel.values()).reduce((s, e) => s + e.cost, 0);

  const models: ModelBreakdownEntry[] = Array.from(byModel.entries()).map(([model, e]) => ({
    model,
    displayName: getModelDisplayName(model),
    turns: e.turns,
    tokens: e.tokens,
    cost: e.cost,
    costPct: totalCost > 0 ? e.cost / totalCost : 0,
    avgCostPerTurn: e.turns > 0 ? e.cost / e.turns : 0,
    avgOutputPerTurn: e.turns > 0 ? e.tokens.output / e.turns : 0,
  }));
  models.sort((a, b) => b.cost - a.cost);

  let modelSwitches = 0;
  for (let i = 1; i < turns.length; i++) {
    if (turns[i]!.model !== turns[i - 1]!.model) modelSwitches++;
  }

  const dominant = models.length > 0 ? models.reduce((a, b) => (a.turns >= b.turns ? a : b)) : null;
  const dominantModel = dominant?.displayName ?? '';
  const dominantModelId = dominant?.model ?? '';

  return {models, modelSwitches, dominantModel, dominantModelId};
}
