"use strict";
/**
 * Tests for session parse progress:
 *  - parseSession's onProgress callback semantics (monotonic bytes, final 100%)
 *  - progress is PUSHED over the /events SSE channel (parse-progress events,
 *    terminating with done:true) — no polling endpoint
 */
import assert from "assert";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";
import { parseSession } from "../backend/dist/parser/core.js";

// Resolve the plugin root from this file, not process.cwd(), so the test
// works from any directory
const PLUGIN_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TEST_PORT = 20000 + Math.floor(Math.random() * 20000);

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

function makeTempJsonl(lineCount) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-progress-"));
  const file = path.join(dir, "session.jsonl");
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(JSON.stringify({uuid: `u-${i}`, type: "user", message: {role: "user", content: "x".repeat(50)}}));
  }
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

/** Collect SSE messages until the predicate passes (or timeout) */
function collectSse(port, timeoutMs) {
  const events = [];
  let req = null;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SSE timeout after ${timeoutMs}ms`)), timeoutMs);
    req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
      let buf = "";
      res.on("data", (d) => {
        buf += d;
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (dataLine) {
            try {
              events.push(JSON.parse(dataLine.slice(5).trim()));
            } catch {}
          }
        }
      });
      res.on("close", () => {
        clearTimeout(timer);
        resolve(events);
      });
      // Expose a poll-until helper
      events.waitFor = async (pred) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const hit = events.find(pred);
          if (hit) return hit;
          await new Promise((r) => setTimeout(r, 50));
        }
        throw new Error(`condition not met within ${timeoutMs}ms; got ${events.length} events`);
      };
    });
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
  return {events, req, done};
}

async function main() {
  console.log("[parse progress]");

  await test("onProgress: monotonic bytes, ends at total", async () => {
    const file = makeTempJsonl(500);
    const total = fs.statSync(file).size;
    const events = [];
    const data = await parseSession(file, (p) => events.push({...p}));
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
    assert.ok(data !== null, "parseSession should return data");
    assert.ok(events.length >= 1, "expected at least one progress event");
    let prev = -1;
    for (const e of events) {
      assert.strictEqual(e.total, total, `total should be ${total}, got ${e.total}`);
      assert.ok(e.bytes >= prev, `bytes must be monotonic: ${e.bytes} after ${prev}`);
      prev = e.bytes;
    }
    const last = events[events.length - 1];
    assert.strictEqual(last.bytes, total, "final event should report bytes === total");
    assert.strictEqual(last.bytes / last.total, 1, "final event should be 100%");
  });

  await test("onProgress: omitted callback does not throw", async () => {
    const file = makeTempJsonl(5);
    const data = await parseSession(file);
    fs.rmSync(path.dirname(file), {recursive: true, force: true});
    assert.ok(data !== null);
  });

  await test("SSE: parse-progress events pushed, ending with done:true", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-progress-srv-"));
    fs.writeFileSync(path.join(dataDir, "config.json"), JSON.stringify({port: TEST_PORT, autoStart: false}));

    const child = execFile(
      process.execPath,
      [path.join(PLUGIN_ROOT, "backend", "dist", "server.js")],
      {env: {
        ...process.env,
        TOKEN_REPORTER_DATA_DIR: dataDir,
        TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
      }},
    );
    let serverErr = "";
    child.stderr?.on("data", (d) => (serverErr += d));

    // Wait for the port to accept connections. Probe "/" — NOT /api/sessions,
    // whose cold-start scan of every session file's first line can take
    // seconds and would eat the probe budget.
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        await new Promise((resolve, reject) => {
          const p = http.get(`http://127.0.0.1:${TEST_PORT}/`, (res) => {
            res.resume();
            resolve();
          });
          p.on("error", reject);
        });
        up = true;
      } catch {}
    }
    assert.ok(up, `test server failed to start; stderr: ${serverErr.slice(0, 300)}`);

    try {
      const sse = collectSse(TEST_PORT, 15000);
      // Give the SSE connection a moment to register server-side
      await new Promise((r) => setTimeout(r, 300));

      // Pick the smallest real session file so the parse finishes fast
      const files = [];
      const projectsDir = path.join(os.homedir(), ".claude", "projects");
      for (const proj of fs.readdirSync(projectsDir)) {
        const projPath = path.join(projectsDir, proj);
        for (const f of fs.readdirSync(projPath)) {
          if (f.endsWith(".jsonl")) files.push(path.join(projPath, f));
        }
      }
      assert.ok(files.length > 0, "no session files found on this machine");
      files.sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);
      const sid = path.basename(files[0]).replace(/\.jsonl$/, "");

      // Fire the session request (do not await — read SSE while it streams)
      const sessionReq = fetch(`http://127.0.0.1:${TEST_PORT}/api/sessions/${sid}`).catch(() => null);

      const doneEvent = await sse.events.waitFor((e) => e.type === "parse-progress" && e.sessionId === sid && e.done === true);
      assert.ok(doneEvent, "expected a terminal parse-progress done event");
      await sessionReq;

      sse.req.destroy();
    } finally {
      child.kill("SIGKILL");
      fs.rmSync(dataDir, {recursive: true, force: true});
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
