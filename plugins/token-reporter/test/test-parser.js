"use strict";
import assert from "assert";
import path from "path";
import fs from "fs";
import os from "os";

const { parseSession } = await import(path.join(process.cwd(), "backend", "dist", "parser", "index.js"));

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

/** Session where the user "message" is a slash command wrapper (Claude Code 2.1+ format) */
function slashCommandSession() {
  return [
    {
      type: "user",
      uuid: "u1",
      message: {
        role: "user",
        content:
          "<command-message>release-plugin</command-message>\n<command-name>/release-plugin</command-name>",
      },
      sessionId: "s1",
      slug: "slash-cmd-test",
      gitBranch: "main",
      timestamp: "2026-04-09T17:05:31.488Z",
    },
    {
      type: "assistant",
      uuid: "a1",
      parentUuid: "u1",
      timestamp: "2026-04-09T17:05:32.000Z",
      message: {
        model: "claude-opus-4-6",
        usage: { input_tokens: 120, output_tokens: 40 },
        content: [{ type: "text", text: "Releasing the plugin now." }],
      },
    },
  ];
}

/**
 * Session with a slash command whose stdout is emitted as a type:"user"
 * string containing <local-command-stdout>, plus a <local-command-caveat>
 * meta message, followed by the next user prompt + assistant reply.
 * This mirrors the 2.1.96 /plugin command pattern.
 */
function slashCommandWithUserStdoutSession() {
  return [
    {
      type: "user",
      uuid: "u1",
      message: {
        role: "user",
        content:
          "<command-name>/plugin</command-name>\n            <command-message>plugin</command-message>\n            <command-args></command-args>",
      },
      sessionId: "s1",
      slug: "plugin-cmd-test",
      gitBranch: "main",
      timestamp: "2026-04-09T17:16:41.802Z",
    },
    {
      type: "user",
      uuid: "u2",
      parentUuid: "u1",
      message: {
        role: "user",
        content:
          "<local-command-stdout>token-reporter is already at the latest version (2.7.2).</local-command-stdout>",
      },
      timestamp: "2026-04-09T17:16:41.802Z",
    },
    {
      type: "user",
      uuid: "u3",
      parentUuid: "u2",
      isMeta: true,
      message: {
        role: "user",
        content:
          "<local-command-caveat>Caveat: The messages below were generated by the user while running local commands. DO NOT respond to these messages or otherwise consider them in your response unless the user explicitly asks you to.</local-command-caveat>",
      },
      timestamp: "2026-04-09T17:16:45.259Z",
    },
    {
      type: "user",
      uuid: "u4",
      parentUuid: "u3",
      message: {
        role: "user",
        content: [{ type: "text", text: "now continue working" }],
      },
      timestamp: "2026-04-09T17:16:50.000Z",
    },
    {
      type: "assistant",
      uuid: "a1",
      parentUuid: "u4",
      timestamp: "2026-04-09T17:16:51.000Z",
      message: {
        model: "claude-opus-4-6",
        usage: { input_tokens: 200, output_tokens: 60 },
        content: [{ type: "text", text: "Continuing." }],
      },
    },
  ];
}

/**
 * Session with a slash command followed by the legacy system/local_command
 * stdout record (Claude Code 2.1.96 /reload-plugins pattern).
 */
function slashCommandWithSystemStdoutSession() {
  return [
    {
      type: "user",
      uuid: "u1",
      message: {
        role: "user",
        content:
          "<command-name>/reload-plugins</command-name>\n            <command-message>reload-plugins</command-message>\n            <command-args></command-args>",
      },
      sessionId: "s1",
      slug: "reload-cmd-test",
      gitBranch: "main",
      timestamp: "2026-04-09T17:16:45.228Z",
    },
    {
      type: "system",
      subtype: "local_command",
      uuid: "sys1",
      parentUuid: "u1",
      content:
        "<local-command-stdout>Reloaded: 6 plugins · 6 skills · 6 agents · 5 hooks · 0 plugin MCP servers · 1 plugin LSP server</local-command-stdout>",
      timestamp: "2026-04-09T17:16:45.259Z",
    },
    {
      type: "user",
      uuid: "u2",
      parentUuid: "sys1",
      message: {
        role: "user",
        content: [{ type: "text", text: "great, now do X" }],
      },
      timestamp: "2026-04-09T17:16:50.000Z",
    },
    {
      type: "assistant",
      uuid: "a1",
      parentUuid: "u2",
      timestamp: "2026-04-09T17:16:51.000Z",
      message: {
        model: "claude-opus-4-6",
        usage: { input_tokens: 100, output_tokens: 30 },
        content: [{ type: "text", text: "ok" }],
      },
    },
  ];
}

/**
 * Session with an inline bash command (typed with `! ` prefix in the CLI).
 * Recorded as two type:"user" string records: <bash-input> then
 * <bash-stdout>...<bash-stderr>...</bash-stderr>.
 */
function bashInlineSession() {
  return [
    {
      type: "user",
      uuid: "u1",
      message: {
        role: "user",
        content: "<bash-input>token-reporter-dev stop</bash-input>",
      },
      sessionId: "s1",
      slug: "bash-test",
      gitBranch: "main",
      timestamp: "2026-04-09T16:56:10.162Z",
    },
    {
      type: "user",
      uuid: "u2",
      parentUuid: "u1",
      message: {
        role: "user",
        content:
          "<bash-stdout>Dev server stopped.\nRemoved dev server targets from status line targets</bash-stdout><bash-stderr></bash-stderr>",
      },
      timestamp: "2026-04-09T16:56:12.654Z",
    },
    {
      type: "user",
      uuid: "u3",
      parentUuid: "u2",
      message: {
        role: "user",
        content: [{ type: "text", text: "thanks, now proceed" }],
      },
      timestamp: "2026-04-09T16:56:15.000Z",
    },
    {
      type: "assistant",
      uuid: "a1",
      parentUuid: "u3",
      timestamp: "2026-04-09T16:56:16.000Z",
      message: {
        model: "claude-opus-4-6",
        usage: { input_tokens: 80, output_tokens: 20 },
        content: [{ type: "text", text: "ok" }],
      },
    },
  ];
}

