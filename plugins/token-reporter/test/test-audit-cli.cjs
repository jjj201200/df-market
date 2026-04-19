const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(PLUGIN_ROOT, 'bin', 'token-reporter-audit');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-'));
  const claudeHome = path.join(dir, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });
  const dataDir = path.join(claudeHome, 'token-reporter');
  fs.mkdirSync(dataDir, { recursive: true });
  const settingsPath = path.join(claudeHome, 'settings.local.json');
  const outDir = path.join(dataDir, 'captures');
  return {
    dir, dataDir, settingsPath, outDir,
    env: {
      ...process.env,
      TOKEN_REPORTER_DATA_DIR: dataDir,
      TOKEN_REPORTER_SETTINGS_PATH: settingsPath,
      TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
      TOKEN_REPORTER_AUDIT_OUT_OVERRIDE: outDir,
    },
  };
}
function run(args, env, input = '') {
  return spawnSync(BIN, args, { env, input, encoding: 'utf8' });
}

test('status on a fresh install reports all absent', () => {
  const s = setup();
  const r = run(['status'], s.env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /auditEnabled: false/);
  assert.match(r.stdout, /NODE_OPTIONS: absent/);
});

test('on without y confirmation exits 2, does not write', () => {
  const s = setup();
  const r = run(['on'], s.env, 'n\n');
  assert.equal(r.status, 2);
  assert.equal(fs.existsSync(s.settingsPath), false);
});

test('on with y writes 3 keys, backs up, flips config', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, JSON.stringify({ env: { FOO: '1' } }));
  const r = run(['on'], s.env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  const after = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.match(after.env.NODE_OPTIONS, /fetch-hook\.cjs/);
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_OUT, s.outDir);
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_ACTIVE, '1');
  assert.equal(after.env.FOO, '1');
  const backups = fs.readdirSync(path.dirname(s.settingsPath)).filter((n) => n.startsWith('settings.local.json.bak-'));
  assert.equal(backups.length, 1);
  const cfg = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'config.json'), 'utf8'));
  assert.equal(cfg.auditEnabled, true);
});

test('on preserves user NODE_OPTIONS and off restores it', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, JSON.stringify({ env: { NODE_OPTIONS: '--max-old-space-size=4096' } }));
  let r = run(['on'], s.env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  const afterOn = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.match(afterOn.env.NODE_OPTIONS, /^--max-old-space-size=4096 --require=/);
  r = run(['off'], s.env);
  assert.equal(r.status, 0, r.stderr);
  const afterOff = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.equal(afterOff.env.NODE_OPTIONS, '--max-old-space-size=4096');
});

test('on refuses invalid settings.local.json', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, 'garbage{');
  const r = run(['on'], s.env, 'y\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /settings\.local\.json is invalid/);
});

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
