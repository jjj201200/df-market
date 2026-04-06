"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { migrate } = require("../src/migrate.js");

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR ||
  path.join(os.homedir(), ".claude", "token-reporter");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const PID_PATH = path.join(DATA_DIR, "server.pid");
const LOCK_PATH = path.join(DATA_DIR, "server.lock");
const SERVER_PATH = path.join(PLUGIN_ROOT, "src", "server.js");
const PLUGIN_JSON_PATH = path.join(
  PLUGIN_ROOT,
  ".claude-plugin",
  "plugin.json",
);

const DEFAULT_CONFIG = { port: 3737, autoStart: true, lastVersion: "0.0.0" };

function readJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  try {
    fs.openSync(LOCK_PATH, "wx");
    return true;
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    return false;
  }
}

function cleanupStale() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {}
  try {
    fs.unlinkSync(PID_PATH);
  } catch {}
}

async function main() {
  // 1. Ensure data directories exist
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "sessions"), { recursive: true });

  // 2. Read or create config.json
  let config = readJSON(CONFIG_PATH, null);
  if (!config) {
    config = { ...DEFAULT_CONFIG };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  // 3. Run version migrations
  const pluginJson = readJSON(PLUGIN_JSON_PATH, { version: "1.0.0" });
  await migrate({
    lastVersion: config.lastVersion,
    pluginVersion: pluginJson.version,
    config,
    dataDir: DATA_DIR,
    configPath: CONFIG_PATH,
  });

  // 4. Exit immediately if autoStart is disabled
  if (config.autoStart === false) process.exit(0);

  // 5. Try to acquire file lock
  if (!acquireLock()) {
    const pidData = readJSON(PID_PATH, null);
    const pid =
      typeof pidData === "number" ? pidData : parseInt(String(pidData || "0"));
    if (pid && isProcessAlive(pid)) {
      process.exit(0);
    }
    cleanupStale();
    if (!acquireLock()) {
      process.exit(0);
    }
  }

  // 6. Spawn server.js as a detached process
  const child = execFile(process.execPath, [SERVER_PATH], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
      TOKEN_REPORTER_DATA_DIR: DATA_DIR,
    },
  });
  child.unref();

  // 7. Wait for server.pid to be written (up to 3 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (fs.existsSync(PID_PATH)) break;
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(`[token-reporter] session-start error: ${e.message}`);
  process.exit(0);
});
