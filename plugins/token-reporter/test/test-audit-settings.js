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
  detectShellRc,
  patchShellRc,
  unpatchShellRc,
  buildAliasLine,
  detectExistingProxy,
} from '../backend/dist/audit-settings.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'audit-set-')); }

// ── settings.local.json ─────────────────────────────────────────────────────

test('enableAudit writes only AUDIT_OUT and AUDIT_ACTIVE (no NODE_OPTIONS)', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(settings, '{}');
  fs.writeFileSync(config, JSON.stringify({ port: 3737 }));

  enableAudit({
    settingsPath: settings,
    configPath: config,
    pluginRoot: dir,
    outDir: '/out',
    shellRcPath: null,
  });

  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_OUT, '/out');
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_ACTIVE, '1');
  assert.equal(s.env.NODE_OPTIONS, undefined,
    'NODE_OPTIONS must NOT be written to settings.local.json (injected via shell alias)');
});

test('enableAudit preserves unrelated env keys', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(settings, JSON.stringify({ env: { MY_FLAG: 'yes' } }));
  fs.writeFileSync(config, JSON.stringify({ port: 3737 }));
  enableAudit({
    settingsPath: settings,
    configPath: config,
    pluginRoot: dir,
    outDir: '/out',
    shellRcPath: null,
  });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.MY_FLAG, 'yes');
});

test('disableAudit strips audit keys and legacy NODE_OPTIONS residue', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(settings, JSON.stringify({
    env: {
      NODE_OPTIONS: '--require=/old/hook.cjs', // legacy residue from pre-hotfix
      TOKEN_REPORTER_AUDIT_OUT: '/out',
      TOKEN_REPORTER_AUDIT_ACTIVE: '1',
      MY_FLAG: 'yes',
    },
  }));
  fs.writeFileSync(config, JSON.stringify({ auditEnabled: true }));
  disableAudit({ settingsPath: settings, configPath: config });
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, undefined, 'legacy NODE_OPTIONS cleaned up');
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_OUT, undefined);
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_ACTIVE, undefined);
  assert.equal(s.env.MY_FLAG, 'yes');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.auditEnabled, false);
});

