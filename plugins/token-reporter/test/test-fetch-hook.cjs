const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'runtime', 'fetch-hook.cjs');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'hook-')); }

function runChild(script, env) {
  // Strip any inherited proxy env — we want direct localhost HTTP
  const cleanEnv = { ...env };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
    delete cleanEnv[k];
  }
  cleanEnv.NO_PROXY = '*';
  return spawnSync(process.execPath, ['--require', HOOK, '-e', script], {
    env: cleanEnv,
    encoding: 'utf8',
  });
}

test('hook writes req/resp/heartbeat for matching urls; skips non-matching', async () => {
  const out = tmp();
  // Start the mock server INSIDE the child process — parent's event loop is
  // blocked by spawnSync so server listening in parent cannot accept connections.
  const script = `
    const http = require('http');
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ echo: body.length }));
      });
    });
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      try {
        const a = await fetch('http://127.0.0.1:' + port + '/v1/messages', {
          method:'POST',
          headers:{'content-type':'application/json','x-claude-code-session-id':'S1','authorization':'Bearer sk-xxx'},
          body:'{"model":"x","messages":[]}'
        });
        await a.text();
        const b = await fetch('http://127.0.0.1:' + port + '/unrelated');
        await b.text();
        server.close(() => process.exit(0));
      } catch (e) { console.error(e); server.close(() => process.exit(1)); }
    });
  `;
  const env = {
    ...process.env,
    TOKEN_REPORTER_AUDIT_OUT: out,
    TOKEN_REPORTER_HOOK_EXTRA_MATCH: '127\\.0\\.0\\.1.*\\/v1\\/messages',
  };
  const r = runChild(script, env);
  assert.equal(r.status, 0, r.stderr);

  const files = fs.readdirSync(out);
  const reqs = files.filter((f) => f.endsWith('.req.json'));
  const resps = files.filter((f) => f.endsWith('.resp.json'));
  assert.equal(reqs.length, 1, `expected 1 req, got ${reqs.length}: ${files.join(',')}`);
  assert.equal(resps.length, 1);
  assert.ok(files.includes('.heartbeat'), '.heartbeat present');

  const req0 = JSON.parse(fs.readFileSync(path.join(out, reqs[0]), 'utf8'));
  assert.equal(req0.headers['x-claude-code-session-id'], 'S1');
  assert.equal(req0.headers['authorization'], undefined, 'authorization must be stripped');
  assert.ok(req0.body.startsWith('{"model":"x"'));
});

test('hook stays inert when no AUDIT_OUT env and no fallback dir exists', () => {
  // Point HOME at a scratch dir where ~/.claude/token-reporter/captures is
  // absent, so the hook's fallback resolution returns null and it no-ops.
  const scratchHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-nohome-'));
  const script = `fetch('http://127.0.0.1:1/whatever').catch(()=>{}).then(()=>process.exit(0));`;
  const env = { ...process.env, HOME: scratchHome };
  delete env.TOKEN_REPORTER_AUDIT_OUT;
  const r = runChild(script, env);
  assert.equal(r.status, 0);
  // No captures dir should have been created by the hook
  assert.equal(fs.existsSync(path.join(scratchHome, '.claude', 'token-reporter', 'captures')), false);
});

test('hook swallows errors when audit-out is read-only', () => {
  const out = path.join(os.tmpdir(), 'hook-ro-' + Date.now());
  fs.mkdirSync(out, { recursive: true });
  fs.chmodSync(out, 0o500);
  try {
    const script = `fetch('http://127.0.0.1:1/x').catch(()=>{}).then(()=>process.exit(0));`;
    const env = {
      ...process.env,
      TOKEN_REPORTER_AUDIT_OUT: out,
      TOKEN_REPORTER_HOOK_EXTRA_MATCH: '127\\.0\\.0\\.1',
    };
    const r = runChild(script, env);
    assert.equal(r.status, 0, 'host exits 0 even with read-only capture dir');
  } finally {
    fs.chmodSync(out, 0o700);
    fs.rmSync(out, { recursive: true });
  }
});
