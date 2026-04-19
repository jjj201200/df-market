"use strict";
import assert from "assert";
import { execFile, execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";

const PLUGIN_ROOT = path.join(process.cwd());
// Pick a random high port at test start to dodge any running prod/dev instance
// (3737 = prod default, 13737 = dev default per CLAUDE.md). Previously hardcoded
// 13737 but that collides with an active `token-reporter-dev start` Vite server.
const TEST_PORT = 20000 + Math.floor(Math.random() * 20000);

let passed = 0;
let failed = 0;
let serverProcess = null;
let dataDir = null;

function fetch(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("timeout")); });
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

/* ── Process finding helpers (distinguish dev vs prod) ── */

function findDevServerProcess() {
  try {
    // Look for node processes with server.js in a temp/test dir (dev/test instance)
    const output = execSync(
      `ps aux 2>/dev/null | grep -E 'node.*server\.js' | grep -v grep | grep -E 'tmp|temp|test' || true`,
      { encoding: "utf8" }
    );
    const lines = output.trim().split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;
    const parts = lines[0].trim().split(/\s+/);
    return parseInt(parts[1]) || null;
  } catch {
    return null;
  }
}

function findProdServerProcess() {
  try {
    // Look for node processes with server.js in the production plugin cache path
    const output = execSync(
      `ps aux 2>/dev/null | grep -E 'node.*server\.js' | grep -v grep | grep -E 'claude/plugins|\\.claude/plugins' | grep -v 'tmp\\|temp\\|test' || true`,
      { encoding: "utf8" }
    );
    const lines = output.trim().split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;
    const parts = lines[0].trim().split(/\s+/);
    return parseInt(parts[1]) || null;
  } catch {
    return null;
  }
}

function getProcessOnPort(port) {
  try {
    const output = execSync(`lsof -i :${port} -sTCP:LISTEN -t 2>/dev/null`, { encoding: "utf8" });
    return parseInt(output.trim().split("\n")[0]) || null;
  } catch {
    return null;
  }
}

function isTokenReporterProcess(pid) {
  try {
    const cmdline = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: "utf8" });
    return cmdline.includes("node") || cmdline.includes("token");
  } catch {
    return false;
  }
}

/**
 * Create a temp data dir with config pointing to TEST_PORT and a mock session JSONL file.
 */
function setupTestEnv() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-server-test-"));
  fs.writeFileSync(
    path.join(dataDir, "config.json"),
    JSON.stringify({ port: TEST_PORT, autoStart: false })
  );

  // Create a mock session JSONL under a fake projects dir so listSessions() can find it
  // parser.js scans ~/.claude/projects/ — we can't override that path easily,
  // so we test the server endpoints that don't depend on session listing:
  // /, static files, /events, /notify
}

function startServer() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
      TOKEN_REPORTER_DATA_DIR: dataDir,
    };
    serverProcess = execFile(process.execPath, [path.join(PLUGIN_ROOT, "backend", "dist", "server.js")], {
      env,
      timeout: 30000,
    });
    serverProcess.stderr.on("data", () => {});
    // Wait for "running at" message
    serverProcess.stdout.on("data", (data) => {
      if (data.toString().includes("running at")) {
        resolve();
      }
    });
    serverProcess.on("error", reject);
    serverProcess.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
    // Fallback: if no output within 5s, resolve anyway (might already be ready)
    setTimeout(resolve, 5000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    // Priority 1: use the direct reference if available
    if (serverProcess) {
      serverProcess.on("exit", resolve);
      try { serverProcess.kill("SIGTERM"); } catch {}
      setTimeout(() => {
        try { serverProcess.kill("SIGKILL"); } catch {}
        resolve();
      }, 3000);
      return;
    }

    // Priority 2: search for dev server process by command line
    let pid = findDevServerProcess();
    if (pid) {
      console.log(`  [cleanup] Found dev server process by search (PID ${pid}).`);
    }

    // Priority 3: fallback to port lookup
    if (!pid) {
      pid = getProcessOnPort(TEST_PORT);
      if (pid) {
        if (!isTokenReporterProcess(pid)) {
          console.log(`  [cleanup] Port ${TEST_PORT} is occupied by a non-token-reporter process (PID ${pid}).`);
          return resolve();
        }
        console.log(`  [cleanup] Found server process by port ${TEST_PORT} (PID ${pid}).`);
      }
    }

    if (!pid) return resolve();

    // Try graceful shutdown
    try { process.kill(pid, "SIGTERM"); } catch {}

    let stopped = false;
    for (let i = 0; i < 3; i++) {
      try {
        process.kill(pid, 0);
      } catch {
        stopped = true;
        break;
      }
      execSync("sleep 1");
    }

    if (!stopped) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }

    resolve();
  });
}

