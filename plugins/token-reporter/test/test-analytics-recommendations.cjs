"use strict";
const assert = require("assert");
const { generateRecommendations } = require("../frontend/src/utils/analytics/index.ts");
const { createT } = require("../frontend/src/i18n/useI18n.ts");

const t = createT("en");

function makeBaseInput(overrides) {
  return {
    cache: {
      totalCacheR: 0,
      totalCacheC: 0,
      totalInput: 0,
      hitRate: 0,
      efficiencyRatio: 0,
      estimatedSavings: 0,
      perTurnHitRate: [],
    },
    tools: {
      totalCalls: 0,
      totalErrors: 0,
      errorRate: 0,
      errorsByClass: {},
      redundantGroups: [],
      largeCalls: [],
      mcpTurnPct: 0,
    },
    context: {
      points: [],
      compactEvents: [],
      avgGrowthPerTurn: 0,
    },
    subagent: {
      mainTokens: { input: 0, output: 0, cacheR: 0, cacheC: 0, cost: 0, turns: 0 },
      agents: [],
      totalSubagentCost: 0,
      subagentCostPct: 0,
    },
    cost: {
      total: 0,
      byType: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      perTurn: [],
      avgPerTurn: 0,
      maxTurnIdx: -1,
      maxTurnCost: 0,
    },
    ...overrides,
  };
}

// Test 1: empty input returns no recommendations
{
  const input = makeBaseInput({});
  const result = generateRecommendations(input, t);
  assert.deepStrictEqual(result, []);
  console.log("✓ empty input returns no recommendations");
}

// Test 2: R1 low cache hit rate
{
  const input = makeBaseInput({
    cache: {
      totalCacheR: 1000,
      totalCacheC: 2000,
      totalInput: 50000,
      hitRate: 0.1,
      efficiencyRatio: 0.5,
      estimatedSavings: 0,
      perTurnHitRate: [],
    },
  });
  const result = generateRecommendations(input, t);
  const r1 = result.find((r) => r.id === "low-cache");
  assert.ok(r1, "expected low-cache recommendation");
  assert.strictEqual(r1.severity, "high");
  assert.strictEqual(r1.category, "cache");
  console.log("✓ R1 low cache hit rate");
}

// Test 3: R18 bloated prompt uses user chars (fixed logic)
// longestPromptChars > 2000 and outputTokens < tokens * 0.1
{
  const input = makeBaseInput({
    prompt: {
      avgUserLength: 0,
      avgUserTokens: 0,
      inputOutputRatio: 0,
      shortPromptStreak: 0,
      longestPromptTurn: 1,
      longestPromptChars: 3000,
      promptTrend: [
        { turnId: 1, chars: 3000, tokens: 750, inputTokens: 50000, outputTokens: 50, ratio: 0 },
      ],
    },
  });
  const result = generateRecommendations(input, t);
  const r18 = result.find((r) => r.id === "bloated-prompt");
  assert.ok(r18, "expected bloated-prompt recommendation");
  assert.strictEqual(r18.severity, "medium");
  assert.strictEqual(r18.category, "cost");
  console.log("✓ R18 bloated prompt (fixed logic)");
}

// Test 4: R18 should NOT trigger when output is high relative to user tokens
{
  const input = makeBaseInput({
    prompt: {
      avgUserLength: 0,
      avgUserTokens: 0,
      inputOutputRatio: 0,
      shortPromptStreak: 0,
      longestPromptTurn: 1,
      longestPromptChars: 3000,
      promptTrend: [
        { turnId: 1, chars: 3000, tokens: 750, inputTokens: 50000, outputTokens: 500, ratio: 0 },
      ],
    },
  });
  const result = generateRecommendations(input, t);
  const r18 = result.find((r) => r.id === "bloated-prompt");
  assert.strictEqual(r18, undefined);
  console.log("✓ R18 correctly skipped when output is not low");
}

// Test 5: results are sorted by severity (high > medium > low)
{
  const input = makeBaseInput({
    cache: {
      totalCacheR: 1000,
      totalCacheC: 2000,
      totalInput: 50000,
      hitRate: 0.1,
      efficiencyRatio: 0.5,
      estimatedSavings: 0,
      perTurnHitRate: [],
    },
    tools: {
      totalCalls: 10,
      totalErrors: 10,
      errorRate: 1,
      errorsByClass: {},
      redundantGroups: [],
      largeCalls: [],
      mcpTurnPct: 0,
    },
  });
  const result = generateRecommendations(input, t);
  const severities = result.map((r) => r.severity);
  const highIdx = severities.indexOf("high");
  const mediumIdx = severities.indexOf("medium");
  // Not all inputs trigger medium, but if both exist high should come before medium
  if (highIdx !== -1 && mediumIdx !== -1) {
    assert.ok(highIdx < mediumIdx, "high severity should come before medium");
  }
  console.log("✓ severity sorting");
}

console.log("\nAll recommendation tests passed!");
