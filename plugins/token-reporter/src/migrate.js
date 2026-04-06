"use strict";
const fs = require("fs");

/**
 * Semantic version comparison: returns -1/0/1
 * @param {string} a
 * @param {string} b
 */
function semverCompare(a, b) {
  const pa = (a || "0.0.0").split(".").map(Number);
  const pb = (b || "0.0.0").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

/**
 * Migration table: key is the minimum lastVersion that triggers this migration
 * Format: [fromVersion, migrateFn]
 * fromVersion: migration runs when lastVersion < fromVersion
 *
 * Example (adding a new field in v1.0.0 → v1.1.0):
 * ['1.1.0', async (config, dataDir) => {
 *   if (config.newField === undefined) config.newField = 'default';
 * }],
 */
const MIGRATIONS = [
  // v1.0.0: no migrations, framework ready
];

/**
 * Run version migrations
 * @param {object} opts
 * @param {string} opts.lastVersion - last version recorded in config.json; treated as '0.0.0' if absent
 * @param {string} opts.pluginVersion - current plugin version from plugin.json
 * @param {object} opts.config - parsed config object (mutated in place)
 * @param {string} opts.dataDir - data directory path
 * @param {string} opts.configPath - full path to config.json (written back after migration)
 */
async function migrate({
  lastVersion,
  pluginVersion,
  config,
  dataDir,
  configPath,
}) {
  const from = lastVersion || "0.0.0";

  // Already at latest version, skip
  if (semverCompare(from, pluginVersion) >= 0) return;

  // Run all pending migrations in version order
  const pending = MIGRATIONS.filter(([ver]) => semverCompare(from, ver) < 0);
  pending.sort((a, b) => semverCompare(a[0], b[0]));

  for (const [ver, migrateFn] of pending) {
    try {
      await migrateFn(config, dataDir);
      console.error(`[token-reporter] migrated to ${ver}`);
    } catch (e) {
      // Migration failed: log error but do not block startup
      console.error(
        `[token-reporter] migration to ${ver} failed: ${e.message}`,
      );
    }
  }

  // Write back config with updated lastVersion
  config.lastVersion = pluginVersion;
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error(
      `[token-reporter] failed to write config after migration: ${e.message}`,
    );
  }
}

module.exports = { migrate, semverCompare, MIGRATIONS };
