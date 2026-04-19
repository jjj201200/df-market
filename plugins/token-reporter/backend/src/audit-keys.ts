import path from 'path';

// Env keys managed by `token-reporter-audit` on/off. Order matters for the
// deep-equal test and for how `audit status` lists them.
export const MANAGED_ENV_KEYS = [
  'NODE_OPTIONS',
  'TOKEN_REPORTER_AUDIT_OUT',
  'TOKEN_REPORTER_AUDIT_ACTIVE',
] as const;

export type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];

// Stable substring grepped inside NODE_OPTIONS to detect whether our
// --require=<hook> entry is already present. Must match hookRequireArg output.
export const HOOK_REQUIRE_TOKEN = 'runtime/fetch-hook.cjs';

export function hookPathForPlugin(pluginRoot: string): string {
  return path.join(pluginRoot, 'runtime', 'fetch-hook.cjs');
}

export function hookRequireArg(pluginRoot: string): string {
  return `--require=${hookPathForPlugin(pluginRoot)}`;
}
