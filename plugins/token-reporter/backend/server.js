"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Paths are injected via env vars by session-start.js; fall back to defaults for standalone use
const PLUGIN_ROOT =
  process.env.TOKEN_REPORTER_PLUGIN_ROOT ||
  path.join(os.homedir(), ".claude", "token-reporter");
const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR ||
  path.join(os.homedir(), ".claude", "token-reporter");

const { parseSession, listSessions } = require(
  path.join(PLUGIN_ROOT, "backend", "parser.js"),
);

const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const PID_PATH = path.join(DATA_DIR, "server.pid");
const LOCK_PATH = path.join(DATA_DIR, "server.lock");
const DIST_DIR = path.join(PLUGIN_ROOT, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { port: 3737, autoStart: true };
  }
}

const sseClients = new Set();

// Cache for real-time limits data from status line
const limitsCache = new Map(); // sessionId -> { timestamp, context_window, rate_limits, model }

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

  // Receive real-time limits data from status line wrapper
  if (url.pathname === "/api/limits" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (data.session_id) {
          limitsCache.set(data.session_id, {
            timestamp: data.timestamp || Date.now(),
            contextWindow: data.context_window,
            rateLimits: data.rate_limits,
            model: data.model,
            cost: data.cost,
          });
          // Broadcast to all connected clients
          broadcast({
            type: "limits_update",
            sessionId: data.session_id,
            payload: data,
          });
        }
        res.writeHead(200).end("ok");
      } catch {
        res.writeHead(400).end("invalid json");
      }
    });
    return;
  }

  // Get limits data for a session
  if (url.pathname === "/api/limits" && req.method === "GET") {
    const sessionId = url.searchParams.get("sessionId");
    res.writeHead(200, { "Content-Type": "application/json" });
    if (sessionId && limitsCache.has(sessionId)) {
      res.end(JSON.stringify(limitsCache.get(sessionId)));
    } else {
      // Return all cached limits
      const allLimits = Object.fromEntries(limitsCache);
      res.end(JSON.stringify(allLimits));
    }
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
          customTitle: s.customTitle,
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
    serveStatic(res, path.join(DIST_DIR, "index.html"));
    return;
  }

  // Serve static assets from dist/ (Vite build output)
  const filePath = path.resolve(path.join(DIST_DIR, url.pathname));
  if (filePath.startsWith(path.resolve(DIST_DIR) + path.sep)) {
    serveStatic(res, filePath);
    return;
  }

  res.writeHead(404).end("not found");
}

const config = loadConfig();
const DEFAULT_PORT = config.port || 3737;
const MAX_PORT_ATTEMPTS = 10;

function startServer(port) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((e) => {
      if (!res.headersSent) res.writeHead(500).end(e.message);
    });
  });

  server.listen(port, "127.0.0.1", () => {
    fs.writeFileSync(PID_PATH, String(process.pid));
    if (port !== DEFAULT_PORT) {
      console.log(`⚠️  Default port ${DEFAULT_PORT} was in use.`);
      console.log(`✅ token-reporter running at http://localhost:${port}`);
    } else {
      console.log(`token-reporter running at http://localhost:${port}`);
    }
  });

  server.on("error", async (e) => {
    if (e.code === "EADDRINUSE") {
      const nextPort = port + 1;
      if (nextPort - DEFAULT_PORT >= MAX_PORT_ATTEMPTS) {
        console.error(`❌ Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts.`);
        console.error(`   Tried ports: ${DEFAULT_PORT} - ${port}`);
        process.exit(1);
      }
      console.log(`Port ${port} is in use, trying port ${nextPort}...`);
      // Small delay before retry to ensure OS releases the port
      await new Promise(r => setTimeout(r, 100));
      startServer(nextPort);
      return;
    }
    throw e;
  });

  // Clean up PID and lock files on exit
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
}

startServer(DEFAULT_PORT);
