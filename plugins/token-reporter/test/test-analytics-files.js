"use strict";
const assert = require("assert");
const { computeFileMetrics } = require("../frontend/src/utils/analytics.ts");

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
  const result = computeFileMetrics([]);
  assert.strictEqual(result.totalReadFiles, 0);
  assert.strictEqual(result.totalEditFiles, 0);
  assert.strictEqual(result.totalReadOps, 0);
  assert.strictEqual(result.totalEditOps, 0);
  assert.strictEqual(result.readEditRatio, 0);
  console.log("✓ empty turns");
}

// Test 2: read and edit ops counting
{
  const turns = [
    makeTurn({
      id: 1,
      tools: [
        makeTool({ cls: "read", name: "read", input: [{ k: "file_path", v: "/a.js" }] }),
        makeTool({ cls: "read", name: "read", input: [{ k: "file_path", v: "/a.js" }] }),
        makeTool({ cls: "edit", name: "edit", input: [{ k: "file_path", v: "/a.js" }] }),
        makeTool({ cls: "write", name: "write", input: [{ k: "file_path", v: "/b.js" }] }),
      ],
    }),
  ];
  const result = computeFileMetrics(turns);
  assert.strictEqual(result.totalReadOps, 2);
  assert.strictEqual(result.totalEditOps, 2);
  assert.strictEqual(result.totalReadFiles, 1);
  assert.strictEqual(result.totalEditFiles, 2);
  assert.strictEqual(result.readEditRatio, 0.5);
  console.log("✓ read and edit ops counting");
}

// Test 3: bloated grep detection
{
  const turns = [
    makeTurn({
      id: 1,
      tools: [
        makeTool({
          cls: "grep",
          name: "grep",
          input: [
            { k: "pattern", v: "foo" },
            { k: "glob", v: "*.ts" },
          ],
          retLines: "150 lines",
        }),
      ],
    }),
  ];
  const result = computeFileMetrics(turns);
  assert.strictEqual(result.bloatedGreps.length, 1);
  assert.strictEqual(result.bloatedGreps[0].retLines, 150);
  console.log("✓ bloated grep detection");
}

// Test 4: unread reads (read >= 2 but never edited)
{
  const turns = [
    makeTurn({
      id: 1,
      tools: [
        makeTool({ cls: "read", input: [{ k: "file_path", v: "/only-read.js" }] }),
        makeTool({ cls: "read", input: [{ k: "file_path", v: "/only-read.js" }] }),
      ],
    }),
  ];
  const result = computeFileMetrics(turns);
  assert.strictEqual(result.unreadReads.length, 1);
  assert.strictEqual(result.unreadReads[0].filePath, "/only-read.js");
  console.log("✓ unread reads detection");
}

console.log("\nAll file metrics tests passed!");
