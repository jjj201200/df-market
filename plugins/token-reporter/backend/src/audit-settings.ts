import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  MANAGED_ENV_KEYS,
  SHELL_RC_MARKER,
  hookPathForPlugin,
  type ManagedEnvKey,
} from './audit-keys.js';

// ── settings.local.json: plain env keys only (no NODE_OPTIONS) ──────────────

export interface SettingsFile {
  env?: Record<string, string>;
  [key: string]: unknown;
}

export function loadSettings(filePath: string): SettingsFile {
  if (!fs.existsSync(filePath)) return { env: {} };
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('settings.local.json is invalid: not an object');
    }
    if (!parsed.env || typeof parsed.env !== 'object') parsed.env = {};
    return parsed as SettingsFile;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`settings.local.json is invalid: ${e.message}`);
    throw e;
  }
}

export function writeSettings(filePath: string, s: SettingsFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(s, null, 2) + '\n');
}

function backup(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const b = `${filePath}.bak-${ts}`;
  fs.copyFileSync(filePath, b);
  return b;
}

// ── Shell rc alias wrapper ──────────────────────────────────────────────────

export interface DetectedShellRc {
  /** Absolute path to the rc file we would patch. null if we can't pick one. */
  path: string | null;
  /** User-facing shell name we detected (for CLI prompt text). */
  shellName: string;
}

export function detectShellRc(homedir: string = os.homedir()): DetectedShellRc {
  const shellEnv = process.env.SHELL || '';
  const base = path.basename(shellEnv);
  if (base.includes('zsh')) return { path: path.join(homedir, '.zshrc'), shellName: 'zsh' };
  if (base.includes('bash')) {
    // Prefer .bashrc when it exists, fall back to .bash_profile.
    const bashrc = path.join(homedir, '.bashrc');
    if (fs.existsSync(bashrc)) return { path: bashrc, shellName: 'bash' };
    return { path: path.join(homedir, '.bash_profile'), shellName: 'bash' };
  }
  if (base.includes('fish')) return { path: null, shellName: 'fish' }; // unsupported, caller should warn
  return { path: null, shellName: base || 'unknown' };
}

/** Build the exact `alias claude='…'` line we inject. The alias definition
 *  is valid zsh / bash syntax. The body uses double-quoted env values plus a
 *  single-quoted outer wrapper — robust to spaces in the hook path.
 *
 *  The alias expands to `NODE_OPTIONS=--require="…" claude` (and, if a proxy
 *  URL is given, `HTTPS_PROXY="…"` too). zsh never recursively expands the
 *  inner `claude` back through the alias, so the second lookup goes to PATH
 *  (→ real claude binary). Unlike the earlier PATH-shim approach this works
 *  regardless of zsh's hash cache and leaves the shell's command lookup
 *  unchanged for all other programs.
 */
export function buildAliasLine(opts: {
  pluginRoot: string;
  /** If set, baked into the alias so every `claude` invocation sees it. */
  httpsProxy?: string | null;
}): string {
  const hook = hookPathForPlugin(opts.pluginRoot);
  const parts: string[] = [];
  if (opts.httpsProxy) parts.push(`HTTPS_PROXY="${opts.httpsProxy}"`);
  parts.push(`NODE_OPTIONS="--require=${hook}"`);
  parts.push('claude');
  return `alias claude='${parts.join(' ')}'`;
}

/** Append our alias block to the shell rc, if not already present. Creates a
 *  `.bak-<ts>` copy first. If a marker already exists but the alias line's
 *  content has drifted (e.g. plugin moved, proxy URL changed), we rewrite it
 *  in-place so re-running `audit on` picks up the new values. */
