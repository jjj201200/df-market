"use strict";
const assert = require("assert");
const { computeCacheMetrics } = require("../frontend/src/utils/analytics/index.ts");

function makeTurn(overrides) {
  return {
    id: 1,
    input: 0,
    output: 0,
    cacheR: 0,
    cacheC: 0,
    model: "claude-sonnet-4-6",
    user: "",
    assistantText: "",
    isSidechain: false,
    tools: [],
    timestamp: "2026-01-01T00:00:00Z",
    time: "00:00:00",
    thinking: null,
    agentId: null,
    ...overrides,
  };
}

// Test 1: empty turns
{
  const result = computeCacheMetrics([]);
  assert.strictEqual(result.totalCacheR, 0);
  assert.strictEqual(result.totalCacheC, 0);
  assert.strictEqual(result.totalInput, 0);
  assert.strictEqual(result.hitRate, 0);
  assert.strictEqual(result.efficiencyRatio, 0);
  assert.strictEqual(result.estimatedSavings, 0);
  assert.deepStrictEqual(result.perTurnHitRate, []);
  console.log("✓ empty turns");
}

// Test 2: single turn with cache read
{
  const turns = [makeTurn({ id: 1, input: 1000, cacheR: 2000, cacheC: 500 })];
  const result = computeCacheMetrics(turns);
  assert.strictEqual(result.totalCacheR, 2000);
  assert.strictEqual(result.totalCacheC, 500);
  assert.strictEqual(result.totalInput, 1000);
  assert.strictEqual(result.hitRate, 2000 / 3000);
  assert.strictEqual(result.efficiencyRatio, 2000 / 500);
  assert.ok(result.estimatedSavings > 0);
  assert.deepStrictEqual(result.perTurnHitRate, [{ turnId: 1, rate: 2000 / 3000 }]);
  console.log("✓ single turn with cache read");
}

// Test 3: multiple turns accumulate correctly
{
  const turns = [
    makeTurn({ id: 1, input: 1000, cacheR: 2000, cacheC: 500 }),
    makeTurn({ id: 2, input: 500, cacheR: 0, cacheC: 0 }),
  ];
  const result = computeCacheMetrics(turns);
  assert.strictEqual(result.totalCacheR, 2000);
  assert.strictEqual(result.totalCacheC, 500);
  assert.strictEqual(result.totalInput, 1500);
  assert.strictEqual(result.hitRate, 2000 / 3500);
  console.log("✓ multiple turns accumulate correctly");
}

// Test 4: per-turn hit rate with zero denominator
{
  const turns = [makeTurn({ id: 1, input: 0, cacheR: 0, cacheC: 100 })];
  const result = computeCacheMetrics(turns);
  assert.strictEqual(result.perTurnHitRate[0].rate, 0);
  console.log("✓ per-turn hit rate with zero denominator");
}

// Test 5: estimated savings uses per-turn model pricing
{
  const turns = [
    makeTurn({ id: 1, input: 0, cacheR: 1_000_000, cacheC: 0, model: "claude-sonnet-4-6" }),
    makeTurn({ id: 2, input: 0, cacheR: 1_000_000, cacheC: 0, model: "claude-opus-4-6" }),
  ];
  const result = computeCacheMetrics(turns);
  // Sonnet saving = 1M * (3 - 0.3) / 1M = 2.7
  // Opus saving = 1M * (15 - 1.5) / 1M = 13.5
  const expected = 2.7 + 13.5;
  assert.strictEqual(result.estimatedSavings, expected);
  console.log("✓ estimated savings uses per-turn model pricing");
}

console.log("\nAll cache metrics tests passed!");
