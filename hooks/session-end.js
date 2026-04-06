"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR ||
  path.join(os.homedir(), ".claude", "token-reporter");
const PID_PATH = path.join(DATA_DIR, "server.pid");
const LOCK_PATH = path.join(DATA_DIR, "server.lock");

if (!fs.existsSync(PID_PATH)) process.exit(0);

try {
  const pid = parseInt(fs.readFileSync(PID_PATH, "utf8").trim());
  process.kill(pid, "SIGTERM");
} catch {}

try {
  fs.unlinkSync(PID_PATH);
} catch {}
try {
  fs.unlinkSync(LOCK_PATH);
} catch {}
process.exit(0);
