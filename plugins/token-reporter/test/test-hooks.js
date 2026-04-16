"use strict";
import assert from "assert";
import { execFile, execSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

const HOOKS_DIR = path.join(process.cwd(), "hooks");

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
      TOKEN_REPORTER_PLUGIN_ROOT: process.cwd(),
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

    // ── Cleanup: stop the server ──
    const config = JSON.parse(fs.readFileSync(path.join(dataDir, "config.json"), "utf8"));
    const testPort = config.port || 3900;

    // Priority 1: PID file
    let pid = parseInt(
      fs.readFileSync(path.join(dataDir, "server.pid"), "utf8").trim(),
    );

    // Priority 2: process search (distinguish dev vs prod)
    if (!pid || !isProcessAlive(pid)) {
      // This is a test instance (temp data dir), search for dev server processes
      pid = findDevServerProcess();
      if (pid) console.log(`  [cleanup] Found dev server by process search (PID ${pid}).`);
    }

    // Priority 3: port lookup as last resort
    if (!pid) {
      pid = getProcessOnPort(testPort);
      if (pid) {
        if (!isTokenReporterProcess(pid)) {
          console.log(`  [cleanup] Port ${testPort} occupied by non-token-reporter (PID ${pid}).`);
          fs.rmSync(dataDir, { recursive: true });
          return;
        }
        console.log(`  [cleanup] Found server by port ${testPort} (PID ${pid}).`);
      }
    }

    if (pid) {
      try { process.kill(pid, "SIGTERM"); } catch {}
      await new Promise((r) => setTimeout(r, 300));
      // Force kill if still alive
      if (isProcessAlive(pid)) {
        try { process.kill(pid, "SIGKILL"); } catch {}
      }
    }
    fs.rmSync(dataDir, { recursive: true });
  });

  function isProcessAlive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  function getProcessOnPort(port) {
    try {
      const output = execSync(`lsof -i :${port} -sTCP:LISTEN -t 2>/dev/null`, { encoding: "utf8" });
      return parseInt(output.trim().split("\n")[0]) || null;
    } catch { return null; }
  }

  function isTokenReporterProcess(pid) {
    try {
      const cmdline = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: "utf8" });
      return cmdline.includes("node") || cmdline.includes("token");
    } catch { return false; }
  }

  function findDevServerProcess() {
    try {
      const output = execSync(
        `ps aux 2>/dev/null | grep -E 'node.*server\\.js' | grep -v grep | grep -E 'tmp|temp|test' || true`,
        { encoding: "utf8" }
      );
      const lines = output.trim().split("\n").filter((l) => l.trim());
      if (lines.length === 0) return null;
      return parseInt(lines[0].trim().split(/\s+/)[1]) || null;
    } catch { return null; }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
