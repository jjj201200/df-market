import fs from 'fs';
import path from 'path';
import {
  MANAGED_ENV_KEYS,
  HOOK_REQUIRE_TOKEN,
  hookRequireArg,
  type ManagedEnvKey,
} from './audit-keys.js';

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

export interface EnableAuditOpts {
  settingsPath: string;
  configPath: string;
  pluginRoot: string;
  outDir: string;
}

export function enableAudit(opts: EnableAuditOpts): { backupPath: string | null } {
  const backupPath = backup(opts.settingsPath);
  const s = loadSettings(opts.settingsPath);
  s.env = s.env || {};
  const hookArg = hookRequireArg(opts.pluginRoot);
  const prev = s.env.NODE_OPTIONS;
  let userNodeOptions: string | null = null;
  let next: string;
  if (prev && prev.includes(HOOK_REQUIRE_TOKEN)) {
    // Already armed — leave value untouched, do not overwrite userNodeOptions memo.
    next = prev;
    userNodeOptions = undefined as unknown as null;
  } else if (prev && prev.trim().length > 0) {
    userNodeOptions = prev;
    next = `${prev} ${hookArg}`;
  } else {
    userNodeOptions = null;
    next = hookArg;
  }
  s.env.NODE_OPTIONS = next;
  s.env.TOKEN_REPORTER_AUDIT_OUT = opts.outDir;
  s.env.TOKEN_REPORTER_AUDIT_ACTIVE = '1';
  writeSettings(opts.settingsPath, s);

  const patch: AuditConfig = {
    auditEnabled: true,
    auditPromptedAt: new Date().toISOString(),
  };
  // Only record userNodeOptions on first arm; idempotent re-arm keeps existing memo.
  if (userNodeOptions !== undefined) patch.userNodeOptions = userNodeOptions;
  writeAuditConfig(opts.configPath, patch);
  return { backupPath };
}

export interface DisableAuditOpts {
  settingsPath: string;
  configPath: string;
}

export function disableAudit(opts: DisableAuditOpts): void {
  const cfg = loadAuditConfig(opts.configPath);
  const userNodeOptions = (cfg.userNodeOptions ?? null) as string | null;
  if (fs.existsSync(opts.settingsPath)) {
    const s = loadSettings(opts.settingsPath);
    s.env = s.env || {};
    if (userNodeOptions && userNodeOptions.length > 0) {
      s.env.NODE_OPTIONS = userNodeOptions;
    } else {
      delete s.env.NODE_OPTIONS;
    }
    delete s.env.TOKEN_REPORTER_AUDIT_OUT;
    delete s.env.TOKEN_REPORTER_AUDIT_ACTIVE;
    writeSettings(opts.settingsPath, s);
  }
  writeAuditConfig(opts.configPath, {
    auditEnabled: false,
    userNodeOptions: null,
  });
}

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
}

export function readHookHeartbeat(outDir: string): HookHeartbeat | null {
  const p = path.join(outDir, '.heartbeat');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export function isHookStale(outDir: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const p = path.join(outDir, '.heartbeat');
  if (!fs.existsSync(p)) return true;
  const mtime = fs.statSync(p).mtimeMs;
  return Date.now() - mtime > maxAgeMs;
}
