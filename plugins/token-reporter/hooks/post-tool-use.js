"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR ||
  path.join(os.homedir(), ".claude", "token-reporter");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const PID_PATH = path.join(DATA_DIR, "server.pid");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { port: 3737 };
  }
}

function isServerRunning() {
  if (!fs.existsSync(PID_PATH)) return false;
  try {
    const pid = parseInt(fs.readFileSync(PID_PATH, "utf8").trim());
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function notifyServer(port, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/notify",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        resolve();
      },
    );
    req.setTimeout(500, () => {
      req.destroy();
      resolve();
    });
    req.on("error", resolve);
    req.end(body);
  });
}

async function main() {
  if (!isServerRunning()) process.exit(0);

  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;

  let hookData = {};
  try {
    hookData = JSON.parse(raw);
  } catch {}

  const config = loadConfig();
  await notifyServer(config.port, {
    type: "tool_use",
    sessionId: hookData.session_id || hookData.sessionId || "",
    toolName: hookData.tool_name || hookData.toolName || "",
    timestamp: new Date().toISOString(),
  });

  process.exit(0);
}

main().catch(() => process.exit(0));
