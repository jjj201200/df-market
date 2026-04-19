import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getComposition } from './composition-service.js';
import {
  loadAuditConfig,
  writeAuditConfig,
  readManagedSnapshot,
  isHookStale,
  readHookHeartbeat,
} from './audit-settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_ROOT =
  process.env.TOKEN_REPORTER_PLUGIN_ROOT ||
  path.join(os.homedir(), '.claude', 'token-reporter');
const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR ||
  path.join(os.homedir(), '.claude', 'token-reporter');

const parserPath = path.join(PLUGIN_ROOT, 'backend', 'dist', 'parser', 'index.js');
const { parseSession, listSessions } = await import(parserPath);

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const PID_PATH = path.join(DATA_DIR, 'server.pid');
const LOCK_PATH = path.join(DATA_DIR, 'server.lock');
const DIST_DIR = path.join(PLUGIN_ROOT, 'dist');
const SETTINGS_PATH =
  process.env.TOKEN_REPORTER_SETTINGS_PATH ||
  path.join(os.homedir(), '.claude', 'settings.local.json');
const AUDIT_OUT =
  process.env.TOKEN_REPORTER_AUDIT_OUT_OVERRIDE || path.join(DATA_DIR, 'captures');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function serveStatic(res: http.ServerResponse, filePath: string) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end('not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function loadConfig(): { port: number; autoStart: boolean } {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { port: number; autoStart: boolean };
  } catch {
    return { port: 3737, autoStart: true };
  }
}

const sseClients = new Set<http.ServerResponse>();

interface LimitsData {
  timestamp: number;
  contextWindow: unknown;
  rateLimits: unknown;
  model: unknown;
  cost: unknown;
}

const limitsCache = new Map<string, LimitsData>();

