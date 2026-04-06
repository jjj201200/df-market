"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 路径从环境变量读取（由 session-start.js 注入），回退到旧路径兼容独立运行
const PLUGIN_ROOT =
  process.env.TOKEN_REPORTER_PLUGIN_ROOT ||
  path.join(os.homedir(), ".claude", "token-reporter");
const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR ||
  path.join(os.homedir(), ".claude", "token-reporter");

const { parseSession, listSessions } = require(
  path.join(PLUGIN_ROOT, "src", "parser.js"),
);

const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const PID_PATH = path.join(DATA_DIR, "server.pid");
const LOCK_PATH = path.join(DATA_DIR, "server.lock");
const HTML_PATH = path.join(PLUGIN_ROOT, "src", "report.html");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { port: 3737, autoStart: true };
  }
}

const sseClients = new Set();

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (url.pathname === "/notify" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        broadcast({ type: "update", payload: JSON.parse(body) });
      } catch {}
      res.writeHead(200).end("ok");
    });
    return;
  }

  if (url.pathname === "/api/sessions") {
    const sessions = listSessions();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        sessions.map((s) => ({
          sessionId: s.sessionId,
          slug: s.slug,
          gitBranch: s.gitBranch,
          mtime: s.mtime,
          filePath: s.filePath,
        })),
      ),
    );
    return;
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/(.+)$/);
  if (sessionMatch) {
    const meta = listSessions().find((s) => s.sessionId === sessionMatch[1]);
    if (!meta) {
      res.writeHead(404).end("session not found");
      return;
    }
    try {
      const data = await parseSession(meta.filePath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500).end(e.message);
    }
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    if (!fs.existsSync(HTML_PATH)) {
      res.writeHead(404).end("report.html not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(HTML_PATH).pipe(res);
    return;
  }

  res.writeHead(404).end("not found");
}

const config = loadConfig();
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((e) => {
    if (!res.headersSent) res.writeHead(500).end(e.message);
  });
});

server.listen(config.port, "127.0.0.1", () => {
  fs.writeFileSync(PID_PATH, String(process.pid));
  console.log(`token-reporter running at http://localhost:${config.port}`);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${config.port} already in use.`);
    process.exit(1);
  }
  throw e;
});

// 退出时清理 PID 和 lock
process.on("exit", () => {
  try {
    fs.unlinkSync(PID_PATH);
  } catch {}
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {}
});
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
