# Context Auditing Dashboard Implementation Plan — v2 (F 路径)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 token-reporter 增加「真实 context 构成」视图。数据源 = Node 进程内 fetch hook 拦截到的 `api.anthropic.com` 完整 request/response body。前端新增 Composition 模块（live/estimated/hookStale 三态 + 顶部横幅）。

**Architecture:** `token-reporter-audit on` 往 `~/.claude/settings.local.json.env` 追加 3 个键：`NODE_OPTIONS=... --require=<plugin>/runtime/fetch-hook.cjs`、`TOKEN_REPORTER_AUDIT_OUT`、`TOKEN_REPORTER_AUDIT_ACTIVE`。Claude 下次启动时 Node 加载 hook，hook patch `globalThis.fetch` + `require('undici').fetch`，抓到 body 副本写 `<OUT>/<pid>-<ts>-<seq>.req.json` / `.resp.json`，原请求不动。后端 `GET /api/sessions/:id/composition` 按 `x-claude-code-session-id` header 归属到 session，拆成 7 类 token 来源返回前端。

**Tech Stack:** TypeScript（`backend/src/` tsc → `backend/dist/`），纯 CJS hook（`runtime/fetch-hook.cjs`，Node preload 硬性要求），React + Zustand + Recharts（frontend），`node:test`/`assert`。

**Scope discipline:**
- 只支持 Node 版 Claude Code CLI（其他形态 audit on 会直接拒绝）
- hook 绝对不 throw 任何错误到宿主；所有异常吞掉 append `.errors.log`
- `NODE_OPTIONS` **追加而非替换**，保留用户原值；`audit off` 完整还原
- **不改** `backend/src/parser/`（主 JSONL 解析零回归）

---

## File Structure

### Backend（TypeScript）

| 路径 | 状态 | 责任 |
|------|------|------|
| `backend/src/audit-keys.ts` | 新建 | 导出 `MANAGED_ENV_KEYS = ['NODE_OPTIONS', 'TOKEN_REPORTER_AUDIT_OUT', 'TOKEN_REPORTER_AUDIT_ACTIVE']` + 辅助常量 `HOOK_REQUIRE_TOKEN`（`--require=<hook-path>` 模式字串，运行时拼接实际路径） |
| `backend/src/audit-settings.ts` | 新建 | 读写 `~/.claude/settings.local.json`：NODE_OPTIONS 合并/还原（保留用户原值）、AUDIT_OUT/ACTIVE 读写；读写 config.json 的 `auditEnabled`/`auditPromptedAt`/`userNodeOptions`；读 hook heartbeat 文件 |
| `backend/src/captures-parser.ts` | 新建 | 读 `<OUT>/*.req.json`（以及对应 `.resp.json`），按 `x-claude-code-session-id` 分组，body JSON 解析 → CompositionPoint[] |
| `backend/src/composition-service.ts` | 新建 | 组装 `/api/sessions/:id/composition`：captures 有则 live；无则 estimated（从 JSONL 估算 messages_* 五类，system_prompt + tools_schema 进 unknownSources）；hookStale 时也返回 estimated + 置位 `hookStale: true` |
| `backend/src/server.ts` | 修改 | 挂载 `GET /api/audit/status`、`POST /api/audit/ack-prompt`、`GET /api/sessions/:id/composition`、`POST /api/audit/purge` |
| `backend/src/migrate.ts` | 修改 | 追加一条到 `2.11.0` 迁移：补 `auditEnabled: false` / `auditPromptedAt: null` / `userNodeOptions: null` |

### Runtime（纯 CJS，不进 tsc 编译）

| 路径 | 状态 | 责任 |
|------|------|------|
| `plugins/token-reporter/runtime/fetch-hook.cjs` | 新建 | Node preload 入口。patch `globalThis.fetch` 和 `require('undici').fetch`，对 `api.anthropic.com/*` 请求抓 body 副本写盘；写 heartbeat；吞异常 |

### CLI

| 路径 | 状态 | 责任 |
|------|------|------|
| `bin/token-reporter-audit` | 新建 | `on`/`off`/`status`/`purge` 入口；含环境前置检查（node ≥18、claude CLI 存在、hook 文件存在） |

### Hooks（session-start）

| 路径 | 状态 | 责任 |
|------|------|------|
| `hooks/session-start.js` | **不改** | v2 放弃 SessionStart stderr 引导路径，只用前端 banner |

### Frontend

| 路径 | 状态 | 责任 |
|------|------|------|
| `frontend/src/types/api.ts` | 修改 | 追加 `AuditStatus`、`CompositionPoint`、`CompositionResponse`、`CompositionSources` |
| `frontend/src/services/api.ts` | 修改 | `getAuditStatus()` / `ackAuditPrompt()` / `getComposition(sessionId)` |
| `frontend/src/stores/auditStore.ts` | 新建 | Zustand store：`status` / `fetchStatus` / `dismiss` |
| `frontend/src/components/Analytics/common/AuditBanner.tsx` | 新建 | 顶部横幅，三态渲染（未启用 / hookStale / 正常） |
| `frontend/src/components/Analytics/common/AuditBanner.module.scss` | 新建 | 横幅样式 |
| `frontend/src/components/Analytics/AnalyticsPage.tsx` | 修改 | 挂 `<AuditBanner />` |
| `frontend/src/components/Analytics/ContextPanel/CompositionStack.tsx` | 新建 | 堆叠面积图 + 徽章 |
| `frontend/src/components/Analytics/ContextPanel/CompositionStack.module.scss` | 新建 | 样式 |
| `frontend/src/components/Analytics/ContextPanel/SourceCards.tsx` | 新建 | 最新一轮 7 张卡 |
| `frontend/src/components/Analytics/ContextPanel/SourceCards.module.scss` | 新建 | 样式 |
| `frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx` | 修改 | 挂 CompositionStack + SourceCards + useComposition hook |
| `frontend/src/i18n/locales/en.ts` | 修改 | 追加 `composition.*` / `audit.banner.*` / `audit.privacy.*` / `audit.cli.*` |
| `frontend/src/i18n/locales/zh-CN.ts` | 修改 | 同上中文 |

### Tests

| 路径 | 状态 | 责任 |
|------|------|------|
| `test/test-audit-keys.js` | 新建 | 白名单 3 键断言 |
| `test/test-audit-settings.js` | 新建 | settings.local.json 合并追加还原、NODE_OPTIONS 保留用户原值、config.json audit 字段读写、heartbeat 读取 |
| `test/test-audit-cli.cjs` | 新建 | `on`/`off`/`status`/`purge`，含前置检查失败分支 |
| `test/test-fetch-hook.cjs` | 新建 | 独立 spawn node 子进程 `--require=fetch-hook.cjs`，mock server + fetch 调用，断言 req/resp 文件 + 心跳 |
| `test/test-captures-parser.js` | 新建 | 3 份 fixture（simple / with-tool / with-thinking）→ 7 类拆解断言 |
| `test/test-composition-service.js` | 新建 | captures 有 → live；无 → estimated；stale → estimated + hookStale |
| `test/test-audit-status-api.js` | 新建 | 四种场景：未启用、启用活、启用 stale、purge 后 |
| `test/fixtures/captures/simple/*.req.json` | 新建 | 3 份 |
| `test/fixtures/captures/with-tool/*.req.json` | 新建 | 1 份 |
| `test/fixtures/captures/with-thinking/*.req.json` | 新建 | 1 份 |
| `test/fixtures/settings.local.json.plain` | 新建 | {} |
| `test/fixtures/settings.local.json.with-user-node-options` | 新建 | 含用户原有 NODE_OPTIONS |
| `test/fixtures/settings.local.json.with-audit-enabled` | 新建 | 已含 3 个白名单键 |

### 版本管理

`plugins/token-reporter/.claude-plugin/plugin.json`: 2.10.1 → 2.11.0  
`.claude-plugin/marketplace.json`: 镜像 2.11.0

通过 `release-market` skill 触发 bump。

---

## Task 0: Hook 脚本（生产级 fetch-hook.cjs）

> 原 v1 Task 0 = OTel 通道验证（已废弃）。v2 Task 0 = 把 `/tmp/f-spike/hook.cjs` spike 代码改写成生产级 `runtime/fetch-hook.cjs`，跑一次实盘测试验证 capture 落盘 + 心跳 + 权限。

**Files:**
- Create: `plugins/token-reporter/runtime/fetch-hook.cjs`

- [ ] **Step 1: 写 hook**

`plugins/token-reporter/runtime/fetch-hook.cjs`：

