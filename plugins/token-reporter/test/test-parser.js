"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { parseSession } = require(path.join(__dirname, "..", "backend", "parser.js"));

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

/**
 * Write a JSONL fixture file with the given records and return its path.
 */
function writeFixture(records) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-parser-"));
  const fp = path.join(dir, "test-session.jsonl");
  fs.writeFileSync(fp, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return { fp, dir };
}

// ── Fixtures ──

/** Minimal session: user → assistant with tool_use + string tool_result */
function basicSession() {
  return [
    { type: "user", uuid: "u1", message: { content: [{ type: "text", text: "Hello" }] }, sessionId: "s1", slug: "test-slug", gitBranch: "main" },
    { type: "assistant", uuid: "a1", parentUuid: "u1", timestamp: "2026-04-07T00:00:00Z", message: {
      model: "claude-opus-4-6",
      usage: { input_tokens: 100, output_tokens: 50 },
      content: [
        { type: "text", text: "Hi there" },
        { type: "tool_use", id: "tu1", name: "Bash", input: { command: "ls" } },
      ],
    }},
    { type: "user", uuid: "u2", parentUuid: "a1", timestamp: "2026-04-07T00:00:01Z", message: { content: [
      { type: "tool_result", tool_use_id: "tu1", content: "file1.txt\nfile2.txt", is_error: false },
    ]}},
  ];
}

/** Session with Agent tool_use whose tool_result.content is an array (not string) */
function agentSession() {
  return [
    { type: "user", uuid: "u1", message: { content: [{ type: "text", text: "Analyze the code" }] }, sessionId: "s1", slug: "agent-test", gitBranch: "main" },
    { type: "assistant", uuid: "a1", parentUuid: "u1", timestamp: "2026-04-07T00:00:00Z", message: {
      model: "claude-opus-4-6",
      usage: { input_tokens: 200, output_tokens: 100 },
      content: [
        { type: "tool_use", id: "tu-agent", name: "Agent", input: { description: "Explore code", subagent_type: "Explore", prompt: "Find files" } },
      ],
    }},
    { type: "user", uuid: "u2", parentUuid: "a1", timestamp: "2026-04-07T00:00:05Z", message: { content: [
      { type: "tool_result", tool_use_id: "tu-agent", content: [
        { type: "text", text: "Found 3 files:\n- src/a.js\n- src/b.js\n- src/c.js" },
      ], is_error: false },
    ]}},
  ];
}

/** Session where the first assistant's parent chain is: user → attachment → assistant */
function attachmentChainSession() {
  return [
    { type: "user", uuid: "u1", message: { content: [{ type: "text", text: "Please create CLAUDE.md" }] }, sessionId: "s1", slug: "chain-test", gitBranch: "main" },
    { type: "attachment", uuid: "att1", parentUuid: "u1", attachment: { type: "deferred_tools_delta", addedNames: ["AskUserQuestion"] } },
    { type: "assistant", uuid: "a1", parentUuid: "att1", timestamp: "2026-04-07T00:00:00Z", message: {
      model: "claude-opus-4-6",
      usage: { input_tokens: 500, output_tokens: 200 },
      content: [{ type: "text", text: "I'll create the file." }],
    }},
  ];
}

/** Session with multiple attachment layers: user → attachment → attachment → assistant */
function deepChainSession() {
  return [
    { type: "user", uuid: "u1", message: { content: [{ type: "text", text: "Deep chain test" }] }, sessionId: "s1", slug: "deep-chain", gitBranch: "main" },
    { type: "attachment", uuid: "att1", parentUuid: "u1", attachment: { type: "a" } },
    { type: "attachment", uuid: "att2", parentUuid: "att1", attachment: { type: "b" } },
    { type: "assistant", uuid: "a1", parentUuid: "att2", timestamp: "2026-04-07T00:00:00Z", message: {
      model: "claude-opus-4-6",
      usage: { input_tokens: 100, output_tokens: 50 },
      content: [{ type: "text", text: "Response" }],
    }},
  ];
}

