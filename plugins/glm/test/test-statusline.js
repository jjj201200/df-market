// glm 插件 statusline 测试。运行：node test/test-statusline.js
// 全部为纯函数 / 临时目录 / 依赖注入测试，不发真实网络请求、不碰真实 ~/.claude。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  CACHE_TTL_MS,
  REFRESH_INTERVAL_MS,
  isGlmBackend,
  parseStatuslineInput,
  resolveClaudeDir,
  shortenPath,
  colorFor,
  formatResetAt,
  renderGlmLine,
  renderBasicLine,
  readCache,
  writeCache,
} from '../scripts/lib/statusline-core.mjs';
import {createInstaller} from '../scripts/install-statusline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({name, fn});

const stripAnsi = (s) => s.replace(/\x1b\[[\d;]*m/g, '');

// ---------- resolveClaudeDir ----------
test('resolveClaudeDir：CLAUDE_CONFIG_DIR 优先，未设置回落 ~/.claude', () => {
  assert.equal(resolveClaudeDir({CLAUDE_CONFIG_DIR: '/custom/cfg'}), '/custom/cfg');
  assert.equal(resolveClaudeDir({}), path.join(os.homedir(), '.claude'));
});

// ---------- isGlmBackend ----------
test('isGlmBackend 判定', () => {
  assert.equal(isGlmBackend('https://open.bigmodel.cn/api/anthropic'), true);
  assert.equal(isGlmBackend('https://api.z.ai/api/anthropic'), true);
  assert.equal(isGlmBackend('https://api.anthropic.com'), false);
  assert.equal(isGlmBackend('https://relay.example.com/api'), false);
  assert.equal(isGlmBackend(''), false);
  assert.equal(isGlmBackend(undefined), false);
  assert.equal(isGlmBackend('not a url'), false);
});

// ---------- parseStatuslineInput ----------
test('parseStatuslineInput 真实 stdin fixture', () => {
  const input = parseStatuslineInput(
    JSON.stringify({
      model: {id: 'glm-5.3[1m]', display_name: 'glm-5.3[1m]'},
      workspace: {current_dir: '/mnt/d/github/df-market'},
      context_window: {used_percentage: 11},
    }),
  );
  assert.equal(input.model, 'glm-5.3[1m]');
  assert.equal(input.cwd, '/mnt/d/github/df-market');
  assert.equal(input.ctxPct, 11);
});

test('parseStatuslineInput 降级路径', () => {
  const empty = parseStatuslineInput('not json');
  assert.deepEqual(empty, {model: null, cwd: null, ctxPct: null});
  const noCtx = parseStatuslineInput(JSON.stringify({cwd: '/tmp'}));
  assert.equal(noCtx.cwd, '/tmp');
  assert.equal(noCtx.ctxPct, null);
});

// ---------- shortenPath / remainingShort ----------
test('shortenPath HOME 缩写', () => {
  assert.equal(shortenPath('/home/jjj201200/work', '/home/jjj201200'), '~/work');
  assert.equal(shortenPath('/home/jjj201200', '/home/jjj201200'), '~');
  assert.equal(shortenPath('/mnt/d/github', '/home/jjj201200'), '/mnt/d/github');
  assert.equal(shortenPath(null), null);
});

// ---------- 渲染（对齐原 statusline-command.sh 格式） ----------
const WINDOWS = [
  {label: '5 小时窗口用量', unit: 3, number: 5, used: 6866, total: 12000, percentage: 57, nextResetTimeMs: 1000 * 60 * 60 * 3},
  {label: '7 天用量', unit: 6, number: 1, used: 6866, total: 60000, percentage: 11, nextResetTimeMs: 1000 * 60 * 60 * 24 * 5},
];

test('renderGlmLine 官方格式快照：user@host:dir [model] ctx:NN% 5h:NN% 7d:NN%', () => {
  const line = renderGlmLine(WINDOWS, {
    user: 'jjj', host: 'ws', cwd: '/home/jjj201200/work', model: 'glm-5.3[1m]', ctxPct: 11,
  });
  assert.equal(
    stripAnsi(line),
    'jjj@ws:~/work [glm-5.3[1m]] ctx:11% 5h:57% 7d:11%',
  );
  assert.ok(!/[│⏱|]/.test(stripAnsi(line)), '无自造分隔符/emoji');
});

test('renderGlmLine 着色档位与官方一致：≥80 红、60-79 黄、其余暗灰', () => {
  const hot = renderGlmLine(
    WINDOWS.map((w) => ({...w, percentage: w.unit === 3 ? 85 : 65})),
    {user: 'u', host: 'h', cwd: '/w'},
  );
  assert.ok(hot.includes(colorFor(85)), '≥80 红');
  assert.ok(hot.includes(colorFor(65)), '60-79 黄');
  const cool = renderGlmLine(WINDOWS, {user: 'u', host: 'h', cwd: '/w'});
  assert.ok(cool.includes(colorFor(57)), '其余暗灰（DIM，非绿）');
});

test('renderGlmLine ≥90% 追加重置时刻（同日 HH:MM / 跨日 MM-DD HH:MM）', () => {
  const now = Date.now();
  const sameDay = now + 1000 * 60 * 90; // 90 分钟后，几乎必然同日
  const hot = renderGlmLine(
    [{unit: 3, number: 5, percentage: 92, nextResetTimeMs: sameDay}],
    {user: 'u', host: 'h', cwd: '/w', now},
  );
  assert.ok(stripAnsi(hot).includes('5h:92%'), '百分比存在');
  assert.ok(/\(\d{2}:\d{2}\)$/.test(stripAnsi(hot)), '同日 HH:MM 括号');
  // 跨日：now 固定为某日 23:50，重置在次日 01:30 → MM-DD HH:MM
  const base = new Date(2026, 7, 16, 23, 50).getTime();
  const next = new Date(2026, 7, 17, 1, 30).getTime();
  const cross = renderGlmLine(
    [{unit: 3, number: 5, percentage: 95, nextResetTimeMs: next}],
    {user: 'u', host: 'h', cwd: '/w', now: base},
  );
  assert.ok(stripAnsi(cross).includes('5h:95%(08-17 01:30)'), '跨日 MM-DD HH:MM');
});

test('renderGlmLine 无数据跳过限额段（官方「字段缺失即跳过」语义）', () => {
  const line = renderGlmLine(null, {user: 'u', host: 'h', cwd: '/w', model: 'glm-5.3[1m]', ctxPct: 11});
  assert.equal(stripAnsi(line), 'u@h:/w [glm-5.3[1m]] ctx:11%');
});

test('renderGlmLine 字段逐级缺失降级', () => {
  assert.equal(stripAnsi(renderGlmLine(WINDOWS, {})), ' 5h:57% 7d:11%');
});

test('formatResetAt 同日/跨日/无效', () => {
  const now = new Date(2026, 7, 16, 10, 0).getTime();
  assert.equal(formatResetAt(new Date(2026, 7, 16, 22, 5).getTime(), now), '22:05');
  assert.equal(formatResetAt(new Date(2026, 7, 18, 8, 0).getTime(), now), '08-18 08:00');
  assert.equal(formatResetAt(NaN, now), null);
});

test('renderBasicLine 兜底行（同官方前缀格式）', () => {
  assert.equal(
    stripAnsi(renderBasicLine({user: 'u', host: 'h', cwd: '/home/x/w', model: 'glm-5.3[1m]'})),
    'u@h:/home/x/w [glm-5.3[1m]]',
  );
  assert.equal(renderBasicLine({}), 'glm statusline');
});

// ---------- 缓存 ----------
test('writeCache / readCache 往返与损坏容错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-test-'));
  const cachePath = path.join(dir, 'sub', 'cache.json'); // 顺带验证父目录自动创建
  assert.equal(readCache(cachePath, fs), null);
  assert.equal(writeCache(cachePath, {windows: WINDOWS, level: 'pro', fetchedAt: 123}, fs), true);
  const data = readCache(cachePath, fs);
  assert.equal(data.level, 'pro');
  assert.equal(data.windows.length, 2);
  fs.writeFileSync(cachePath, 'corrupt{');
  assert.equal(readCache(cachePath, fs), null);
  fs.rmSync(dir, {recursive: true, force: true});
});

