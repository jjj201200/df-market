import type {TurnItem, SubagentStats} from '../../types/state';
import {computeSessionCost, computeTurnCost} from '../cost';

export interface SubagentEfficiency {
  mainTokens: {input: number; output: number; cacheR: number; cacheC: number; cost: number; turns: number};
  agents: {
    agentId: string;
    agentType: string;
    description: string;
    tokens: {input: number; output: number; cacheR: number; cacheC: number};
    cost: number;
    turns: number;
    toolCounts: Record<string, number>;
    tokensPerTurn: number;
  }[];
  totalSubagentCost: number;
  subagentCostPct: number;
}

export function computeSubagentEfficiency(
  subagents: Record<string, SubagentStats>,
  turns: TurnItem[],
): SubagentEfficiency {
  const mainTotals = {input: 0, output: 0, cacheR: 0, cacheC: 0};
  for (const t of turns) {
    mainTotals.input += t.input;
    mainTotals.output += t.output;
    mainTotals.cacheR += t.cacheR;
    mainTotals.cacheC += t.cacheC;
  }
  const mainCostData = computeSessionCost(turns);

  const agents: SubagentEfficiency['agents'] = [];
  let totalSubagentCost = 0;

  for (const [, sa] of Object.entries(subagents)) {
    let cost = 0;
    for (const t of sa.turns) {
      cost += computeTurnCost(t as unknown as TurnItem);
    }
    const tk = sa.totalTokens;
    totalSubagentCost += cost;
    agents.push({
      agentId: sa.agentId,
      agentType: sa.agentType,
      description: sa.description,
      tokens: tk,
      cost,
      turns: sa.totalTurns,
      toolCounts: sa.toolCounts,
      tokensPerTurn: sa.totalTurns > 0 ? (tk.input + tk.output + tk.cacheR + tk.cacheC) / sa.totalTurns : 0,
    });
  }

  agents.sort((a, b) => b.cost - a.cost);

  const totalCost = mainCostData.total + totalSubagentCost;

  return {
    mainTokens: {...mainTotals, cost: mainCostData.total, turns: turns.length},
    agents,
    totalSubagentCost,
    subagentCostPct: totalCost > 0 ? totalSubagentCost / totalCost : 0,
  };
}
