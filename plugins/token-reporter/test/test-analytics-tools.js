"use strict";
const assert = require("assert");
const { computeToolEfficiency } = require("../frontend/src/utils/analytics.ts");

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

function makeTool(overrides) {
  return {
    name: "read",
    cls: "read",
    params: "",
    status: "ok",
    input: [{ k: "file_path", v: "/tmp/test.js" }],
    output: "content",
    retSize: "10 B",
    retLines: "1 line",
    isErr: false,
    dur: "—",
    mcp: null,
    ...overrides,
  };
}

// Test 1: empty turns
{
  const result = computeToolEfficiency([]);
  assert.strictEqual(result.totalCalls, 0);
  assert.strictEqual(result.totalErrors, 0);
  assert.strictEqual(result.errorRate, 0);
  assert.deepStrictEqual(result.redundantGroups, []);
  assert.deepStrictEqual(result.largeCalls, []);
  console.log("✓ empty turns");
}

// Test 2: basic counts and error rate
{
  const turns = [
    makeTurn({
      id: 1,
      tools: [
        makeTool({ name: "read", cls: "read" }),
        makeTool({ name: "bash", cls: "bash", isErr: true }),
      ],
    }),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.totalCalls, 2);
  assert.strictEqual(result.totalErrors, 1);
  assert.strictEqual(result.errorRate, 0.5);
  assert.strictEqual(result.errorsByClass.read.total, 1);
  assert.strictEqual(result.errorsByClass.bash.total, 1);
  assert.strictEqual(result.errorsByClass.bash.errors, 1);
  console.log("✓ basic counts and error rate");
}

// Test 3: redundant detection with identical outputs
{
  const turns = [
    makeTurn({ id: 1, tools: [makeTool({ output: "same content" })] }),
    makeTurn({ id: 2, tools: [makeTool({ output: "same content" })] }),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.redundantGroups.length, 1);
  assert.strictEqual(result.redundantGroups[0].count, 2);
  console.log("✓ redundant detection with identical outputs");
}

// Test 4: redundant detection should NOT flag diverging outputs beyond 200 chars
// This documents the CURRENT behavior (false positive) — may be fixed in later task
{
  const prefix = "a".repeat(200);
  const turns = [
    makeTurn({ id: 1, tools: [makeTool({ output: prefix + "-suffix-1" })] }),
    makeTurn({ id: 2, tools: [makeTool({ output: prefix + "-suffix-2" })] }),
  ];
  const result = computeToolEfficiency(turns);
  // Current implementation compares first 200 chars only
  assert.strictEqual(result.redundantGroups.length, 1);
  console.log("✓ redundant detection 200-char truncation behavior documented");
}

// Test 5: large calls detection (>50KB)
{
  const turns = [
    makeTurn({ id: 1, tools: [makeTool({ retSize: "60 KB", retContent: "x".repeat(60 * 1024) })] }),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.largeCalls.length, 1);
  assert.strictEqual(result.largeCalls[0].retBytes, 60 * 1024);
  console.log("✓ large calls detection");
}

// Test 6: mcpTurnPct calculation
{
  const turns = [
    makeTurn({ id: 1, tools: [makeTool({ name: "mcp__server__method", cls: "mcp", mcp: { server: "s", method: "m" } })] }),
    makeTurn({ id: 2, tools: [makeTool({ name: "read", cls: "read" })] }),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.mcpTurnPct, 0.5);
  console.log("✓ mcpTurnPct calculation");
}

// Test 7: errors by class rate computation
{
  const turns = [
    makeTurn({
      id: 1,
      tools: [
        makeTool({ name: "bash", cls: "bash", isErr: true }),
        makeTool({ name: "bash", cls: "bash", isErr: true }),
        makeTool({ name: "bash", cls: "bash" }),
      ],
    }),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.errorsByClass.bash.total, 3);
  assert.strictEqual(result.errorsByClass.bash.errors, 2);
  assert.strictEqual(result.errorsByClass.bash.rate, 2 / 3);
  console.log("✓ errors by class rate computation");
}

console.log("\nAll tool efficiency tests passed!");