export function patchShellRc(rcPath: string, aliasLine: string): {
  backupPath: string | null;
  alreadyPatched: boolean;
  rewrote: boolean;
} {
  const existing = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
  if (existing.includes(SHELL_RC_MARKER)) {
    // Marker present — check if our alias line is identical; if not, rewrite.
    const lines = existing.split('\n');
    const idx = lines.findIndex((l) => l === SHELL_RC_MARKER);
    const next = idx >= 0 ? lines[idx + 1] : undefined;
    if (next === aliasLine) {
      return { backupPath: null, alreadyPatched: true, rewrote: false };
    }
    // Refresh the alias line in place.
    const backupPath = backup(rcPath);
    lines[idx + 1] = aliasLine;
    fs.writeFileSync(rcPath, lines.join('\n'));
    return { backupPath, alreadyPatched: true, rewrote: true };
  }
  const backupPath = fs.existsSync(rcPath) ? backup(rcPath) : null;
  const block = [
    '',
    SHELL_RC_MARKER,
    aliasLine,
    '',
  ].join('\n');
  fs.appendFileSync(rcPath, block);
  return { backupPath, alreadyPatched: false, rewrote: false };
}

/** Remove exactly the two lines we appended — marker line and the alias
 *  immediately after it. Opportunistically drops adjacent blank lines we may
 *  have written as padding. */
export function unpatchShellRc(rcPath: string): { changed: boolean } {
  if (!fs.existsSync(rcPath)) return { changed: false };
  const src = fs.readFileSync(rcPath, 'utf8');
  if (!src.includes(SHELL_RC_MARKER)) return { changed: false };
  const lines = src.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === SHELL_RC_MARKER) {
      if (out.length && out[out.length - 1] === '') out.pop();
      i += 1; // skip the alias line immediately after marker
      if (i + 1 < lines.length && lines[i + 1] === '') i += 1;
      continue;
    }
    out.push(lines[i]);
  }
  const result = out.join('\n');
  if (result === src) return { changed: false };
  backup(rcPath);
  fs.writeFileSync(rcPath, result);
  return { changed: true };
}

/** Scan a rc file for a pre-existing `alias claude='…'` line and extract an
 *  HTTPS_PROXY env value if the line is of the form
 *  `alias claude='HTTPS_PROXY=URL claude'` (quoting variations supported).
 *  Returns null when no such pattern is found. */
