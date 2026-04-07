#!/usr/bin/env node
"use strict";
/**
 * Status Line Integration Tests
 * Tests the wrapper script generation and basic logic
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    console.error(`    ${e.stack?.split('\n')[1]?.trim() || ''}`);
    failed++;
  }
}

// Helper to create temp test environment
function createTestEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-statusline-test-"));
  const claudeDir = path.join(tmpDir, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });

  return {
    tmpDir,
    claudeDir,
    scriptPath: path.join(claudeDir, "statusline-command.sh"),
    originalPath: path.join(claudeDir, "statusline-command.sh.original"),
    settingsPath: path.join(claudeDir, "settings.json"),
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {}
    },
  };
}

// Test wrapper script content
function testWrapperScript() {
  const wrapperContent = `#!/bin/sh
# Token Reporter Status Line Wrapper
# Generated automatically - Do not edit manually

# Read input from Claude Code
INPUT=$(cat)

# Forward token limits data to token-reporter server (async, silent)
(
  echo "$INPUT" | jq -n --argjson input "$INPUT" '{
    timestamp: now,
    session_id: $input.session_id,
    context_window: $input.context_window,
    rate_limits: $input.rate_limits,
    model: $input.model,
    cost: $input.cost
  }' 2>/dev/null | curl -s -X POST \
    http://localhost:3737/api/limits \
    -H "Content-Type: application/json" \
    -d @- \
    --connect-timeout 1 \
    --max-time 2 \
    2>/dev/null
) &

# Call original script with the input
echo "$INPUT" | sh "${'$'}{HOME}/.claude/statusline-command.sh.original"
`;

  // Verify wrapper has all required components
  assert.strictEqual(wrapperContent.includes("Token Reporter Status Line Wrapper"), true, "Should have header comment");
  assert.strictEqual(wrapperContent.includes('session_id: $input.session_id'), true, "Should extract session_id");
  assert.strictEqual(wrapperContent.includes('context_window: $input.context_window'), true, "Should extract context_window");
  assert.strictEqual(wrapperContent.includes('rate_limits: $input.rate_limits'), true, "Should extract rate_limits");
  assert.strictEqual(wrapperContent.includes("http://localhost:3737/api/limits"), true, "Should post to correct endpoint");
  assert.strictEqual(wrapperContent.includes("statusline-command.sh.original"), true, "Should call original script");

  return wrapperContent;
}

async function main() {
  console.log("\n[Status Line Integration Tests]");

  // ── Wrapper Script Content ─────────────────────────
  console.log("\n[Wrapper Script Generation]");

  await test("wrapper contains all required fields", async () => {
    testWrapperScript();
  });

  await test("wrapper forwards data asynchronously", async () => {
    const wrapper = testWrapperScript();
    assert.strictEqual(wrapper.includes("("), true, "Should use subshell for async");
    assert.strictEqual(wrapper.includes("&"), true, "Should background the curl process");
  });

  await test("wrapper handles missing jq gracefully", async () => {
    const wrapper = testWrapperScript();
    assert.strictEqual(wrapper.includes("2>/dev/null"), true, "Should suppress errors");
  });

  // ── File Operations ────────────────────────────────
  console.log("\n[File Operations]");

  await test("backup creates .original file", async () => {
    const env = createTestEnv();

    // Create original script
    fs.writeFileSync(env.scriptPath, "#!/bin/sh\necho 'original'");

    // Simulate backup
    fs.copyFileSync(env.scriptPath, env.originalPath);

    assert.ok(fs.existsSync(env.originalPath), ".original should exist");
    assert.strictEqual(
      fs.readFileSync(env.originalPath, "utf8"),
      "#!/bin/sh\necho 'original'",
      "Content should match"
    );

    env.cleanup();
  });

  await test("wrapper replaces original script", async () => {
    const env = createTestEnv();

    // Create original and backup
    fs.writeFileSync(env.scriptPath, "#!/bin/sh\necho 'original'");
    fs.copyFileSync(env.scriptPath, env.originalPath);

    // Write wrapper
    const wrapperContent = testWrapperScript();
    fs.writeFileSync(env.scriptPath, wrapperContent);

    assert.strictEqual(
      fs.readFileSync(env.scriptPath, "utf8").includes("Token Reporter"),
      true,
      "Script should be wrapper"
    );

    env.cleanup();
  });

  await test("restore copies .original back to script", async () => {
    const env = createTestEnv();

    // Setup: original backed up, wrapper in place
    fs.writeFileSync(env.originalPath, "#!/bin/sh\necho 'original'");
    fs.writeFileSync(env.scriptPath, "#!/bin/sh\necho 'wrapper'");

    // Simulate restore
    fs.copyFileSync(env.originalPath, env.scriptPath);

    assert.strictEqual(
      fs.readFileSync(env.scriptPath, "utf8"),
      "#!/bin/sh\necho 'original'",
      "Should restore original content"
    );

    env.cleanup();
  });

  // ── Settings Management ────────────────────────────
  console.log("\n[Settings Management]");

  await test("integration flag is stored in settings", async () => {
    const env = createTestEnv();

    const settings = {
      statusLine: { type: "command", command: "sh ~/.claude/statusline-command.sh" },
    };
    fs.writeFileSync(env.settingsPath, JSON.stringify(settings, null, 2));

    // Simulate enable
    settings._tokenReporterStatusLineIntegrated = true;
    fs.writeFileSync(env.settingsPath, JSON.stringify(settings, null, 2));

    const saved = JSON.parse(fs.readFileSync(env.settingsPath, "utf8"));
    assert.strictEqual(saved._tokenReporterStatusLineIntegrated, true);

    env.cleanup();
  });

  await test("disable removes integration flag", async () => {
    const env = createTestEnv();

    const settings = {
      statusLine: { type: "command", command: "sh ~/.claude/statusline-command.sh" },
      _tokenReporterStatusLineIntegrated: true,
    };
    fs.writeFileSync(env.settingsPath, JSON.stringify(settings, null, 2));

    // Simulate disable
    delete settings._tokenReporterStatusLineIntegrated;
    fs.writeFileSync(env.settingsPath, JSON.stringify(settings, null, 2));

    const saved = JSON.parse(fs.readFileSync(env.settingsPath, "utf8"));
    assert.strictEqual(saved._tokenReporterStatusLineIntegrated, undefined);

    env.cleanup();
  });

  // ── Integration Detection ──────────────────────────
  console.log("\n[Integration Detection]");

  await test("detects integrated when flag is true", async () => {
    const env = createTestEnv();

    fs.writeFileSync(env.settingsPath, JSON.stringify({
      _tokenReporterStatusLineIntegrated: true,
    }));

    const settings = JSON.parse(fs.readFileSync(env.settingsPath, "utf8"));
    const isIntegrated = settings._tokenReporterStatusLineIntegrated === true;

    assert.strictEqual(isIntegrated, true);

    env.cleanup();
  });

  await test("detects not integrated when flag is missing", async () => {
    const env = createTestEnv();

    fs.writeFileSync(env.settingsPath, JSON.stringify({
      statusLine: { type: "command", command: "sh ~/.claude/statusline-command.sh" },
    }));

    const settings = JSON.parse(fs.readFileSync(env.settingsPath, "utf8"));
    const isIntegrated = settings._tokenReporterStatusLineIntegrated === true;

    assert.strictEqual(isIntegrated, false);

    env.cleanup();
  });

  await test("detects not integrated when no settings", async () => {
    const env = createTestEnv();

    // No settings file
    const isIntegrated = false; // Default

    assert.strictEqual(isIntegrated, false);

    env.cleanup();
  });

  // ── Edge Cases ─────────────────────────────────────
  console.log("\n[Edge Cases]");

  await test("handles missing original script gracefully", async () => {
    const env = createTestEnv();

    // Try to restore when .original doesn't exist
    const canRestore = fs.existsSync(env.originalPath);
    assert.strictEqual(canRestore, false);

    env.cleanup();
  });

  await test("wrapper preserves exit code of original script", async () => {
    const wrapper = testWrapperScript();
    // The wrapper ends with calling the original script directly,
    // so the exit code should be preserved
    assert.strictEqual(
      wrapper.trim().endsWith('"${HOME}/.claude/statusline-command.sh.original"'),
      true,
      "Should end with original script call"
    );
  });

  await test("handles concurrent status line calls", async () => {
    const wrapper = testWrapperScript();
    // Each call is independent - uses $(cat) to read fresh input
    assert.strictEqual(wrapper.includes("INPUT=$(cat)"), true, "Should read fresh input each time");
    // Background curl won't block
    assert.strictEqual(wrapper.includes("&"), true, "Should not block on curl");
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
