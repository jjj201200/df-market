"use strict";
const fs = require("fs");

/**
 * 语义版本比较：返回 -1/0/1
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
 * 迁移表：key 为触发该迁移所需的最低 lastVersion（即"从这个版本之后需要运行"）
 * 格式：[fromVersion, migrateFn]
 * fromVersion: 若 lastVersion < fromVersion，则执行该迁移
 *
 * 示例（v1.0.0 → v1.1.0 时添加新字段）:
 * ['1.1.0', async (config, dataDir) => {
 *   if (config.newField === undefined) config.newField = 'default';
 * }],
 */
const MIGRATIONS = [
  // v1.0.0 无迁移内容，框架就绪
];

/**
 * 执行版本迁移
 * @param {object} opts
 * @param {string} opts.lastVersion - config.json 中记录的上次版本，无则视为 '0.0.0'
 * @param {string} opts.pluginVersion - 当前插件版本（plugin.json 中的 version）
 * @param {object} opts.config - 已解析的 config 对象（会被就地修改）
 * @param {string} opts.dataDir - 数据目录路径
 * @param {string} opts.configPath - config.json 完整路径（迁移完成后写回）
 */
async function migrate({
  lastVersion,
  pluginVersion,
  config,
  dataDir,
  configPath,
}) {
  const from = lastVersion || "0.0.0";

  // 已是最新版本，跳过
  if (semverCompare(from, pluginVersion) >= 0) return;

  // 按版本顺序执行所有需要的迁移
  const pending = MIGRATIONS.filter(([ver]) => semverCompare(from, ver) < 0);
  pending.sort((a, b) => semverCompare(a[0], b[0]));

  for (const [ver, migrateFn] of pending) {
    try {
      await migrateFn(config, dataDir);
      console.error(`[token-reporter] migrated to ${ver}`);
    } catch (e) {
      // 迁移失败：记录错误，不阻断启动
      console.error(
        `[token-reporter] migration to ${ver} failed: ${e.message}`,
      );
    }
  }

  // 写回 config（包含 lastVersion 更新）
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
