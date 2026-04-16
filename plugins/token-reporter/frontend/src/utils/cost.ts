import type {TurnItem} from '../types/state';

/** Pricing per million tokens (USD) */
export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Sonnet family
  'claude-sonnet-4-6': {input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75},
  'claude-sonnet-4-5-20250514': {input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75},
  'claude-sonnet-4-20250514': {input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75},
  // Opus family
  'claude-opus-4-6': {input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75},
  'claude-opus-4-0-20250501': {input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75},
  // Haiku family
  'claude-haiku-4-5-20251001': {input: 0.8, output: 4, cacheRead: 0.08, cacheCreation: 1},
  'claude-3-5-haiku-20241022': {input: 0.8, output: 4, cacheRead: 0.08, cacheCreation: 1},
};

/** Default to Sonnet pricing when model is unknown */
const DEFAULT_PRICING: ModelPricing = PRICING['claude-sonnet-4-6']!;

/** Extract a short display name from a model ID */
export function getModelDisplayName(model: string): string {
  if (model === '<synthetic>') return 'Synthetic';
  if (model.includes('opus')) return 'Opus';
  if (model.includes('haiku')) return 'Haiku';
  if (model.includes('sonnet')) return 'Sonnet';
  return model.split('-').slice(0, 2).join(' ') || model;
}

export function getModelPricing(model: string): ModelPricing {
  // Synthetic turns are system-generated and have zero tokens; skip pricing/warning
  if (model === '<synthetic>') return DEFAULT_PRICING;
  // Try exact match first
  if (PRICING[model]) return PRICING[model];
  // Try prefix match
  const key = Object.keys(PRICING).find((k) => model.startsWith(k) || model.includes(k));
  if (key) return PRICING[key]!;
  // Detect model family from name
  if (model.includes('opus')) return PRICING['claude-opus-4-6']!;
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5-20251001']!;
  // Warn about unknown models so users know the cost estimate may be inaccurate
  if (typeof console !== 'undefined') {
    console.warn(
      `[token-reporter] Unknown model "${model}", falling back to Sonnet pricing. Cost estimate may be inaccurate.`,
    );
  }
  return DEFAULT_PRICING;
}

export function computeTurnCost(turn: TurnItem, pricing?: ModelPricing): number {
  const p = pricing ?? getModelPricing(turn.model);
  return (
    (turn.input * p.input + turn.output * p.output + turn.cacheR * p.cacheRead + turn.cacheC * p.cacheCreation) /
    1_000_000
  );
}

export interface SessionCost {
  total: number;
  byType: {input: number; output: number; cacheRead: number; cacheCreation: number};
  perTurn: number[];
  avgPerTurn: number;
  maxTurnIdx: number;
  maxTurnCost: number;
}

export function computeSessionCost(turns: TurnItem[]): SessionCost {
  const byType = {input: 0, output: 0, cacheRead: 0, cacheCreation: 0};
  const perTurn: number[] = [];
  let maxTurnCost = 0;
  let maxTurnIdx = 0;

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    const p = getModelPricing(t.model);
    const ic = (t.input * p.input) / 1_000_000;
    const oc = (t.output * p.output) / 1_000_000;
    const rc = (t.cacheR * p.cacheRead) / 1_000_000;
    const cc = (t.cacheC * p.cacheCreation) / 1_000_000;
    byType.input += ic;
    byType.output += oc;
    byType.cacheRead += rc;
    byType.cacheCreation += cc;
    const turnTotal = ic + oc + rc + cc;
    perTurn.push(turnTotal);
    if (turnTotal > maxTurnCost) {
      maxTurnCost = turnTotal;
      maxTurnIdx = i;
    }
  }

  const total = byType.input + byType.output + byType.cacheRead + byType.cacheCreation;
  return {
    total,
    byType,
    perTurn,
    avgPerTurn: turns.length > 0 ? total / turns.length : 0,
    maxTurnIdx,
    maxTurnCost,
  };
}
