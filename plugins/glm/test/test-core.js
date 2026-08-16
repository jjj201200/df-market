// glm 插件核心逻辑测试。运行：node test/test-core.js
// 全部为纯函数 / 依赖注入测试，不发真实网络请求。

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

import {
  UsageError,
  buildEndpoints,
  fetchQuota,
  windowLabel,
  parseQuotaResponse,
  formatDuration,
  formatNumber,
  renderBar,
  renderPanel,
} from '../scripts/lib/core.mjs';

let passed = 0;
let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({name, fn});

// ---------- formatDuration ----------
test('formatDuration 分钟档', () => {
  assert.equal(formatDuration(5 * 60000), '5 分后重置');
  assert.equal(formatDuration(30 * 1000), '1 分后重置'); // 不足 1 分向上取 1
});

test('formatDuration 小时档', () => {
  assert.equal(formatDuration(((3 * 60 + 24) * 60) * 1000), '3 小时 24 分后重置');
});

test('formatDuration 天档', () => {
  assert.equal(formatDuration((((5 * 24 + 4) * 60) * 60) * 1000), '5 天 4 小时后重置');
});

test('formatDuration 边界', () => {
  assert.equal(formatDuration(0), '即将重置');
  assert.equal(formatDuration(-1000), '即将重置');
  assert.equal(formatDuration(NaN), '重置时间未知');
});

// ---------- formatNumber / displayWidth ----------
test('formatNumber 千分位', () => {
  assert.equal(formatNumber(6866), '6,866');
  assert.equal(formatNumber(60000), '60,000');
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(null), '0');
});

// ---------- windowLabel ----------
test('windowLabel 已知映射', () => {
  assert.equal(windowLabel(3, 5), '5 小时窗口用量');
  assert.equal(windowLabel(6, 1), '7 天用量');
});

test('windowLabel 未知兜底', () => {
  assert.equal(windowLabel(9, 2), '窗口（unit=9 × 2）用量');
});

// ---------- parseQuotaResponse ----------
const FIXTURE = {
  code: 200,
  data: {
    limits: [
      {type: 'CREDIT_LIMIT', unit: 6, number: 1, usage: 60000, currentValue: 6866, remaining: 53133, percentage: 11, nextResetTime: 1787308186998},
      {type: 'CREDIT_LIMIT', unit: 3, number: 5, usage: 12000, currentValue: 6866, remaining: 5133, percentage: 57, nextResetTime: 1786858288851},
    ],
    level: 'pro',
  },
  success: true,
};

test('parseQuotaResponse 正常解析且按窗口时长排序', () => {
  const parsed = parseQuotaResponse(FIXTURE);
  assert.equal(parsed.level, 'pro');
  assert.equal(parsed.windows.length, 2);
  assert.equal(parsed.windows[0].unit, 3); // 5h 排前
  assert.equal(parsed.windows[1].unit, 6);
  assert.equal(parsed.windows[0].label, '5 小时窗口用量');
  assert.equal(parsed.windows[1].used, 6866);
  assert.equal(parsed.windows[1].total, 60000);
  assert.equal(parsed.windows[1].percentage, 11);
});

test('parseQuotaResponse 无 data 包裹的裸结构兼容', () => {
  const parsed = parseQuotaResponse({limits: FIXTURE.data.limits, level: 'lite'});
  assert.equal(parsed.level, 'lite');
});

test('parseQuotaResponse 结构异常抛 parse 错误并携带原始响应', () => {
  assert.throws(() => parseQuotaResponse({foo: 1}), (e) => e instanceof UsageError && e.kind === 'parse' && e.raw !== undefined);
  assert.throws(() => parseQuotaResponse({data: {limits: []}}), (e) => e.kind === 'parse');
});

test('parseQuotaResponse 百分比钳制', () => {
  const parsed = parseQuotaResponse({data: {limits: [{unit: 3, number: 5, usage: 1, currentValue: 1, percentage: 250, nextResetTime: 1}]}});
  assert.equal(parsed.windows[0].percentage, 100);
});

// ---------- renderBar / renderPanel ----------
test('renderBar 30 格进度条', () => {
  assert.equal(renderBar(57).length, 30);
  assert.equal(renderBar(57), '█'.repeat(17) + '░'.repeat(13)); // round(57*30/100)=17
  assert.equal(renderBar(0), '░'.repeat(30));
  assert.equal(renderBar(100), '█'.repeat(30));
});

test('renderPanel 快照（学官方 /usage：无框键值列布局）', () => {
  const parsed = parseQuotaResponse(FIXTURE);
  const now = 1786848000000; // 固定基准时刻
  const out = renderPanel(parsed, {now, manageUrl: 'https://open.bigmodel.cn/coding-plan'});
  const lines = out.split('\n');
  // 头 1 + (空行 + 窗口 4 行) × 2 + 空行 + 链接 = 13 行
  assert.equal(lines.length, 13);
  assert.equal(lines[0], 'GLM Coding Plan 用量 · Pro 档');
  assert.equal(lines[1], '');
  assert.equal(lines[2], '5 小时窗口用量');
  assert.equal(lines[3], `  ${renderBar(57)}   57%`);
  assert.equal(lines[4], '  已用  6,866 / 12,000');
  // 5h 重置点 1786858288851 - now 1786848000000 = 10288851ms ≈ 171 分 = 2 小时 51 分
  assert.equal(lines[5], '  重置  2 小时 51 分后重置');
  assert.equal(lines[7], '7 天用量');
  // 7d 重置点 1787308186998 - now 1786848000000 = 460186998ms ≈ 127.8h = 5 天 7 小时
  assert.equal(lines[10], '  重置  5 天 7 小时后重置');
  assert.equal(lines[12], '管理套餐: https://open.bigmodel.cn/coding-plan');
});

