import path from 'path';
// Env keys managed by `token-reporter-audit` on/off. Order matters for the
// deep-equal test and for how `audit status` lists them.
//
// NODE_OPTIONS is NOT managed here. Claude Code reads settings.env and applies
// it via `Object.assign(process.env, …)` AFTER Node has started — too late for
// `--require=<hook>` to take effect. We inject NODE_OPTIONS via a zsh/bash
// alias in the user's shell rc; see audit-settings.ts.
export const MANAGED_ENV_KEYS = [
    'TOKEN_REPORTER_AUDIT_OUT',
    'TOKEN_REPORTER_AUDIT_ACTIVE',
];
// Stable substring grepped inside NODE_OPTIONS to detect whether our
// --require=<hook> entry is already present. Must match hookRequireArg output.
export const HOOK_REQUIRE_TOKEN = 'runtime/fetch-hook.cjs';
export function hookPathForPlugin(pluginRoot) {
    return path.join(pluginRoot, 'runtime', 'fetch-hook.cjs');
}
export function hookRequireArg(pluginRoot) {
    return `--require=${hookPathForPlugin(pluginRoot)}`;
}
// Marker comment written into the user's shell rc right above our alias line.
// `audit off` uses this marker to surgically remove the two lines we added
// (comment + alias).
export const SHELL_RC_MARKER = '# token-reporter-audit: alias wrapper';