export function detectExistingProxy(rcText: string): string | null {
  const m = rcText.match(
    /^alias\s+claude\s*=\s*['"](.*HTTPS_PROXY[=\s]["']?)([^"'\s]+)["']?\s+claude['"]/m,
  );
  return m ? m[2] : null;
}

// ── enable / disable audit (top-level API used by CLI) ──────────────────────

export interface EnableAuditOpts {
  settingsPath: string;
  configPath: string;
  pluginRoot: string;
  outDir: string;
  /** Shell rc file to patch; pass null to skip rc patching. */
  shellRcPath: string | null;
  /** HTTPS_PROXY to bake into the alias. Pass null to omit. */
  httpsProxy?: string | null;
}

export interface EnableAuditResult {
  settingsBackupPath: string | null;
  shellRcPatched: string | null;
  shellRcAlreadyPatched: boolean;
  shellRcRewrote: boolean;
  aliasLine: string;
}

export function enableAudit(opts: EnableAuditOpts): EnableAuditResult {
  const settingsBackupPath = backup(opts.settingsPath);
  const s = loadSettings(opts.settingsPath);
  s.env = s.env || {};
  s.env.TOKEN_REPORTER_AUDIT_OUT = opts.outDir;
  s.env.TOKEN_REPORTER_AUDIT_ACTIVE = '1';
  writeSettings(opts.settingsPath, s);

  const aliasLine = buildAliasLine({
    pluginRoot: opts.pluginRoot,
    httpsProxy: opts.httpsProxy ?? null,
  });

  let shellRcPatched: string | null = null;
  let shellRcAlreadyPatched = false;
  let shellRcRewrote = false;
  if (opts.shellRcPath) {
    const r = patchShellRc(opts.shellRcPath, aliasLine);
    shellRcAlreadyPatched = r.alreadyPatched;
    shellRcRewrote = r.rewrote;
    // Record in config when our block is present in the rc (fresh add OR
    // in-place rewrite), so `off` knows to remove it. Untouched pre-existing
    // markers we didn't add stay out of config.
    if (!r.alreadyPatched || r.rewrote) shellRcPatched = opts.shellRcPath;
  }

  writeAuditConfig(opts.configPath, {
    auditEnabled: true,
    auditPromptedAt: new Date().toISOString(),
    shellRcPatched,
  });

  return {
    settingsBackupPath,
    shellRcPatched,
    shellRcAlreadyPatched,
    shellRcRewrote,
    aliasLine,
  };
}

export interface DisableAuditOpts {
  settingsPath: string;
  configPath: string;
}

export function disableAudit(opts: DisableAuditOpts): void {
  if (fs.existsSync(opts.settingsPath)) {
    const s = loadSettings(opts.settingsPath);
    s.env = s.env || {};
    delete s.env.TOKEN_REPORTER_AUDIT_OUT;
    delete s.env.TOKEN_REPORTER_AUDIT_ACTIVE;
    // Legacy cleanup: pre-hotfix installs wrote NODE_OPTIONS here; remove.
    delete (s.env as Record<string, string>).NODE_OPTIONS;
    writeSettings(opts.settingsPath, s);
  }

  const cfg = loadAuditConfig(opts.configPath);
  const rcToRevert = (cfg.shellRcPatched ?? null) as string | null;
  if (rcToRevert) {
    try { unpatchShellRc(rcToRevert); } catch { /* ignore */ }
  }

  // Legacy: an earlier PATH-shim prototype wrote ~/.claude/bin/claude. Remove
  // it if present so upgrading users don't end up with a stale shim.
  const legacyShim = path.join(os.homedir(), '.claude', 'bin', 'claude');
  try { fs.unlinkSync(legacyShim); } catch { /* not there */ }

  writeAuditConfig(opts.configPath, {
    auditEnabled: false,
    shellRcPatched: null,
    // Legacy field cleanup
    userNodeOptions: null,
    userClaudeBin: null,
  });
}

// ── snapshot / config / heartbeat reads ─────────────────────────────────────

export type ManagedSnapshot = Record<ManagedEnvKey, { present: boolean; value: string | null }>;

export function readManagedSnapshot(settingsPath: string): ManagedSnapshot {
  const s = fs.existsSync(settingsPath) ? loadSettings(settingsPath) : { env: {} };
  const env = s.env || {};
  const out = {} as ManagedSnapshot;
  for (const k of MANAGED_ENV_KEYS) {
    out[k] = { present: k in env, value: k in env ? env[k] : null };
  }
  return out;
}

export interface AuditConfig {
  auditEnabled?: boolean;
  auditPromptedAt?: string | null;
  userNodeOptions?: string | null;
  userClaudeBin?: string | null;
  shellRcPatched?: string | null;
  [k: string]: unknown;
}

export function loadAuditConfig(filePath: string): AuditConfig {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return {}; }
}

export function writeAuditConfig(filePath: string, patch: AuditConfig): void {
  const cur = loadAuditConfig(filePath);
  const merged = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
}

export interface HookHeartbeat {
  pid: number;
  at: string;
  /** Absolute path of the fetch-hook.cjs that actually ran. Added in v2.12.
   *  Older heartbeats written by pre-v2.12 hooks won't have this field. */
  hookPath?: string;
}

export function readHookHeartbeat(outDir: string): HookHeartbeat | null {
  const p = path.join(outDir, '.heartbeat');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/** Extract the `--require=<path>` value from our managed alias line in the
 *  given shell rc file. Returns null when no alias or no NODE_OPTIONS flag is
 *  found. Matches both single and double quoted alias bodies. */
export function parseAliasHookPath(rcPath: string): string | null {
  if (!fs.existsSync(rcPath)) return null;
  const src = fs.readFileSync(rcPath, 'utf8');
  if (!src.includes(SHELL_RC_MARKER)) return null;
  const lines = src.split('\n');
  const idx = lines.findIndex((l) => l === SHELL_RC_MARKER);
  const aliasLine = idx >= 0 ? lines[idx + 1] : undefined;
  if (!aliasLine) return null;
  const m = aliasLine.match(/NODE_OPTIONS\s*=\s*["']--require=([^"']+)["']/);
  return m ? m[1] : null;
}

export function isHookStale(outDir: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const p = path.join(outDir, '.heartbeat');
  if (!fs.existsSync(p)) return true;
  const mtime = fs.statSync(p).mtimeMs;
  return Date.now() - mtime > maxAgeMs;
}
