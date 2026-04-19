const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(PLUGIN_ROOT, 'bin', 'token-reporter-audit');

function setup(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-'));
  const home = path.join(root, 'home');
  const claudeHome = path.join(home, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });
  const dataDir = path.join(claudeHome, 'token-reporter');
  fs.mkdirSync(dataDir, { recursive: true });
  const settingsPath = path.join(claudeHome, 'settings.local.json');
  const outDir = path.join(dataDir, 'captures');
  const rcPath = path.join(home, '.zshrc');
  fs.writeFileSync(rcPath, opts.rcContent ?? 'export EXISTING=1\n');

  // Clear HTTPS_PROXY from env unless test explicitly sets it — otherwise the
  // real developer's proxy leaks into unit tests.
  const env = {
    ...process.env,
    HOME: home,
    SHELL: '/bin/zsh',
    TOKEN_REPORTER_DATA_DIR: dataDir,
    TOKEN_REPORTER_SETTINGS_PATH: settingsPath,
    TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
    TOKEN_REPORTER_AUDIT_OUT_OVERRIDE: outDir,
  };
  delete env.HTTPS_PROXY;
  delete env.https_proxy;
  if (opts.httpsProxy) env.HTTPS_PROXY = opts.httpsProxy;

  return { root, home, dataDir, settingsPath, outDir, rcPath, env };
}
function run(args, env, input = '') {
  return spawnSync(BIN, args, { env, input, encoding: 'utf8' });
}

// ── status ─────────────────────────────────────────────────────────────────

test('status on a fresh install reports audit off and no NODE_OPTIONS in managed list', () => {
  const s = setup();
  const r = run(['status'], s.env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /auditEnabled: false/);
  assert.doesNotMatch(r.stdout, /NODE_OPTIONS:/);
  assert.match(r.stdout, /TOKEN_REPORTER_AUDIT_OUT: absent/);
});

// ── on: proceed=n ──────────────────────────────────────────────────────────

test('on with "n" at proceed prompt exits 2, nothing changes', () => {
  const s = setup();
  const r = run(['on'], s.env, 'n\n');
  assert.equal(r.status, 2);
  assert.equal(fs.existsSync(s.settingsPath), false);
  const rcAfter = fs.readFileSync(s.rcPath, 'utf8');
  assert.equal(rcAfter, 'export EXISTING=1\n');
});

// ── on: proceed=y, rc=y ────────────────────────────────────────────────────

test('on with y/y writes audit env, appends alias to rc', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, JSON.stringify({ env: { FOO: '1' } }));
  const r = run(['on'], s.env, 'y\ny\n');
  assert.equal(r.status, 0, r.stderr);

  const after = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_OUT, s.outDir);
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_ACTIVE, '1');
  assert.equal(after.env.NODE_OPTIONS, undefined);
  assert.equal(after.env.FOO, '1');

  const rcAfter = fs.readFileSync(s.rcPath, 'utf8');
  assert.match(rcAfter, /token-reporter-audit: alias wrapper/);
  assert.match(rcAfter, /alias claude=/);
  assert.match(rcAfter, /NODE_OPTIONS="--require=.+fetch-hook\.cjs"/);
  assert.doesNotMatch(rcAfter, /HTTPS_PROXY/);
  assert.ok(rcAfter.includes('export EXISTING=1'));

  const cfg = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'config.json'), 'utf8'));
  assert.equal(cfg.auditEnabled, true);
  assert.equal(cfg.shellRcPatched, s.rcPath);
});

// ── on with HTTPS_PROXY in env: alias gets proxy baked in ─────────────────

test('on picks up HTTPS_PROXY from env and bakes into alias', () => {
  const s = setup({ httpsProxy: 'http://127.0.0.1:1087' });
  fs.writeFileSync(s.settingsPath, '{}');
  const r = run(['on'], s.env, 'y\ny\n');
  assert.equal(r.status, 0, r.stderr);
  const rcAfter = fs.readFileSync(s.rcPath, 'utf8');
  assert.match(rcAfter, /HTTPS_PROXY="http:\/\/127\.0\.0\.1:1087"/);
});

// ── on detects pre-existing alias claude='HTTPS_PROXY=... claude' ─────────

test('on picks up HTTPS_PROXY from user\'s own alias line when env has none', () => {
  const s = setup({
    rcContent: "alias claude='HTTPS_PROXY=http://existing-proxy:9999 claude'\nexport FOO=bar\n",
  });
  fs.writeFileSync(s.settingsPath, '{}');
  const r = run(['on'], s.env, 'y\ny\n');
  assert.equal(r.status, 0, r.stderr);
  const rcAfter = fs.readFileSync(s.rcPath, 'utf8');
  assert.match(rcAfter, /HTTPS_PROXY="http:\/\/existing-proxy:9999"/,
    "CLI extracted proxy from existing user alias");
});

// ── on: proceed=y, rc=n ────────────────────────────────────────────────────

test('on with y/n skips rc patch and prints manual step', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, '{}');
  const r = run(['on'], s.env, 'y\nn\n');
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'config.json'), 'utf8'));
  assert.equal(cfg.shellRcPatched, null);
  const rcAfter = fs.readFileSync(s.rcPath, 'utf8');
  assert.doesNotMatch(rcAfter, /token-reporter-audit/);
  assert.match(r.stdout, /Manual step|append this/);
});

// ── off: full cleanup ────────────────────────────────────────────────────

test('on then off: rc unpatched, audit keys stripped', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, JSON.stringify({ env: { FOO: '1' } }));
  run(['on'], s.env, 'y\ny\n');

  const r = run(['off'], s.env);
  assert.equal(r.status, 0, r.stderr);

  const after = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_OUT, undefined);
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_ACTIVE, undefined);
  assert.equal(after.env.FOO, '1');

  const rcAfter = fs.readFileSync(s.rcPath, 'utf8');
  assert.doesNotMatch(rcAfter, /token-reporter-audit/);
  assert.ok(rcAfter.includes('export EXISTING=1'));

  const cfg = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'config.json'), 'utf8'));
  assert.equal(cfg.auditEnabled, false);
  assert.equal(cfg.shellRcPatched, null);
});

// ── on: invalid settings.local.json ──────────────────────────────────────

test('on refuses invalid settings.local.json', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, 'garbage{');
  const r = run(['on'], s.env, 'y\ny\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /settings\.local\.json is invalid/);
});

// ── purge ────────────────────────────────────────────────────────────────

test('purge with y deletes all files under audit-out but keeps dir', () => {
  const s = setup();
  fs.mkdirSync(s.outDir, { recursive: true });
  fs.writeFileSync(path.join(s.outDir, 'a.req.json'), '{}');
  fs.writeFileSync(path.join(s.outDir, '.heartbeat'), '{}');
  const r = run(['purge'], s.env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(s.outDir), true);
  assert.deepEqual(fs.readdirSync(s.outDir), []);
});
