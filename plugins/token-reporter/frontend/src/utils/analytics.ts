import type {TurnItem, DataItem, SubagentStats, ToolItem, CompactItem} from '../types/state';
import {computeSessionCost, computeTurnCost, getModelPricing, getModelDisplayName, type SessionCost} from './cost';
import {parseDur, fmtPct, fmtTokens} from './format';
import type {TFunction} from '../i18n';

export const IDLE_THRESHOLD_MS = 60_000;

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

// ─── Pressure Metrics ────────────────────────────────────

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
  const avgTurnsBetweenCompact = compactionCount > 0 && points.length > 0
    ? points.length / (compactionCount + 1)
    : points.length;

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

// ─── Model Breakdown ────────────────────────────────────

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
  dominantModel: string;      // display name
  dominantModelId: string;    // raw model ID for pricing lookups
}

export function computeModelBreakdown(turns: TurnItem[]): ModelBreakdown {
  const byModel = new Map<string, {turns: number; tokens: {input: number; output: number; cacheR: number; cacheC: number}; cost: number}>();

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

// ─── Thinking Metrics ───────────────────────────────────

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

// ─── Sidechain Metrics ──────────────────────────────────

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

// ─── Timing Metrics ─────────────────────────────────────

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
  // Session duration from timestamps
  let sessionDurationMs = 0;
  if (turns.length >= 2) {
    const first = new Date(turns[0]!.timestamp).getTime();
    const last = new Date(turns[turns.length - 1]!.timestamp).getTime();
    sessionDurationMs = last - first;
  }

  // Turn intervals
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

  const avgTurnIntervalMs = turnIntervals.length > 0
    ? turnIntervals.reduce((s, t) => s + t.intervalMs, 0) / turnIntervals.length
    : 0;

  // Tool durations
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

// ─── MCP Metrics ─────────────────────────────────────────

export interface McpMethodStats {
  calls: number;
  errors: number;
  totalMs: number;
  avgMs: number;
  errorRate: number;
}

export interface McpServerStats {
  calls: number;
  errors: number;
  totalMs: number;
  avgMs: number;
  errorRate: number;
  methods: Record<string, McpMethodStats>;
}

export interface McpTurnUsage {
  turnId: number;
  calls: {server: string; method: string; durMs: number; isErr: boolean}[];
}

export interface McpMetrics {
  totalMcpCalls: number;
  totalMcpErrors: number;
  mcpPct: number;
  avgMcpDurationMs: number;
  byServer: Record<string, McpServerStats>;
  totalCalls: number;
  turnUsage: McpTurnUsage[];
}

function parseDurToMs(dur: string): number {
  const m = dur.match(/([\d.]+)\s*ms/);
  return m ? parseFloat(m[1]!) : 0;
}

export function computeMcpMetrics(turns: TurnItem[]): McpMetrics {
  let totalMcpCalls = 0;
  let totalMcpErrors = 0;
  let totalMcpDurationMs = 0;
  const byServer: Record<string, McpServerStats> = {};
  let totalCalls = 0;
  const turnUsage: McpTurnUsage[] = [];

  for (const t of turns) {
    const turnCalls: McpTurnUsage['calls'] = [];
    for (const tool of t.tools) {
      totalCalls++;
      if (tool.cls !== 'mcp' || !tool.mcp) continue;
      totalMcpCalls++;
      if (tool.isErr) totalMcpErrors++;

      const server = tool.mcp.server || 'unknown';
      const method = tool.mcp.method || 'unknown';
      if (!byServer[server]) {
        byServer[server] = {calls: 0, errors: 0, totalMs: 0, avgMs: 0, errorRate: 0, methods: {}};
      }
      byServer[server]!.calls++;
      if (tool.isErr) byServer[server]!.errors++;

      if (!byServer[server]!.methods[method]) {
        byServer[server]!.methods[method] = {calls: 0, errors: 0, totalMs: 0, avgMs: 0, errorRate: 0};
      }
      byServer[server]!.methods[method]!.calls++;
      if (tool.isErr) byServer[server]!.methods[method]!.errors++;

      const ms = parseDurToMs(tool.dur);
      if (ms > 0) {
        byServer[server]!.totalMs += ms;
        totalMcpDurationMs += ms;
        byServer[server]!.methods[method]!.totalMs += ms;
      }

      turnCalls.push({server, method, durMs: ms, isErr: tool.isErr});
    }
    if (turnCalls.length > 0) {
      turnUsage.push({turnId: t.id, calls: turnCalls});
    }
  }

  for (const s of Object.values(byServer)) {
    s.avgMs = s.calls > 0 ? s.totalMs / s.calls : 0;
    s.errorRate = s.calls > 0 ? s.errors / s.calls : 0;
    for (const m of Object.values(s.methods)) {
      m.avgMs = m.calls > 0 ? m.totalMs / m.calls : 0;
      m.errorRate = m.calls > 0 ? m.errors / m.calls : 0;
    }
  }

  return {
    totalMcpCalls,
    totalMcpErrors,
    mcpPct: totalCalls > 0 ? totalMcpCalls / totalCalls : 0,
    avgMcpDurationMs: totalMcpCalls > 0 ? totalMcpDurationMs / totalMcpCalls : 0,
    byServer,
    totalCalls,
    turnUsage,
  };
}

// ─── Prompt Metrics ──────────────────────────────────────

export interface PromptMetrics {
  avgUserLength: number;
  avgUserTokens: number;
  inputOutputRatio: number;
  shortPromptStreak: number;
  longestPromptTurn: number;
  longestPromptChars: number;
  promptTrend: {turnId: number; chars: number; tokens: number; inputTokens: number; outputTokens: number; ratio: number}[];
}

export function computePromptMetrics(turns: TurnItem[]): PromptMetrics {
  let totalChars = 0;
  let totalTokens = 0;
  let longestPromptChars = 0;
  let longestPromptTurn = -1;
  let maxShortStreak = 0;
  let currentStreak = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const promptTrend: PromptMetrics['promptTrend'] = [];

  for (const t of turns) {
    const chars = t.user ? t.user.length : 0;
    const estTokens = Math.round(chars / 4);
    totalChars += chars;
    totalTokens += estTokens;
    totalInput += t.input;
    totalOutput += t.output;

    if (chars > longestPromptChars) {
      longestPromptChars = chars;
      longestPromptTurn = t.id;
    }

    if (chars < 20) {
      currentStreak++;
    } else {
      maxShortStreak = Math.max(maxShortStreak, currentStreak);
      currentStreak = 0;
    }

    const ratio = t.output > 0 ? t.input / t.output : 0;
    promptTrend.push({
      turnId: t.id,
      chars,
      tokens: estTokens,
      inputTokens: t.input,
      outputTokens: t.output,
      ratio: ratio,
    });
  }

  maxShortStreak = Math.max(maxShortStreak, currentStreak);

  return {
    avgUserLength: turns.length > 0 ? totalChars / turns.length : 0,
    avgUserTokens: turns.length > 0 ? totalTokens / turns.length : 0,
    inputOutputRatio: totalOutput > 0 ? totalInput / totalOutput : 0,
    shortPromptStreak: maxShortStreak,
    longestPromptTurn,
    longestPromptChars,
    promptTrend,
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

export interface RecommendationInput {
  cache: CacheMetrics;
  tools: ToolEfficiency;
  context: ContextGrowth;
  subagent: SubagentEfficiency;
  cost: SessionCost;
  modelBreakdown?: ModelBreakdown;
  thinking?: ThinkingMetrics;
  sidechain?: SidechainMetrics;
  timing?: TimingMetrics;
  mcp?: McpMetrics;
  prompt?: PromptMetrics;
  pressure?: PressureMetrics;
}

export function generateRecommendations(input: RecommendationInput, t: TFunction): Recommendation[] {
  const {cache, tools, context, subagent, cost, modelBreakdown, thinking, sidechain, timing, mcp, prompt, pressure} = input;
  const recs: Recommendation[] = [];
  const usd = (v: number) => `$${v.toFixed(4)}`;

  // R1: Low cache hit rate
  if (cache.hitRate < 0.3 && cache.totalInput > 10000) {
    recs.push({
      id: 'low-cache',
      severity: 'high',
      category: 'cache',
      title: t('rec.lowCache.title', {rate: fmtPct(cache.hitRate)}),
      detail: t('rec.lowCache.detail'),
      estimatedSavings: t('rec.lowCache.savings', {amount: usd(cache.totalInput * 0.5 * (getModelPricing('claude-sonnet-4-6').input - getModelPricing('claude-sonnet-4-6').cacheRead) / 1_000_000)}),
    });
  }

  // R2: High tool error rate
  if (tools.errorRate > 0.15 && tools.totalCalls > 5) {
    recs.push({
      id: 'tool-errors',
      severity: 'high',
      category: 'tools',
      title: t('rec.toolErrors.title', {errors: tools.totalErrors, total: tools.totalCalls, rate: fmtPct(tools.errorRate)}),
      detail: t('rec.toolErrors.detail'),
    });
  }

  // R3: Redundant tool calls
  if (tools.redundantGroups.length > 0) {
    const totalRedundant = tools.redundantGroups.reduce((s, g) => s + g.count - 1, 0);
    recs.push({
      id: 'redundant-tools',
      severity: totalRedundant > 5 ? 'high' : 'medium',
      category: 'tools',
      title: t('rec.redundantTools.title', {count: totalRedundant}),
      detail: t('rec.redundantTools.detail', {groups: tools.redundantGroups.length, top: `${tools.redundantGroups[0]!.cls}(${tools.redundantGroups[0]!.keyParam.slice(0, 60)}) x${tools.redundantGroups[0]!.count}`}),
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
        title: t('rec.frequentCompact.title', {count: context.compactEvents.length, avgTurns: Math.round(avgTurns)}),
        detail: t('rec.frequentCompact.detail'),
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
        title: t('rec.highOutput.title', {pct: fmtPct(outputPct)}),
        detail: t('rec.highOutput.detail'),
      });
    }
  }

  // R6: Large tool returns
  if (tools.largeCalls.length > 3) {
    recs.push({
      id: 'large-returns',
      severity: 'medium',
      category: 'tools',
      title: t('rec.largeReturns.title', {count: tools.largeCalls.length}),
      detail: t('rec.largeReturns.detail', {toolName: tools.largeCalls[0]!.toolName, retSize: tools.largeCalls[0]!.retSize}),
    });
  }

  // R7: High subagent cost
  if (subagent.subagentCostPct > 0.5 && subagent.agents.length > 0) {
    recs.push({
      id: 'subagent-cost',
      severity: 'medium',
      category: 'cost',
      title: t('rec.subagentCost.title', {pct: fmtPct(subagent.subagentCostPct)}),
      detail: t('rec.subagentCost.detail'),
      estimatedSavings: t('rec.subagentCost.savings', {amount: usd(subagent.totalSubagentCost * 0.8)}),
    });
  }

  // R8: Good cache - positive feedback
  if (cache.hitRate >= 0.6 && cache.totalInput > 10000) {
    recs.push({
      id: 'good-cache',
      severity: 'low',
      category: 'cache',
      title: t('rec.goodCache.title', {rate: fmtPct(cache.hitRate)}),
      detail: t('rec.goodCache.detail', {amount: usd(cache.estimatedSavings)}),
    });
  }

  // R9: High idle ratio
  if (timing && timing.idlePct > 0.5 && timing.turnIntervals.length > 10) {
    recs.push({
      id: 'high-idle',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highIdle.title', {pct: fmtPct(timing.idlePct)}),
      detail: t('rec.highIdle.detail'),
    });
  }

  // R10: Slow tool class
  if (timing) {
    for (const [cls, dur] of Object.entries(timing.toolDurByClass)) {
      if (dur.avgMs > 5000 && dur.count > 3) {
        recs.push({
          id: `slow-tool-${cls}`,
          severity: 'medium',
          category: 'tools',
          title: t('rec.slowTool.title', {cls, time: (dur.avgMs / 1000).toFixed(1)}),
          detail: t('rec.slowTool.detail', {count: dur.count, cls}),
        });
        break; // Only report the slowest class
      }
    }
  }

  // R11: High thinking cost
  if (thinking && cost.total > 0 && thinking.estimatedThinkingCost / cost.total > 0.3) {
    recs.push({
      id: 'high-thinking',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highThinking.title', {pct: fmtPct(thinking.estimatedThinkingCost / cost.total)}),
      detail: t('rec.highThinking.detail', {tokens: Math.round(thinking.estimatedThinkingTokens / 1000)}),
    });
  }

  // R12: Expensive model for simple tasks
  if (modelBreakdown) {
    const opusEntry = modelBreakdown.models.find((m) => m.model.includes('opus'));
    if (opusEntry && opusEntry.turns > 5 && opusEntry.avgOutputPerTurn < 500) {
      recs.push({
        id: 'opus-simple-tasks',
        severity: 'medium',
        category: 'cost',
        title: t('rec.opusSimple.title', {turns: opusEntry.turns}),
        detail: t('rec.opusSimple.detail', {tokens: Math.round(opusEntry.avgOutputPerTurn)}),
        estimatedSavings: usd(opusEntry.cost * 0.8),
      });
    }
  }

  // R13: High sidechain cost
  if (sidechain && sidechain.sidechainCostPct > 0.4 && sidechain.sidechainTurns > 0) {
    recs.push({
      id: 'high-sidechain',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highSidechain.title', {pct: fmtPct(sidechain.sidechainCostPct)}),
      detail: t('rec.highSidechain.detail', {turns: sidechain.sidechainTurns, amount: usd(sidechain.sidechainCost)}),
    });
  }

  // R14: High MCP usage
  if (mcp && mcp.mcpPct > 0.3 && mcp.totalMcpCalls > 3) {
    recs.push({
      id: 'high-mcp',
      severity: 'medium',
      category: 'cost',
      title: t('rec.highMcp.title', {pct: fmtPct(mcp.mcpPct)}),
      detail: t('rec.highMcp.detail', {count: mcp.totalMcpCalls}),
    });
  }

  // R15: MCP server with high error rate
  if (mcp) {
    for (const [server, stats] of Object.entries(mcp.byServer)) {
      if (stats.errorRate > 0.2 && stats.calls > 2) {
        recs.push({
          id: `mcp-errors-${server}`,
          severity: 'high',
          category: 'tools',
          title: t('rec.mcpErrors.title', {server, rate: fmtPct(stats.errorRate)}),
          detail: t('rec.mcpErrors.detail', {server, count: stats.calls}),
        });
        break;
      }
    }
  }

  // R16: Slow MCP server
  if (mcp) {
    for (const [server, stats] of Object.entries(mcp.byServer)) {
      if (stats.avgMs > 5000 && stats.calls > 2) {
        recs.push({
          id: `slow-mcp-${server}`,
          severity: 'medium',
          category: 'tools',
          title: t('rec.slowMcp.title', {server, time: (stats.avgMs / 1000).toFixed(1)}),
          detail: t('rec.slowMcp.detail', {server, count: stats.calls}),
        });
        break;
      }
    }
  }

  // R17: Fragmented prompts
  if (prompt && prompt.shortPromptStreak >= 3) {
    recs.push({
      id: 'fragmented-prompts',
      severity: 'medium',
      category: 'cost',
      title: t('rec.fragmentedPrompts.title', {count: prompt.shortPromptStreak}),
      detail: t('rec.fragmentedPrompts.detail'),
    });
  }

  // R18: Bloated prompt
  if (prompt && prompt.longestPromptChars > 2000) {
    const turn = prompt.promptTrend.find((p) => p.turnId === prompt.longestPromptTurn);
    if (turn && turn.outputTokens < turn.inputTokens * 0.1) {
      recs.push({
        id: 'bloated-prompt',
        severity: 'medium',
        category: 'cost',
        title: t('rec.bloatedPrompt.title', {chars: prompt.longestPromptChars}),
        detail: t('rec.bloatedPrompt.detail'),
      });
    }
  }

  // R19: Vague prompt (low input, high output)
  if (prompt && prompt.inputOutputRatio < 0.1) {
    const highOutputTurns = prompt.promptTrend.filter((p) => p.outputTokens > 5000).length;
    if (highOutputTurns > 0) {
      recs.push({
        id: 'vague-prompt',
        severity: 'medium',
        category: 'cost',
        title: t('rec.vaguePrompt.title', {ratio: fmtPct(prompt.inputOutputRatio)}),
        detail: t('rec.vaguePrompt.detail', {count: highOutputTurns}),
      });
    }
  }

  // R20: High context pressure
  if (pressure && pressure.compactionCount >= 2 && pressure.avgTurnsBetweenCompact < 10) {
    recs.push({
      id: 'high-pressure',
      severity: 'high',
      category: 'context',
      title: t('rec.highPressure.title', {count: pressure.compactionCount, avg: Math.round(pressure.avgTurnsBetweenCompact)}),
      detail: t('rec.highPressure.detail'),
    });
  }

  // R21: High context spike
  if (pressure && pressure.highSpikeTurns.length > 0) {
    recs.push({
      id: 'context-spike',
      severity: 'medium',
      category: 'context',
      title: t('rec.contextSpike.title', {count: pressure.highSpikeTurns.length}),
      detail: t('rec.contextSpike.detail', {turnId: pressure.highSpikeTurns[0]!.turnId, delta: fmtTokens(pressure.highSpikeTurns[0]!.delta)}),
    });
  }

  return recs.sort((a, b) => {
    const ord = {high: 0, medium: 1, low: 2};
    return ord[a.severity] - ord[b.severity];
  });
}
