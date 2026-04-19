import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const PORT = 13838;
const PLUGIN_ROOT = path.resolve(import.meta.dirname, '..');

function setupServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-api-'));
  const claudeHome = path.join(dir, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });
  const dataDir = path.join(claudeHome, 'token-reporter');
  fs.mkdirSync(dataDir, { recursive: true });
  const outDir = path.join(dataDir, 'captures');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({
    port: PORT,
    autoStart: true,
    lastVersion: '2.11.0',
    auditEnabled: false,
    auditPromptedAt: null,
    userNodeOptions: null,
  }));
  const settingsPath = path.join(claudeHome, 'settings.local.json');
  const child = spawn(process.execPath, [path.join(PLUGIN_ROOT, 'backend', 'dist', 'server.js')], {
    env: {
      ...process.env,
      TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
      TOKEN_REPORTER_DATA_DIR: dataDir,
      TOKEN_REPORTER_SETTINGS_PATH: settingsPath,
      TOKEN_REPORTER_AUDIT_OUT_OVERRIDE: outDir,
      TOKEN_REPORTER_PORT: String(PORT),
    },
    stdio: 'pipe',
  });
  let err = '';
  child.stderr.on('data', (d) => { err += String(d); });
  return { child, dataDir, outDir, settingsPath, err: () => err };
}

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${pathname}`, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
}
function post(pathname, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const req = http.request(`http://127.0.0.1:${PORT}${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (res) => {
      let d = ''; res.on('data', (x) => (d += x)); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject); req.end(body);
  });
}

async function waitUp() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await get('/api/audit/status');
      if (r.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server never came up');
}

test('GET /api/audit/status initial + POST /api/audit/ack-prompt updates time', async () => {
  const s = setupServer();
  try {
    await waitUp();
    let r = await get('/api/audit/status');
    assert.equal(r.status, 200);
    let parsed = JSON.parse(r.body);
    assert.equal(parsed.auditEnabled, false);
    assert.equal(parsed.auditPromptedAt, null);
    assert.equal(parsed.hookStale, false);
    assert.ok(parsed.settingsLocalKeys);

    r = await post('/api/audit/ack-prompt', {});
    assert.equal(r.status, 200);

    r = await get('/api/audit/status');
    parsed = JSON.parse(r.body);
    assert.ok(parsed.auditPromptedAt, 'auditPromptedAt set');
  } finally {
    s.child.kill('SIGTERM');
  }
});

test('POST /api/audit/purge clears captures dir', async () => {
  const s = setupServer();
  try {
    await waitUp();
    fs.writeFileSync(path.join(s.outDir, 'a.req.json'), '{}');
    fs.writeFileSync(path.join(s.outDir, '.heartbeat'), '{}');
    const r = await post('/api/audit/purge', {});
    assert.equal(r.status, 200);
    assert.deepEqual(fs.readdirSync(s.outDir), []);
  } finally {
    s.child.kill('SIGTERM');
  }
});

test('GET /api/sessions/:id/composition returns estimated when audit disabled', async () => {
  const s = setupServer();
  try {
    await waitUp();
    // Session id does not need to exist — composition-service will call turnsFallback
    // which returns [] for unknown ids, producing empty points.
    const r = await get('/api/sessions/unknown-sess/composition');
    assert.equal(r.status, 200);
    const parsed = JSON.parse(r.body);
    assert.equal(parsed.source, 'estimated');
    assert.deepEqual(parsed.unknownSources, ['system_prompt', 'tools_schema']);
  } finally {
    s.child.kill('SIGTERM');
  }
});