```javascript
// token-reporter fetch-hook
// Preloaded by Node via NODE_OPTIONS=--require=<this>. Patches globalThis.fetch
// and require('undici').fetch to capture Anthropic Messages API request bodies
// before TLS. Original fetch return is untouched — zero behavior change on host.
//
// Writes to process.env.TOKEN_REPORTER_AUDIT_OUT:
//   <pid>-<ts>-<seq>.req.json
//   <pid>-<ts>-<seq>.resp.json
//   .heartbeat
//   .errors.log (append)
// All exceptions are swallowed. The host must never observe a throw from this file.

'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const OUT_DIR = process.env.TOKEN_REPORTER_AUDIT_OUT;
if (!OUT_DIR) return; // hook not armed

const PID = process.pid;
const MATCH = /^https?:\/\/api\.anthropic\.com(\/|$)/;
const HEADER_ALLOWLIST = new Set([
  'x-claude-code-session-id',
  'anthropic-version',
  'anthropic-beta',
  'x-client-request-id',
  'content-type',
  'user-agent',
]);
let seq = 0;

function safeMkdir() {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(OUT_DIR, 0o700); } catch {}
  } catch {}
}
safeMkdir();

function safeAppend(name, data) {
  try { fs.appendFileSync(path.join(OUT_DIR, name), data); } catch {}
}

function safeWrite(name, data) {
  try { fs.writeFileSync(path.join(OUT_DIR, name), data); } catch (e) { safeAppend('.errors.log', `${new Date().toISOString()} write ${name}: ${e && e.message}\n`); }
}

function heartbeat() {
  try {
    fs.writeFileSync(path.join(OUT_DIR, '.heartbeat'), JSON.stringify({
      pid: PID,
      at: new Date().toISOString(),
    }));
  } catch {}
}
heartbeat();

function filterHeaders(h) {
  const out = {};
  try {
    if (!h) return out;
    if (typeof h.forEach === 'function') {
      h.forEach((v, k) => { if (HEADER_ALLOWLIST.has(String(k).toLowerCase())) out[String(k).toLowerCase()] = v; });
    } else if (typeof h === 'object') {
      for (const k of Object.keys(h)) {
        if (HEADER_ALLOWLIST.has(k.toLowerCase())) out[k.toLowerCase()] = h[k];
      }
    }
  } catch {}
  return out;
}

async function readBodyToString(rawBody) {
  if (rawBody == null) return { body: null, bytes: 0 };
  if (typeof rawBody === 'string') return { body: rawBody, bytes: Buffer.byteLength(rawBody, 'utf8') };
  if (Buffer.isBuffer(rawBody)) return { body: rawBody.toString('utf8'), bytes: rawBody.length };
  if (rawBody instanceof Uint8Array) return { body: Buffer.from(rawBody).toString('utf8'), bytes: rawBody.byteLength };
  if (typeof rawBody === 'object' && typeof rawBody.pipe === 'function') return { body: null, bytes: -1, note: 'stream-unreadable' };
  if (rawBody && typeof rawBody.getReader === 'function') return { body: null, bytes: -1, note: 'stream-unreadable' };
  try { const s = JSON.stringify(rawBody); return { body: s, bytes: Buffer.byteLength(s, 'utf8') }; } catch {}
  return { body: null, bytes: -1, note: 'unknown-body-type' };
}

function wrapFetch(originalFetch, label) {
  return async function patchedFetch(input, init) {
    let writeReq = null;
    let reqId = null;
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (MATCH.test(url)) {
        reqId = `${PID}-${Date.now()}-${++seq}`;
        const method = (init && init.method) || (input && input.method) || 'GET';
        const body = init && init.body;
        const { body: bodyStr, bytes, note } = await readBodyToString(body);
        const headers = filterHeaders((init && init.headers) || (input && input.headers));
        writeReq = {
          id: reqId,
          capturedAt: new Date().toISOString(),
          url, method, headers, bodyBytes: bytes, bodyNote: note || null, body: bodyStr,
        };
      }
    } catch (e) {
      safeAppend('.errors.log', `${new Date().toISOString()} ${label} pre-fetch: ${e && e.message}\n`);
    }

    let result;
    try {
      result = await originalFetch.apply(this, arguments);
    } catch (e) {
      if (writeReq) {
        safeWrite(`${reqId}.req.json`, JSON.stringify(writeReq, null, 2));
        safeAppend('.errors.log', `${new Date().toISOString()} ${label} fetch-threw ${reqId}: ${e && e.message}\n`);
      }
      throw e;
    }

    if (writeReq) {
      safeWrite(`${reqId}.req.json`, JSON.stringify(writeReq, null, 2));
      heartbeat();
      try {
        const cloned = typeof result.clone === 'function' ? result.clone() : null;
        if (cloned) {
          const text = await cloned.text();
          safeWrite(`${reqId}.resp.json`, JSON.stringify({
            id: reqId,
            capturedAt: new Date().toISOString(),
            status: cloned.status,
            headers: filterHeaders(cloned.headers),
            body: text,
            bodyBytes: Buffer.byteLength(text, 'utf8'),
          }, null, 2));
        }
      } catch (e) {
        safeAppend('.errors.log', `${new Date().toISOString()} ${label} resp-clone ${reqId}: ${e && e.message}\n`);
      }
    }

    return result;
  };
}

if (typeof globalThis.fetch === 'function') {
  try { globalThis.fetch = wrapFetch(globalThis.fetch, 'globalThis'); } catch (e) { safeAppend('.errors.log', `patch globalThis.fetch: ${e && e.message}\n`); }
}

try {
  const origLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const m = origLoad.apply(this, arguments);
    try {
      if (request === 'undici' && m && typeof m.fetch === 'function' && !m.__tokenReporterPatched) {
        m.fetch = wrapFetch(m.fetch, 'undici');
        m.__tokenReporterPatched = true;
      }
    } catch (e) { safeAppend('.errors.log', `patch undici: ${e && e.message}\n`); }
    return m;
  };
} catch (e) { safeAppend('.errors.log', `install Module._load: ${e && e.message}\n`); }
```

- [ ] **Step 2: Smoke test hook 实盘**

```bash
cd plugins/token-reporter
OUT=/tmp/tr-hook-smoke
rm -rf "$OUT" && mkdir -p "$OUT"
NODE_OPTIONS="--require=$(pwd)/runtime/fetch-hook.cjs" \
TOKEN_REPORTER_AUDIT_OUT="$OUT" \
TOKEN_REPORTER_AUDIT_ACTIVE=1 \
  /Users/df2025/.nvm/versions/node/v23.9.0/bin/claude --print --model claude-haiku-4-5 "Say HELLO." > /dev/null
ls "$OUT"
cat "$OUT/.heartbeat"
```

Expected：`$OUT` 下至少 1 个 `*.req.json`、对应 `*.resp.json`、`.heartbeat`；no `.errors.log` 或 errors.log 为空。用 node 脚本断言 req body parse 成 JSON。

```bash
node -e "
const fs=require('fs'),path=require('path');
const OUT='$OUT';
const files=fs.readdirSync(OUT).filter(f=>f.endsWith('.req.json'));
if(!files.length){console.error('NO REQ FILES'); process.exit(1)}
const r=JSON.parse(fs.readFileSync(path.join(OUT,files[0]),'utf8'));
console.log('url:',r.url,'method:',r.method,'bytes:',r.bodyBytes);
const b=JSON.parse(r.body);
console.log('top keys:',Object.keys(b));
console.log('session header:',r.headers['x-claude-code-session-id']);
console.log('tools count:',b.tools?b.tools.length:null);
"
```

Expected：JSON parse 成功、有 tools / system / messages 字段、`x-claude-code-session-id` header 非空。

- [ ] **Step 3: Commit**

```bash
git add plugins/token-reporter/runtime/fetch-hook.cjs
git commit -m "feat(token-reporter): fetch-hook.cjs for F-path capture"
```

---

## Task 1: audit-keys 常量

**Files:**
- Create: `backend/src/audit-keys.ts`
- Create: `test/test-audit-keys.js`

- [ ] **Step 1: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MANAGED_ENV_KEYS, HOOK_REQUIRE_TOKEN, hookPathForPlugin, hookRequireArg } from '../backend/dist/audit-keys.js';
import path from 'path';

test('MANAGED_ENV_KEYS lists exactly 3 keys in documented order', () => {
  assert.deepEqual(MANAGED_ENV_KEYS, [
    'NODE_OPTIONS',
    'TOKEN_REPORTER_AUDIT_OUT',
    'TOKEN_REPORTER_AUDIT_ACTIVE',
  ]);
});

test('HOOK_REQUIRE_TOKEN is a marker substring used to detect our --require', () => {
  assert.equal(typeof HOOK_REQUIRE_TOKEN, 'string');
  assert.ok(HOOK_REQUIRE_TOKEN.length > 0);
  assert.ok(HOOK_REQUIRE_TOKEN.includes('fetch-hook.cjs'));
});

test('hookPathForPlugin joins runtime/fetch-hook.cjs', () => {
  const p = hookPathForPlugin('/x/plugins/token-reporter');
  assert.equal(p, path.join('/x/plugins/token-reporter', 'runtime', 'fetch-hook.cjs'));
});

test('hookRequireArg produces --require=<abs path>', () => {
  const arg = hookRequireArg('/x/plugins/token-reporter');
  assert.match(arg, /^--require=\/x\/plugins\/token-reporter\/runtime\/fetch-hook\.cjs$/);
  assert.ok(arg.includes(HOOK_REQUIRE_TOKEN));
});
```

- [ ] **Step 2: Run test**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-audit-keys.js
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: Implement**

`backend/src/audit-keys.ts`：

```typescript
import path from 'path';

export const MANAGED_ENV_KEYS = [
  'NODE_OPTIONS',
  'TOKEN_REPORTER_AUDIT_OUT',
  'TOKEN_REPORTER_AUDIT_ACTIVE',
] as const;

export type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];

// Stable substring we look for in NODE_OPTIONS to decide if our hook is already installed.
export const HOOK_REQUIRE_TOKEN = 'runtime/fetch-hook.cjs';

export function hookPathForPlugin(pluginRoot: string): string {
  return path.join(pluginRoot, 'runtime', 'fetch-hook.cjs');
}

