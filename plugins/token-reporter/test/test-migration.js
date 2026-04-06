"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { migrate, semverCompare, MIGRATIONS } = require("../src/migrate.js");

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
  await test("undefined 视为 0.0.0", async () => {
    assert.strictEqual(semverCompare(undefined, "1.0.0"), -1);
  });

  // ── migrate ──────────────────────────────────────
  console.log("\n[migrate]");

  await test("lastVersion === pluginVersion → 跳过所有迁移", async () => {
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

  await test("lastVersion 未定义 → 视为 0.0.0，执行迁移", async () => {
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

  await test("迁移函数抛错 → 记录错误但 config.lastVersion 仍然更新", async () => {
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

  // ── 结果 ────────────────────────────────────────
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
