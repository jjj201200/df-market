import type {TurnItem, DataItem, SubagentStats, ToolItem, CompactItem} from '../types/state';
import {computeSessionCost, getModelPricing, type SessionCost} from './cost';

// ─── Cache Metrics ───────────────────────────────────────

export interface CacheMetrics {
  totalCacheR: number;
  totalCacheC: number;
  totalInput: number;
  hitRate: number; // cacheR / (cacheR + input), 0-1
  efficiencyRatio: number; // cacheR / cacheC
  estimatedSavings: number; // USD saved by cache hits
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

  // Savings = cacheR tokens * (full input price - cache read price) for each turn's model
  let estimatedSavings = 0;
  for (const t of turns) {
    const p = getModelPricing(t.model);
    estimatedSavings += (t.cacheR * (p.input - p.cacheRead)) / 1_000_000;
  }

  return {totalCacheR, totalCacheC, totalInput, hitRate, efficiencyRatio, estimatedSavings, perTurnHitRate};
}

// ─── Tool Efficiency ─────────────────────────────────────

export interface RedundantGroup {
  cls: string;
  keyParam: string;
  count: number;
  turnIds: number[];
}

export interface ToolEfficiency {
  totalCalls: number;
  totalErrors: number;
  errorRate: number;
  errorsByClass: Record<string, {total: number; errors: number; rate: number}>;
  redundantGroups: RedundantGroup[];
  largeCalls: {turnId: number; toolName: string; retSize: string; retBytes: number}[];
  mcpTokenPct: number;
}

function parseSize(s: string): number {
  const m = s.match(/([\d.]+)\s*(KB|B|MB)/i);
  if (!m) return 0;
  const val = parseFloat(m[1]!);
  const unit = m[2]!.toUpperCase();
  if (unit === 'KB') return val * 1024;
  if (unit === 'MB') return val * 1024 * 1024;
  return val;
}

function toolKeyParam(tool: ToolItem): string {
  const args = tool.input;
  if (tool.cls === 'read' || tool.cls === 'edit' || tool.cls === 'write') {
    const fp = args.find((a) => a.k === 'file_path');
    return fp ? fp.v : '';
  }
  if (tool.cls === 'grep') {
    const pat = args.find((a) => a.k === 'pattern');
    const gl = args.find((a) => a.k === 'glob');
    return `${pat?.v ?? ''}|${gl?.v ?? ''}`;
  }
  if (tool.cls === 'glob') {
    const pat = args.find((a) => a.k === 'pattern');
    return pat?.v ?? '';
  }
  if (tool.cls === 'bash') {
    const cmd = args.find((a) => a.k === 'command');
    return cmd?.v ?? '';
  }
  return '';
}

export function computeToolEfficiency(turns: TurnItem[]): ToolEfficiency {
  let totalCalls = 0;
  let totalErrors = 0;
  const errorsByClass: Record<string, {total: number; errors: number; rate: number}> = {};
  const keyMap = new Map<string, {cls: string; keyParam: string; turnIds: number[]; outputs: string[]}>();
  const largeCalls: ToolEfficiency['largeCalls'] = [];
  let mcpTurns = 0;

  for (const t of turns) {
    let hasMcp = false;
    for (const tool of t.tools) {
      totalCalls++;
      if (tool.isErr) totalErrors++;

      // Error stats by class
      if (!errorsByClass[tool.cls]) errorsByClass[tool.cls] = {total: 0, errors: 0, rate: 0};
      errorsByClass[tool.cls]!.total++;
      if (tool.isErr) errorsByClass[tool.cls]!.errors++;

      // Redundancy detection
      const kp = toolKeyParam(tool);
      if (kp) {
        const mapKey = `${tool.cls}::${kp}`;
        if (!keyMap.has(mapKey)) keyMap.set(mapKey, {cls: tool.cls, keyParam: kp, turnIds: [], outputs: []});
        const entry = keyMap.get(mapKey)!;
        entry.turnIds.push(t.id);
        entry.outputs.push(tool.output.slice(0, 200)); // compare first 200 chars
      }

      // Large returns
      const bytes = parseSize(tool.retSize);
      if (bytes > 50 * 1024) {
        largeCalls.push({turnId: t.id, toolName: tool.name, retSize: tool.retSize, retBytes: bytes});
      }

      if (tool.cls === 'mcp') hasMcp = true;
    }
    if (hasMcp) mcpTurns++;
  }

  // Compute error rates
  for (const v of Object.values(errorsByClass)) {
    v.rate = v.total > 0 ? v.errors / v.total : 0;
  }

  // Filter redundant groups (same key, same output, count > 1)
  const redundantGroups: RedundantGroup[] = [];
  for (const entry of keyMap.values()) {
    if (entry.turnIds.length <= 1) continue;
    // Check if outputs are identical (simple string compare on truncated content)
    const first = entry.outputs[0];
    const allSame = entry.outputs.every((o) => o === first);
    if (allSame) {
      redundantGroups.push({
        cls: entry.cls,
        keyParam: entry.keyParam,
        count: entry.turnIds.length,
        turnIds: entry.turnIds,
      });
    }
  }
  redundantGroups.sort((a, b) => b.count - a.count);

  return {
    totalCalls,
    totalErrors,
    errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
    errorsByClass,
    redundantGroups,
    largeCalls: largeCalls.sort((a, b) => b.retBytes - a.retBytes).slice(0, 20),
    mcpTokenPct: turns.length > 0 ? mcpTurns / turns.length : 0,
  };
}