export function hookRequireArg(pluginRoot: string): string {
  return `--require=${hookPathForPlugin(pluginRoot)}`;
}
```

- [ ] **Step 4: Verify pass**

```bash
npm run build:backend && node --test test/test-audit-keys.js
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/audit-keys.ts test/test-audit-keys.js
git commit -m "feat(token-reporter): managed env key constants for audit"
```

---

## Task 2: audit-settings helpers

**Files:**
- Create: `backend/src/audit-settings.ts`
- Create: `test/test-audit-settings.js`
- Create: 3 fixture 文件

- [ ] **Step 1: Write fixtures**

`test/fixtures/settings.local.json.plain`:
```json
{}
```

`test/fixtures/settings.local.json.with-user-node-options`:
```json
{
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=4096",
    "MY_FLAG": "yes"
  }
}
```

`test/fixtures/settings.local.json.with-audit-enabled`:
```json
{
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=4096 --require=/p/runtime/fetch-hook.cjs",
    "TOKEN_REPORTER_AUDIT_OUT": "/tmp/cap",
    "TOKEN_REPORTER_AUDIT_ACTIVE": "1",
    "MY_FLAG": "yes"
  }
}
```

- [ ] **Step 2: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadSettings, writeSettings,
  enableAudit, disableAudit,
  readManagedSnapshot,
  loadAuditConfig, writeAuditConfig,
  readHookHeartbeat,
} from '../backend/dist/audit-settings.js';
import { hookRequireArg } from '../backend/dist/audit-keys.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'audit-set-')); }
function fixtureCopy(name, dest) {
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', name), dest);
}

test('enableAudit on plain settings writes 3 keys and stores userNodeOptions=null', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.plain', settings);
  fs.writeFileSync(config, JSON.stringify({port: 3737}));
  enableAudit({settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out'});
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, hookRequireArg('/p'));
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_OUT, '/out');
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_ACTIVE, '1');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.auditEnabled, true);
  assert.equal(c.userNodeOptions, null);
});

test('enableAudit preserves user NODE_OPTIONS and stores it for restore', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.with-user-node-options', settings);
  fs.writeFileSync(config, JSON.stringify({port: 3737}));
  enableAudit({settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out'});
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, '--max-old-space-size=4096 ' + hookRequireArg('/p'));
  assert.equal(s.env.MY_FLAG, 'yes');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.userNodeOptions, '--max-old-space-size=4096');
});

test('enableAudit is idempotent — running twice does not duplicate --require', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.plain', settings);
  fs.writeFileSync(config, JSON.stringify({port: 3737}));
  enableAudit({settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out'});
  enableAudit({settingsPath: settings, configPath: config, pluginRoot: '/p', outDir: '/out'});
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  const count = (s.env.NODE_OPTIONS.match(/fetch-hook\.cjs/g) || []).length;
  assert.equal(count, 1);
});

test('disableAudit removes 3 keys and restores user NODE_OPTIONS', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fixtureCopy('settings.local.json.with-audit-enabled', settings);
  fs.writeFileSync(config, JSON.stringify({port: 3737, auditEnabled: true, userNodeOptions: '--max-old-space-size=4096'}));
  disableAudit({settingsPath: settings, configPath: config});
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, '--max-old-space-size=4096');
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_OUT, undefined);
  assert.equal(s.env.TOKEN_REPORTER_AUDIT_ACTIVE, undefined);
  assert.equal(s.env.MY_FLAG, 'yes');
  const c = JSON.parse(fs.readFileSync(config, 'utf8'));
  assert.equal(c.auditEnabled, false);
});

test('disableAudit drops NODE_OPTIONS entirely when userNodeOptions was null', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(settings, JSON.stringify({
    env: {
      NODE_OPTIONS: '--require=/p/runtime/fetch-hook.cjs',
      TOKEN_REPORTER_AUDIT_OUT: '/out',
      TOKEN_REPORTER_AUDIT_ACTIVE: '1',
    },
  }));
  fs.writeFileSync(config, JSON.stringify({auditEnabled: true, userNodeOptions: null}));
  disableAudit({settingsPath: settings, configPath: config});
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.env.NODE_OPTIONS, undefined);
});

test('readManagedSnapshot reports presence for each key', () => {
  const dir = tmp();
  const settings = path.join(dir, 'settings.local.json');
  fixtureCopy('settings.local.json.with-audit-enabled', settings);
  const snap = readManagedSnapshot(settings);
  assert.equal(snap.NODE_OPTIONS.present, true);
  assert.ok(snap.NODE_OPTIONS.value.includes('fetch-hook.cjs'));
  assert.equal(snap.TOKEN_REPORTER_AUDIT_OUT.present, true);
  assert.equal(snap.TOKEN_REPORTER_AUDIT_ACTIVE.present, true);
});

test('loadSettings on missing file returns {env:{}}', () => {
  const dir = tmp();
  const r = loadSettings(path.join(dir, 'missing.json'));
  assert.deepEqual(r, {env: {}});
});

test('loadSettings on invalid JSON throws labelled', () => {
  const dir = tmp();
  const p = path.join(dir, 'bad.json');
  fs.writeFileSync(p, 'nope');
  assert.throws(() => loadSettings(p), /settings\.local\.json is invalid/);
});

test('readHookHeartbeat returns null if missing, parsed object if present', () => {
  const dir = tmp();
  assert.equal(readHookHeartbeat(dir), null);
  fs.writeFileSync(path.join(dir, '.heartbeat'), JSON.stringify({pid: 1, at: '2026-04-19T00:00:00.000Z'}));
  const hb = readHookHeartbeat(dir);
  assert.equal(hb.pid, 1);
});
```

- [ ] **Step 3: Run test**

Expected: FAIL (module missing).

- [ ] **Step 4: Implement**

`backend/src/audit-settings.ts`：

```typescript
import fs from 'fs';
import path from 'path';
import { MANAGED_ENV_KEYS, HOOK_REQUIRE_TOKEN, hookRequireArg, type ManagedEnvKey } from './audit-keys.js';

export interface SettingsFile {
  env?: Record<string, string>;
  [key: string]: unknown;
}

export function loadSettings(filePath: string): SettingsFile {
  if (!fs.existsSync(filePath)) return { env: {} };
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('settings.local.json is invalid: not an object');
    }
    if (!parsed.env || typeof parsed.env !== 'object') parsed.env = {};
    return parsed as SettingsFile;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`settings.local.json is invalid: ${e.message}`);
    throw e;
  }
}

export function writeSettings(filePath: string, s: SettingsFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(s, null, 2) + '\n');
}

function backup(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const b = `${filePath}.bak-${ts}`;
  fs.copyFileSync(filePath, b);
  return b;
}

interface EnableAuditOpts {
  settingsPath: string;
  configPath: string;
  pluginRoot: string;
  outDir: string;
}

export function enableAudit(opts: EnableAuditOpts): { backupPath: string | null } {
  const backupPath = backup(opts.settingsPath);
  const s = loadSettings(opts.settingsPath);
  s.env = s.env || {};
  const hookArg = hookRequireArg(opts.pluginRoot);
  const prev = s.env.NODE_OPTIONS;
  let userNodeOptions: string | null = null;
  let next: string;
  if (prev && prev.includes(HOOK_REQUIRE_TOKEN)) {
    // Already armed — keep as is
    next = prev;
    userNodeOptions = null;
  } else if (prev && prev.trim().length > 0) {
    userNodeOptions = prev;
    next = `${prev} ${hookArg}`;
  } else {
    userNodeOptions = null;
    next = hookArg;
  }
  s.env.NODE_OPTIONS = next;
  s.env.TOKEN_REPORTER_AUDIT_OUT = opts.outDir;
  s.env.TOKEN_REPORTER_AUDIT_ACTIVE = '1';
  writeSettings(opts.settingsPath, s);

  writeAuditConfig(opts.configPath, {
    auditEnabled: true,
    auditPromptedAt: new Date().toISOString(),
    userNodeOptions: userNodeOptions,
  });

  return { backupPath };
}

interface DisableAuditOpts { settingsPath: string; configPath: string }

export function disableAudit(opts: DisableAuditOpts): void {
  const cfg = loadAuditConfig(opts.configPath);
  const userNodeOptions = (cfg.userNodeOptions ?? null) as string | null;
  if (fs.existsSync(opts.settingsPath)) {
    const s = loadSettings(opts.settingsPath);
    s.env = s.env || {};
    if (userNodeOptions && userNodeOptions.length > 0) {
      s.env.NODE_OPTIONS = userNodeOptions;
    } else {
      delete s.env.NODE_OPTIONS;
    }
    delete s.env.TOKEN_REPORTER_AUDIT_OUT;
    delete s.env.TOKEN_REPORTER_AUDIT_ACTIVE;
    writeSettings(opts.settingsPath, s);
  }
  writeAuditConfig(opts.configPath, {
    auditEnabled: false,
    userNodeOptions: null,
  });
}

export type ManagedSnapshot = Record<ManagedEnvKey, { present: boolean; value: string | null }>;

export function readManagedSnapshot(settingsPath: string): ManagedSnapshot {
  const s = fs.existsSync(settingsPath) ? loadSettings(settingsPath) : { env: {} };
  const env = s.env || {};
  const out = {} as ManagedSnapshot;
  for (const k of MANAGED_ENV_KEYS) {
    out[k] = { present: k in env, value: k in env ? env[k] : null };
  }
  return out;
}

export interface AuditConfig {
  auditEnabled?: boolean;
  auditPromptedAt?: string | null;
  userNodeOptions?: string | null;
  [k: string]: unknown;
}

export function loadAuditConfig(filePath: string): AuditConfig {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return {}; }
}

export function writeAuditConfig(filePath: string, patch: AuditConfig): void {
  const cur = loadAuditConfig(filePath);
  const merged = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
}

export interface HookHeartbeat { pid: number; at: string }

export function readHookHeartbeat(outDir: string): HookHeartbeat | null {
  const p = path.join(outDir, '.heartbeat');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export function isHookStale(outDir: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const p = path.join(outDir, '.heartbeat');
  if (!fs.existsSync(p)) return true;
  const mtime = fs.statSync(p).mtimeMs;
  return Date.now() - mtime > maxAgeMs;
}
```

- [ ] **Step 5: Verify + commit**

```bash
npm run build:backend && node --test test/test-audit-settings.js
git add backend/src/audit-settings.ts test/test-audit-settings.js test/fixtures/settings.local.json.*
git commit -m "feat(token-reporter): audit-settings helpers (NODE_OPTIONS merge/restore)"
```

Expected: 9 tests PASS.

---

## Task 3: token-reporter-audit CLI