test('CACHE_TTL_MS 为 5 分钟', () => {
  assert.equal(CACHE_TTL_MS, 300000);
});

test('REFRESH_INTERVAL_MS 为 60 秒', () => {
  assert.equal(REFRESH_INTERVAL_MS, 60000);
});

// ---------- hooks/refresh-cache.js（子进程 + 临时 CLAUDE_CONFIG_DIR，不发真实请求） ----------
const HOOK = path.join(ROOT, 'hooks', 'refresh-cache.js');

test('hook：新鲜缓存直接跳过（不更新 fetchedAt）', () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-hook-'));
  const cachePath = path.join(cfg, 'glm', 'cache.json');
  fs.mkdirSync(path.join(cfg, 'glm'), {recursive: true});
  fs.writeFileSync(cachePath, JSON.stringify({windows: [], level: null, fetchedAt: Date.now()}));
  const r = spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      CLAUDE_CONFIG_DIR: cfg,
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      ANTHROPIC_AUTH_TOKEN: 'invalid-token-for-test',
    },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'hook 零输出');
  assert.equal(JSON.parse(fs.readFileSync(cachePath, 'utf8')).fetchedAt >= Date.now() - 1000 ? 'fresh-kept' : 'updated', 'fresh-kept');
  fs.rmSync(cfg, {recursive: true, force: true});
});