async function main() {
  console.log("\n[server integration tests]");
  console.log(`  (using port ${TEST_PORT} to avoid conflict with production)`); // randomized each run

  setupTestEnv();
  try {
    await startServer();
  } catch (e) {
    console.error(`  Failed to start test server: ${e.message}`);
    process.exit(1);
  }

  // ── HTML serving ──
  await test("GET / returns HTML with correct Content-Type", async () => {
    const res = await fetch("/");
    assert.strictEqual(res.status, 200);
    assert.ok(
      res.headers["content-type"].includes("text/html"),
      `Expected text/html, got: ${res.headers["content-type"]}`
    );
    assert.ok(res.body.toLowerCase().includes("<!doctype html>"), "Should contain doctype");
    assert.ok(res.body.includes('<script type="module"'), "Should contain ES module script tag");
    assert.ok(res.body.includes('href="/assets/'), "Should contain CSS asset link tags");
  });

  // ── Vite hashed assets ──
  await test("GET /assets/ returns hashed JS/CSS assets", async () => {
    // Find at least one asset referenced in index.html
    const index = await fetch("/");
    const assetMatch = index.body.match(/(?:src|href)="(\/assets\/[^"]+)"/);
    assert.ok(assetMatch, "index.html should reference hashed assets in /assets/");
    const assetPath = assetMatch[1];
    const res = await fetch(assetPath);
    assert.strictEqual(res.status, 200, `Expected 200 for ${assetPath}, got ${res.status}`);
    const ct = res.headers["content-type"] || "";
    assert.ok(
      ct.includes("javascript") || ct.includes("css"),
      `Expected JS or CSS MIME for ${assetPath}, got: ${ct}`
    );
  });

  // ── Security: path traversal ──
  // Note: Node's URL parser normalizes /../ to /, so the traversal is
  // already blocked by the URL layer. We test that requesting files
  // outside the expected directories (css/, js/) returns 404.
  await test("requesting files outside dist dirs returns 404", async () => {
    const res = await fetch("/parser.js");
    assert.strictEqual(res.status, 404, `Expected 404 for /parser.js, got ${res.status}`);
  });

  await test("requesting hidden files returns 404", async () => {
    // URL normalizes ../../ away → /package.json → src/package.json (doesn't exist, and not under css/js)
    const res = await fetch("/../../package.json");
    assert.strictEqual(res.status, 404, `Expected 404 for package.json traversal, got ${res.status}`);
  });

  // ── 404 for unknown paths ──
  await test("GET /nonexistent returns 404", async () => {
    const res = await fetch("/nonexistent");
    assert.strictEqual(res.status, 404);
  });

  await test("GET /assets/nonexistent.css returns 404", async () => {
    const res = await fetch("/assets/nonexistent.css");
    assert.strictEqual(res.status, 404);
  });

  // ── API ──
  await test("GET /api/sessions returns JSON array", async () => {
    const res = await fetch("/api/sessions");
    assert.strictEqual(res.status, 200);
    assert.ok(
      res.headers["content-type"].includes("application/json"),
      `Expected JSON, got: ${res.headers["content-type"]}`
    );
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data), "Should be an array");
  });

  await test("GET /api/sessions/nonexistent returns 404", async () => {
    const res = await fetch("/api/sessions/no-such-session");
    assert.strictEqual(res.status, 404);
  });

  // ── SSE endpoint ──
  await test("GET /events returns event-stream", async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${TEST_PORT}/events`, (res) => {
        let body = "";
        res.on("data", (d) => {
          body += d;
          // Got some data, close the connection
          req.destroy();
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      });
      req.on("error", (e) => {
        // ECONNRESET is expected when we destroy the request
        if (e.code === "ECONNRESET") return;
        reject(e);
      });
      req.setTimeout(3000, () => { req.destroy(); reject(new Error("timeout")); });
    });
    assert.strictEqual(res.status, 200);
    assert.ok(
      res.headers["content-type"].includes("text/event-stream"),
      `Expected event-stream, got: ${res.headers["content-type"]}`
    );
    assert.ok(res.body.includes("connected"), "Should receive connected event");
  });

  // ── POST /notify ──
  await test("POST /notify accepts notifications", async () => {
    const res = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({ type: "tool_use", toolName: "Bash" });
      const req = http.request({
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path: "/notify",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": postData.length },
      }, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      req.on("error", reject);
      req.write(postData);
      req.end();
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body, "ok");
  });

  // ── CORS ──
  await test("responses include CORS header", async () => {
    const res = await fetch("/api/sessions");
    assert.strictEqual(
      res.headers["access-control-allow-origin"], "*",
      "Should have CORS wildcard header"
    );
  });

  // Cleanup
  await stopServer();
  try { fs.rmSync(dataDir, { recursive: true }); } catch {}

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await stopServer();
  try { if (dataDir) fs.rmSync(dataDir, { recursive: true }); } catch {}
  process.exit(1);
});