// ─── Context Growth ──────────────────────────────────────

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

  // Extract compact events and map to nearest turn
  const compactEvents: ContextGrowth['compactEvents'] = [];
  for (const item of data) {
    if (item.type === 'compact') {
      const ci = item as CompactItem;
      // Find the turn index closest to this compact event by timestamp
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

// ─── Subagent Efficiency ─────────────────────────────────

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
  turns: TurnItem[]
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
    // Estimate cost from subagent token counts using haiku pricing as default for subagents
    const model = sa.turns[0]?.model ?? 'claude-haiku-4-5-20251001';
    const p = getModelPricing(model);
    const tk = sa.totalTokens;
    const cost =
      (tk.input * p.input + tk.output * p.output + tk.cacheR * p.cacheRead + tk.cacheC * p.cacheCreation) / 1_000_000;
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

// ─── Recommendations ─────────────────────────────────────

export interface Recommendation {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'cache' | 'tools' | 'context' | 'cost';
  title: string;
  detail: string;
  estimatedSavings?: string;
}

export function generateRecommendations(
  cache: CacheMetrics,
  tools: ToolEfficiency,
  context: ContextGrowth,
  subagent: SubagentEfficiency,
  cost: SessionCost
): Recommendation[] {
  const recs: Recommendation[] = [];
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const usd = (v: number) => `$${v.toFixed(4)}`;

  // R1: Low cache hit rate
  if (cache.hitRate < 0.3 && cache.totalInput > 10000) {
    recs.push({
      id: 'low-cache',
      severity: 'high',
      category: 'cache',
      title: `Low cache hit rate (${pct(cache.hitRate)})`,
      detail:
        'Cache hit rate below 30%. Structure prompts to preserve prefix stability. Avoid changing system prompts between turns. Static content should come first, dynamic content last.',
      estimatedSavings: `Up to ${usd(cache.totalInput * 0.5 * (getModelPricing('claude-sonnet-4-6').input - getModelPricing('claude-sonnet-4-6').cacheRead) / 1_000_000)} if hit rate improves to 50%`,
    });
  }

  // R2: High tool error rate
  if (tools.errorRate > 0.15 && tools.totalCalls > 5) {
    recs.push({
      id: 'tool-errors',
      severity: 'high',
      category: 'tools',
      title: `${tools.totalErrors} of ${tools.totalCalls} tool calls failed (${pct(tools.errorRate)})`,
      detail: 'Failed tool calls waste tokens on both the request and the error response. Check common error patterns.',
    });
  }

  // R3: Redundant tool calls
  if (tools.redundantGroups.length > 0) {
    const totalRedundant = tools.redundantGroups.reduce((s, g) => s + g.count - 1, 0);
    recs.push({
      id: 'redundant-tools',
      severity: totalRedundant > 5 ? 'high' : 'medium',
      category: 'tools',
      title: `${totalRedundant} redundant tool calls detected`,
      detail: `${tools.redundantGroups.length} tool call pattern(s) repeated with identical results. Top: ${tools.redundantGroups[0]!.cls}(${tools.redundantGroups[0]!.keyParam.slice(0, 60)}) x${tools.redundantGroups[0]!.count}.`,
    });
  }

  // R4: Frequent compaction
  if (context.compactEvents.length >= 2) {
    const avgTurns =
      context.points.length > 0 ? context.points.length / (context.compactEvents.length + 1) : Infinity;
    if (avgTurns < 15) {
      recs.push({
        id: 'frequent-compact',
        severity: 'medium',
        category: 'context',
        title: `Context compacted ${context.compactEvents.length} times (avg every ${Math.round(avgTurns)} turns)`,
        detail:
          'Sessions hitting context limits quickly. Consider more targeted file reads (use offset/limit), more specific grep patterns, and delegating verbose tasks to subagents.',
      });
    }
  }

  // R5: High output ratio
  if (cost.total > 0) {
    const outputPct = cost.byType.output / cost.total;
    if (outputPct > 0.6) {
      recs.push({
        id: 'high-output',
        severity: 'medium',
        category: 'cost',
        title: `Output tokens account for ${pct(outputPct)} of cost`,
        detail: 'Output tokens are 5x more expensive than input. Consider asking for concise responses or reducing verbose explanations.',
      });
    }
  }

  // R6: Large tool returns
  if (tools.largeCalls.length > 3) {
    recs.push({
      id: 'large-returns',
      severity: 'medium',
      category: 'tools',
      title: `${tools.largeCalls.length} tool calls returned >50KB`,
      detail: `Large tool returns inflate context. Use offset/limit for Read, more specific grep patterns, or pipe through head/tail for bash. Largest: ${tools.largeCalls[0]!.toolName} (${tools.largeCalls[0]!.retSize}).`,
    });
  }

  // R7: High subagent cost
  if (subagent.subagentCostPct > 0.5 && subagent.agents.length > 0) {
    recs.push({
      id: 'subagent-cost',
      severity: 'medium',
      category: 'cost',
      title: `Subagents consumed ${pct(subagent.subagentCostPct)} of total cost`,
      detail: 'Verify that subagent delegations are worthwhile. Consider using Haiku model for exploration subagents.',
      estimatedSavings: `${usd(subagent.totalSubagentCost * 0.8)} if subagents used Haiku`,
    });
  }

  // R8: Good cache - positive feedback
  if (cache.hitRate >= 0.6 && cache.totalInput > 10000) {
    recs.push({
      id: 'good-cache',
      severity: 'low',
      category: 'cache',
      title: `Good cache hit rate (${pct(cache.hitRate)})`,
      detail: `Cache is working well. Saved approximately ${usd(cache.estimatedSavings)} this session.`,
    });
  }

  return recs.sort((a, b) => {
    const ord = {high: 0, medium: 1, low: 2};
    return ord[a.severity] - ord[b.severity];
  });
}