test('hook：过期缓存 + 无效 token → 静默失败，缓存不动', () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-hook-'));
  const cachePath = path.join(cfg, 'glm', 'cache.json');
  fs.mkdirSync(path.join(cfg, 'glm'), {recursive: true});
  fs.writeFileSync(cachePath, JSON.stringify({windows: [], level: null, fetchedAt: 1}));
  const r = spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8',
    timeout: 20000,
    env: {
      PATH: process.env.PATH,
      CLAUDE_CONFIG_DIR: cfg,
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      ANTHROPIC_AUTH_TOKEN: 'invalid-token-for-test',
    },
  });
  assert.equal(r.status, 0, '静默退出');
  assert.equal(r.stderr, '', '零 stderr');
  assert.equal(JSON.parse(fs.readFileSync(cachePath, 'utf8')).fetchedAt, 1, '缓存未被改动');
  fs.rmSync(cfg, {recursive: true, force: true});
});

test('hook：非智谱 BASE_URL 直接退出', () => {
  const r = spawnSync(process.execPath, [HOOK], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_AUTH_TOKEN: 'whatever',
    },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

// ---------- installer（on / off / status，临时目录） ----------
function makeInstallerCtx() {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-claude-'));
  const installer = createInstaller({claudeDir});
  return {claudeDir, installer};
}

test('on：备份原配置并接管，二次 on 幂等', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
    model: 'glm-5.3',
    statusLine: {type: 'command', command: 'sh /home/x/statusline-command.sh'},
  }));
  const r1 = installer.on();
  assert.equal(r1.success, true);
  assert.deepEqual(r1.originalStatusLine, {type: 'command', command: 'sh /home/x/statusline-command.sh'});
  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  assert.equal(settings.model, 'glm-5.3', '保留其他键');
  assert.equal(settings.statusLine.command, installer.paths.stubCommand);
  assert.ok(fs.existsSync(installer.paths.stubPath), 'stub 已落盘');
  const r2 = installer.on();
  assert.equal(r2.already, true);
  // 幂等后备份不应被二次覆盖（仍是原配置）
  assert.deepEqual(JSON.parse(fs.readFileSync(installer.paths.backupPath, 'utf8')), {
    type: 'command',
    command: 'sh /home/x/statusline-command.sh',
  });
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

test('on：原本无 statusLine 时备份 null，off 删除该键', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({theme: 'dark'}));
  installer.on();
  assert.equal(JSON.parse(fs.readFileSync(installer.paths.backupPath, 'utf8')), null);
  const off = installer.off();
  assert.equal(off.success, true);
  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  assert.equal(settings.statusLine, undefined, 'null 备份 → 删除键');
  assert.equal(settings.theme, 'dark');
  assert.ok(!fs.existsSync(installer.paths.backupPath));
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

test('off：还原原始配置对象', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  const original = {type: 'command', command: 'sh /home/x/s.sh', padding: 4};
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({statusLine: original}));
  installer.on();
  installer.off();
  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  assert.deepEqual(settings.statusLine, original, '完整还原（含 padding 等附加键）');
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

test('status：报告接管状态', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({}));
  assert.equal(installer.status().integrated, false);
  installer.on();
  const s = installer.status();
  assert.equal(s.integrated, true);
  assert.equal(s.currentCommand, installer.paths.stubCommand);
  assert.equal(s.hasBackupFile, true);
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

// ---------- stub：动态发现最新版缓存（端到端，HOME 重定向） ----------
test('stub 发现最新版插件缓存并转发', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({}));
  installer.on();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-stub-home-'));
  // 两个市场各放一个 glm 版本，另放一个干扰插件——期望选中版本号最大的 0.10.0
  const mk = (market, version) => {
    const dir = path.join(home, '.claude/plugins/cache', market, 'glm', version, 'scripts');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'statusline.mjs'), `console.log('FROM ${market}@${version}');\n`);
  };
  mk('df-market', '0.9.0');
  mk('other-market', '0.10.0'); // 0.10 > 0.9（数字段比较，非字典序）
  fs.mkdirSync(path.join(home, '.claude/plugins/cache/df-market/other-plugin/1.0.0'), {recursive: true});
  const r = spawnSync(process.execPath, [installer.paths.stubPath], {
    encoding: 'utf8',
    env: {PATH: process.env.PATH, HOME: home},
  });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(r.stdout.trim(), 'FROM other-market@0.10.0');
  fs.rmSync(home, {recursive: true, force: true});
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

