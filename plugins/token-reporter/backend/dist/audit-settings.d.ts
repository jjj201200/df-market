import { type ManagedEnvKey } from './audit-keys.js';
export interface SettingsFile {
    env?: Record<string, string>;
    [key: string]: unknown;
}
export declare function loadSettings(filePath: string): SettingsFile;
export declare function writeSettings(filePath: string, s: SettingsFile): void;
export interface DetectedShellRc {
    /** Absolute path to the rc file we would patch. null if we can't pick one. */
    path: string | null;
    /** User-facing shell name we detected (for CLI prompt text). */
    shellName: string;
}
export declare function detectShellRc(homedir?: string): DetectedShellRc;
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
export declare function buildAliasLine(opts: {
    pluginRoot: string;
    /** If set, baked into the alias so every `claude` invocation sees it. */
    httpsProxy?: string | null;
}): string;
/** Append our alias block to the shell rc, if not already present. Creates a
 *  `.bak-<ts>` copy first. If a marker already exists but the alias line's
 *  content has drifted (e.g. plugin moved, proxy URL changed), we rewrite it
 *  in-place so re-running `audit on` picks up the new values. */
export declare function patchShellRc(rcPath: string, aliasLine: string): {
    backupPath: string | null;
    alreadyPatched: boolean;
    rewrote: boolean;
};
/** Remove exactly the two lines we appended — marker line and the alias
 *  immediately after it. Opportunistically drops adjacent blank lines we may
 *  have written as padding. */
export declare function unpatchShellRc(rcPath: string): {
    changed: boolean;
};
/** Scan a rc file for a pre-existing `alias claude='…'` line and extract an
 *  HTTPS_PROXY env value if the line is of the form
 *  `alias claude='HTTPS_PROXY=URL claude'` (quoting variations supported).
 *  Returns null when no such pattern is found. */
export declare function detectExistingProxy(rcText: string): string | null;
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
export declare function enableAudit(opts: EnableAuditOpts): EnableAuditResult;
export interface DisableAuditOpts {
    settingsPath: string;
    configPath: string;
}
export declare function disableAudit(opts: DisableAuditOpts): void;
export type ManagedSnapshot = Record<ManagedEnvKey, {
    present: boolean;
    value: string | null;
}>;
export declare function readManagedSnapshot(settingsPath: string): ManagedSnapshot;
export interface AuditConfig {
    auditEnabled?: boolean;
    auditPromptedAt?: string | null;
    userNodeOptions?: string | null;
    userClaudeBin?: string | null;
    shellRcPatched?: string | null;
    [k: string]: unknown;
}
export declare function loadAuditConfig(filePath: string): AuditConfig;
export declare function writeAuditConfig(filePath: string, patch: AuditConfig): void;
export interface HookHeartbeat {
    pid: number;
    at: string;
}
export declare function readHookHeartbeat(outDir: string): HookHeartbeat | null;
export declare function isHookStale(outDir: string, maxAgeMs?: number): boolean;
//# sourceMappingURL=audit-settings.d.ts.map