/** Session with thinking block */
function thinkingSession() {
  return [
    { type: "user", uuid: "u1", message: { content: [{ type: "text", text: "Think about this" }] }, sessionId: "s1", slug: "thinking-test", gitBranch: "main" },
    { type: "assistant", uuid: "a1", parentUuid: "u1", timestamp: "2026-04-07T00:00:00Z", message: {
      model: "claude-opus-4-6",
      usage: { input_tokens: 300, output_tokens: 150, cache_read_input_tokens: 50 },
      content: [
        { type: "thinking", thinking: "Let me think about this carefully..." },
        { type: "text", text: "Here is my answer." },
      ],
    }},
  ];
}

async function main() {
  console.log("\n[parser bug fix tests]");

  // ── Basic parsing ──
  await test("basic session: parses user text and tool result correctly", async () => {
    const { fp, dir } = writeFixture(basicSession());
    try {
      const result = await parseSession(fp);
      assert.ok(result, "parseSession should return a result");
      assert.strictEqual(result.turns.length, 1);
      const turn = result.turns[0];
      assert.strictEqual(turn.userText, "Hello");
      assert.strictEqual(turn.assistantText, "Hi there");
      assert.strictEqual(turn.tools.length, 1);
      assert.strictEqual(turn.tools[0].name, "Bash");
      // tool_result content is a string → should be preserved as-is
      assert.ok(
        turn.tools[0].retContent.includes("file1.txt"),
        `Expected tool result to contain 'file1.txt', got: ${turn.tools[0].retContent.slice(0, 100)}`
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Bug 1: Agent tool_result with array content ──
  await test("BUG FIX: Agent tool_result array content is extracted as text (not JSON)", async () => {
    const { fp, dir } = writeFixture(agentSession());
    try {
      const result = await parseSession(fp);
      const turn = result.turns[0];
      assert.strictEqual(turn.tools.length, 1);
      assert.strictEqual(turn.tools[0].name, "Agent");
      assert.strictEqual(turn.tools[0].cls, "agent");
      // The tool result content should be the extracted text, NOT JSON stringified
      assert.ok(
        !turn.tools[0].retContent.includes('"type"'),
        `Agent tool result should NOT contain raw JSON. Got: ${turn.tools[0].retContent.slice(0, 200)}`
      );
      assert.ok(
        turn.tools[0].retContent.includes("Found 3 files"),
        `Agent tool result should contain readable text. Got: ${turn.tools[0].retContent.slice(0, 200)}`
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Bug 2: parentUuid chain through attachment ──
  await test("BUG FIX: user text found through attachment chain (user → attachment → assistant)", async () => {
    const { fp, dir } = writeFixture(attachmentChainSession());
    try {
      const result = await parseSession(fp);
      const turn = result.turns[0];
      assert.strictEqual(
        turn.userText, "Please create CLAUDE.md",
        `Expected user text 'Please create CLAUDE.md', got: '${turn.userText}'`
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  await test("BUG FIX: user text found through deep chain (user → att → att → assistant)", async () => {
    const { fp, dir } = writeFixture(deepChainSession());
    try {
      const result = await parseSession(fp);
      const turn = result.turns[0];
      assert.strictEqual(
        turn.userText, "Deep chain test",
        `Expected user text 'Deep chain test', got: '${turn.userText}'`
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Thinking block ──
  await test("thinking block is extracted correctly", async () => {
    const { fp, dir } = writeFixture(thinkingSession());
    try {
      const result = await parseSession(fp);
      const turn = result.turns[0];
      assert.ok(turn.thinking, "thinking should not be null");
      assert.ok(
        turn.thinking.includes("think about this carefully"),
        `thinking should contain expected text, got: ${turn.thinking.slice(0, 100)}`
      );
      assert.strictEqual(turn.cacheR, 50, "cache_read should be 50");
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Token usage ──
  await test("token usage fields are captured correctly", async () => {
    const { fp, dir } = writeFixture(basicSession());
    try {
      const result = await parseSession(fp);
      const turn = result.turns[0];
      assert.strictEqual(turn.input, 100);
      assert.strictEqual(turn.output, 50);
      assert.strictEqual(turn.cacheR, 0);
      assert.strictEqual(turn.cacheC, 0);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Session metadata ──
  await test("session metadata (slug, gitBranch) is extracted", async () => {
    const { fp, dir } = writeFixture(basicSession());
    try {
      const result = await parseSession(fp);
      assert.strictEqual(result.slug, "test-slug");
      assert.strictEqual(result.gitBranch, "main");
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
