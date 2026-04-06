"use strict";
const assert = require("assert");
const { execFile } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const HOOKS_DIR = path.join(__dirname, "..", "hooks");

let passed = 0;
let failed = 0;

function run(script, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const dataDir =
      opts.dataDir || path.join(os.tmpdir(), "tr-hooks-test-" + Date.now());
    const env = {
      ...process.env,
      TOKEN_REPORTER_DATA_DIR: dataDir,
      TOKEN_REPORTER_PLUGIN_ROOT: path.join(__dirname, ".."),
    };
    const child = execFile(
      process.execPath,
      [path.join(HOOKS_DIR, script)],
      {
        env,
        timeout: 8000,
      },
      (err, stdout, stderr) => {
        resolve({ code: err ? err.code || 1 : 0, stdout, stderr });
      },
    );
    if (opts.stdin) {
      child.stdin.end(opts.stdin);
    }
  });
}

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

async function main() {
  console.log("\n[hooks smoke tests]");

  await test("session-end.js: exits 0 when no server running (idempotent)", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-hooks-"));
    const r = await run("session-end.js", { dataDir });
    assert.strictEqual(
      r.code,
      0,
      `expected exit code 0, got: ${r.code}\nstderr: ${r.stderr}`,
    );
    fs.rmSync(dataDir, { recursive: true });
  });

  await test("post-tool-use.js: exits 0 silently when server is not running", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-hooks-"));
    const stdin = JSON.stringify({ session_id: "test", tool_name: "Bash" });
    const r = await run("post-tool-use.js", { dataDir, stdin });
    assert.strictEqual(
      r.code,
      0,
      `expected exit code 0, got: ${r.code}\nstderr: ${r.stderr}`,
    );
    fs.rmSync(dataDir, { recursive: true });
  });

  await test("session-start.js: exits 0 when autoStart=false", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-hooks-"));
    fs.writeFileSync(
      path.join(dataDir, "config.json"),
      JSON.stringify({
        port: 3737,
        autoStart: false,
        lastVersion: "1.0.0",
      }),
    );
    const r = await run("session-start.js", { dataDir });
    assert.strictEqual(
      r.code,
      0,
      `expected exit code 0, got: ${r.code}\nstderr: ${r.stderr}`,
    );
    assert.strictEqual(fs.existsSync(path.join(dataDir, "server.pid")), false);
    fs.rmSync(dataDir, { recursive: true });
  });

  await test("session-start.js: starts server and creates server.pid when autoStart=true", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-hooks-"));
    fs.writeFileSync(
      path.join(dataDir, "config.json"),
      JSON.stringify({
        port: 3900,
        autoStart: true,
        lastVersion: "1.0.0",
      }),
    );
    const r = await run("session-start.js", { dataDir });
    assert.strictEqual(
      r.code,
      0,
      `expected exit code 0, got: ${r.code}\nstderr: ${r.stderr}`,
    );
    assert.strictEqual(
      fs.existsSync(path.join(dataDir, "server.pid")),
      true,
      "server.pid should exist",
    );
    // Cleanup: stop the server
    const pid = parseInt(
      fs.readFileSync(path.join(dataDir, "server.pid"), "utf8").trim(),
    );
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
    fs.rmSync(dataDir, { recursive: true });
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