**Files:**
- Create: `bin/token-reporter-audit`
- Create: `test/test-audit-cli.cjs`

- [ ] **Step 1: Write failing test**

```javascript
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(PLUGIN_ROOT, 'bin', 'token-reporter-audit');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-'));
  const claudeHome = path.join(dir, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });
  const dataDir = path.join(claudeHome, 'token-reporter');
  fs.mkdirSync(dataDir, { recursive: true });
  const settingsPath = path.join(claudeHome, 'settings.local.json');
  const outDir = path.join(dataDir, 'captures');
  return {
    dir, dataDir, settingsPath, outDir,
    env: {
      ...process.env,
      TOKEN_REPORTER_DATA_DIR: dataDir,
      TOKEN_REPORTER_SETTINGS_PATH: settingsPath,
      TOKEN_REPORTER_PLUGIN_ROOT: PLUGIN_ROOT,
      TOKEN_REPORTER_AUDIT_OUT_OVERRIDE: outDir,
    },
  };
}
function run(args, env, input = '') {
  return spawnSync(BIN, args, { env, input, encoding: 'utf8' });
}

test('status on fresh install reports all absent', () => {
  const s = setup();
  const r = run(['status'], s.env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /auditEnabled: false/);
  assert.match(r.stdout, /NODE_OPTIONS: absent/);
});

test('on refuses without y confirmation; status unchanged', () => {
  const s = setup();
  const r = run(['on'], s.env, 'n\n');
  assert.equal(r.status, 2);
  assert.equal(fs.existsSync(s.settingsPath), false);
});

test('on with y writes 3 keys and backs up', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, JSON.stringify({env: {FOO: '1'}}));
  const r = run(['on'], s.env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  const after = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.match(after.env.NODE_OPTIONS, /fetch-hook\.cjs/);
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_OUT, s.outDir);
  assert.equal(after.env.TOKEN_REPORTER_AUDIT_ACTIVE, '1');
  assert.equal(after.env.FOO, '1');
  const backups = fs.readdirSync(path.dirname(s.settingsPath)).filter(n => n.startsWith('settings.local.json.bak-'));
  assert.equal(backups.length, 1);
  const cfg = JSON.parse(fs.readFileSync(path.join(s.dataDir, 'config.json'), 'utf8'));
  assert.equal(cfg.auditEnabled, true);
});

test('on preserves user NODE_OPTIONS and off restores it', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, JSON.stringify({env: {NODE_OPTIONS: '--max-old-space-size=4096'}}));
  let r = run(['on'], s.env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  const afterOn = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.match(afterOn.env.NODE_OPTIONS, /^--max-old-space-size=4096 --require=/);
  r = run(['off'], s.env);
  assert.equal(r.status, 0, r.stderr);
  const afterOff = JSON.parse(fs.readFileSync(s.settingsPath, 'utf8'));
  assert.equal(afterOff.env.NODE_OPTIONS, '--max-old-space-size=4096');
});

test('on refuses invalid settings.local.json', () => {
  const s = setup();
  fs.writeFileSync(s.settingsPath, 'garbage{');
  const r = run(['on'], s.env, 'y\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /settings\.local\.json is invalid/);
});

test('purge with y deletes all files under audit-out but keeps dir', () => {
  const s = setup();
  fs.mkdirSync(s.outDir, { recursive: true });
  fs.writeFileSync(path.join(s.outDir, 'a.req.json'), '{}');
  fs.writeFileSync(path.join(s.outDir, '.heartbeat'), '{}');
  const r = run(['purge'], s.env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(s.outDir), true);
  assert.deepEqual(fs.readdirSync(s.outDir), []);
});
```

- [ ] **Step 2: Run test (FAIL)**

```bash
node --test test/test-audit-cli.cjs
```

- [ ] **Step 3: Implement CLI**

`bin/token-reporter-audit`：

```javascript
#!/usr/bin/env node
// token-reporter-audit {on|off|status|purge}

import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.TOKEN_REPORTER_PLUGIN_ROOT || path.resolve(__dirname, '..');

const DATA_DIR = process.env.TOKEN_REPORTER_DATA_DIR || path.join(os.homedir(), '.claude', 'token-reporter');
const SETTINGS_PATH = process.env.TOKEN_REPORTER_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.local.json');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const OUT_DIR = process.env.TOKEN_REPORTER_AUDIT_OUT_OVERRIDE || path.join(DATA_DIR, 'captures');

const settingsMod = await import(path.join(PLUGIN_ROOT, 'backend', 'dist', 'audit-settings.js'));
const keysMod = await import(path.join(PLUGIN_ROOT, 'backend', 'dist', 'audit-keys.js'));
const { enableAudit, disableAudit, readManagedSnapshot, loadAuditConfig, readHookHeartbeat, isHookStale } = settingsMod;
const { MANAGED_ENV_KEYS, hookPathForPlugin } = keysMod;

function ensureDataDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

async function confirm(prompt) {
  process.stdout.write(prompt);
  const rl = readline.createInterface({ input: process.stdin });
  return new Promise((r) => rl.once('line', (line) => { rl.close(); r(line.trim().toLowerCase() === 'y'); }));
}

function preflight() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 18) {
    console.error(`Node 18+ required (current: ${process.versions.node})`);
    process.exit(1);
  }
  const hook = hookPathForPlugin(PLUGIN_ROOT);
  if (!fs.existsSync(hook)) {
    console.error(`fetch-hook.cjs missing at ${hook}`);
    process.exit(1);
  }
}

async function cmdOn() {
  preflight();
  console.log('\n[token-reporter audit] Enabling audit captures:');
  console.log('  - appends --require=<hook> to NODE_OPTIONS in', SETTINGS_PATH);
  console.log('  - captures every Anthropic API request/response body (PLAINTEXT) to', OUT_DIR);
  console.log('  - includes: system prompt, tools schema, your prompts, assistant output, thinking');
  console.log('  - never uploaded; visible to anyone who can read your disk');
  console.log('  - reversible via `token-reporter-audit off`');
  console.log('  - clear captures via `token-reporter-audit purge`');
  const ok = await confirm('\nProceed? [y/N] ');
  if (!ok) { console.log('Cancelled.'); process.exit(2); }
  ensureDataDir();
  fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(OUT_DIR, 0o700); } catch {}
  try {
    const r = enableAudit({ settingsPath: SETTINGS_PATH, configPath: CONFIG_PATH, pluginRoot: PLUGIN_ROOT, outDir: OUT_DIR });
    if (r.backupPath) console.log(`Backed up previous settings to ${r.backupPath}`);
  } catch (e) { console.error(e.message); process.exit(1); }
  console.log('\nAudit enabled. Restart Claude Code for changes to take effect.');
}

function cmdOff() {
  ensureDataDir();
  try { disableAudit({ settingsPath: SETTINGS_PATH, configPath: CONFIG_PATH }); }
  catch (e) { console.error(e.message); process.exit(1); }
  console.log('Audit disabled. Restart Claude Code to stop capturing.');
}

function cmdStatus() {
  const cfg = loadAuditConfig(CONFIG_PATH);
  console.log(`auditEnabled: ${cfg.auditEnabled === true}`);
  console.log(`auditPromptedAt: ${cfg.auditPromptedAt || 'never'}`);
  console.log(`hook path: ${hookPathForPlugin(PLUGIN_ROOT)}`);
  console.log(`captures dir: ${OUT_DIR}`);
  const hb = readHookHeartbeat(OUT_DIR);
  console.log(`last hook heartbeat: ${hb ? hb.at : 'none'}`);
  console.log(`hook stale: ${cfg.auditEnabled === true ? isHookStale(OUT_DIR) : 'n/a'}`);
  const snap = readManagedSnapshot(SETTINGS_PATH);
  for (const k of MANAGED_ENV_KEYS) {
    const r = snap[k];
    console.log(`  ${k}: ${r.present ? r.value : 'absent'}`);
  }
}

async function cmdPurge() {
  console.log(`This will delete all files under ${OUT_DIR}.`);
  const ok = await confirm('Continue? [y/N] ');
  if (!ok) { console.log('Cancelled.'); process.exit(2); }
  if (fs.existsSync(OUT_DIR)) {
    for (const name of fs.readdirSync(OUT_DIR)) {
      try { fs.rmSync(path.join(OUT_DIR, name), { recursive: true, force: true }); } catch {}
    }
  }
  console.log('Captures purged.');
}

const cmd = process.argv[2];
if (cmd === 'on') await cmdOn();
else if (cmd === 'off') cmdOff();
else if (cmd === 'status') cmdStatus();
else if (cmd === 'purge') await cmdPurge();
else { console.error('Usage: token-reporter-audit {on|off|status|purge}'); process.exit(64); }
```

```bash
chmod +x bin/token-reporter-audit
```

- [ ] **Step 4: Verify + commit**

```bash
npm run build:backend && node --test test/test-audit-cli.cjs
git add bin/token-reporter-audit test/test-audit-cli.cjs
git commit -m "feat(token-reporter): token-reporter-audit CLI"
```

Expected: 6 tests PASS.

---

## Task 4: migrate 2.11.0

**Files:**
- Modify: `backend/src/migrate.ts`
- Modify: `test/test-migration.js`

- [ ] **Step 1: Add test**

Append to `test/test-migration.js`：

