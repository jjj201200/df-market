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
  console.log("\n[hooks 冒烟测试]");

  await test("session-end.js: 无服务时以 exit 0 退出（幂等）", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-hooks-"));
    const r = await run("session-end.js", { dataDir });
    assert.strictEqual(
      r.code,
      0,
      `exit code 应为 0，实际: ${r.code}\nstderr: ${r.stderr}`,
    );
    fs.rmSync(dataDir, { recursive: true });
  });

  await test("post-tool-use.js: 服务未运行时以 exit 0 静默退出", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-hooks-"));
    const stdin = JSON.stringify({ session_id: "test", tool_name: "Bash" });
    const r = await run("post-tool-use.js", { dataDir, stdin });
    assert.strictEqual(
      r.code,
      0,
      `exit code 应为 0，实际: ${r.code}\nstderr: ${r.stderr}`,
    );
    fs.rmSync(dataDir, { recursive: true });
  });

  await test("session-start.js: autoStart=false 时以 exit 0 退出", async () => {
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
      `exit code 应为 0，实际: ${r.code}\nstderr: ${r.stderr}`,
    );
    assert.strictEqual(fs.existsSync(path.join(dataDir, "server.pid")), false);
    fs.rmSync(dataDir, { recursive: true });
  });

  await test("session-start.js: autoStart=true 时启动服务，产生 server.pid", async () => {
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
      `exit code 应为 0，实际: ${r.code}\nstderr: ${r.stderr}`,
    );
    assert.strictEqual(
      fs.existsSync(path.join(dataDir, "server.pid")),
      true,
      "server.pid 应存在",
    );
    // 清理：停止服务
    const pid = parseInt(
      fs.readFileSync(path.join(dataDir, "server.pid"), "utf8").trim(),
    );
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
    fs.rmSync(dataDir, { recursive: true });
  });

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
