export declare const MANAGED_ENV_KEYS: readonly ["TOKEN_REPORTER_AUDIT_OUT", "TOKEN_REPORTER_AUDIT_ACTIVE"];
export type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];
export declare const HOOK_REQUIRE_TOKEN = "runtime/fetch-hook.cjs";
export declare function hookPathForPlugin(pluginRoot: string): string;
export declare function hookRequireArg(pluginRoot: string): string;
export declare const SHELL_RC_MARKER = "# token-reporter-audit: alias wrapper";
//# sourceMappingURL=audit-keys.d.ts.map