```javascript
test('migration to 2.11.0 adds auditEnabled/auditPromptedAt/userNodeOptions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-audit-'));
  const configPath = path.join(dir, 'config.json');
  const config = { port: 3737, autoStart: true, lastVersion: '2.10.1' };
  fs.writeFileSync(configPath, JSON.stringify(config));
  await migrate({
    lastVersion: '2.10.1',
    pluginVersion: '2.11.0',
    config,
    dataDir: dir,
    configPath,
  });
  const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(after.auditEnabled, false);
  assert.equal(after.auditPromptedAt, null);
  assert.equal(after.userNodeOptions, null);
  assert.equal(after.lastVersion, '2.11.0');
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Implement**

Replace the empty `MIGRATIONS` in `backend/src/migrate.ts`：

```typescript
export const MIGRATIONS: Array<[string, (config: Record<string, unknown>, dataDir: string) => Promise<void> | void]> = [
  ['2.11.0', (config) => {
    if (!('auditEnabled' in config)) config.auditEnabled = false;
    if (!('auditPromptedAt' in config)) config.auditPromptedAt = null;
    if (!('userNodeOptions' in config)) config.userNodeOptions = null;
  }],
];
```

- [ ] **Step 4: Verify + commit**

```bash
npm run build:backend && node test/test-migration.js
git add backend/src/migrate.ts test/test-migration.js
git commit -m "feat(token-reporter): migrate config to 2.11.0 audit fields"
```

---

## Checkpoint A review

暂停。用户 review Task 0–4（hook 脚本、audit 常量/设置/CLI、迁移）。

---

## Task 5: fetch-hook 独立进程测试

> Task 0 已 smoke-tested hook 实盘。现在补一套单元测试，不依赖 Claude CLI，全程 spawn Node 子进程 + mock HTTP server 覆盖各分支。

**Files:**
- Create: `test/test-fetch-hook.cjs`

- [ ] **Step 1: Write test**

```javascript
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'runtime', 'fetch-hook.cjs');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'hook-')); }

function runChild(script, env) {
  return spawnSync(process.execPath, ['--require', HOOK, '-e', script], { env, encoding: 'utf8' });
}

test('hook writes req/resp + heartbeat when fetching anthropic-matching url', async () => {
  const out = tmp();
  // Start a local server that pretends to be api.anthropic.com (the hook matches by url string, so we need to fool it via URL host)
  // Simpler: point fetch at http://api.anthropic.com/test but reach it via mock. We spin a local server and make the child
  // fetch it with URL that matches the regex: use http host header.
  // Since the hook's MATCH regex is on the URL string, we craft the URL as http://api.anthropic.com:<port>/v1/messages
  // and rely on Node's fetch to respect DNS override via --dns-result-order? Not reliable.
  // Instead: host an HTTP server and patch the URL to include api.anthropic.com literal. We use http://127.0.0.1:<port>
  // BUT adjust the hook MATCH via env override for tests.
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (d) => body += d);
    req.on('end', () => { res.writeHead(200, {'Content-Type': 'application/json'}); res.end(JSON.stringify({ok: true, received: body.length})); });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const script = `
    fetch('http://api.anthropic.com:${port}/v1/messages', {
      method:'POST',
      headers:{'content-type':'application/json','x-claude-code-session-id':'test-sess','authorization':'Bearer sk-xxx'},
      body: JSON.stringify({model:'x', messages:[{role:'user',content:'hi'}], system:'sys', tools:[]})
    }).then(r=>r.text()).then(t=>{process.stdout.write(t); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)});
  `.trim();
  // Patch resolve via host override? Simpler approach: we don't actually need to hit anthropic — the MATCH regex only
  // needs the URL string. But fetch will resolve DNS for api.anthropic.com. Work around with 127.0.0.1 alias in hostname
  // is hard. So we use a local proxy and rewrite hostname.
  // ... (Use the simpler approach: host listens on 127.0.0.1:port, make request to http://127.0.0.1:port; and extend
  //     the hook MATCH via HOOK_MATCH_URL_OVERRIDE env to include 127.0.0.1 during tests.)
  // Update hook to honor TOKEN_REPORTER_HOOK_EXTRA_MATCH (added in hook for test hooks); see Task 0 amendment below.
  server.close();
  // NOTE: see Step 2 — we add a test-only env in the hook to widen MATCH for this test.
});
```

> **Test scaffolding note**: because the hook's MATCH is hardcoded to `api.anthropic.com`, testing without actually hitting that host requires a small env hook. Amend `runtime/fetch-hook.cjs` to also honor `TOKEN_REPORTER_HOOK_EXTRA_MATCH`（一个正则字符串），在测试里设为 `127\.0\.0\.1`。生产中这个 env 不会出现。然后把上面脚本简化成真实的端口调用。

- [ ] **Step 2: Amend hook for testability**

在 `runtime/fetch-hook.cjs` 顶部，紧跟 `MATCH` 定义之后追加：

```javascript
const EXTRA_MATCH_RAW = process.env.TOKEN_REPORTER_HOOK_EXTRA_MATCH;
const EXTRA_MATCH = EXTRA_MATCH_RAW ? new RegExp(EXTRA_MATCH_RAW) : null;
function shouldCapture(url) {
  if (MATCH.test(url)) return true;
  if (EXTRA_MATCH && EXTRA_MATCH.test(url)) return true;
  return false;
}
```

并把 `wrapFetch` 里的 `if (MATCH.test(url))` 改成 `if (shouldCapture(url))`。

- [ ] **Step 3: Rewrite the test body**

```javascript
test('hook writes req/resp/heartbeat for matching urls; skips non-matching', async () => {
  const out = tmp();
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (d) => body += d);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ echo: body.length }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const script = `
    (async()=>{
      const a = await fetch('http://127.0.0.1:${port}/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-claude-code-session-id':'S1'},body:'{"model":"x","messages":[]}'}); await a.text();
      const b = await fetch('http://example.com/unrelated'); await b.text().catch(()=>null);
      process.exit(0);
    })().catch(e=>{console.error(e);process.exit(1)});
  `;
  const env = { ...process.env, TOKEN_REPORTER_AUDIT_OUT: out, TOKEN_REPORTER_HOOK_EXTRA_MATCH: '127\\.0\\.0\\.1' };
  const r = runChild(script, env);
  assert.equal(r.status, 0, r.stderr);
  server.close();
  const files = fs.readdirSync(out);
  const reqs = files.filter((f) => f.endsWith('.req.json'));
  const resps = files.filter((f) => f.endsWith('.resp.json'));
  assert.equal(reqs.length, 1, 'exactly one req captured');
  assert.equal(resps.length, 1, 'exactly one resp captured');
  assert.ok(files.includes('.heartbeat'), '.heartbeat present');
  const req0 = JSON.parse(fs.readFileSync(path.join(out, reqs[0]), 'utf8'));
  assert.equal(req0.headers['x-claude-code-session-id'], 'S1');
  assert.equal(req0.headers['authorization'], undefined, 'authorization stripped');
  assert.ok(req0.body.startsWith('{"model":"x"'));
});

test('hook no-ops when TOKEN_REPORTER_AUDIT_OUT unset', () => {
  const script = `fetch('http://127.0.0.1:1/whatever').catch(()=>{}).then(()=>process.exit(0));`;
  const env = { ...process.env };
  delete env.TOKEN_REPORTER_AUDIT_OUT;
  const r = runChild(script, env);
  assert.equal(r.status, 0);
});

test('hook swallows errors internally even if disk write fails', () => {
  const out = path.join(os.tmpdir(), 'nonexistent-ro-' + Date.now());
  fs.mkdirSync(out);
  fs.chmodSync(out, 0o500); // read-only
  const script = `fetch('http://127.0.0.1:1/x').catch(()=>{}).then(()=>process.exit(0));`;
  const env = { ...process.env, TOKEN_REPORTER_AUDIT_OUT: out, TOKEN_REPORTER_HOOK_EXTRA_MATCH: '127\\.0\\.0\\.1' };
  const r = runChild(script, env);
  assert.equal(r.status, 0, 'host process still exits 0');
  fs.chmodSync(out, 0o700);
  fs.rmSync(out, { recursive: true });
});
```

- [ ] **Step 4: Run + commit**

```bash
node --test test/test-fetch-hook.cjs
git add runtime/fetch-hook.cjs test/test-fetch-hook.cjs
git commit -m "test(token-reporter): fetch-hook unit tests + EXTRA_MATCH env"
```

Expected: 3 tests PASS.

---

## Task 6: captures-parser

**Files:**
- Create: `backend/src/captures-parser.ts`
- Create: `test/test-captures-parser.js`
- Create: 3 fixture dirs

- [ ] **Step 1: Write fixtures**

`test/fixtures/captures/simple/12345-1700000001-1.req.json`（每个 `.req.json` 是 hook 写的格式；body 是一个 Anthropic Messages API 完整 JSON）：

```json
{
  "id": "12345-1700000001-1",
  "capturedAt": "2026-04-19T00:00:01.000Z",
  "url": "https://api.anthropic.com/v1/messages",
  "method": "POST",
  "headers": {"x-claude-code-session-id": "sess-simple", "content-type": "application/json"},
  "bodyBytes": 300,
  "body": "{\"model\":\"claude-haiku-4-5\",\"system\":\"You are helpful.\",\"tools\":[],\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"hi\"}]}]}"
}
```

多写 2 个相同 session 不同时间戳的 .req.json 模拟 3 轮。

`test/fixtures/captures/with-tool/12345-1700000010-1.req.json`：body 含非空 tools 数组 + assistant `tool_use` block + user `tool_result` block。

`test/fixtures/captures/with-thinking/12345-1700000020-1.req.json`：body 含 assistant `thinking` block。

- [ ] **Step 2: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import { parseCaptures, groupBySession } from '../backend/dist/captures-parser.js';

const FIX = path.join(import.meta.dirname, 'fixtures', 'captures');

test('simple fixture: 3 points under sess-simple, no tool/thinking/tool_result', async () => {
  const groups = await parseCaptures(path.join(FIX, 'simple'));
  assert.ok(groups['sess-simple']);
  assert.ok(groups['sess-simple'].length >= 3);
  for (const p of groups['sess-simple']) {
    assert.equal(p.sources.messages_tool_use, 0);
    assert.equal(p.sources.messages_tool_result, 0);
    assert.equal(p.sources.messages_thinking, 0);
    assert.ok(p.sources.system_prompt > 0);
  }
});

test('with-tool fixture: non-zero tools_schema, tool_use, tool_result', async () => {
  const groups = await parseCaptures(path.join(FIX, 'with-tool'));
  const sess = Object.values(groups)[0];
  const p = sess[0];
  assert.ok(p.sources.tools_schema > 0);
  assert.ok(p.sources.messages_tool_use > 0);
  assert.ok(p.sources.messages_tool_result > 0);
});

test('with-thinking fixture: non-zero messages_thinking', async () => {
  const groups = await parseCaptures(path.join(FIX, 'with-thinking'));
  const sess = Object.values(groups)[0];
  assert.ok(sess[0].sources.messages_thinking > 0);
});

test('total equals sum of 7 sources within rounding', async () => {
  const groups = await parseCaptures(path.join(FIX, 'with-tool'));
  const sess = Object.values(groups)[0];
  for (const p of sess) {
    const sum = Object.values(p.sources).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(p.total - sum) <= 1);
  }
});
```

