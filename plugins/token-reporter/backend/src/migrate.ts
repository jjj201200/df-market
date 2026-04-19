import fs from 'fs';

export function semverCompare(a: string, b: string): number {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

export const MIGRATIONS: Array<[string, (config: Record<string, unknown>, dataDir: string) => Promise<void> | void]> = [
  ['2.11.0', (config) => {
    if (!('auditEnabled' in config)) config.auditEnabled = false;
    if (!('auditPromptedAt' in config)) config.auditPromptedAt = null;
    // Pre-hotfix field (NODE_OPTIONS via settings.env path). Kept for legacy
    // installs; the hotfix adds the two real fields below.
    if (!('userNodeOptions' in config)) config.userNodeOptions = null;
    // Hotfix (PATH shim path): real claude binary + shell rc we patched.
    if (!('userClaudeBin' in config)) config.userClaudeBin = null;
    if (!('shellRcPatched' in config)) config.shellRcPatched = null;
  }],
];

export async function migrate({
  lastVersion,
  pluginVersion,
  config,
  dataDir,
  configPath,
}: {
  lastVersion?: string;
  pluginVersion: string;
  config: Record<string, unknown>;
  dataDir: string;
  configPath: string;
}): Promise<void> {
  const from = lastVersion || '0.0.0';

  if (semverCompare(from, pluginVersion) >= 0) return;

  const pending = MIGRATIONS.filter(([ver]) => semverCompare(from, ver) < 0);
  pending.sort((a, b) => semverCompare(a[0], b[0]));

  for (const [ver, migrateFn] of pending) {
    try {
      await migrateFn(config, dataDir);
      console.error(`[token-reporter] migrated to ${ver}`);
    } catch (e: unknown) {
      console.error(
        `[token-reporter] migration to ${ver} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  config.lastVersion = pluginVersion;
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e: unknown) {
    console.error(
      `[token-reporter] failed to write config after migration: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
