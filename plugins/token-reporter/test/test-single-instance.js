"use strict";
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
    failed++;
  }
}

function makeLockFns(lockPath, pidPath) {
  function acquireLock() {
    try {
      fs.openSync(lockPath, "wx");
      return true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      return false;
    }
  }
  function cleanupStale() {
    try {
      fs.unlinkSync(lockPath);
    } catch {}
    try {
      fs.unlinkSync(pidPath);
    } catch {}
  }
  function isProcessAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  return { acquireLock, cleanupStale, isProcessAlive };
}

async function main() {
  console.log("\n[Single-instance file lock]");

  await test("acquire lock succeeds on first attempt", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-lock-"));
    const lockPath = path.join(tmpDir, "server.lock");
    const { acquireLock } = makeLockFns(lockPath, "");
    assert.strictEqual(acquireLock(), true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  await test("returns false when lock already exists", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-lock-"));
    const lockPath = path.join(tmpDir, "server.lock");
    const { acquireLock } = makeLockFns(lockPath, "");
    acquireLock();
    assert.strictEqual(acquireLock(), false);
    fs.rmSync(tmpDir, { recursive: true });
  });

  await test("re-acquire succeeds after cleaning up stale lock", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-lock-"));
    const lockPath = path.join(tmpDir, "server.lock");
    const pidPath = path.join(tmpDir, "server.pid");
    const { acquireLock, cleanupStale } = makeLockFns(lockPath, pidPath);

    acquireLock();
    assert.strictEqual(acquireLock(), false);
    cleanupStale();
    assert.strictEqual(acquireLock(), true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  await test("isProcessAlive returns true for current process", async () => {
    const { isProcessAlive } = makeLockFns("", "");
    assert.strictEqual(isProcessAlive(process.pid), true);
  });

  await test("isProcessAlive returns false for non-existent PID", async () => {
    const { isProcessAlive } = makeLockFns("", "");
    assert.strictEqual(isProcessAlive(99999999), false);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