test('renderPanel 不含制表符框线/emoji（跨终端稳定不变量；█░ 进度条白名单放行）', () => {
  const parsed = parseQuotaResponse(FIXTURE);
  const out = renderPanel(parsed, {now: 0, manageUrl: 'x'});
  // box-drawing（U+2500-257F，框线/分隔线）与 emoji 禁止——它们跨字体宽度不稳
  assert.ok(!/[─-╿]/.test(out), '输出含制表符');
  assert.ok(!out.includes('⏱'), '不含 emoji');
  assert.ok(!/\u{1F000}-\u{1FAFF}/u.test(out), '不含 emoji 区字符');
  // 除中文标签、间隔点、进度条 █░ 外不得引入其他非 ASCII
  const nonAscii = out.replace(/[一-鿿·█░]/g, '');
  assert.ok(/^[\x20-\x7E\n]*$/.test(nonAscii), '非 ASCII 字符超出白名单（中文标签/·/█░）');
});

test('renderPanel 标签列等宽（值行相对对齐不变量）', () => {
  const parsed = parseQuotaResponse(FIXTURE);
  const lines = renderPanel(parsed, {now: 0}).split('\n');
  const labelLines = lines.filter((l) => /^  (已用|重置)  /.test(l));
  assert.equal(labelLines.length, parsed.windows.length * 2);
});

test('renderPanel 无 level 时省略档位、无 manageUrl 时省略链接', () => {
  const parsed = parseQuotaResponse({data: {limits: [{unit: 3, number: 5, usage: 1, currentValue: 0, percentage: 0}]}});
  const out = renderPanel(parsed, {now: 0});
  assert.equal(out.split('\n')[0], 'GLM Coding Plan 用量');
  assert.ok(!out.includes('管理套餐'));
});

// ---------- buildEndpoints ----------
test('buildEndpoints 国内端点', () => {
  const ep = buildEndpoints('https://open.bigmodel.cn/api/anthropic');
  assert.equal(ep.urls[0], 'https://open.bigmodel.cn/api/monitor/usage/quota/limit');
  assert.equal(ep.urls[1], 'https://open.bigmodel.cn/api/monitor/usage/quota');
  assert.equal(ep.manageUrl, 'https://open.bigmodel.cn/coding-plan');
});

test('buildEndpoints 国际端点', () => {
  const ep = buildEndpoints('https://api.z.ai/api/anthropic');
  assert.equal(ep.host, 'api.z.ai');
  assert.equal(ep.manageUrl, 'https://z.ai/subscribe');
});

test('buildEndpoints 配置错误', () => {
  assert.throws(() => buildEndpoints(''), (e) => e.kind === 'config');
  assert.throws(() => buildEndpoints('not a url'), (e) => e.kind === 'config');
  assert.throws(() => buildEndpoints('https://relay.example.com/api'), (e) => /不是智谱官方端点/.test(e.message));
});

// ---------- fetchQuota ----------
const jsonResponse = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

test('fetchQuota 首端点成功', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    return jsonResponse(200, FIXTURE);
  };
  const json = await fetchQuota(fake, ['https://a/limit', 'https://a/quota'], 'tok');
  assert.deepEqual(json, FIXTURE);
  assert.equal(calls.length, 1);
});

test('fetchQuota 404 回退第二端点', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    return calls.length === 1 ? jsonResponse(404, {}) : jsonResponse(200, FIXTURE);
  };
  const json = await fetchQuota(fake, ['https://a/limit', 'https://a/quota'], 'tok');
  assert.deepEqual(json, FIXTURE);
  assert.equal(calls.length, 2);
});

test('fetchQuota 全部 404 抛 notfound', async () => {
  const fake = async () => jsonResponse(404, {});
  await assert.rejects(fetchQuota(fake, ['https://a/limit', 'https://a/quota'], 'tok'), (e) => e.kind === 'notfound');
});

test('fetchQuota 401 直接抛 auth（不回退）', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    return jsonResponse(401, {});
  };
  await assert.rejects(fetchQuota(fake, ['https://a/limit', 'https://a/quota'], 'tok'), (e) => e.kind === 'auth');
  assert.equal(calls.length, 1);
});

test('fetchQuota 网络错误不回退直接抛 network', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    throw new Error('ECONNREFUSED');
  };
  await assert.rejects(fetchQuota(fake, ['https://a/limit', 'https://a/quota'], 'tok'), (e) => e.kind === 'network');
  assert.equal(calls.length, 1);
});

test('fetchQuota 超时中止', async () => {
  const fake = (url, opts) =>
    new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})));
    });
  await assert.rejects(fetchQuota(fake, ['https://a/limit'], 'tok', {timeoutMs: 50}), (e) => e.kind === 'network');
});

test('fetchQuota 请求头携带裸 token 且无 Bearer 前缀', async () => {
  let seenHeaders;
  const fake = async (url, opts) => {
    seenHeaders = opts.headers;
    return jsonResponse(200, FIXTURE);
  };
  await fetchQuota(fake, ['https://a/limit'], 'secret-tok');
  assert.equal(seenHeaders.Authorization, 'secret-tok');
});

// ---------- CLI 错误路径 ----------
test('CLI：缺 ANTHROPIC_AUTH_TOKEN 时 exit 1 且不回显任何值', () => {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/usage.mjs');
  const r = spawnSync(process.execPath, [script], {
    env: {PATH: process.env.PATH}, // 清掉 ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.ok(/ANTHROPIC_AUTH_TOKEN/.test(r.stderr));
  assert.ok(!r.stderr.includes(process.env.ANTHROPIC_AUTH_TOKEN ?? '__none__'));
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
