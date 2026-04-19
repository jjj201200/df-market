"use strict";
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { migrate, semverCompare, MIGRATIONS } from "../backend/dist/migrate.js";

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

async function main() {
  // ── semverCompare ──────────────────────────────────
  console.log("\n[semverCompare]");

  await test("1.0.0 < 1.1.0", async () => {
    assert.strictEqual(semverCompare("1.0.0", "1.1.0"), -1);
  });
  await test("1.1.0 > 1.0.0", async () => {
    assert.strictEqual(semverCompare("1.1.0", "1.0.0"), 1);
  });
  await test("1.0.0 === 1.0.0", async () => {
    assert.strictEqual(semverCompare("1.0.0", "1.0.0"), 0);
  });
  await test("undefined is treated as 0.0.0", async () => {
    assert.strictEqual(semverCompare(undefined, "1.0.0"), -1);
  });

  // ── migrate ──────────────────────────────────────
  console.log("\n[migrate]");

  await test("lastVersion === pluginVersion → skip all migrations", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-test-"));
    const configPath = path.join(tmpDir, "config.json");
    const config = { port: 3737, autoStart: true, lastVersion: "1.0.0" };
    fs.writeFileSync(configPath, JSON.stringify(config));

    await migrate({
      lastVersion: "1.0.0",
      pluginVersion: "1.0.0",
      config,
      dataDir: tmpDir,
      configPath,
    });

    const written = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.strictEqual(written.lastVersion, "1.0.0");
    fs.rmSync(tmpDir, { recursive: true });
  });

  await test("lastVersion undefined → treated as 0.0.0, run migrations", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-test-"));
    const configPath = path.join(tmpDir, "config.json");
    const config = { port: 3737, autoStart: true };
    fs.writeFileSync(configPath, JSON.stringify(config));

    await migrate({
      lastVersion: undefined,
      pluginVersion: "1.0.0",
      config,
      dataDir: tmpDir,
      configPath,
    });

    const written = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.strictEqual(written.lastVersion, "1.0.0");
    fs.rmSync(tmpDir, { recursive: true });
  });

  await test("migration fn throws → logs error but config.lastVersion still updated", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-test-"));
    const configPath = path.join(tmpDir, "config.json");
    const config = { port: 3737, autoStart: true };
    fs.writeFileSync(configPath, JSON.stringify(config));

    MIGRATIONS.push([
      "1.0.0",
      async () => {
        throw new Error("intentional test error");
      },
    ]);
    try {
      await migrate({
        lastVersion: "0.0.0",
        pluginVersion: "1.0.0",
        config,
        dataDir: tmpDir,
        configPath,
      });
      const written = JSON.parse(fs.readFileSync(configPath, "utf8"));
      assert.strictEqual(written.lastVersion, "1.0.0");
    } finally {
      MIGRATIONS.pop();
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await test("2.11.0 migration adds auditEnabled/auditPromptedAt/userNodeOptions", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-test-"));
    const configPath = path.join(tmpDir, "config.json");
    const config = { port: 3737, autoStart: true, lastVersion: "2.10.1" };
    fs.writeFileSync(configPath, JSON.stringify(config));

    await migrate({
      lastVersion: "2.10.1",
      pluginVersion: "2.11.0",
      config,
      dataDir: tmpDir,
      configPath,
    });

    const written = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.strictEqual(written.auditEnabled, false);
    assert.strictEqual(written.auditPromptedAt, null);
    assert.strictEqual(written.userNodeOptions, null);
    assert.strictEqual(written.lastVersion, "2.11.0");
    fs.rmSync(tmpDir, { recursive: true });
  });

  // ── results ────────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
