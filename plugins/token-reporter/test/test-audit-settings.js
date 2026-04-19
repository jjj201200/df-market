import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadSettings,
  enableAudit,
  disableAudit,
  readManagedSnapshot,
  loadAuditConfig,
  readHookHeartbeat,
  isHookStale,
} from '../backend/dist/audit-settings.js';
import { hookRequireArg } from '../backend/dist/audit-keys.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'audit-set-')); }
function fixtureCopy(name, dest) {
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', name), dest);
}

test('enableAudit on plain settings writes 3 keys and userNodeOptions=null', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.plain', settings);
  fs.writeFileSync(config, JSON.stringify({ port: 3737 }));
  enableAudit({ settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out' });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, hookRequireArg('/p'));
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_OUT, '/out');
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_ACTIVE, '1');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.auditEnabled, true);
  assert.equal(c.userNodeOptions, null);
});

test('enableAudit preserves user NODE_OPTIONS and stores it for restore', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.with-user-node-options', settings);
  fs.writeFileSync(config, JSON.stringify({ port: 3737 }));
  enableAudit({ settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out' });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, '--max-old-space-size=4096 ' + hookRequireArg('/p'));
  assert.equal(s.env.MY_FLAG, 'yes');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.userNodeOptions, '--max-old-space-size=4096');
});

test('enableAudit is idempotent — two invocations do not duplicate --require', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.plain', settings);
  fs.writeFileSync(config, JSON.stringify({ port: 3737 }));
  enableAudit({ settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out' });
  enableAudit({ settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out' });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  const count = (s.env.NODE_OPTIONS.match(/fetch-hook\.cjs/g) || []).length;
  assert.equal(count, 1);
});

test('disableAudit removes 3 keys and restores user NODE_OPTIONS', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.with-audit-enabled', settings);
  fs.writeFileSync(config, JSON.stringify({
    port: 3737, auditEnabled: true, userNodeOptions: '--max-old-space-size=4096',
  }));
  disableAudit({ settingsPath: settings, configPath: config });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, '--max-old-space-size=4096');
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_OUT, undefined);
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_ACTIVE, undefined);
  assert.equal(s.env.MY_FLAG, 'yes');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.auditEnabled, false);
});

test('disableAudit drops NODE_OPTIONS entirely when userNodeOptions was null', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(settings, JSON.stringify({
    env: {
      NODE_OPTIONS: '--require=/p/runtime/fetch-hook.cjs',
      TOKEN_REPORTER_AUDIT_OUT: '/out',
      TOKEN_REPORTER_AUDIT_ACTIVE: '1',
    },
  }));
  fs.writeFileSync(config, JSON.stringify({ auditEnabled: true, userNodeOptions: null }));
  disableAudit({ settingsPath: settings, configPath: config });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, undefined);
});

test('readManagedSnapshot reports presence for each key', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  fixtureCopy('settings.local.json.with-audit-enabled', settings);
  const snap = readManagedSnapshot(settings);
  assert.equal(snap.NODE_OPTIONS.present, true);
  assert.ok(snap.NODE_OPTIONS.value.includes('fetch-hook.cjs'));
  assert.equal(snap.TOKEN_REPORTER_AUDIT_OUT.present, true);
  assert.equal(snap.TOKEN_REPORTER_AUDIT_ACTIVE.present, true);
});

test('loadSettings on missing file returns {env:{}}', () => {
  const dir = tmp();
  const r = loadSettings(path.join(dir, 'missing.json'));
  assert.deepEqual(r, { env: {} });
});

test('loadSettings on invalid JSON throws labelled', () => {
  const dir = tmp();
  const p = path.join(dir, 'bad.json');
  fs.writeFileSync(p, 'nope');
  assert.throws(() => loadSettings(p), /settings\.local\.json is invalid/);
});

test('readHookHeartbeat returns null if missing, parsed object if present', () => {
  const dir = tmp();
  assert.equal(readHookHeartbeat(dir), null);
  fs.writeFileSync(path.join(dir, '.heartbeat'), JSON.stringify({ pid: 1, at: '2026-04-19T00:00:00.000Z' }));
  const hb = readHookHeartbeat(dir);
  assert.equal(hb.pid, 1);
});

test('isHookStale true when .heartbeat missing, false when fresh', () => {
  const dir = tmp();
  assert.equal(isHookStale(dir), true);
  fs.writeFileSync(path.join(dir, '.heartbeat'), '{}');
  assert.equal(isHookStale(dir), false);
});