test('readManagedSnapshot reports presence for the 2 audit keys only', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  fs.writeFileSync(settings, JSON.stringify({
    env: {
      TOKEN_REPORTER_AUDIT_OUT: '/out',
      TOKEN_REPORTER_AUDIT_ACTIVE: '1',
      SOMETHING_ELSE: 'x',
    },
  }));
  const snap = readManagedSnapshot(settings);
  assert.equal(snap.TOKEN_REPORTER_AUDIT_OUT.present, true);
  assert.equal(snap.TOKEN_REPORTER_AUDIT_OUT.value, '/out');
  assert.equal(snap.TOKEN_REPORTER_AUDIT_ACTIVE.present, true);
  assert.equal(Object.keys(snap).length, 2);
  assert.equal(snap.NODE_OPTIONS, undefined, 'NODE_OPTIONS not in managed snapshot');
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

// ── Heartbeat ───────────────────────────────────────────────────────────────

test('readHookHeartbeat returns null when missing, parsed object when present', () => {
  const dir = tmp();
  assert.equal(readHookHeartbeat(dir), null);
  fs.writeFileSync(path.join(dir, '.heartbeat'),
    JSON.stringify({ pid: 1, at: '2026-04-19T00:00:00.000Z' }));
  const hb = readHookHeartbeat(dir);
  assert.equal(hb.pid, 1);
});

test('isHookStale: missing → true; fresh → false', () => {
  const dir = tmp();
  assert.equal(isHookStale(dir), true);
  fs.writeFileSync(path.join(dir, '.heartbeat'), '{}');
  assert.equal(isHookStale(dir), false);
});

// ── Alias line ──────────────────────────────────────────────────────────────

test('buildAliasLine wraps NODE_OPTIONS only when no proxy', () => {
  const line = buildAliasLine({ pluginRoot: '/p' });
  assert.match(line, /^alias claude='/);
  assert.match(line, /NODE_OPTIONS="--require=\/p\/runtime\/fetch-hook\.cjs"/);
  assert.doesNotMatch(line, /HTTPS_PROXY/);
  assert.match(line, / claude'$/, "alias body ends with ` claude'` so zsh re-resolves via PATH");
});

test('buildAliasLine bakes HTTPS_PROXY when provided', () => {
  const line = buildAliasLine({ pluginRoot: '/p', httpsProxy: 'http://127.0.0.1:1087' });
  assert.match(line, /HTTPS_PROXY="http:\/\/127\.0\.0\.1:1087"/);
  assert.match(line, /NODE_OPTIONS=/);
  // Ordering: proxy before NODE_OPTIONS — both valid, but keep stable for diff-friendliness.
  const pi = line.indexOf('HTTPS_PROXY');
  const ni = line.indexOf('NODE_OPTIONS');
  assert.ok(pi < ni);
});

// ── detectExistingProxy ─────────────────────────────────────────────────────

test('detectExistingProxy extracts HTTPS_PROXY from user alias', () => {
  const rc = `
alias ls='ls -la'
alias claude='HTTPS_PROXY=http://127.0.0.1:1087 claude'
export FOO=bar
`;
  assert.equal(detectExistingProxy(rc), 'http://127.0.0.1:1087');
});

test('detectExistingProxy returns null when no matching alias', () => {
  assert.equal(detectExistingProxy('alias ls=ls\n'), null);
  assert.equal(detectExistingProxy(''), null);
  assert.equal(detectExistingProxy("alias claude='claude'"), null);
});

// ── Shell rc detection & patching ───────────────────────────────────────────

test('detectShellRc picks .zshrc for zsh, .bashrc for bash', () => {
  const realShell = process.env.SHELL;
  try {
    process.env.SHELL = '/bin/zsh';
    assert.equal(detectShellRc('/tmp/home').path, '/tmp/home/.zshrc');
    assert.equal(detectShellRc('/tmp/home').shellName, 'zsh');

    const bashHome = tmp();
    fs.writeFileSync(path.join(bashHome, '.bashrc'), '');
    process.env.SHELL = '/bin/bash';
    assert.equal(detectShellRc(bashHome).path, path.join(bashHome, '.bashrc'));
    assert.equal(detectShellRc(bashHome).shellName, 'bash');

    const bashHome2 = tmp();
    assert.equal(detectShellRc(bashHome2).path, path.join(bashHome2, '.bash_profile'));

    process.env.SHELL = '/usr/local/bin/fish';
    assert.equal(detectShellRc('/tmp/home').path, null);
    assert.equal(detectShellRc('/tmp/home').shellName, 'fish');
  } finally {
    process.env.SHELL = realShell;
  }
});

test('patchShellRc appends marker + alias; idempotent second run', () => {
  const dir = tmp();
  const rc = path.join(dir, '.zshrc');
  fs.writeFileSync(rc, 'export FOO=bar\n');
  const alias1 = buildAliasLine({ pluginRoot: '/p' });

  const r1 = patchShellRc(rc, alias1);
  assert.equal(r1.alreadyPatched, false);
  assert.equal(r1.rewrote, false);
  assert.ok(r1.backupPath && fs.existsSync(r1.backupPath));
  const after1 = fs.readFileSync(rc, 'utf8');
  assert.match(after1, /token-reporter-audit: alias wrapper/);
  assert.ok(after1.includes(alias1));
  assert.ok(after1.includes('export FOO=bar'));

  const r2 = patchShellRc(rc, alias1);
  assert.equal(r2.alreadyPatched, true);
  assert.equal(r2.rewrote, false, 'identical alias → no rewrite');
});

test('patchShellRc rewrites alias line when content drifts', () => {
  const dir = tmp();
  const rc = path.join(dir, '.zshrc');
  fs.writeFileSync(rc, 'export FOO=bar\n');
  const alias1 = buildAliasLine({ pluginRoot: '/old-plugin-path' });
  const alias2 = buildAliasLine({ pluginRoot: '/new-plugin-path' });
  patchShellRc(rc, alias1);
  const r = patchShellRc(rc, alias2);
  assert.equal(r.alreadyPatched, true);
  assert.equal(r.rewrote, true, 'drift detected — alias line refreshed');
  const content = fs.readFileSync(rc, 'utf8');
  assert.ok(content.includes(alias2));
  assert.ok(!content.includes(alias1));
});

test('unpatchShellRc removes exactly marker + alias; backs up', () => {
  const dir = tmp();
  const rc = path.join(dir, '.zshrc');
  fs.writeFileSync(rc, 'export FOO=bar\nexport BAZ=qux\n');
  patchShellRc(rc, buildAliasLine({ pluginRoot: '/p' }));
  const r = unpatchShellRc(rc);
  assert.equal(r.changed, true);
  const after = fs.readFileSync(rc, 'utf8');
  assert.doesNotMatch(after, /token-reporter-audit/);
  assert.ok(after.includes('export FOO=bar'));
  assert.ok(after.includes('export BAZ=qux'));

  patchShellRc(rc, buildAliasLine({ pluginRoot: '/p' })); unpatchShellRc(rc);
  patchShellRc(rc, buildAliasLine({ pluginRoot: '/p' })); unpatchShellRc(rc);
  const finalContent = fs.readFileSync(rc, 'utf8');
  assert.doesNotMatch(finalContent, /token-reporter-audit/);
  assert.ok(finalContent.includes('export FOO=bar'));
});

test('unpatchShellRc on a file without our marker is a no-op', () => {
  const dir = tmp();
  const rc = path.join(dir, '.zshrc');
  const original = 'export FOO=bar\n# user comment\n';
  fs.writeFileSync(rc, original);
  const r = unpatchShellRc(rc);
  assert.equal(r.changed, false);
  assert.equal(fs.readFileSync(rc, 'utf8'), original);
});

// ── End-to-end: enableAudit + rc + disableAudit ─────────────────────────────

test('enableAudit patches rc with alias containing hook path', () => {
  const dir = tmp();
  const pluginRoot = path.join(dir, 'plugin');
  fs.mkdirSync(path.join(pluginRoot, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'runtime', 'fetch-hook.cjs'), '');
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  const rc = path.join(dir, '.zshrc');
  fs.writeFileSync(rc, '');
  fs.writeFileSync(settings, '{}');
  fs.writeFileSync(config, '{}');

  const r = enableAudit({
    settingsPath: settings,
    configPath: config,
    pluginRoot,
    outDir: '/out',
    shellRcPath: rc,
  });
  assert.equal(r.shellRcPatched, rc);
  assert.equal(r.shellRcAlreadyPatched, false);
  assert.match(r.aliasLine, /^alias claude=/);
  const rcContent = fs.readFileSync(rc, 'utf8');
  assert.match(rcContent, /token-reporter-audit/);
  assert.ok(rcContent.includes(r.aliasLine));
  const cfg = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(cfg.auditEnabled, true);
  assert.equal(cfg.shellRcPatched, rc);
});

test('enableAudit with httpsProxy bakes it into alias', () => {
  const dir = tmp();
  const pluginRoot = path.join(dir, 'plugin');
  fs.mkdirSync(path.join(pluginRoot, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'runtime', 'fetch-hook.cjs'), '');
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  const rc = path.join(dir, '.zshrc');
  fs.writeFileSync(rc, '');
  fs.writeFileSync(settings, '{}');
  fs.writeFileSync(config, '{}');

  const r = enableAudit({
    settingsPath: settings,
    configPath: config,
    pluginRoot,
    outDir: '/out',
    shellRcPath: rc,
    httpsProxy: 'http://127.0.0.1:1087',
  });
  assert.match(r.aliasLine, /HTTPS_PROXY="http:\/\/127\.0\.0\.1:1087"/);
});

test('disableAudit unpatches rc and strips settings; legacy shim removed if present', () => {
  const dir = tmp();
  const pluginRoot = path.join(dir, 'plugin');
  fs.mkdirSync(path.join(pluginRoot, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'runtime', 'fetch-hook.cjs'), '');
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  const rc = path.join(dir, '.zshrc');
  fs.writeFileSync(rc, 'export FOO=bar\n');
  fs.writeFileSync(settings, '{}');
  fs.writeFileSync(config, '{}');

  // Also drop a legacy shim and make sure disableAudit removes it.
  const home = tmp();
  const realHome = process.env.HOME;
  process.env.HOME = home;
  try {
    fs.mkdirSync(path.join(home, '.claude', 'bin'), { recursive: true });
    const legacyShim = path.join(home, '.claude', 'bin', 'claude');
    fs.writeFileSync(legacyShim, '#!/bin/sh\ntrue\n');

    enableAudit({
      settingsPath: settings,
      configPath: config,
      pluginRoot,
      outDir: '/out',
      shellRcPath: rc,
    });
    disableAudit({ settingsPath: settings, configPath: config });

    assert.equal(fs.existsSync(legacyShim), false, 'legacy shim removed');
    const rcContent = fs.readFileSync(rc, 'utf8');
    assert.doesNotMatch(rcContent, /token-reporter-audit/);
    assert.ok(rcContent.includes('export FOO=bar'));
    const cfg = JSON.parse(fs.readFileSync(config, 'utf8'));
    assert.equal(cfg.auditEnabled, false);
    assert.equal(cfg.shellRcPatched, null);
  } finally {
    process.env.HOME = realHome;
  }
});

test('disableAudit does NOT touch rc we did not patch', () => {
  const dir = tmp();
  const pluginRoot = path.join(dir, 'plugin');
  fs.mkdirSync(path.join(pluginRoot, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, 'runtime', 'fetch-hook.cjs'), '');
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(settings, '{}');
  const rc = path.join(dir, '.zshrc');
  const alias = buildAliasLine({ pluginRoot });
  // rc already has our marker + alias from a prior install
  fs.writeFileSync(rc, `\n# token-reporter-audit: alias wrapper\n${alias}\n`);
  fs.writeFileSync(config, '{}');

  const r = enableAudit({
    settingsPath: settings,
    configPath: config,
    pluginRoot,
    outDir: '/out',
    shellRcPath: rc,
  });
  assert.equal(r.shellRcAlreadyPatched, true);
  assert.equal(r.shellRcPatched, null, 'not recorded — we did not add');
  disableAudit({ settingsPath: settings, configPath: config });
  const rcContent = fs.readFileSync(rc, 'utf8');
  assert.match(rcContent, /token-reporter-audit/,
    'rc marker preserved — we did not add it, so off must not remove it');
});