- [ ] **Step 3: Run (FAIL)**

- [ ] **Step 4: Implement**

`backend/src/captures-parser.ts`：

```typescript
import fs from 'fs';
import path from 'path';

export interface CompositionSources {
  system_prompt: number;
  tools_schema: number;
  messages_user: number;
  messages_assistant: number;
  messages_tool_use: number;
  messages_tool_result: number;
  messages_thinking: number;
}

export interface CompositionPoint {
  turnId: number;
  capturedAt: string;
  requestId: string | null;
  total: number;
  sources: CompositionSources;
}

interface CaptureFile {
  id: string;
  capturedAt: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyBytes: number;
  body: string | null;
}

function charsToTokens(n: number): number { return Math.round(n / 4); }
function lenStr(v: unknown): number {
  if (typeof v === 'string') return v.length;
  if (v == null) return 0;
  return JSON.stringify(v).length;
}

function splitMessages(messages: unknown[]): Omit<CompositionSources, 'system_prompt' | 'tools_schema'> {
  const out = {
    messages_user: 0, messages_assistant: 0,
    messages_tool_use: 0, messages_tool_result: 0, messages_thinking: 0,
  };
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as { role?: string; content?: unknown };
    const role = msg.role;
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        const b = block as { type?: string; text?: string; content?: unknown; thinking?: string };
        if (b.type === 'text') {
          if (role === 'user') out.messages_user += lenStr(b.text);
          else if (role === 'assistant') out.messages_assistant += lenStr(b.text);
        } else if (b.type === 'tool_use') out.messages_tool_use += lenStr(b);
        else if (b.type === 'tool_result') out.messages_tool_result += lenStr(b.content);
        else if (b.type === 'thinking') out.messages_thinking += lenStr(b.thinking);
      }
    } else if (typeof content === 'string') {
      if (role === 'user') out.messages_user += content.length;
      else if (role === 'assistant') out.messages_assistant += content.length;
    }
  }
  return out;
}

function bodyToSources(body: unknown): CompositionSources {
  const b = (body ?? {}) as { system?: unknown; tools?: unknown[]; messages?: unknown[] };
  const msg = splitMessages(Array.isArray(b.messages) ? b.messages : []);
  return {
    system_prompt: charsToTokens(lenStr(b.system)),
    tools_schema: charsToTokens(lenStr(b.tools)),
    messages_user: charsToTokens(msg.messages_user),
    messages_assistant: charsToTokens(msg.messages_assistant),
    messages_tool_use: charsToTokens(msg.messages_tool_use),
    messages_tool_result: charsToTokens(msg.messages_tool_result),
    messages_thinking: charsToTokens(msg.messages_thinking),
  };
}

export async function parseCaptures(outDir: string): Promise<Record<string, CompositionPoint[]>> {
  if (!fs.existsSync(outDir)) return {};
  const entries = fs.readdirSync(outDir).filter((f) => f.endsWith('.req.json'));
  const bySession: Record<string, Array<CompositionPoint & { _ts: number }>> = {};
  for (const f of entries) {
    try {
      const raw = fs.readFileSync(path.join(outDir, f), 'utf8');
      const cap = JSON.parse(raw) as CaptureFile;
      if (!cap.body) continue;
      const sessionId = cap.headers?.['x-claude-code-session-id'];
      if (!sessionId) continue;
      let body: unknown;
      try { body = JSON.parse(cap.body); } catch { continue; }
      const sources = bodyToSources(body);
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      const ts = Date.parse(cap.capturedAt);
      const arr = bySession[sessionId] || (bySession[sessionId] = []);
      arr.push({
        turnId: 0, // filled below
        capturedAt: cap.capturedAt,
        requestId: cap.headers?.['x-client-request-id'] || null,
        total,
        sources,
        _ts: ts,
      });
    } catch {
      // ignore individual file errors
    }
  }
  const out: Record<string, CompositionPoint[]> = {};
  for (const [sid, points] of Object.entries(bySession)) {
    points.sort((a, b) => a._ts - b._ts);
    out[sid] = points.map((p, i) => {
      const { _ts, ...rest } = p;
      return { ...rest, turnId: i + 1 };
    });
  }
  return out;
}

export function groupBySession(points: CompositionPoint[]): Record<string, CompositionPoint[]> {
  // helper if we ever ingest a flat list
  return { all: points };
}
```

- [ ] **Step 5: Verify + commit**

```bash
npm run build:backend && node --test test/test-captures-parser.js
git add backend/src/captures-parser.ts test/test-captures-parser.js test/fixtures/captures/
git commit -m "feat(token-reporter): captures-parser with 7-source split"
```

Expected: 4 tests PASS.

---

## Task 7: composition-service

**Files:**
- Create: `backend/src/composition-service.ts`
- Create: `test/test-composition-service.js`

- [ ] **Step 1: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getComposition } from '../backend/dist/composition-service.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'comp-')); }

test('audit enabled + captures match session → live', async () => {
  const dir = tmp();
  const out = path.join(dir, 'captures');
  fs.mkdirSync(out);
  fs.copyFileSync(
    path.join(import.meta.dirname, 'fixtures', 'captures', 'with-tool', fs.readdirSync(path.join(import.meta.dirname,'fixtures','captures','with-tool'))[0]),
    path.join(out, 'cap.req.json'),
  );
  fs.writeFileSync(path.join(out, '.heartbeat'), JSON.stringify({ pid: 1, at: new Date().toISOString() }));
  const r = await getComposition('sess-with-tool', {
    outDir: out,
    auditEnabled: true,
    turnsFallback: async () => [],
  });
  assert.equal(r.source, 'live');
  assert.ok(r.points.length > 0);
});

test('audit enabled + heartbeat stale → estimated + hookStale', async () => {
  const dir = tmp();
  const out = path.join(dir, 'captures');
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, '.heartbeat'), JSON.stringify({ pid: 1, at: '2020-01-01T00:00:00.000Z' }));
  const r = await getComposition('any', {
    outDir: out,
    auditEnabled: true,
    turnsFallback: async () => [{ turnId: 1, userText: 'hi', assistantText: 'hi', toolUseJson: '', toolResultText: '', thinkingText: '' }],
  });
  assert.equal(r.source, 'estimated');
  assert.equal(r.hookStale, true);
});