/** Session where inline bash command produced stderr output. */
function bashInlineErrorSession() {
  return [
    {
      type: "user",
      uuid: "u1",
      message: {
        role: "user",
        content: "<bash-input>ls /no/such/path</bash-input>",
      },
      sessionId: "s1",
      slug: "bash-err-test",
      gitBranch: "main",
      timestamp: "2026-04-09T17:00:00.000Z",
    },
    {
      type: "user",
      uuid: "u2",
      parentUuid: "u1",
      message: {
        role: "user",
        content:
          "<bash-stdout></bash-stdout><bash-stderr>ls: /no/such/path: No such file or directory</bash-stderr>",
      },
      timestamp: "2026-04-09T17:00:01.000Z",
    },
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

  // ── Bug 3: slash command wrapped user message ──
  await test("BUG FIX: slash command user message becomes a command event and clears userText", async () => {
    const { fp, dir } = writeFixture(slashCommandSession());
    try {
      const result = await parseSession(fp);
      // The assistant reply should still produce a turn with token usage
      assert.strictEqual(result.turns.length, 1);
      const turn = result.turns[0];
      assert.strictEqual(
        turn.userText, "",
        `userText should be cleared for slash command turns, got: '${turn.userText}'`
      );
      assert.strictEqual(turn.input, 120);
      assert.strictEqual(turn.output, 40);
      // The slash command should be surfaced as a system event
      const cmdEvents = result.systemEvents.filter((e) => e.type === "command");
      assert.strictEqual(cmdEvents.length, 1, "expected one command event");
      const ev = cmdEvents[0];
      assert.strictEqual(ev.command, "/release-plugin");
      assert.strictEqual(ev.message, "release-plugin");
      assert.strictEqual(ev.output, "");
      assert.strictEqual(ev.timestamp, "2026-04-09T17:05:31.488Z");
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Bug 3b: slash command stdout emitted as type:"user" string ──
  await test("BUG FIX: slash command stdout from type:user record attaches to command event", async () => {
    const { fp, dir } = writeFixture(slashCommandWithUserStdoutSession());
    try {
      const result = await parseSession(fp);
      const cmdEvents = result.systemEvents.filter((e) => e.type === "command");
      assert.strictEqual(cmdEvents.length, 1, "expected exactly one command event");
      const ev = cmdEvents[0];
      assert.strictEqual(ev.command, "/plugin");
      assert.strictEqual(ev.message, "plugin");
      assert.strictEqual(
        ev.output,
        "token-reporter is already at the latest version (2.7.2).",
        `stdout should be attached to command event, got: '${ev.output}'`
      );
      // The follow-up user turn should render normally
      assert.strictEqual(result.turns.length, 1);
      assert.strictEqual(result.turns[0].userText, "now continue working");
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Bug 3c: slash command + legacy system stdout ──
  await test("BUG FIX: legacy system/local_command stdout attaches to user-type slash command", async () => {
    const { fp, dir } = writeFixture(slashCommandWithSystemStdoutSession());
    try {
      const result = await parseSession(fp);
      const cmdEvents = result.systemEvents.filter((e) => e.type === "command");
      assert.strictEqual(cmdEvents.length, 1, "should not duplicate: one event with attached stdout");
      const ev = cmdEvents[0];
      assert.strictEqual(ev.command, "/reload-plugins");
      assert.ok(
        ev.output.includes("Reloaded: 6 plugins"),
        `legacy system stdout should attach, got: '${ev.output}'`
      );
      assert.strictEqual(result.turns.length, 1);
      assert.strictEqual(result.turns[0].userText, "great, now do X");
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  // ── Bug 3d: inline bash command (! prefix) ──
  await test("BUG FIX: inline bash command becomes a bash command event with stdout attached", async () => {
    const { fp, dir } = writeFixture(bashInlineSession());
    try {
      const result = await parseSession(fp);
      const cmdEvents = result.systemEvents.filter((e) => e.type === "command");
      assert.strictEqual(cmdEvents.length, 1);
      const ev = cmdEvents[0];
      assert.strictEqual(ev.kind, "bash");
      assert.strictEqual(ev.command, "token-reporter-dev stop");
      assert.strictEqual(ev.message, "");
      assert.ok(
        ev.output.includes("Dev server stopped."),
        `expected stdout to be attached, got: '${ev.output}'`
      );
      assert.strictEqual(ev.isError, false);
      // The follow-up user text turn should render normally
      assert.strictEqual(result.turns.length, 1);
      assert.strictEqual(result.turns[0].userText, "thanks, now proceed");
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  await test("BUG FIX: inline bash command with stderr sets isError and captures stderr", async () => {
    const { fp, dir } = writeFixture(bashInlineErrorSession());
    try {
      const result = await parseSession(fp);
      const cmdEvents = result.systemEvents.filter((e) => e.type === "command");
      assert.strictEqual(cmdEvents.length, 1);
      const ev = cmdEvents[0];
      assert.strictEqual(ev.kind, "bash");
      assert.strictEqual(ev.command, "ls /no/such/path");
      assert.ok(
        ev.output.includes("No such file or directory"),
        `expected stderr in output, got: '${ev.output}'`
      );
      assert.strictEqual(ev.isError, true);
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
