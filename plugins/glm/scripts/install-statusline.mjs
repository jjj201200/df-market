// glm-statusline-on / -off / -status 的实现模块。
// 通过 createInstaller({claudeDir}) 参数化路径，bin 薄壳传真实路径，测试传临时目录。

import fs from 'node:fs';
import path from 'node:path';

/** stub 文件内容：动态发现最新版 glm 插件缓存并转发（插件升级换版本目录后无需重装） */
const STUB_SOURCE = `#!/usr/bin/env node
// 由 glm-statusline-on 生成，勿手改。发现最新版 glm 插件缓存中的 statusline 入口并转发。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cacheRoot = path.join(os.homedir(), '.claude', 'plugins', 'cache');
function cmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
let entry = null;
let bestVersion = null;
try {
  for (const market of fs.readdirSync(cacheRoot)) {
    const pluginDir = path.join(cacheRoot, market, 'glm');
    let versions;
    try {
      versions = fs.readdirSync(pluginDir);
    } catch {
      continue;
    }
    for (const version of versions) {
      const candidate = path.join(pluginDir, version, 'scripts', 'statusline.mjs');
      if (fs.existsSync(candidate) && (bestVersion === null || cmp(version, bestVersion) > 0)) {
        bestVersion = version;
        entry = candidate;
      }
    }
  }
} catch {}
if (entry) {
  await import(entry);
} else {
  console.log('glm statusline: 未找到 glm 插件缓存（重装 glm 插件后再运行 glm-statusline-on）');
}
`;

export function createInstaller({claudeDir}) {
  const glmDir = path.join(claudeDir, 'glm');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const stubPath = path.join(glmDir, 'statusline.mjs');
  const backupPath = path.join(glmDir, 'statusline-backup.json');
  const stubCommand = `node ${JSON.stringify(stubPath)}`;

  function readSettings() {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      return {};
    }
  }

  function writeSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  function isIntegrated(settings) {
    return settings.statusLine?.command === stubCommand;
  }

  function status() {
    const settings = readSettings();
    let backup = null;
    let hasBackupFile = false;
    try {
      backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      hasBackupFile = true;
    } catch {
      // 无备份文件
    }
    return {
      integrated: isIntegrated(settings),
      currentCommand: settings.statusLine?.command ?? null,
      backup,
      hasBackupFile,
    };
  }

  function on() {
    const settings = readSettings();
    if (isIntegrated(settings)) {
      return {success: true, message: 'glm statusline 已接管（幂等，未重复备份）', already: true};
    }
    fs.mkdirSync(glmDir, {recursive: true});
    // 备份原 statusLine 配置；原本没有则为 null（off 时删除该键）
    fs.writeFileSync(backupPath, JSON.stringify(settings.statusLine ?? null, null, 2) + '\n');
    fs.writeFileSync(stubPath, STUB_SOURCE);
    settings.statusLine = {type: 'command', command: stubCommand};
    writeSettings(settings);
    const original = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    return {
      success: true,
      message: 'glm statusline 接管成功',
      backupPath,
      originalStatusLine: original,
    };
  }

  function off() {
    const settings = readSettings();
    if (!fs.existsSync(backupPath)) {
      return {success: false, message: '未找到接管备份（可能从未执行过 glm-statusline-on）'};
    }
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    if (backup === null) {
      delete settings.statusLine;
    } else {
      settings.statusLine = backup;
    }
    writeSettings(settings);
    fs.rmSync(backupPath);
    return {success: true, message: '已还原原 statusline 配置'};
  }

  return {status, on, off, paths: {glmDir, settingsPath, stubPath, backupPath, stubCommand}};
}