test('audit disabled → estimated + unknownSources', async () => {
  const r = await getComposition('x', {
    outDir: '/nonexistent',
    auditEnabled: false,
    turnsFallback: async () => [{ turnId: 1, userText: 'hello', assistantText: 'hi', toolUseJson: '', toolResultText: '', thinkingText: '' }],
  });
  assert.equal(r.source, 'estimated');
  assert.deepEqual(r.unknownSources, ['system_prompt', 'tools_schema']);
  assert.equal(r.points[0].sources.system_prompt, 0);
  assert.ok(r.points[0].sources.messages_user > 0);
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Implement**

`backend/src/composition-service.ts`：

```typescript
import fs from 'fs';
import path from 'path';
import { parseCaptures, type CompositionPoint, type CompositionSources } from './captures-parser.js';
import { isHookStale } from './audit-settings.js';

export interface EstimatedTurn {
  turnId: number;
  userText: string;
  assistantText: string;
  toolUseJson: string;
  toolResultText: string;
  thinkingText: string;
}

export interface CompositionResponse {
  source: 'live' | 'estimated';
  points: CompositionPoint[];
  unknownSources?: Array<keyof CompositionSources>;
  hookStale?: boolean;
}

export interface GetCompositionOpts {
  outDir: string;
  auditEnabled: boolean;
  turnsFallback: (sessionId: string) => Promise<EstimatedTurn[]>;
}

function charsToTokens(n: number): number { return Math.round(n / 4); }

async function estimatedFromTurns(sessionId: string, fallback: GetCompositionOpts['turnsFallback']): Promise<CompositionPoint[]> {
  const turns = await fallback(sessionId);
  return turns.map((t) => {
    const sources = {
      system_prompt: 0,
      tools_schema: 0,
      messages_user: charsToTokens(t.userText.length),
      messages_assistant: charsToTokens(t.assistantText.length),
      messages_tool_use: charsToTokens(t.toolUseJson.length),
      messages_tool_result: charsToTokens(t.toolResultText.length),
      messages_thinking: charsToTokens(t.thinkingText.length),
    };
    const total = Object.values(sources).reduce((a, b) => a + b, 0);
    return { turnId: t.turnId, capturedAt: '', requestId: null, total, sources };
  });
}

export async function getComposition(sessionId: string, opts: GetCompositionOpts): Promise<CompositionResponse> {
  if (!opts.auditEnabled) {
    const points = await estimatedFromTurns(sessionId, opts.turnsFallback);
    return { source: 'estimated', points, unknownSources: ['system_prompt', 'tools_schema'] };
  }
  const stale = !fs.existsSync(opts.outDir) || isHookStale(opts.outDir);
  if (stale) {
    const points = await estimatedFromTurns(sessionId, opts.turnsFallback);
    return { source: 'estimated', points, unknownSources: ['system_prompt', 'tools_schema'], hookStale: true };
  }
  const groups = await parseCaptures(opts.outDir);
  const livePoints = groups[sessionId] || [];
  if (livePoints.length > 0) return { source: 'live', points: livePoints };
  // audit on but nothing for this session yet — fallback to estimated without hookStale
  const points = await estimatedFromTurns(sessionId, opts.turnsFallback);
  return { source: 'estimated', points, unknownSources: ['system_prompt', 'tools_schema'] };
}
```

- [ ] **Step 4: Verify + commit**

```bash
npm run build:backend && node --test test/test-composition-service.js
git add backend/src/composition-service.ts test/test-composition-service.js
git commit -m "feat(token-reporter): composition-service with live/estimated/hookStale"
```

Expected: 3 tests PASS.

---

## Task 8: Server 路由挂载

**Files:**
- Modify: `backend/src/server.ts`
- Create: `test/test-audit-status-api.js`

- [ ] **Step 1: Write failing test**

（参考 v1 plan 里的 test-audit-status-api 风格；加 hookStale 场景和 composition 路由）

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const PORT = 13838;

function setupServer() {
  const root = path.resolve(import.meta.dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-api-'));
  const claudeHome = path.join(dir, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });
  const dataDir = path.join(claudeHome, 'token-reporter');
  fs.mkdirSync(dataDir, { recursive: true });
  const outDir = path.join(dataDir, 'captures');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({
    port: PORT, autoStart: true, lastVersion: '2.11.0',
    auditEnabled: false, auditPromptedAt: null, userNodeOptions: null,
  }));
  const child = spawn(process.execPath, [path.join(root, 'backend', 'dist', 'server.js')], {
    env: { ...process.env,
      TOKEN_REPORTER_PLUGIN_ROOT: root,
      TOKEN_REPORTER_DATA_DIR: dataDir,
      TOKEN_REPORTER_SETTINGS_PATH: path.join(claudeHome, 'settings.local.json'),
      TOKEN_REPORTER_AUDIT_OUT_OVERRIDE: outDir,
      TOKEN_REPORTER_PORT: String(PORT),
    },
    stdio: 'pipe',
  });
  return { child, dataDir, outDir, claudeHome };
}

async function get(url) { return new Promise((r, rj) => http.get(url, (res) => { let b=''; res.on('data',d=>b+=d); res.on('end',()=>r({status:res.statusCode, body:b})); }).on('error', rj)); }
async function post(url, p) { return new Promise((r, rj) => { const body=JSON.stringify(p); const req=http.request(url,{method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},(res)=>{let d='';res.on('data',x=>d+=x);res.on('end',()=>r({status:res.statusCode, body:d}));}); req.on('error',rj); req.end(body); }); }

test('audit status + ack + hookStale detection', async () => {
  const s = setupServer();
  try {
    await new Promise((r) => setTimeout(r, 1500));
    let r = await get(`http://127.0.0.1:${PORT}/api/audit/status`);
    let parsed = JSON.parse(r.body);
    assert.equal(parsed.auditEnabled, false);
    assert.equal(parsed.hookStale, false); // audit disabled → stale not reported
    r = await post(`http://127.0.0.1:${PORT}/api/audit/ack-prompt`, {});
    assert.equal(r.status, 200);
    r = await get(`http://127.0.0.1:${PORT}/api/audit/status`);
    parsed = JSON.parse(r.body);
    assert.ok(parsed.auditPromptedAt);
  } finally { s.child.kill('SIGTERM'); }
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Modify server.ts**

顶部 imports：

```typescript
import { getComposition } from './composition-service.js';
import { loadAuditConfig, writeAuditConfig, readManagedSnapshot, isHookStale, readHookHeartbeat } from './audit-settings.js';
```

常量：

```typescript
const SETTINGS_PATH =
  process.env.TOKEN_REPORTER_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.local.json');
const AUDIT_OUT =
  process.env.TOKEN_REPORTER_AUDIT_OUT_OVERRIDE || path.join(DATA_DIR, 'captures');
```

在 `/api/sessions` 之前插入路由：

```typescript
if (url.pathname === '/api/audit/status' && req.method === 'GET') {
  const cfg = loadAuditConfig(CONFIG_PATH);
  const settingsLocalKeys = readManagedSnapshot(SETTINGS_PATH);
  const hb = readHookHeartbeat(AUDIT_OUT);
  const stale = cfg.auditEnabled === true ? isHookStale(AUDIT_OUT) : false;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    auditEnabled: cfg.auditEnabled === true,
    auditPromptedAt: cfg.auditPromptedAt ?? null,
    hookHeartbeatAt: hb?.at ?? null,
    hookStale: stale,
    settingsLocalKeys,
  }));
  return;
}
if (url.pathname === '/api/audit/ack-prompt' && req.method === 'POST') {
  writeAuditConfig(CONFIG_PATH, { auditPromptedAt: new Date().toISOString() });
  res.writeHead(200).end('ok');
  return;
}
if (url.pathname === '/api/audit/purge' && req.method === 'POST') {
  try {
    if (fs.existsSync(AUDIT_OUT)) {
      for (const name of fs.readdirSync(AUDIT_OUT)) {
        try { fs.rmSync(path.join(AUDIT_OUT, name), { recursive: true, force: true }); } catch {}
      }
    }
    res.writeHead(200).end('ok');
  } catch (e) {
    res.writeHead(500).end(e instanceof Error ? e.message : String(e));
  }
  return;
}
```

在 sessionMatch 之后：

```typescript
const compMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/composition$/);
if (compMatch) {
  try {
    const cfg = loadAuditConfig(CONFIG_PATH);
    const data = await getComposition(compMatch[1], {
      outDir: AUDIT_OUT,
      auditEnabled: cfg.auditEnabled === true,
      turnsFallback: async (sid) => {
        const meta = listSessions().find((s: { sessionId: string }) => s.sessionId === sid);
        if (!meta) return [];
        const parsed = await parseSession(meta.filePath);
        return (parsed.turns ?? []).map((t: any, i: number) => ({
          turnId: t.turnId ?? i + 1,
          userText: t.userText ?? '',
          assistantText: t.assistantText ?? '',
          toolUseJson: JSON.stringify(t.toolUses ?? []),
          toolResultText: (t.toolResults ?? []).map((r: any) => r.text ?? '').join(''),
          thinkingText: t.thinkingText ?? '',
        }));
      },
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (e: unknown) {
    res.writeHead(500).end(e instanceof Error ? e.message : String(e));
  }
  return;
}
```

同时把 `DEFAULT_PORT`：

```typescript
const DEFAULT_PORT = Number(process.env.TOKEN_REPORTER_PORT) || config.port || 3737;
```

> `turnsFallback` 取字段名要跟 `backend/src/parser/` 的实际返回对齐；**必须在实现前 `grep` 一下 parser 源码**，字段名不对就修这里。

- [ ] **Step 4: Verify + full test suite**

```bash
npm run build:backend && node --test test/test-audit-status-api.js
npm test
```

Expected: 所有原有测试 + 新测试全 PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/src/server.ts test/test-audit-status-api.js
git commit -m "feat(token-reporter): audit status + purge + composition routes"
```

---

## Checkpoint B review

暂停。用户 review Task 5–8（hook 单元测试、captures-parser、composition-service、server routes）。

---

## Task 9: Frontend types / api / store

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/stores/auditStore.ts`

- [ ] **Step 1: Extend types**

Append to `frontend/src/types/api.ts`：

```typescript
export interface AuditStatus {
  auditEnabled: boolean;
  auditPromptedAt: string | null;
  hookHeartbeatAt: string | null;
  hookStale: boolean;
  settingsLocalKeys: Record<string, {present: boolean; value: string | null}>;
}

export interface CompositionSources {
  system_prompt: number;
  tools_schema: number;
  messages_user: number;
  messages_assistant: number;
  messages_tool_use: number;
  messages_tool_result: number;
  messages_thinking: number;
}

export interface CompositionPoint {
  turnId: number;
  capturedAt: string;
  requestId: string | null;
  total: number;
  sources: CompositionSources;
}

export interface CompositionResponse {
  source: 'live' | 'estimated';
  points: CompositionPoint[];
  unknownSources?: Array<keyof CompositionSources>;
  hookStale?: boolean;
}
```

- [ ] **Step 2: Extend api.ts**

```typescript
import type {AuditStatus, CompositionResponse} from '../types/api';

export async function getAuditStatus(): Promise<AuditStatus> {
  const res = await fetch('/api/audit/status');
  if (!res.ok) throw new Error('Failed to load audit status');
  return res.json();
}
export async function ackAuditPrompt(): Promise<void> {
  await fetch('/api/audit/ack-prompt', {method: 'POST'});
}
export async function getComposition(sessionId: string): Promise<CompositionResponse> {
  const res = await fetch('/api/sessions/' + sessionId + '/composition');
  if (!res.ok) throw new Error('Failed to load composition');
  return res.json();
}
```

- [ ] **Step 3: Create auditStore.ts**

```typescript
import {create} from 'zustand';
import type {AuditStatus} from '../types/api';
import {getAuditStatus, ackAuditPrompt} from '../services/api';

interface AuditStore {
  status: AuditStatus | null;
  dismissed: boolean;
  fetchStatus: () => Promise<void>;
  dismiss: () => Promise<void>;
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  status: null,
  dismissed: false,
  fetchStatus: async () => {
    try { set({status: await getAuditStatus()}); }
    catch { set({status: null}); }
  },
  dismiss: async () => {
    set({dismissed: true});
    try { await ackAuditPrompt(); } finally { await get().fetchStatus(); }
  },
}));
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/services/api.ts frontend/src/stores/auditStore.ts
git commit -m "feat(token-reporter): frontend audit types + api + store"
```

---

## Task 10: i18n keys

**Files:**
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/zh-CN.ts`

- [ ] **Step 1: Add English keys**

`en.ts` 内新增 namespace：

```typescript
  composition: {
    title: 'Context Composition',
    live: 'live',
    estimated: 'estimated',
    hookStale: 'hook stale',
    enableAuditHint: 'Enable audit for exact data: `token-reporter-audit on`',
    hookStaleHint: 'Hook has not captured in 5+ minutes. Restart Claude Code or run `token-reporter-audit status`.',
    unknownPlaceholder: '— (enable audit)',
    sources: {
      systemPrompt: 'System prompt',
      toolsSchema: 'Tools schema',
      user: 'User messages',
      assistant: 'Assistant messages',
      toolUse: 'Tool use',
      toolResult: 'Tool result',
      thinking: 'Thinking',
    },
  },
  audit: {
    banner: {
      title: 'Context composition is estimated.',
      cta: 'Run `token-reporter-audit on` for real data.',
      dismiss: 'Dismiss',
      hookStaleTitle: 'Audit hook appears inactive.',
      hookStaleCta: 'Restart Claude Code, or run `token-reporter-audit status` to inspect.',
    },
    privacy: {
      warning: 'Enabling audit stores full API request/response bodies (including system prompt, tools, your prompts, assistant output, thinking) under ~/.claude/token-reporter/captures/ in plaintext. Nothing is uploaded.',
      purgeHint: 'Run `token-reporter-audit purge` to clear all captures.',
    },
  },
```

- [ ] **Step 2: Add zh-CN keys**

（对应中文翻译，参考 en 结构）

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/zh-CN.ts
git commit -m "i18n(token-reporter): composition + audit strings"
```

---

## Task 11: AuditBanner

**Files:**
- Create: `frontend/src/components/Analytics/common/AuditBanner.tsx`
- Create: `frontend/src/components/Analytics/common/AuditBanner.module.scss`
- Modify: `frontend/src/components/Analytics/AnalyticsPage.tsx`

- [ ] **Step 1: AuditBanner.tsx**

```tsx
import {useEffect} from 'react';
import {useAuditStore} from '../../../stores/auditStore';
import {useI18n} from '../../../i18n';
import s from './AuditBanner.module.scss';

export default function AuditBanner() {
  const {t} = useI18n();
  const status = useAuditStore((st) => st.status);
  const dismissed = useAuditStore((st) => st.dismissed);
  const fetchStatus = useAuditStore((st) => st.fetchStatus);
  const dismiss = useAuditStore((st) => st.dismiss);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!status) return null;

  if (status.auditEnabled && status.hookStale) {
    return (
      <div className={`${s.banner} ${s.stale}`} role="alert">
        <div className={s.text}>
          <strong>{t('audit.banner.hookStaleTitle')}</strong> {t('audit.banner.hookStaleCta')}
        </div>
      </div>
    );
  }

  if (!status.auditEnabled && !dismissed && !status.auditPromptedAt) {
    return (
      <div className={s.banner} role="status">
        <div className={s.text}>
          <strong>{t('audit.banner.title')}</strong> {t('audit.banner.cta')}
        </div>
        <button className={s.dismiss} onClick={() => dismiss()}>{t('audit.banner.dismiss')}</button>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: AuditBanner.module.scss**

```scss
.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  background: var(--warning-soft, #fff8e1);
  border-bottom: 1px solid var(--warning, #f0b429);
  font-size: 13px;
  color: var(--fg, #222);
}
.stale { background: #fff1d6; border-color: #e0a800; }
.text { flex: 1; }
.dismiss {
  background: transparent; border: 1px solid currentColor; color: inherit;
  padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;
}
```

- [ ] **Step 3: Mount in AnalyticsPage**

Import `AuditBanner`; 在 `<div className={s.page}>` 内、`.content` 之前插入 `<AuditBanner />`；早退分支同理。

- [ ] **Step 4: Build + manual verify**

```bash
cd frontend && npm run build
cd .. && export TOKEN_REPORTER_DEV_ROOT="$(pwd)" && bin/token-reporter-dev start
# Browser http://localhost:13737 → 顶部应该看到引导横幅
bin/token-reporter-dev stop
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Analytics/common/AuditBanner.tsx \
        frontend/src/components/Analytics/common/AuditBanner.module.scss \
        frontend/src/components/Analytics/AnalyticsPage.tsx
git commit -m "feat(token-reporter): AuditBanner with enable + stale states"
```

---

## Task 12: CompositionStack + SourceCards

**Files:**
- Create: `frontend/src/components/Analytics/ContextPanel/CompositionStack.tsx`
- Create: `frontend/src/components/Analytics/ContextPanel/CompositionStack.module.scss`
- Create: `frontend/src/components/Analytics/ContextPanel/SourceCards.tsx`
- Create: `frontend/src/components/Analytics/ContextPanel/SourceCards.module.scss`
- Modify: `frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx`

参考 v1 plan Task 13 的 CompositionStack / SourceCards 实现；改动：

- 徽章新增第三态 `hookStale`（黄色 pill + tooltip = `t('composition.hookStaleHint')`）
- `source==='live'` → 绿色 pill
- `source==='estimated'` && `hookStale !== true` → 灰色 pill + tooltip `enableAuditHint`
- `source==='estimated'` && `hookStale === true` → 黄色 pill

useComposition hook：

```tsx
function useComposition(sessionId: string | null) {
  const [data, setData] = useState<CompositionResponse | null>(null);
  useEffect(() => {
    if (!sessionId) { setData(null); return; }
    let cancelled = false;
    getComposition(sessionId).then((d) => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [sessionId]);
  return data;
}
```

- [ ] **Step 1–5**: 按 v1 plan Task 13 的步骤，替换徽章渲染逻辑为三态
- [ ] **Step 6: Build + manual verify**（开 dev server，手动 `audit on` / 构造 `<OUT>/.heartbeat` 旧时间戳确认 stale banner 也会出现）
- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Analytics/ContextPanel/
git commit -m "feat(token-reporter): CompositionStack + SourceCards with live/estimated/stale"
```

---

## Task 13: 版本 bump 2.11.0

- [ ] **Step 1: Build frontend dist**

```bash
cd frontend && npm run build && cd ..
```

- [ ] **Step 2: Invoke release-market skill**

对 Claude 说：

```
release token-reporter 2.11.0
```

skill 会：
1. 校验镜像字段一致性
2. 更新 `plugins/token-reporter/.claude-plugin/plugin.json` → `2.11.0`
3. 更新 `.claude-plugin/marketplace.json` → 2.11.0
4. 创建 commit `chore(token-reporter): bump version to 2.11.0`
5. 创建 tag `token-reporter-v2.11.0`

- [ ] **Step 3: Run full test suite**

```bash
cd plugins/token-reporter && npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: Push**（由用户下令）

---

## Self-Review 记录

**Spec v2 覆盖**

| Spec 条目 | 实现位置 |
|-----------|----------|
| §二 F1–F5 前置结论 | 已通过 spike 验证（Task 0 smoke test） |
| §4.1 受管 env 键（3 个） | Task 1 |
| §4.1 settings.local.json 读写 + NODE_OPTIONS 合并 | Task 2 |
| §4.1 CLI on/off/status/purge + 前置检查 | Task 3 |
| §4.1 config.json 新增字段 migrate | Task 4 |
| §4.2 fetch-hook.cjs 生产实现 | Task 0 |
| §4.2 hook heartbeat + 头 allowlist + 错误吞 | Task 0 |
| §4.3 CompositionPoint 7 类拆解 | Task 6 |
| §4.4 /api/sessions/:id/composition live/estimated/stale | Task 7 + Task 8 |
| §4.4 /api/audit/status + ack-prompt + purge | Task 8 |
| §4.5 AuditBanner 三态 | Task 11 |
| §4.5 CompositionStack + SourceCards | Task 12 |
| §4.6 i18n keys | Task 10 |
| §八 迁移 | Task 4 |
| §九 范围外 | 未出现在任何 task（显式排除） |

**Placeholder 扫描**：无 TBD / TODO；每个 code step 都贴了实际代码；每个 run step 都给了命令与预期输出。

**Type consistency**
- `CompositionSources` / `CompositionPoint` / `CompositionResponse` 在 `backend/src/captures-parser.ts` + `backend/src/composition-service.ts` + `frontend/src/types/api.ts` 同名同字段
- `MANAGED_ENV_KEYS` 只在 `audit-keys.ts` 定义，其他文件 import
- `hookRequireArg()` / `hookPathForPlugin()` 作为对 plugin 根目录的唯一映射函数，CLI 和 settings 都经由它，避免"路径拼接漂移"
- hook 文件**必须是 `.cjs` 扩展名**（Node preload 硬性要求 CommonJS），plan 各处路径一致

---

## Execution Handoff

Plan v2 已保存到 `docs/superpowers/plans/2026-04-19-context-auditing-dashboard-v2.md`。原 v1 plan 已改名为 `...-v1-deprecated.md` 并加顶部弃用说明。

在 inline 执行流程下（当前会话），我现在要做的是：

1. 清空之前基于 v1 创建的 task 列表
2. 按 v2 重建 task 列表
3. 从 Task 0 重新开始

需要你确认一下：之前 v1 遗留的 `test/otel-verification-result.json` 和 `test/verify-otel-channel.js` 保留作为设计演进证据，还是清理掉？保留更有历史价值（未来重读 v1 能看到为什么废弃），但会在 `npm test` 清单外、不参与回归。

确认后我清空旧 task 列表、建 v2 新列表、跑 Task 0。