function broadcast(data: unknown) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (url.pathname === '/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        broadcast({ type: 'update', payload: JSON.parse(body) });
      } catch {}
      res.writeHead(200).end('ok');
    });
    return;
  }

  if (url.pathname === '/notify-new-session' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        const { sessionId } = JSON.parse(body) as { sessionId?: string };
        broadcast({ type: 'new_session', sessionId: sessionId || '' });
      } catch {}
      res.writeHead(200).end('ok');
    });
    return;
  }

  if (url.pathname === '/api/limits' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        const data = JSON.parse(body) as {
          session_id?: string;
          timestamp?: number;
          context_window?: unknown;
          rate_limits?: unknown;
          model?: unknown;
          cost?: unknown;
        };
        if (data.session_id) {
          limitsCache.set(data.session_id, {
            timestamp: data.timestamp || Date.now(),
            contextWindow: data.context_window,
            rateLimits: data.rate_limits,
            model: data.model,
            cost: data.cost,
          });
          broadcast({
            type: 'limits_update',
            sessionId: data.session_id,
            payload: data,
          });
        }
        res.writeHead(200).end('ok');
      } catch {
        res.writeHead(400).end('invalid json');
      }
    });
    return;
  }

  if (url.pathname === '/api/limits' && req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (sessionId && limitsCache.has(sessionId)) {
      res.end(JSON.stringify(limitsCache.get(sessionId)));
    } else {
      const allLimits = Object.fromEntries(limitsCache);
      res.end(JSON.stringify(allLimits));
    }
    return;
  }

  if (url.pathname === '/api/sessions') {
    const sessions = listSessions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        sessions.map((s: { sessionId: string; slug: string; customTitle: string; gitBranch: string; mtime: string; filePath: string }) => ({
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

  if (url.pathname === '/api/audit/status' && req.method === 'GET') {
    const cfg = loadAuditConfig(CONFIG_PATH);
    const settingsLocalKeys = readManagedSnapshot(SETTINGS_PATH);
    const hb = readHookHeartbeat(AUDIT_OUT);
    const stale = cfg.auditEnabled === true ? isHookStale(AUDIT_OUT) : false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      auditEnabled: cfg.auditEnabled === true,
      auditPromptedAt: cfg.auditPromptedAt ?? null,
      hookHeartbeatAt: hb?.at ?? null,
      hookStale: stale,
      settingsLocalKeys,
    }));
    return;
  }

  if (url.pathname === '/api/audit/ack-prompt' && req.method === 'POST') {
    writeAuditConfig(CONFIG_PATH, { auditPromptedAt: new Date().toISOString() });
    res.writeHead(200).end('ok');
    return;
  }

  if (url.pathname === '/api/audit/purge' && req.method === 'POST') {
    try {
      if (fs.existsSync(AUDIT_OUT)) {
        for (const name of fs.readdirSync(AUDIT_OUT)) {
          try { fs.rmSync(path.join(AUDIT_OUT, name), { recursive: true, force: true }); } catch {}
        }
      }
      res.writeHead(200).end('ok');
    } catch (e: unknown) {
      res.writeHead(500).end(e instanceof Error ? e.message : String(e));
    }
    return;
  }

  const compMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/composition$/);
  if (compMatch) {
    try {
      const sessionId = compMatch[1];
      const cfg = loadAuditConfig(CONFIG_PATH);
      const data = await getComposition(sessionId, {
        outDir: AUDIT_OUT,
        auditEnabled: cfg.auditEnabled === true,
        turnsFallback: async (sid) => {
          const meta = listSessions().find((s: { sessionId: string }) => s.sessionId === sid);
          if (!meta) return [];
          const parsed = await parseSession(meta.filePath);
          const turns = (parsed.turns ?? []) as Array<{
            id: number;
            userText?: string;
            assistantText?: string;
            thinking?: string | null;
            tools?: Array<{ params?: string; retContent?: string }>;
          }>;
          return turns.map((t) => ({
            turnId: t.id,
            userText: t.userText ?? '',
            assistantText: t.assistantText ?? '',
            toolUseJson: JSON.stringify(t.tools ?? []),
            toolResultText: (t.tools ?? []).map((x) => x.retContent ?? '').join(''),
            thinkingText: t.thinking ?? '',
          }));
        },
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e: unknown) {
      res.writeHead(500).end(e instanceof Error ? e.message : String(e));
    }
    return;
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    const meta = listSessions().find((s: { sessionId: string }) => s.sessionId === sessionMatch[1]);
    if (!meta) {
      res.writeHead(404).end('session not found');
      return;
    }
    try {
      const data = await parseSession(meta.filePath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e: unknown) {
      res.writeHead(500).end(e instanceof Error ? e.message : String(e));
    }
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    serveStatic(res, path.join(DIST_DIR, 'index.html'));
    return;
  }

  const filePath = path.resolve(path.join(DIST_DIR, url.pathname));
  if (filePath.startsWith(path.resolve(DIST_DIR) + path.sep)) {
    serveStatic(res, filePath);
    return;
  }

  res.writeHead(404).end('not found');
}

const config = loadConfig();
const DEFAULT_PORT = Number(process.env.TOKEN_REPORTER_PORT) || config.port || 3737;
const MAX_PORT_ATTEMPTS = 10;

function startServer(port: number) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((e: unknown) => {
      if (!res.headersSent) res.writeHead(500).end(e instanceof Error ? e.message : String(e));
    });
  });

  server.listen(port, '127.0.0.1', () => {
    fs.writeFileSync(PID_PATH, String(process.pid));
    if (port !== DEFAULT_PORT) {
      console.log(`⚠️  Default port ${DEFAULT_PORT} was in use.`);
      console.log(`✅ token-reporter running at http://localhost:${port}`);
    } else {
      console.log(`token-reporter running at http://localhost:${port}`);
    }
  });

  server.on('error', async (e: Error & { code?: string }) => {
    if (e.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      if (nextPort - DEFAULT_PORT >= MAX_PORT_ATTEMPTS) {
        console.error(`❌ Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts.`);
        console.error(`   Tried ports: ${DEFAULT_PORT} - ${port}`);
        process.exit(1);
      }
      console.log(`Port ${port} is in use, trying port ${nextPort}...`);
      await new Promise((r) => setTimeout(r, 100));
      startServer(nextPort);
      return;
    }
    throw e;
  });

  process.on('exit', () => {
    try {
      fs.unlinkSync(PID_PATH);
    } catch {}
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {}
  });
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));
}

startServer(DEFAULT_PORT);
