import fs from 'fs';
import os from 'os';
import path from 'path';
import { MANAGED_ENV_KEYS, SHELL_RC_MARKER, hookPathForPlugin, } from './audit-keys.js';
export function loadSettings(filePath) {
    if (!fs.existsSync(filePath))
        return { env: {} };
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('settings.local.json is invalid: not an object');
        }
        if (!parsed.env || typeof parsed.env !== 'object')
            parsed.env = {};
        return parsed;
    }
    catch (e) {
        if (e instanceof SyntaxError)
            throw new Error(`settings.local.json is invalid: ${e.message}`);
        throw e;
    }
}
export function writeSettings(filePath, s) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(s, null, 2) + '\n');
}
function backup(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const b = `${filePath}.bak-${ts}`;
    fs.copyFileSync(filePath, b);
    return b;
}
export function detectShellRc(homedir = os.homedir()) {
    const shellEnv = process.env.SHELL || '';
    const base = path.basename(shellEnv);
    if (base.includes('zsh'))
        return { path: path.join(homedir, '.zshrc'), shellName: 'zsh' };
    if (base.includes('bash')) {
        // Prefer .bashrc when it exists, fall back to .bash_profile.
        const bashrc = path.join(homedir, '.bashrc');
        if (fs.existsSync(bashrc))
            return { path: bashrc, shellName: 'bash' };
        return { path: path.join(homedir, '.bash_profile'), shellName: 'bash' };
    }
    if (base.includes('fish'))
        return { path: null, shellName: 'fish' }; // unsupported, caller should warn
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
export function buildAliasLine(opts) {
    const hook = hookPathForPlugin(opts.pluginRoot);
    const parts = [];
    if (opts.httpsProxy)
        parts.push(`HTTPS_PROXY="${opts.httpsProxy}"`);
    parts.push(`NODE_OPTIONS="--require=${hook}"`);
    parts.push('claude');
    return `alias claude='${parts.join(' ')}'`;
}
/** Append our alias block to the shell rc, if not already present. Creates a
 *  `.bak-<ts>` copy first. If a marker already exists but the alias line's
 *  content has drifted (e.g. plugin moved, proxy URL changed), we rewrite it
 *  in-place so re-running `audit on` picks up the new values. */
export function patchShellRc(rcPath, aliasLine) {
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
export function unpatchShellRc(rcPath) {
    if (!fs.existsSync(rcPath))
        return { changed: false };
    const src = fs.readFileSync(rcPath, 'utf8');
    if (!src.includes(SHELL_RC_MARKER))
        return { changed: false };
    const lines = src.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === SHELL_RC_MARKER) {
            if (out.length && out[out.length - 1] === '')
                out.pop();
            i += 1; // skip the alias line immediately after marker
            if (i + 1 < lines.length && lines[i + 1] === '')
                i += 1;
            continue;
        }
        out.push(lines[i]);
    }
    const result = out.join('\n');
    if (result === src)
        return { changed: false };
    backup(rcPath);
    fs.writeFileSync(rcPath, result);
    return { changed: true };
}
/** Scan a rc file for a pre-existing `alias claude='…'` line and extract an
 *  HTTPS_PROXY env value if the line is of the form
 *  `alias claude='HTTPS_PROXY=URL claude'` (quoting variations supported).
 *  Returns null when no such pattern is found. */
export function detectExistingProxy(rcText) {
    const m = rcText.match(/^alias\s+claude\s*=\s*['"](.*HTTPS_PROXY[=\s]["']?)([^"'\s]+)["']?\s+claude['"]/m);
    return m ? m[2] : null;
}
export function enableAudit(opts) {
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
    let shellRcPatched = null;
    let shellRcAlreadyPatched = false;
    let shellRcRewrote = false;
    if (opts.shellRcPath) {
        const r = patchShellRc(opts.shellRcPath, aliasLine);
        shellRcAlreadyPatched = r.alreadyPatched;
        shellRcRewrote = r.rewrote;
        // Record in config when our block is present in the rc (fresh add OR
        // in-place rewrite), so `off` knows to remove it. Untouched pre-existing
        // markers we didn't add stay out of config.
        if (!r.alreadyPatched || r.rewrote)
            shellRcPatched = opts.shellRcPath;
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
export function disableAudit(opts) {
    if (fs.existsSync(opts.settingsPath)) {
        const s = loadSettings(opts.settingsPath);
        s.env = s.env || {};
        delete s.env.TOKEN_REPORTER_AUDIT_OUT;
        delete s.env.TOKEN_REPORTER_AUDIT_ACTIVE;
        // Legacy cleanup: pre-hotfix installs wrote NODE_OPTIONS here; remove.
        delete s.env.NODE_OPTIONS;
        writeSettings(opts.settingsPath, s);
    }
    const cfg = loadAuditConfig(opts.configPath);
    const rcToRevert = (cfg.shellRcPatched ?? null);
    if (rcToRevert) {
        try {
            unpatchShellRc(rcToRevert);
        }
        catch { /* ignore */ }
    }
    // Legacy: an earlier PATH-shim prototype wrote ~/.claude/bin/claude. Remove
    // it if present so upgrading users don't end up with a stale shim.
    const legacyShim = path.join(os.homedir(), '.claude', 'bin', 'claude');
    try {
        fs.unlinkSync(legacyShim);
    }
    catch { /* not there */ }
    writeAuditConfig(opts.configPath, {
        auditEnabled: false,
        shellRcPatched: null,
        // Legacy field cleanup
        userNodeOptions: null,
        userClaudeBin: null,
    });
}
export function readManagedSnapshot(settingsPath) {
    const s = fs.existsSync(settingsPath) ? loadSettings(settingsPath) : { env: {} };
    const env = s.env || {};
    const out = {};
    for (const k of MANAGED_ENV_KEYS) {
        out[k] = { present: k in env, value: k in env ? env[k] : null };
    }
    return out;
}
export function loadAuditConfig(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    catch {
        return {};
    }
}
export function writeAuditConfig(filePath, patch) {
    const cur = loadAuditConfig(filePath);
    const merged = { ...cur, ...patch };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
}
export function readHookHeartbeat(outDir) {
    const p = path.join(outDir, '.heartbeat');
    if (!fs.existsSync(p))
        return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    catch {
        return null;
    }
}
/** Extract the `--require=<path>` value from our managed alias line in the
 *  given shell rc file. Returns null when no alias or no NODE_OPTIONS flag is
 *  found. Matches both single and double quoted alias bodies. */
export function parseAliasHookPath(rcPath) {
    if (!fs.existsSync(rcPath))
        return null;
    const src = fs.readFileSync(rcPath, 'utf8');
    if (!src.includes(SHELL_RC_MARKER))
        return null;
    const lines = src.split('\n');
    const idx = lines.findIndex((l) => l === SHELL_RC_MARKER);
    const aliasLine = idx >= 0 ? lines[idx + 1] : undefined;
    if (!aliasLine)
        return null;
    const m = aliasLine.match(/NODE_OPTIONS\s*=\s*["']--require=([^"']+)["']/);
    return m ? m[1] : null;
}
export function isHookStale(outDir, maxAgeMs = 5 * 60 * 1000) {
    const p = path.join(outDir, '.heartbeat');
    if (!fs.existsSync(p))
        return true;
    const mtime = fs.statSync(p).mtimeMs;
    return Date.now() - mtime > maxAgeMs;
}