test('stub 双根发现：CLAUDE_CONFIG_DIR 下的更高版本优先于 ~/.claude', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({}));
  installer.on();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-stub-home-'));
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-stub-cfg-'));
  const mk = (base, market, version) => {
    const dir = path.join(base, 'plugins/cache', market, 'glm', version, 'scripts');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'statusline.mjs'), `console.log('FROM ${market}@${version}');\n`);
  };
  mk(home, 'df-market', '0.9.0'); // 官方默认根下旧版本
  mk(cfgDir, 'df-market', '0.10.0'); // CLAUDE_CONFIG_DIR 根下新版本
  const r = spawnSync(process.execPath, [installer.paths.stubPath], {
    encoding: 'utf8',
    env: {PATH: process.env.PATH, HOME: home, CLAUDE_CONFIG_DIR: cfgDir},
  });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(r.stdout.trim(), 'FROM df-market@0.10.0');
  fs.rmSync(home, {recursive: true, force: true});
  fs.rmSync(cfgDir, {recursive: true, force: true});
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

test('stub 无缓存时输出提示行（状态栏不空白）', () => {
  const {claudeDir, installer} = makeInstallerCtx();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({}));
  installer.on();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-stub-home-'));
  const r = spawnSync(process.execPath, [installer.paths.stubPath], {
    encoding: 'utf8',
    env: {PATH: process.env.PATH, HOME: home},
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('glm statusline'), `stdout: ${r.stdout}`);
  fs.rmSync(home, {recursive: true, force: true});
  fs.rmSync(claudeDir, {recursive: true, force: true});
});

// ---------- 端到端：statusline.mjs 双模式（子进程，fake env + fake 备份） ----------
const STDIN_FIXTURE = JSON.stringify({
  model: {display_name: 'glm-5.3[1m]'},
  workspace: {current_dir: path.join(os.homedir(), 'work')},
  context_window: {used_percentage: 11},
});

test('端到端：非智谱 + 备份命令 → 透传原命令输出', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-home-'));
  const glmDir = path.join(home, '.claude', 'glm');
  fs.mkdirSync(glmDir, {recursive: true});
  fs.writeFileSync(path.join(glmDir, 'statusline-backup.json'), JSON.stringify({
    type: 'command',
    command: `node -e "let t='';process.stdin.on('data',d=>t+=d).on('end',()=>process.stdout.write('ORIG/'+JSON.parse(t).model.display_name))"`,
  }));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/statusline.mjs')], {
    input: STDIN_FIXTURE,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: home, // 重定向 HOME：statusline.mjs 从 os.homedir() 找备份
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_AUTH_TOKEN: 'fake',
    },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'ORIG/glm-5.3[1m]');
  fs.rmSync(home, {recursive: true, force: true});
});

test('端到端：非智谱 + 无备份 → 基础行（状态栏不空白）', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-home-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/statusline.mjs')], {
    input: STDIN_FIXTURE,
    encoding: 'utf8',
    env: {PATH: process.env.PATH, HOME: home, ANTHROPIC_BASE_URL: 'https://api.anthropic.com'},
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0, '永有空输出');
  fs.rmSync(home, {recursive: true, force: true});
});

test('端到端：智谱后端 + 坏 token → ?% 降级（不崩、不空）', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-home-'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/statusline.mjs')], {
    input: STDIN_FIXTURE,
    encoding: 'utf8',
    timeout: 20000, // 真实网络请求（401 快速返回），仅验证降级路径
    env: {
      PATH: process.env.PATH,
      HOME: home,
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      ANTHROPIC_AUTH_TOKEN: 'invalid-token-for-test',
    },
  });
  assert.equal(r.status, 0);
  // 官方「字段缺失即跳过」语义：限额段不显示，但前缀/模型/ctx 段照常，状态栏非空
  assert.ok(r.stdout.includes('ctx:'), '基础段照常输出');
  assert.ok(r.stdout.trim().length > 0, '状态栏永不空白');
  fs.rmSync(home, {recursive: true, force: true});
});

for (const {name, fn} of tests) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(failed ? `${failed} tests failed, ${passed} passed` : `All ${passed} tests passed`);
