# [DEPRECATED 2026-04-19] Context Auditing Dashboard Implementation Plan — v1 (OTel path)

> **Status:** DEPRECATED. Replaced by v2 at `docs/superpowers/plans/2026-04-19-context-auditing-dashboard-v2.md`.
>
> **Reason:** OTel channel hard-truncates API request body at 60KB (Claude Code `cli.js` hardcodes `61440`, no env override). v2 switches to Node fetch hook (F path) which captures full body. See v2 spec for evidence.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 token-reporter 增加「真实 context 构成」视图 —— 通过官方 OpenTelemetry 通道把每轮 API request body 拆解成 system_prompt / tools_schema / messages_* 7 类来源的 token 占比，落盘到 `~/.claude/token-reporter/otel/<sessionId>.jsonl`，前端新增 Composition 模块（live/estimated 双模式 + 退化横幅）。

**Architecture:** token-reporter server 直接当 OTLP/HTTP JSON receiver（端口 3737），新增路由 `POST /v1/logs`、`POST /v1/metrics`、`GET /api/audit/status`、`POST /api/audit/ack-prompt`、`GET /api/sessions/:id/composition`。新增 CLI `token-reporter-audit`（on/off/status）写 `~/.claude/settings.local.json` 的 6 个 OTel env 键，用户一次性同意后 Claude 下次启动自动开启遥测。不引入 `@opentelemetry/*` 运行时依赖（手写 OTLP JSON validator）。

**Tech Stack:** TypeScript（`backend/src/` tsc 编译到 `backend/dist/`）、React + Zustand + Recharts（frontend）、Node 原生 `http` + `fs`、`node:test`/`assert` 测试栈。

**Scope discipline:**
- **不改** `backend/src/parser/`（主 JSONL 解析路径零回归）
- 所有受管 env 键走白名单常量 `backend/src/audit-keys.ts`，精确 delete
- `@opentelemetry/*` 不进 package.json

---

## File Structure

### Backend（TypeScript 源文件位于 `plugins/token-reporter/backend/src/`，tsc 编译到 `backend/dist/`）

| 路径 | 状态 | 责任 |
|------|------|------|
| `backend/src/audit-keys.ts` | 新建 | 导出 `MANAGED_ENV_KEYS` 字符串数组 + `MANAGED_ENV_DEFAULTS` 键值映射。CLI / server / 测试共用。 |
| `backend/src/audit-settings.ts` | 新建 | 读写 `~/.claude/settings.local.json` 的工具函数（loadSettings / mergeManagedEnv / stripManagedEnv / listManagedEnvKeys），以及 `config.json` 中 `auditEnabled`/`auditPromptedAt` 字段的读写。 |
| `backend/src/otlp-receiver.ts` | 新建 | OTLP/HTTP JSON payload 的 validate + 落盘（`otel/<sessionId>.jsonl`）。包含 session attribute 优先级解析 + 时间窗口 fallback ID。 |
| `backend/src/otel-parser.ts` | 新建 | 读 `otel/<sessionId>.jsonl`，把 `anthropic.request.body` 拆解成 `CompositionPoint`。 |
| `backend/src/composition-service.ts` | 新建 | 组装 `/api/sessions/:id/composition` 响应：OTel 存在时走 otel-parser，否则基于现有 JSONL 估算 5 类 messages_* + 把 system_prompt/tools_schema 放进 `unknownSources`。 |
| `backend/src/server.ts` | 修改 | 挂载 4 个新路由：`POST /v1/logs`、`POST /v1/metrics`、`GET /api/audit/status`、`POST /api/audit/ack-prompt`、`GET /api/sessions/:id/composition`。 |
| `backend/src/migrate.ts` | 修改 | 在 `MIGRATIONS` 数组追加一条到 `2.11.0`（或下一版号）的迁移：补 `auditEnabled: false` 与 `auditPromptedAt: null`。 |
| `backend/src/parser/index.ts` | **不改** | — |

### CLI

| 路径 | 状态 | 责任 |
|------|------|------|
| `bin/token-reporter-audit` | 新建 | 入口脚本，读第一个参数分发 `on` / `off` / `status`。import `backend/dist/audit-settings.js` + `backend/dist/audit-keys.js`。 |

### Hooks

| 路径 | 状态 | 责任 |
|------|------|------|
| `hooks/session-start.js` | 修改 | 在 migrate 后、fork server 前：如果 `auditEnabled === false && auditPromptedAt === null` 且 V4 通过 → `console.error(引导文案)` + `POST /api/audit/ack-prompt`。V4 未通过 → 跳过 console 引导，让前端横幅兜底。 |

### Frontend

| 路径 | 状态 | 责任 |
|------|------|------|
| `frontend/src/types/api.ts` | 修改 | 追加 `AuditStatus`、`CompositionPoint`、`CompositionResponse` 类型。 |
| `frontend/src/services/api.ts` | 修改 | 追加 `getAuditStatus()`、`ackAuditPrompt()`、`getComposition(sessionId)`。 |
| `frontend/src/stores/auditStore.ts` | 新建 | Zustand store：`status`、`fetchStatus`、`dismiss`（调用 ack + 设 local flag）。 |
| `frontend/src/components/Analytics/common/AuditBanner.tsx` | 新建 | 顶部横幅组件，读 auditStore 渲染引导；`auditEnabled===true` 或 `auditPromptedAt` 非 null 时隐藏。 |
| `frontend/src/components/Analytics/common/AuditBanner.module.scss` | 新建 | 横幅样式。 |
| `frontend/src/components/Analytics/AnalyticsPage.tsx` | 修改 | 在 `.content` 首行挂 `<AuditBanner />`。 |
| `frontend/src/components/Analytics/ContextPanel/CompositionStack.tsx` | 新建 | 堆叠面积图：x=turn、y=tokens、7 层分色。带 live/estimated 徽章。 |
| `frontend/src/components/Analytics/ContextPanel/CompositionStack.module.scss` | 新建 | 样式。 |
| `frontend/src/components/Analytics/ContextPanel/SourceCards.tsx` | 新建 | 最新一轮 7 张卡片：tokens / delta / 占比。 |
| `frontend/src/components/Analytics/ContextPanel/SourceCards.module.scss` | 新建 | 样式。 |
| `frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx` | 修改 | 在 `context.contextWindowGrowth` 之后追加 `<CompositionStack />` 和 `<SourceCards />`；按 sessionId fetch composition 数据。 |
| `frontend/src/i18n/locales/en.ts` | 修改 | 追加 `composition.*`、`audit.banner.*`、`audit.privacy.warning` 等键。 |
| `frontend/src/i18n/locales/zh-CN.ts` | 修改 | 同上中文翻译。 |

### Tests（位于 `plugins/token-reporter/test/`）

| 路径 | 状态 | 责任 |
|------|------|------|
| `test/verify-otel-channel.js` | 新建 | Task 0 验证脚本。写 test/otel-verification-result.json。 |
| `test/otel-verification-result.json` | 新建（Task 0 产物） | 由验证脚本写入，后续 task 读取以固化 V1/V2/V3 的真实 attribute 名与 V4 的决策。 |
| `test/test-audit-keys.js` | 新建 | 断言 `MANAGED_ENV_KEYS` 与 `MANAGED_ENV_DEFAULTS` key 集完全一致，且顺序与 spec §4.1 一致。 |
| `test/test-audit-settings.js` | 新建 | settings.local.json 读写工具单元测试。 |
| `test/test-audit-cli.cjs` | 新建 | 跑 `token-reporter-audit on/off/status`，给定 fixture 验证备份、合并、精确删除、隐私确认分支、退出码。 |
| `test/test-otlp-receiver.js` | 新建 | POST /v1/logs 合法/非法 payload、5MB 限制、session attribute 缺失的时间窗口 fallback。 |
| `test/test-otel-parser.js` | 新建 | 3 份 fixture（无 tool / 有 tool / 有 thinking）→ 断言 7 类 token 拆解准确度（允许 ±2% 由 cache_read 校对）。 |
| `test/test-composition-service.js` | 新建 | OTel 存在 → source=otel，不存在 → source=estimated + unknownSources 包含 system_prompt/tools_schema。 |
| `test/test-audit-status-api.js` | 新建 | GET /api/audit/status、POST /api/audit/ack-prompt 在各种 config.json / settings.local.json 组合下的返回。 |
| `test/fixtures/otel/no-tool.jsonl` | 新建 | 3 轮对话，无 tool_use。 |
| `test/fixtures/otel/with-tool.jsonl` | 新建 | 含 Bash + Read tool_use + tool_result。 |
| `test/fixtures/otel/with-thinking.jsonl` | 新建 | 含 thinking block。 |
| `test/fixtures/settings.local.json.plain` | 新建 | 无任何 env 的 settings fixture。 |
| `test/fixtures/settings.local.json.with-other-env` | 新建 | 含非白名单 env 键（验证 off 不会误删）。 |
| `test/fixtures/settings.local.json.with-managed-env` | 新建 | 已含 6 个白名单键（验证 off 精确删除、on 覆盖）。 |

### 版本管理

| 路径 | 状态 | 责任 |
|------|------|------|
| `plugins/token-reporter/.claude-plugin/plugin.json` | 修改 | `2.10.1` → `2.11.0`（minor：新增 CLI + 新路由 + 新面板）。 |
| `.claude-plugin/marketplace.json` | 修改 | 镜像字段同步到 `2.11.0`。 |

通过 `release-market` skill 触发版本 bump，不要手改。

---

## Task 0: OTel 通道验证（spec §二 V1–V4）

**必须最先跑，失败直接停。** 本 task 产物 `test/otel-verification-result.json` 是后续所有 task 的前提。

**Files:**
- Create: `plugins/token-reporter/test/verify-otel-channel.js`
- Create (by script): `plugins/token-reporter/test/otel-verification-result.json`

- [ ] **Step 1: Write verify script**

创建 `plugins/token-reporter/test/verify-otel-channel.js`：

```javascript
#!/usr/bin/env node
// Verifies OTel channel assumptions V1–V4 from spec §二.
// Writes ./otel-verification-result.json on success; non-zero exit on failure.

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULT_PATH = path.join(__dirname, 'otel-verification-result.json');
const RECEIVER_PORT = 14317; // isolated port, not 3737 or 13737
const CAPTURE_SECS = 30;

const captured = [];
const server = http.createServer((req, res) => {
  if (req.url === '/v1/logs' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try { captured.push({ path: req.url, body: JSON.parse(body), receivedAt: Date.now() }); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    });
    return;
  }
  res.writeHead(404).end();
});
server.listen(RECEIVER_PORT, '127.0.0.1');

const env = {
  ...process.env,
  CLAUDE_CODE_ENABLE_TELEMETRY: '1',
  OTEL_LOGS_EXPORTER: 'otlp',
  OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
  OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${RECEIVER_PORT}`,
  OTEL_LOG_RAW_API_BODIES: '1',
  OTEL_LOG_USER_PROMPTS: '1',
};

// Drive one headless claude invocation. Use --print so it exits when complete.
const claude = spawn('claude', ['--print', '--model', 'claude-haiku-4-5', 'Say the single word HELLO and stop.'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stdout = '';
let stderr = '';
claude.stdout.on('data', (d) => (stdout += d));
claude.stderr.on('data', (d) => (stderr += d));

const timeout = setTimeout(() => {
  try { claude.kill('SIGTERM'); } catch {}
}, CAPTURE_SECS * 1000);

claude.on('close', async () => {
  clearTimeout(timeout);
  // Give any in-flight exports 2s to land
  await new Promise((r) => setTimeout(r, 2000));
  server.close();

  const result = {
    generatedAt: new Date().toISOString(),
    V1: { passed: false, notes: '', exporter: 'otlp' },
    V2: { passed: false, notes: '', rawBodyAttributeKey: null, bodyIsJson: false },
    V3: { passed: false, notes: '', sessionAttributeKey: null, sessionAttributeValue: null },
    V4: { passed: false, notes: 'manual step required — see Step 3' },
    sampleAttributes: [],
    rawSample: null,
  };

  if (captured.length === 0) {
    result.V1.notes = `No OTLP logs received on port ${RECEIVER_PORT}. stdout=${stdout.slice(0, 200)} stderr=${stderr.slice(0, 400)}`;
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
    console.error('[verify] V1 FAILED — no payload received. See result file.');
    process.exit(1);
  }

  result.V1.passed = true;
  result.V1.notes = `Received ${captured.length} OTLP log POST(s) on port ${RECEIVER_PORT}.`;
  result.rawSample = captured[0];

  // Walk OTLP structure for attributes
  const attrSet = new Set();
  let anthropicBodyKey = null;
  let sessionKey = null;
  let sessionValue = null;
  let bodyIsJson = false;

  for (const rec of captured) {
    const logs = rec.body?.resourceLogs ?? [];
    for (const rl of logs) {
      const resourceAttrs = rl.resource?.attributes ?? [];
      for (const a of resourceAttrs) attrSet.add(`resource.${a.key}`);
      for (const sl of rl.scopeLogs ?? []) {
        for (const lr of sl.logRecords ?? []) {
          for (const a of lr.attributes ?? []) {
            attrSet.add(a.key);
            if (!anthropicBodyKey && /anthropic.*request.*body/i.test(a.key)) {
              anthropicBodyKey = a.key;
              const raw = a.value?.stringValue ?? a.value?.bytesValue ?? '';
              try { JSON.parse(raw); bodyIsJson = true; } catch {}
            }
            if (!sessionKey && /session[._]id/i.test(a.key)) {
              sessionKey = a.key;
              sessionValue = a.value?.stringValue ?? null;
            }
          }
        }
      }
    }
  }

  result.sampleAttributes = [...attrSet].sort();

  if (anthropicBodyKey) {
    result.V2.passed = bodyIsJson;
    result.V2.rawBodyAttributeKey = anthropicBodyKey;
    result.V2.bodyIsJson = bodyIsJson;
    result.V2.notes = bodyIsJson ? 'raw body parsed as JSON' : 'attribute present but body not JSON — fallback needed';
  } else {
    result.V2.notes = 'No anthropic.*request.*body attribute — summary-only mode, plan must fall back to usage-based splits.';
  }

  if (sessionKey) {
    result.V3.passed = true;
    result.V3.sessionAttributeKey = sessionKey;
    result.V3.sessionAttributeValue = sessionValue;
    result.V3.notes = `session attribute found: ${sessionKey}`;
  } else {
    result.V3.notes = 'No session.* attribute — server must synthesize IDs via time-window fallback.';
  }

  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
  console.log(`[verify] V1=${result.V1.passed} V2=${result.V2.passed} V3=${result.V3.passed}`);
  console.log(`[verify] wrote ${RESULT_PATH}`);
  console.log('[verify] V4 requires manual step (see Step 3 of Task 0).');

  if (!result.V1.passed || !result.V2.passed) {
    console.error('[verify] V1 or V2 FAILED — STOP. Return to brainstorming.');
    process.exit(1);
  }
  process.exit(0);
});
```

- [ ] **Step 2: Run V1/V2/V3**

```bash
cd plugins/token-reporter
node test/verify-otel-channel.js
```

Expected on success:
- 退出码 0
- `test/otel-verification-result.json` 写入
- `V1.passed === true`（至少 1 条 OTLP POST 收到）
- `V2.passed === true`（找到 `anthropic.*request.*body` attribute 且值是合法 JSON）
- `V3.passed === true/false` —— 失败不阻断，写入 fallback 注记

Expected on failure（V1 或 V2 失败）：
- 退出码非 0 → **STOP，回到 brainstorming**，不要启动后续 task。

- [ ] **Step 3: Run V4（SessionStart hook 可见性）**

临时写一份 hook 脚本测试 `console.error` 是否在 Claude Code 交互界面可见：

```bash
# 1. 暂存原 hooks.json
cp plugins/token-reporter/hooks/hooks.json plugins/token-reporter/hooks/hooks.json.bak-verify

# 2. 写入临时 probe hook 到 /tmp/v4-probe.js
cat > /tmp/v4-probe.js <<'EOF'
#!/usr/bin/env node
console.error('[token-reporter][V4-PROBE] visible-in-claude-code?');
process.exit(0);
EOF
chmod +x /tmp/v4-probe.js

# 3. 暂时把 SessionStart 指向 probe（手动编辑 hooks.json）
# 4. 启动 claude 一次（交互模式），观察是否出现 [V4-PROBE] 字样
# 5. 恢复 hooks.json
mv plugins/token-reporter/hooks/hooks.json.bak-verify plugins/token-reporter/hooks/hooks.json
rm /tmp/v4-probe.js
```

然后用户手动在 `otel-verification-result.json` 里把 `V4.passed` 设为 true 或 false（脚本无法自动判定）。结果写入后 commit。

- [ ] **Step 4: Commit verification result**

```bash
git add plugins/token-reporter/test/verify-otel-channel.js plugins/token-reporter/test/otel-verification-result.json
git commit -m "test(token-reporter): verify OTel channel assumptions V1-V4"
```

---

## Task 1: Managed env keys 常量集中

**Files:**
- Create: `plugins/token-reporter/backend/src/audit-keys.ts`
- Create: `plugins/token-reporter/test/test-audit-keys.js`

- [ ] **Step 1: Write failing test**

创建 `plugins/token-reporter/test/test-audit-keys.js`：

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MANAGED_ENV_KEYS, MANAGED_ENV_DEFAULTS } from '../backend/dist/audit-keys.js';

test('MANAGED_ENV_KEYS lists exactly the 6 keys from spec §4.1', () => {
  assert.deepEqual(MANAGED_ENV_KEYS, [
    'CLAUDE_CODE_ENABLE_TELEMETRY',
    'OTEL_LOGS_EXPORTER',
    'OTEL_EXPORTER_OTLP_PROTOCOL',
    'OTEL_EXPORTER_OTLP_ENDPOINT',
    'OTEL_LOG_RAW_API_BODIES',
    'OTEL_LOG_USER_PROMPTS',
  ]);
});

test('MANAGED_ENV_DEFAULTS has a value for every managed key', () => {
  for (const k of MANAGED_ENV_KEYS) {
    assert.equal(typeof MANAGED_ENV_DEFAULTS[k], 'string', `${k} missing default`);
    assert.ok(MANAGED_ENV_DEFAULTS[k].length > 0, `${k} default empty`);
  }
  assert.equal(Object.keys(MANAGED_ENV_DEFAULTS).length, MANAGED_ENV_KEYS.length);
});

test('OTEL_EXPORTER_OTLP_ENDPOINT default points to local receiver', () => {
  assert.equal(MANAGED_ENV_DEFAULTS.OTEL_EXPORTER_OTLP_ENDPOINT, 'http://127.0.0.1:3737');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-audit-keys.js
```

Expected: FAIL `Cannot find module 'backend/dist/audit-keys.js'`.

- [ ] **Step 3: Write implementation**

创建 `plugins/token-reporter/backend/src/audit-keys.ts`：

```typescript
export const MANAGED_ENV_KEYS = [
  'CLAUDE_CODE_ENABLE_TELEMETRY',
  'OTEL_LOGS_EXPORTER',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_LOG_RAW_API_BODIES',
  'OTEL_LOG_USER_PROMPTS',
] as const;

export type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];

export const MANAGED_ENV_DEFAULTS: Record<ManagedEnvKey, string> = {
  CLAUDE_CODE_ENABLE_TELEMETRY: '1',
  OTEL_LOGS_EXPORTER: 'otlp',
  OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:3737',
  OTEL_LOG_RAW_API_BODIES: '1',
  OTEL_LOG_USER_PROMPTS: '1',
};
```

> 注：如果 Task 0 验证结果 `otel-verification-result.json` 显示 `OTEL_LOGS_EXPORTER` 或其他键真实名称不同，先改这里再继续，让后续 task 读同一份权威源。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-audit-keys.js
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/token-reporter/backend/src/audit-keys.ts plugins/token-reporter/test/test-audit-keys.js
git commit -m "feat(token-reporter): add managed OTel env keys constant"
```

---

## Task 2: audit-settings 工具模块

读写 `~/.claude/settings.local.json` 与 `config.json` 的 audit 字段。

**Files:**
- Create: `plugins/token-reporter/backend/src/audit-settings.ts`
- Create: `plugins/token-reporter/test/test-audit-settings.js`
- Create: `plugins/token-reporter/test/fixtures/settings.local.json.plain`
- Create: `plugins/token-reporter/test/fixtures/settings.local.json.with-other-env`
- Create: `plugins/token-reporter/test/fixtures/settings.local.json.with-managed-env`

- [ ] **Step 1: Write fixtures**

`plugins/token-reporter/test/fixtures/settings.local.json.plain`:
```json
{}
```

`plugins/token-reporter/test/fixtures/settings.local.json.with-other-env`:
```json
{
  "env": {
    "MY_CUSTOM_FLAG": "yes",
    "UNRELATED": "42"
  }
}
```

`plugins/token-reporter/test/fixtures/settings.local.json.with-managed-env`:
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:3737",
    "OTEL_LOG_RAW_API_BODIES": "1",
    "OTEL_LOG_USER_PROMPTS": "1",
    "MY_CUSTOM_FLAG": "yes"
  }
}
```

- [ ] **Step 2: Write failing test**

创建 `plugins/token-reporter/test/test-audit-settings.js`：

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadSettings,
  writeSettings,
  mergeManagedEnv,
  stripManagedEnv,
  listManagedEnvKeys,
  loadAuditConfig,
  writeAuditConfig,
} from '../backend/dist/audit-settings.js';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'audit-settings-'));
}

function copyFixture(name, dest) {
  const src = path.join(import.meta.dirname, 'fixtures', name);
  fs.copyFileSync(src, dest);
}

test('mergeManagedEnv adds all 6 keys to a plain settings file, preserving existing env', () => {
  const dir = tmpdir();
  const settings = path.join(dir, 'settings.local.json');
  copyFixture('settings.local.json.with-other-env', settings);
  const result = mergeManagedEnv(settings);
  assert.equal(result.backupPath && fs.existsSync(result.backupPath), true);
  const after = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(after.env.CLAUDE_CODE_ENABLE_TELEMETRY, '1');
  assert.equal(after.env.MY_CUSTOM_FLAG, 'yes');
});

test('stripManagedEnv removes exactly the 6 keys, preserves others, and empties env if left empty', () => {
  const dir = tmpdir();
  const settings = path.join(dir, 'settings.local.json');
  copyFixture('settings.local.json.with-managed-env', settings);
  stripManagedEnv(settings);
  const after = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(after.env.MY_CUSTOM_FLAG, 'yes');
  assert.equal(after.env.CLAUDE_CODE_ENABLE_TELEMETRY, undefined);
  assert.equal(after.env.OTEL_LOGS_EXPORTER, undefined);
});

test('listManagedEnvKeys reports presence/value for each managed key', () => {
  const dir = tmpdir();
  const settings = path.join(dir, 'settings.local.json');
  copyFixture('settings.local.json.with-managed-env', settings);
  const report = listManagedEnvKeys(settings);
  assert.equal(report.CLAUDE_CODE_ENABLE_TELEMETRY.present, true);
  assert.equal(report.CLAUDE_CODE_ENABLE_TELEMETRY.value, '1');
  assert.equal(Object.keys(report).length, 6);
});

test('loadSettings on missing file returns {env:{}} without error', () => {
  const dir = tmpdir();
  const result = loadSettings(path.join(dir, 'missing.json'));
  assert.deepEqual(result, { env: {} });
});

test('loadSettings on invalid JSON throws labelled error', () => {
  const dir = tmpdir();
  const p = path.join(dir, 'bad.json');
  fs.writeFileSync(p, 'not json');
  assert.throws(() => loadSettings(p), /settings\.local\.json is invalid/);
});

test('writeAuditConfig flips auditEnabled and sets auditPromptedAt timestamp', () => {
  const dir = tmpdir();
  const cfg = path.join(dir, 'config.json');
  fs.writeFileSync(cfg, JSON.stringify({ port: 3737, autoStart: true }));
  writeAuditConfig(cfg, { auditEnabled: true, auditPromptedAt: '2026-04-19T00:00:00.000Z' });
  const after = JSON.parse(fs.readFileSync(cfg, 'utf8'));
  assert.equal(after.auditEnabled, true);
  assert.equal(after.auditPromptedAt, '2026-04-19T00:00:00.000Z');
  assert.equal(after.port, 3737);
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-audit-settings.js
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write implementation**

创建 `plugins/token-reporter/backend/src/audit-settings.ts`：

```typescript
import fs from 'fs';
import path from 'path';
import { MANAGED_ENV_KEYS, MANAGED_ENV_DEFAULTS, type ManagedEnvKey } from './audit-keys.js';

export interface SettingsFile {
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface AuditConfig {
  auditEnabled?: boolean;
  auditPromptedAt?: string | null;
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

export function writeSettings(filePath: string, settings: SettingsFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
}

function backup(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${filePath}.bak-${ts}`;
  fs.copyFileSync(filePath, bak);
  return bak;
}

export function mergeManagedEnv(filePath: string): { backupPath: string | null } {
  const backupPath = backup(filePath);
  const settings = loadSettings(filePath);
  settings.env = settings.env || {};
  for (const k of MANAGED_ENV_KEYS) {
    settings.env[k] = MANAGED_ENV_DEFAULTS[k];
  }
  writeSettings(filePath, settings);
  return { backupPath };
}

export function stripManagedEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const settings = loadSettings(filePath);
  if (!settings.env) return;
  for (const k of MANAGED_ENV_KEYS) {
    delete settings.env[k];
  }
  writeSettings(filePath, settings);
}

export type ManagedKeyReport = Record<ManagedEnvKey, { present: boolean; value: string | null }>;

export function listManagedEnvKeys(filePath: string): ManagedKeyReport {
  const settings = fs.existsSync(filePath) ? loadSettings(filePath) : { env: {} };
  const env = settings.env || {};
  const report = {} as ManagedKeyReport;
  for (const k of MANAGED_ENV_KEYS) {
    report[k] = { present: k in env, value: k in env ? env[k] : null };
  }
  return report;
}

export function loadAuditConfig(filePath: string): AuditConfig & Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

export function writeAuditConfig(filePath: string, patch: AuditConfig): void {
  const current = loadAuditConfig(filePath);
  const merged = { ...current, ...patch };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-audit-settings.js
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add plugins/token-reporter/backend/src/audit-settings.ts \
        plugins/token-reporter/test/test-audit-settings.js \
        plugins/token-reporter/test/fixtures/settings.local.json.plain \
        plugins/token-reporter/test/fixtures/settings.local.json.with-other-env \
        plugins/token-reporter/test/fixtures/settings.local.json.with-managed-env
git commit -m "feat(token-reporter): audit-settings helpers for settings.local.json"
```

---

## Task 3: token-reporter-audit CLI

**Files:**
- Create: `plugins/token-reporter/bin/token-reporter-audit`
- Create: `plugins/token-reporter/test/test-audit-cli.cjs`

- [ ] **Step 1: Write failing test**

创建 `plugins/token-reporter/test/test-audit-cli.cjs`（用 cjs 因为跑 child_process 拼命令更直接）：

```javascript
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN = path.resolve(__dirname, '..', 'bin', 'token-reporter-audit');

function tmpEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-'));
  const claudeHome = path.join(dir, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });
  return {
    dir,
    env: {
      ...process.env,
      TOKEN_REPORTER_DATA_DIR: path.join(claudeHome, 'token-reporter'),
      TOKEN_REPORTER_SETTINGS_PATH: path.join(claudeHome, 'settings.local.json'),
    },
  };
}

function run(args, env, input = '') {
  return spawnSync(BIN, args, { env, input, encoding: 'utf8' });
}

test('audit status on a fresh install reports all keys absent', () => {
  const { env } = tmpEnv();
  const r = run(['status'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /auditEnabled: false/);
  assert.match(r.stdout, /CLAUDE_CODE_ENABLE_TELEMETRY: absent/);
});

test('audit on without confirmation exits with code 2 and does not write', () => {
  const { env } = tmpEnv();
  const r = run(['on'], env, 'n\n');
  assert.equal(r.status, 2);
  assert.equal(fs.existsSync(env.TOKEN_REPORTER_SETTINGS_PATH), false);
});

test('audit on with y writes the 6 keys and backs up', () => {
  const { env } = tmpEnv();
  fs.writeFileSync(env.TOKEN_REPORTER_SETTINGS_PATH, JSON.stringify({ env: { FOO: '1' } }));
  const r = run(['on'], env, 'y\n');
  assert.equal(r.status, 0, r.stderr);
  const after = JSON.parse(fs.readFileSync(env.TOKEN_REPORTER_SETTINGS_PATH, 'utf8'));
  assert.equal(after.env.CLAUDE_CODE_ENABLE_TELEMETRY, '1');
  assert.equal(after.env.FOO, '1');
  const backups = fs.readdirSync(path.dirname(env.TOKEN_REPORTER_SETTINGS_PATH))
    .filter((n) => n.startsWith('settings.local.json.bak-'));
  assert.equal(backups.length, 1);
  // config.json.auditEnabled === true
  const cfg = JSON.parse(fs.readFileSync(path.join(env.TOKEN_REPORTER_DATA_DIR, 'config.json'), 'utf8'));
  assert.equal(cfg.auditEnabled, true);
});

test('audit off removes exactly the 6 keys', () => {
  const { env } = tmpEnv();
  fs.writeFileSync(env.TOKEN_REPORTER_SETTINGS_PATH, JSON.stringify({
    env: {
      CLAUDE_CODE_ENABLE_TELEMETRY: '1',
      OTEL_LOGS_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:3737',
      OTEL_LOG_RAW_API_BODIES: '1',
      OTEL_LOG_USER_PROMPTS: '1',
      MY_FLAG: 'yes',
    },
  }));
  const r = run(['off'], env);
  assert.equal(r.status, 0, r.stderr);
  const after = JSON.parse(fs.readFileSync(env.TOKEN_REPORTER_SETTINGS_PATH, 'utf8'));
  assert.equal(after.env.CLAUDE_CODE_ENABLE_TELEMETRY, undefined);
  assert.equal(after.env.MY_FLAG, 'yes');
  const cfg = JSON.parse(fs.readFileSync(path.join(env.TOKEN_REPORTER_DATA_DIR, 'config.json'), 'utf8'));
  assert.equal(cfg.auditEnabled, false);
});

test('audit on refuses invalid settings.local.json', () => {
  const { env } = tmpEnv();
  fs.writeFileSync(env.TOKEN_REPORTER_SETTINGS_PATH, 'garbage{');
  const r = run(['on'], env, 'y\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /settings\.local\.json is invalid/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd plugins/token-reporter && node --test test/test-audit-cli.cjs
```

Expected: FAIL — bin script not found.

- [ ] **Step 3: Write implementation**

创建 `plugins/token-reporter/bin/token-reporter-audit`：

```javascript
#!/usr/bin/env node
// token-reporter-audit {on|off|status}
// Reads/writes ~/.claude/settings.local.json (6 managed OTel env keys) and ~/.claude/token-reporter/config.json.

import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '..');

const DATA_DIR =
  process.env.TOKEN_REPORTER_DATA_DIR || path.join(os.homedir(), '.claude', 'token-reporter');
const SETTINGS_PATH =
  process.env.TOKEN_REPORTER_SETTINGS_PATH || path.join(os.homedir(), '.claude', 'settings.local.json');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// Import compiled helpers
const auditSettingsPath = path.join(PLUGIN_ROOT, 'backend', 'dist', 'audit-settings.js');
const auditKeysPath = path.join(PLUGIN_ROOT, 'backend', 'dist', 'audit-keys.js');
const { mergeManagedEnv, stripManagedEnv, listManagedEnvKeys, writeAuditConfig, loadAuditConfig } =
  await import(auditSettingsPath);
const { MANAGED_ENV_KEYS } = await import(auditKeysPath);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function confirm(prompt) {
  process.stdout.write(prompt);
  const rl = readline.createInterface({ input: process.stdin });
  return new Promise((resolve) => {
    rl.once('line', (line) => {
      rl.close();
      resolve(line.trim().toLowerCase() === 'y');
    });
  });
}

async function cmdOn() {
  console.log('\n[token-reporter audit] Enabling OpenTelemetry audit will:');
  console.log('  - write 6 env keys to', SETTINGS_PATH);
  console.log('  - cause Claude Code to send full API request/response bodies + user prompts');
  console.log('    to 127.0.0.1:3737 (this local token-reporter process, never uploaded)');
  console.log('  - store raw conversation data under ~/.claude/token-reporter/otel/ on disk');
  console.log('  - be reversible at any time via `token-reporter-audit off`');

  const ok = await confirm('\nProceed? [y/N] ');
  if (!ok) {
    console.log('Cancelled.');
    process.exit(2);
  }

  try {
    const { backupPath } = mergeManagedEnv(SETTINGS_PATH);
    if (backupPath) console.log(`Backed up previous settings to ${backupPath}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  ensureDataDir();
  writeAuditConfig(CONFIG_PATH, { auditEnabled: true, auditPromptedAt: new Date().toISOString() });
  console.log('Audit enabled. Restart Claude Code for env to take effect.');
}

function cmdOff() {
  try {
    stripManagedEnv(SETTINGS_PATH);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  ensureDataDir();
  writeAuditConfig(CONFIG_PATH, { auditEnabled: false });
  console.log('Audit disabled. Restart Claude Code to stop exporting telemetry.');
}

function cmdStatus() {
  const cfg = loadAuditConfig(CONFIG_PATH);
  console.log(`auditEnabled: ${cfg.auditEnabled === true}`);
  console.log(`auditPromptedAt: ${cfg.auditPromptedAt || 'never'}`);
  console.log(`settings.local.json: ${SETTINGS_PATH}`);
  const report = listManagedEnvKeys(SETTINGS_PATH);
  for (const k of MANAGED_ENV_KEYS) {
    const r = report[k];
    console.log(`  ${k}: ${r.present ? r.value : 'absent'}`);
  }
}

const cmd = process.argv[2];
if (cmd === 'on') await cmdOn();
else if (cmd === 'off') cmdOff();
else if (cmd === 'status') cmdStatus();
else {
  console.error('Usage: token-reporter-audit {on|off|status}');
  process.exit(64);
}
```

确保可执行：
```bash
chmod +x plugins/token-reporter/bin/token-reporter-audit
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-audit-cli.cjs
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/token-reporter/bin/token-reporter-audit plugins/token-reporter/test/test-audit-cli.cjs
git commit -m "feat(token-reporter): add token-reporter-audit CLI"
```

---

## Task 4: Migration: auditEnabled + auditPromptedAt 字段

**Files:**
- Modify: `plugins/token-reporter/backend/src/migrate.ts`（在 `MIGRATIONS` 数组追加）
- Modify: `plugins/token-reporter/test/test-migration.js`（如存在；否则新增一个断言）

- [ ] **Step 1: Read current migrate test**

```bash
cat plugins/token-reporter/test/test-migration.js
```

- [ ] **Step 2: Write failing test**

在 `plugins/token-reporter/test/test-migration.js` 追加：

```javascript
test('migration to 2.11.0 adds auditEnabled and auditPromptedAt', async () => {
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
  assert.equal(after.lastVersion, '2.11.0');
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node test/test-migration.js
```

Expected: FAIL — `auditEnabled` undefined.

- [ ] **Step 4: Implement migration**

修改 `plugins/token-reporter/backend/src/migrate.ts` 把 `MIGRATIONS` 数组改成：

```typescript
export const MIGRATIONS: Array<[string, (config: Record<string, unknown>, dataDir: string) => Promise<void> | void]> = [
  ['2.11.0', (config) => {
    if (!('auditEnabled' in config)) config.auditEnabled = false;
    if (!('auditPromptedAt' in config)) config.auditPromptedAt = null;
  }],
];
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run build:backend && node test/test-migration.js
```

Expected: PASS, all migration tests.

- [ ] **Step 6: Commit**

```bash
git add plugins/token-reporter/backend/src/migrate.ts plugins/token-reporter/test/test-migration.js
git commit -m "feat(token-reporter): migrate config.json with audit fields"
```

---

## Task 5: OTLP Receiver 模块（backend/src/otlp-receiver.ts）

**Files:**
- Create: `plugins/token-reporter/backend/src/otlp-receiver.ts`
- Create: `plugins/token-reporter/test/test-otlp-receiver.js`

- [ ] **Step 1: Write failing test**

`plugins/token-reporter/test/test-otlp-receiver.js`：

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ingestOtlpLogs, MAX_BODY_BYTES } from '../backend/dist/otlp-receiver.js';

function otelDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'otlp-'));
  return dir;
}

function minimalPayload(sessionId) {
  return {
    resourceLogs: [{
      resource: { attributes: [] },
      scopeLogs: [{
        logRecords: [{
          timeUnixNano: String(Date.now() * 1e6),
          attributes: [
            { key: 'session.id', value: { stringValue: sessionId } },
            { key: 'anthropic.request.body', value: { stringValue: '{"model":"claude-haiku","messages":[]}' } },
          ],
        }],
      }],
    }],
  };
}

test('ingestOtlpLogs writes one logRecord per line to <sessionId>.jsonl', async () => {
  const dir = otelDir();
  const result = await ingestOtlpLogs(minimalPayload('sess-A'), { dataDir: dir, now: () => 1000 });
  assert.equal(result.inferred, false);
  assert.equal(result.recordsWritten, 1);
  const line = fs.readFileSync(path.join(dir, 'otel', 'sess-A.jsonl'), 'utf8').trim();
  const parsed = JSON.parse(line);
  assert.ok(parsed.attributes);
});

test('ingestOtlpLogs synthesizes session id when no session.* attribute present', async () => {
  const dir = otelDir();
  const payload = minimalPayload('dummy');
  // Remove the session.id attribute
  payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes =
    payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes.filter((a) => a.key !== 'session.id');
  const result = await ingestOtlpLogs(payload, { dataDir: dir, now: () => 2000 });
  assert.equal(result.inferred, true);
  assert.match(result.sessionId, /^_inferred-/);
});

test('ingestOtlpLogs rejects payload exceeding MAX_BODY_BYTES', async () => {
  const dir = otelDir();
  const big = new Array(MAX_BODY_BYTES + 1).fill('a').join('');
  await assert.rejects(() => ingestOtlpLogs(big, { dataDir: dir, asRawString: true }), /payload too large/);
});

test('ingestOtlpLogs rejects non-object payload', async () => {
  const dir = otelDir();
  await assert.rejects(() => ingestOtlpLogs('not json', { dataDir: dir, asRawString: true }), /invalid/i);
});

test('session attribute key priority: session.id > claude.session_id > claude.session.id', async () => {
  const dir = otelDir();
  const payload = minimalPayload('dummy');
  payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes = [
    { key: 'claude.session.id', value: { stringValue: 'zzz' } },
    { key: 'session.id', value: { stringValue: 'aaa' } },
    { key: 'claude.session_id', value: { stringValue: 'bbb' } },
  ];
  const r = await ingestOtlpLogs(payload, { dataDir: dir });
  assert.equal(r.sessionId, 'aaa');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-otlp-receiver.js
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement ingestOtlpLogs**

创建 `plugins/token-reporter/backend/src/otlp-receiver.ts`：

```typescript
import fs from 'fs';
import path from 'path';

export const MAX_BODY_BYTES = 5 * 1024 * 1024;
const SESSION_KEY_PRIORITY = ['session.id', 'claude.session_id', 'claude.session.id', 'user_session_id'];
const INFERENCE_WINDOW_MS = 60_000;

interface OtlpAttribute {
  key: string;
  value?: { stringValue?: string; bytesValue?: string; intValue?: string };
}

interface OtlpLogRecord {
  timeUnixNano?: string;
  attributes?: OtlpAttribute[];
  body?: { stringValue?: string };
}

interface OtlpScopeLogs { logRecords?: OtlpLogRecord[] }
interface OtlpResourceLogs { resource?: { attributes?: OtlpAttribute[] }; scopeLogs?: OtlpScopeLogs[] }
interface OtlpLogsPayload { resourceLogs?: OtlpResourceLogs[] }

export interface IngestOpts {
  dataDir: string;
  now?: () => number;
  asRawString?: boolean;
}

export interface IngestResult {
  sessionId: string;
  recordsWritten: number;
  inferred: boolean;
}

let lastInferredId: string | null = null;
let lastInferredAt = 0;

function resetInferenceStateForTests(): void {
  lastInferredId = null;
  lastInferredAt = 0;
}
export const __test__ = { resetInferenceStateForTests };

function attrValue(a: OtlpAttribute): string | null {
  return a.value?.stringValue ?? a.value?.bytesValue ?? a.value?.intValue ?? null;
}

function pickSessionId(records: OtlpLogRecord[]): string | null {
  for (const key of SESSION_KEY_PRIORITY) {
    for (const r of records) {
      for (const a of r.attributes ?? []) {
        if (a.key === key) {
          const v = attrValue(a);
          if (v) return v;
        }
      }
    }
  }
  return null;
}

function synthesizeId(now: number): string {
  if (lastInferredId && now - lastInferredAt < INFERENCE_WINDOW_MS) {
    lastInferredAt = now;
    return lastInferredId;
  }
  lastInferredId = `_inferred-${now}`;
  lastInferredAt = now;
  return lastInferredId;
}

export async function ingestOtlpLogs(
  input: unknown,
  opts: IngestOpts,
): Promise<IngestResult> {
  if (opts.asRawString) {
    if (typeof input !== 'string') throw new Error('invalid payload: expected raw string');
    if (Buffer.byteLength(input, 'utf8') > MAX_BODY_BYTES) throw new Error('payload too large');
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error('invalid OTLP JSON payload');
    }
  }
  const payload = input as OtlpLogsPayload;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.resourceLogs)) {
    throw new Error('invalid OTLP payload: missing resourceLogs');
  }

  const records: OtlpLogRecord[] = [];
  for (const rl of payload.resourceLogs) {
    for (const sl of rl.scopeLogs ?? []) {
      for (const lr of sl.logRecords ?? []) records.push(lr);
    }
  }

  if (records.length === 0) return { sessionId: '', recordsWritten: 0, inferred: false };

  const explicitId = pickSessionId(records);
  const now = opts.now?.() ?? Date.now();
  const sessionId = explicitId ?? synthesizeId(now);
  const inferred = explicitId === null;

  const outDir = path.join(opts.dataDir, 'otel');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${sessionId}.jsonl`);

  const stream = fs.createWriteStream(outPath, { flags: 'a' });
  for (const r of records) {
    const withMeta = inferred ? { ...r, _sessionInferred: true } : r;
    stream.write(JSON.stringify(withMeta) + '\n');
  }
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  return { sessionId, recordsWritten: records.length, inferred };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-otlp-receiver.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/token-reporter/backend/src/otlp-receiver.ts plugins/token-reporter/test/test-otlp-receiver.js
git commit -m "feat(token-reporter): OTLP receiver module"
```

---

## Task 6: OTel parser（backend/src/otel-parser.ts）

把每行 `anthropic.request.body`（Anthropic Messages API JSON）拆解成 `CompositionPoint`。

**Files:**
- Create: `plugins/token-reporter/backend/src/otel-parser.ts`
- Create: `plugins/token-reporter/test/test-otel-parser.js`
- Create: `plugins/token-reporter/test/fixtures/otel/no-tool.jsonl`
- Create: `plugins/token-reporter/test/fixtures/otel/with-tool.jsonl`
- Create: `plugins/token-reporter/test/fixtures/otel/with-thinking.jsonl`

- [ ] **Step 1: Write fixture `no-tool.jsonl`**

每行一个 OTel logRecord，attribute 有 `anthropic.request.body` 和 `anthropic.response.body`。示例单行（实际写为一行）：

```json
{"timeUnixNano":"1","attributes":[{"key":"anthropic.request.body","value":{"stringValue":"{\"model\":\"claude-haiku\",\"system\":\"You are helpful.\",\"tools\":[],\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"hi\"}]}]}"}},{"key":"anthropic.response.body","value":{"stringValue":"{\"usage\":{\"input_tokens\":12,\"output_tokens\":3,\"cache_read_input_tokens\":0,\"cache_creation_input_tokens\":0}}"}}]}
```

写 2–3 轮。

- [ ] **Step 2: Write fixture `with-tool.jsonl`**

1 轮：request body messages 里含 assistant `tool_use` + user `tool_result` block。tools 字段给一个非空 schema（比如 Read + Bash）。

- [ ] **Step 3: Write fixture `with-thinking.jsonl`**

1 轮：assistant message 含 `{"type":"thinking","thinking":"..."}` block。

- [ ] **Step 4: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import { parseCompositionFromOtel } from '../backend/dist/otel-parser.js';

const FIX = path.join(import.meta.dirname, 'fixtures', 'otel');

test('no-tool fixture produces 0 tool_use / tool_result / thinking', async () => {
  const points = await parseCompositionFromOtel(path.join(FIX, 'no-tool.jsonl'));
  assert.ok(points.length >= 2);
  for (const p of points) {
    assert.equal(p.sources.messages_tool_use, 0);
    assert.equal(p.sources.messages_tool_result, 0);
    assert.equal(p.sources.messages_thinking, 0);
    assert.ok(p.sources.system_prompt > 0);
  }
});

test('with-tool fixture reports non-zero tools_schema and tool_use/result', async () => {
  const points = await parseCompositionFromOtel(path.join(FIX, 'with-tool.jsonl'));
  const p = points[0];
  assert.ok(p.sources.tools_schema > 0);
  assert.ok(p.sources.messages_tool_use > 0);
  assert.ok(p.sources.messages_tool_result > 0);
});

test('with-thinking fixture reports non-zero messages_thinking', async () => {
  const points = await parseCompositionFromOtel(path.join(FIX, 'with-thinking.jsonl'));
  assert.ok(points[0].sources.messages_thinking > 0);
});

test('total equals sum of 7 sources within rounding', async () => {
  const points = await parseCompositionFromOtel(path.join(FIX, 'with-tool.jsonl'));
  for (const p of points) {
    const sum = Object.values(p.sources).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(p.total - sum) <= 1, `total ${p.total} != sum ${sum}`);
  }
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-otel-parser.js
```

Expected: FAIL — module not found.

- [ ] **Step 6: Implement otel-parser**

创建 `plugins/token-reporter/backend/src/otel-parser.ts`：

```typescript
import fs from 'fs';
import readline from 'readline';

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
  total: number;
  sources: CompositionSources;
}

function charsToTokens(n: number): number { return Math.round(n / 4); }
function lenStr(v: unknown): number {
  if (typeof v === 'string') return v.length;
  if (v == null) return 0;
  return JSON.stringify(v).length;
}

function splitMessages(messages: unknown[]): Omit<CompositionSources, 'system_prompt' | 'tools_schema'> {
  const out = {
    messages_user: 0,
    messages_assistant: 0,
    messages_tool_use: 0,
    messages_tool_result: 0,
    messages_thinking: 0,
  };
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as { role?: string; content?: unknown };
    const role = msg.role;
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        const b = block as { type?: string; text?: string; input?: unknown; content?: unknown; thinking?: string };
        if (b.type === 'text') {
          if (role === 'user') out.messages_user += lenStr(b.text);
          else if (role === 'assistant') out.messages_assistant += lenStr(b.text);
        } else if (b.type === 'tool_use') {
          out.messages_tool_use += lenStr(b);
        } else if (b.type === 'tool_result') {
          out.messages_tool_result += lenStr(b.content);
        } else if (b.type === 'thinking') {
          out.messages_thinking += lenStr(b.thinking);
        }
      }
    } else if (typeof content === 'string') {
      if (role === 'user') out.messages_user += content.length;
      else if (role === 'assistant') out.messages_assistant += content.length;
    }
  }
  return out;
}

function bodyToComposition(body: unknown, turnId: number): CompositionPoint {
  const b = (body ?? {}) as { system?: unknown; tools?: unknown[]; messages?: unknown[] };
  const system_prompt = charsToTokens(lenStr(b.system));
  const tools_schema = charsToTokens(lenStr(b.tools));
  const msg = splitMessages(Array.isArray(b.messages) ? b.messages : []);
  const sources: CompositionSources = {
    system_prompt,
    tools_schema,
    messages_user: charsToTokens(msg.messages_user),
    messages_assistant: charsToTokens(msg.messages_assistant),
    messages_tool_use: charsToTokens(msg.messages_tool_use),
    messages_tool_result: charsToTokens(msg.messages_tool_result),
    messages_thinking: charsToTokens(msg.messages_thinking),
  };
  const total = Object.values(sources).reduce((a, n) => a + n, 0);
  return { turnId, total, sources };
}

function extractRequestBody(rec: { attributes?: Array<{ key: string; value?: { stringValue?: string } }> }): unknown {
  for (const a of rec.attributes ?? []) {
    if (/anthropic.*request.*body/i.test(a.key)) {
      const raw = a.value?.stringValue;
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }
  }
  return null;
}

export async function parseCompositionFromOtel(jsonlPath: string): Promise<CompositionPoint[]> {
  const points: CompositionPoint[] = [];
  if (!fs.existsSync(jsonlPath)) return points;
  const rl = readline.createInterface({ input: fs.createReadStream(jsonlPath), crlfDelay: Infinity });
  let turnId = 1;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const body = extractRequestBody(rec);
    if (body == null) continue;
    points.push(bodyToComposition(body, turnId));
    turnId += 1;
  }
  return points;
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-otel-parser.js
```

Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
git add plugins/token-reporter/backend/src/otel-parser.ts \
        plugins/token-reporter/test/test-otel-parser.js \
        plugins/token-reporter/test/fixtures/otel/*.jsonl
git commit -m "feat(token-reporter): OTel request-body composition parser"
```

---

## Task 7: Composition Service（OTel vs estimated fallback）

**Files:**
- Create: `plugins/token-reporter/backend/src/composition-service.ts`
- Create: `plugins/token-reporter/test/test-composition-service.js`

- [ ] **Step 1: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getComposition } from '../backend/dist/composition-service.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'comp-')); }

test('when otel jsonl exists returns source=otel with full 7 sources', async () => {
  const dir = tmp();
  const otelDir = path.join(dir, 'otel');
  fs.mkdirSync(otelDir, { recursive: true });
  fs.copyFileSync(
    path.join(import.meta.dirname, 'fixtures', 'otel', 'with-tool.jsonl'),
    path.join(otelDir, 'sess-A.jsonl'),
  );
  const r = await getComposition('sess-A', { dataDir: dir, turnsFallback: async () => [] });
  assert.equal(r.source, 'otel');
  assert.ok(r.points.length > 0);
  assert.equal(r.unknownSources ?? null, null);
});

test('when no otel jsonl, returns source=estimated with unknownSources', async () => {
  const dir = tmp();
  const r = await getComposition('sess-missing', {
    dataDir: dir,
    turnsFallback: async () => [
      {
        turnId: 1,
        userText: 'hello',
        assistantText: 'hi',
        toolUseJson: '',
        toolResultText: '',
        thinkingText: '',
      },
    ],
  });
  assert.equal(r.source, 'estimated');
  assert.deepEqual(r.unknownSources, ['system_prompt', 'tools_schema']);
  assert.equal(r.points[0].sources.system_prompt, 0);
  assert.ok(r.points[0].sources.messages_user > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-composition-service.js
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement composition-service**

创建 `plugins/token-reporter/backend/src/composition-service.ts`：

```typescript
import fs from 'fs';
import path from 'path';
import { parseCompositionFromOtel, type CompositionPoint } from './otel-parser.js';

export interface EstimatedTurn {
  turnId: number;
  userText: string;
  assistantText: string;
  toolUseJson: string;
  toolResultText: string;
  thinkingText: string;
}

export interface CompositionResponse {
  source: 'otel' | 'estimated';
  points: CompositionPoint[];
  unknownSources?: string[];
}

export interface GetCompositionOpts {
  dataDir: string;
  turnsFallback: (sessionId: string) => Promise<EstimatedTurn[]>;
}

function charsToTokens(n: number): number { return Math.round(n / 4); }

export async function getComposition(
  sessionId: string,
  opts: GetCompositionOpts,
): Promise<CompositionResponse> {
  const otelPath = path.join(opts.dataDir, 'otel', `${sessionId}.jsonl`);
  if (fs.existsSync(otelPath)) {
    const points = await parseCompositionFromOtel(otelPath);
    return { source: 'otel', points };
  }
  const turns = await opts.turnsFallback(sessionId);
  const points: CompositionPoint[] = turns.map((t) => {
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
    return { turnId: t.turnId, total, sources };
  });
  return { source: 'estimated', points, unknownSources: ['system_prompt', 'tools_schema'] };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-composition-service.js
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/token-reporter/backend/src/composition-service.ts plugins/token-reporter/test/test-composition-service.js
git commit -m "feat(token-reporter): composition service with otel/estimated fallback"
```

---

## Task 8: Server 路由挂载

**Files:**
- Modify: `plugins/token-reporter/backend/src/server.ts`
- Create: `plugins/token-reporter/test/test-audit-status-api.js`
- Modify: `plugins/token-reporter/test/test-otlp-receiver.js`（追加一个 HTTP-level 集成用例，或新建一个 `test-server-routes.js`）

- [ ] **Step 1: Write failing test for /api/audit/status + ack-prompt**

`plugins/token-reporter/test/test-audit-status-api.js`：

```javascript
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';

const PORT = 13838;

function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-api-'));
  const claudeDir = path.join(dir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const dataDir = path.join(claudeDir, 'token-reporter');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({
    port: PORT, autoStart: true, lastVersion: '2.11.0', auditEnabled: false, auditPromptedAt: null,
  }));
  const pluginRoot = path.resolve(import.meta.dirname, '..');
  const child = spawn(process.execPath, [path.join(pluginRoot, 'backend', 'dist', 'server.js')], {
    env: {
      ...process.env,
      TOKEN_REPORTER_PLUGIN_ROOT: pluginRoot,
      TOKEN_REPORTER_DATA_DIR: dataDir,
      TOKEN_REPORTER_SETTINGS_PATH: path.join(claudeDir, 'settings.local.json'),
      TOKEN_REPORTER_PORT: String(PORT),
    },
    stdio: 'pipe',
  });
  return { child, dir, dataDir };
}

async function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}
async function post(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
      let data = ''; res.on('data', (d) => (data += d)); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject); req.end(body);
  });
}

test('GET /api/audit/status + POST /api/audit/ack-prompt round trip', async () => {
  const { child, dataDir } = startServer();
  try {
    await new Promise((r) => setTimeout(r, 1500));
    let r = await get(`http://127.0.0.1:${PORT}/api/audit/status`);
    assert.equal(r.status, 200);
    let parsed = JSON.parse(r.body);
    assert.equal(parsed.auditEnabled, false);
    assert.equal(parsed.auditPromptedAt, null);
    assert.ok(parsed.settingsLocalKeys);

    r = await post(`http://127.0.0.1:${PORT}/api/audit/ack-prompt`, {});
    assert.equal(r.status, 200);

    r = await get(`http://127.0.0.1:${PORT}/api/audit/status`);
    parsed = JSON.parse(r.body);
    assert.ok(parsed.auditPromptedAt);
  } finally {
    child.kill('SIGTERM');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd plugins/token-reporter && npm run build:backend && node --test test/test-audit-status-api.js
```

Expected: FAIL — 404 on /api/audit/status.

- [ ] **Step 3: Modify server.ts**

在 `plugins/token-reporter/backend/src/server.ts` 里：

1. 顶部 import：
```typescript
import { ingestOtlpLogs, MAX_BODY_BYTES } from './otlp-receiver.js';
import { getComposition } from './composition-service.js';
import { listManagedEnvKeys, loadAuditConfig, writeAuditConfig } from './audit-settings.js';
```

2. 追加常量：
```typescript
const SETTINGS_PATH =
  process.env.TOKEN_REPORTER_SETTINGS_PATH ||
  path.join(os.homedir(), '.claude', 'settings.local.json');
```

3. 在 `handleRequest` 内 `/api/sessions` match 之前插入路由：

```typescript
  // OTLP receiver
  if ((url.pathname === '/v1/logs' || url.pathname === '/v1/metrics') && req.method === 'POST') {
    let raw = '';
    let tooLarge = false;
    req.on('data', (d) => {
      raw += d;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (tooLarge) { res.writeHead(413).end('payload too large'); return; }
      if (url.pathname === '/v1/metrics') {
        // Persist raw for forward-looking #5 token-budget-forecaster, never parsed now
        try {
          const metricsDir = path.join(DATA_DIR, 'otel', '_metrics');
          fs.mkdirSync(metricsDir, { recursive: true });
          fs.appendFileSync(path.join(metricsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`), raw + '\n');
        } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
        return;
      }
      try {
        await ingestOtlpLogs(raw, { dataDir: DATA_DIR, asRawString: true });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
      } catch (e: unknown) {
        console.error('[token-reporter] otlp ingest failed:', e instanceof Error ? e.message : String(e));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}'); // keep Claude exporter happy
      }
    });
    return;
  }

  // Audit status + ack
  if (url.pathname === '/api/audit/status' && req.method === 'GET') {
    const cfg = loadAuditConfig(CONFIG_PATH);
    const settingsLocalKeys = listManagedEnvKeys(SETTINGS_PATH);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      auditEnabled: cfg.auditEnabled === true,
      auditPromptedAt: cfg.auditPromptedAt ?? null,
      settingsLocalKeys,
    }));
    return;
  }
  if (url.pathname === '/api/audit/ack-prompt' && req.method === 'POST') {
    writeAuditConfig(CONFIG_PATH, { auditPromptedAt: new Date().toISOString() });
    res.writeHead(200).end('ok');
    return;
  }
```

4. 在 `sessionMatch` 之后追加 composition 路由：
```typescript
  const compMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/composition$/);
  if (compMatch) {
    try {
      const data = await getComposition(compMatch[1], {
        dataDir: DATA_DIR,
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

> `turnsFallback` 里从 parseSession 取的字段名要与 `backend/src/parser/index.ts` 的实际返回对齐；若字段名不同，以 parser 源码为准改这里（查 `grep -n 'turnId' backend/src/parser/*.ts`）。

5. `loadConfig()` 返回值扩展：让 `config.port` 支持 `TOKEN_REPORTER_PORT` 覆盖（方便测试）：

```typescript
const DEFAULT_PORT = Number(process.env.TOKEN_REPORTER_PORT) || config.port || 3737;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run build:backend && node --test test/test-audit-status-api.js
```

Expected: PASS.

- [ ] **Step 5: Run full backend test suite to confirm no regression**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/token-reporter/backend/src/server.ts plugins/token-reporter/test/test-audit-status-api.js
git commit -m "feat(token-reporter): OTLP receiver + audit API + composition route"
```

---

## Task 9: SessionStart hook 引导（路径 A）

根据 Task 0 V4 结果决定是否启用。

**Files:**
- Modify: `plugins/token-reporter/hooks/session-start.js`
- Modify: `plugins/token-reporter/test/test-hooks.js`

- [ ] **Step 1: Read verification result**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('plugins/token-reporter/test/otel-verification-result.json','utf8')).V4.passed)"
```

如果输出 `false` → 跳过整个 Task 9，直接进 Task 10 的前端横幅负担兜底；在 spec/plan 里留一行 commit 注明「V4=false, skipping console guidance」。

如果 `true` → 继续。

- [ ] **Step 2: Write failing test**

在 `plugins/token-reporter/test/test-hooks.js` 追加：

```javascript
test('session-start prints audit guidance exactly once when audit disabled and not prompted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-audit-'));
  fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    port: 13737, autoStart: false, lastVersion: '2.11.0', auditEnabled: false, auditPromptedAt: null,
  }));
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'session-start.js')], {
    env: { ...process.env, TOKEN_REPORTER_DATA_DIR: dir },
    encoding: 'utf8',
  });
  assert.match(r.stderr, /Context Audit .+ disabled/);

  // Second invocation: auditPromptedAt now set, guidance must not repeat
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  assert.ok(cfg.auditPromptedAt);
  const r2 = spawnSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'session-start.js')], {
    env: { ...process.env, TOKEN_REPORTER_DATA_DIR: dir },
    encoding: 'utf8',
  });
  assert.doesNotMatch(r2.stderr, /Context Audit/);
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd plugins/token-reporter && node test/test-hooks.js
```

- [ ] **Step 4: Patch session-start.js**

在 `plugins/token-reporter/hooks/session-start.js` 的第 72 行（migrate 完成后、autoStart 检查前）插入：

```javascript
  // Audit opt-in guidance (path A; front-end banner is path B)
  if (config.auditEnabled !== true && !config.auditPromptedAt) {
    console.error(
      '[token-reporter] Context Audit (OpenTelemetry) is disabled.\n' +
      '  Run `token-reporter-audit on` to enable real context composition.\n' +
      '  This adds 6 keys to ~/.claude/settings.local.json (see /audit-info in the web UI).'
    );
    config.auditPromptedAt = new Date().toISOString();
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch {}
  }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
node test/test-hooks.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plugins/token-reporter/hooks/session-start.js plugins/token-reporter/test/test-hooks.js
git commit -m "feat(token-reporter): session-start audit opt-in guidance"
```

---

## Task 10: Frontend types + API client

**Files:**
- Modify: `plugins/token-reporter/frontend/src/types/api.ts`
- Modify: `plugins/token-reporter/frontend/src/services/api.ts`
- Create: `plugins/token-reporter/frontend/src/stores/auditStore.ts`

- [ ] **Step 1: Extend types/api.ts**

追加到 `plugins/token-reporter/frontend/src/types/api.ts`：

```typescript
export interface AuditStatus {
  auditEnabled: boolean;
  auditPromptedAt: string | null;
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
  total: number;
  sources: CompositionSources;
}

export interface CompositionResponse {
  source: 'otel' | 'estimated';
  points: CompositionPoint[];
  unknownSources?: Array<keyof CompositionSources>;
}
```

- [ ] **Step 2: Extend services/api.ts**

追加：

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

`plugins/token-reporter/frontend/src/stores/auditStore.ts`：

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
    try {
      const status = await getAuditStatus();
      set({status});
    } catch {
      set({status: null});
    }
  },
  dismiss: async () => {
    set({dismissed: true});
    try {
      await ackAuditPrompt();
    } finally {
      await get().fetchStatus();
    }
  },
}));
```

- [ ] **Step 4: Commit**

```bash
git add plugins/token-reporter/frontend/src/types/api.ts \
        plugins/token-reporter/frontend/src/services/api.ts \
        plugins/token-reporter/frontend/src/stores/auditStore.ts
git commit -m "feat(token-reporter): frontend audit types + api client + store"
```

---

## Task 11: i18n 新增键

**Files:**
- Modify: `plugins/token-reporter/frontend/src/i18n/locales/en.ts`
- Modify: `plugins/token-reporter/frontend/src/i18n/locales/zh-CN.ts`

- [ ] **Step 1: Add English keys**

在 `en.ts` 追加到现有 namespace 之间：

```typescript
  composition: {
    title: 'Context Composition',
    estimated: 'estimated',
    live: 'live',
    enableAuditHint: 'Enable audit for exact data: `token-reporter-audit on`',
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
    },
    privacy: {
      warning: 'Enabling audit stores full API request bodies and user prompts under ~/.claude/token-reporter/otel/ on this machine. Nothing is uploaded.',
    },
  },
```

- [ ] **Step 2: Add zh-CN translations**

`zh-CN.ts` 对应：

```typescript
  composition: {
    title: '上下文构成',
    estimated: '估算',
    live: '实时',
    enableAuditHint: '启用审计获取精确数据：`token-reporter-audit on`',
    unknownPlaceholder: '— (启用审计)',
    sources: {
      systemPrompt: '系统提示',
      toolsSchema: '工具 schema',
      user: '用户消息',
      assistant: '助手消息',
      toolUse: '工具调用',
      toolResult: '工具结果',
      thinking: '思考',
    },
  },

  audit: {
    banner: {
      title: '上下文构成数据当前为估算。',
      cta: '运行 `token-reporter-audit on` 获取真实数据。',
      dismiss: '不再提示',
    },
    privacy: {
      warning: '启用审计后，完整的 API 请求体与用户 prompt 会写入 ~/.claude/token-reporter/otel/，永不上传，但对能读本机磁盘的人可见。',
    },
  },
```

- [ ] **Step 3: Commit**

```bash
git add plugins/token-reporter/frontend/src/i18n/locales/en.ts plugins/token-reporter/frontend/src/i18n/locales/zh-CN.ts
git commit -m "i18n(token-reporter): composition + audit strings"
```

---

## Task 12: AuditBanner 组件 + 挂到 AnalyticsPage

**Files:**
- Create: `plugins/token-reporter/frontend/src/components/Analytics/common/AuditBanner.tsx`
- Create: `plugins/token-reporter/frontend/src/components/Analytics/common/AuditBanner.module.scss`
- Modify: `plugins/token-reporter/frontend/src/components/Analytics/AnalyticsPage.tsx`

- [ ] **Step 1: Write AuditBanner.tsx**

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
  if (status.auditEnabled) return null;
  if (dismissed) return null;
  if (status.auditPromptedAt) return null;

  return (
    <div className={s.banner} role="status">
      <div className={s.text}>
        <strong>{t('audit.banner.title')}</strong> {t('audit.banner.cta')}
      </div>
      <button className={s.dismiss} onClick={() => dismiss()}>{t('audit.banner.dismiss')}</button>
    </div>
  );
}
```

- [ ] **Step 2: Write AuditBanner.module.scss**

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
.text { flex: 1; }
.dismiss {
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
```

- [ ] **Step 3: Mount in AnalyticsPage**

在 `plugins/token-reporter/frontend/src/components/Analytics/AnalyticsPage.tsx`：

1. `import AuditBanner from './common/AuditBanner';`
2. 在 `return` 的 `<div className={s.page}>` 内、`.content` 之前插入 `<AuditBanner />`

```tsx
  return (
    <div className={s.page}>
      <AuditBanner />
      <div className={s.content}>
        ...
      </div>
    </div>
  );
```

也要把早退分支（`turns.length === 0`）里加上：

```tsx
  if (turns.length === 0) {
    return (
      <div className={s.page}>
        <AuditBanner />
        {isLoading ? (
          <div className={s.content}><PanelSkeleton /></div>
        ) : (
          <div className={s.empty}>{t('error.noSessionData')}</div>
        )}
      </div>
    );
  }
```

- [ ] **Step 4: Build frontend and manual-verify**

```bash
cd plugins/token-reporter/frontend && npm run build
cd .. && export TOKEN_REPORTER_DEV_ROOT="$(pwd)" && bin/token-reporter-dev start
```

在浏览器打开 `http://localhost:13737`，确认横幅出现；点 Dismiss 后横幅消失、页面刷新后仍然消失。手动测试完成后 `bin/token-reporter-dev stop`。

- [ ] **Step 5: Commit**

```bash
git add plugins/token-reporter/frontend/src/components/Analytics/common/AuditBanner.tsx \
        plugins/token-reporter/frontend/src/components/Analytics/common/AuditBanner.module.scss \
        plugins/token-reporter/frontend/src/components/Analytics/AnalyticsPage.tsx
git commit -m "feat(token-reporter): AuditBanner on AnalyticsPage"
```

---

## Task 13: CompositionStack + SourceCards 组件

**Files:**
- Create: `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/CompositionStack.tsx`
- Create: `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/CompositionStack.module.scss`
- Create: `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/SourceCards.tsx`
- Create: `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/SourceCards.module.scss`
- Modify: `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx`

- [ ] **Step 1: Add a composition data hook**

在 `ContextPanel.tsx` 上方就近定义（或新增 `useComposition.ts`，看偏好）：

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

- [ ] **Step 2: CompositionStack.tsx**

```tsx
import {AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend} from 'recharts';
import {useI18n} from '../../../i18n';
import {fmtTokens} from '../../../utils/format';
import {tooltipStyle, tooltipLabelStyle, tooltipItemStyle, gridStroke, axisTickStyle, cssVar} from '../../../utils/chartTheme';
import ChartBox from '../common/ChartBox';
import type {CompositionResponse, CompositionSources} from '../../../types/api';
import {useChartTurnClick} from '../common/useChartTurnClick';
import s from './CompositionStack.module.scss';

const ORDER: Array<keyof CompositionSources> = [
  'system_prompt', 'tools_schema', 'messages_user', 'messages_assistant',
  'messages_tool_use', 'messages_tool_result', 'messages_thinking',
];

const COLORS: Record<keyof CompositionSources, string> = {
  system_prompt: 'var(--chart-1, #6ea8fe)',
  tools_schema: 'var(--chart-2, #a78bfa)',
  messages_user: 'var(--chart-3, #34d399)',
  messages_assistant: 'var(--chart-4, #fbbf24)',
  messages_tool_use: 'var(--chart-5, #fb7185)',
  messages_tool_result: 'var(--chart-6, #38bdf8)',
  messages_thinking: 'var(--chart-7, #c084fc)',
};

export default function CompositionStack({composition}: {composition: CompositionResponse | null}) {
  const {t} = useI18n();
  const onChartClick = useChartTurnClick();

  if (!composition) return null;
  const unknown = new Set<string>(composition.unknownSources ?? []);
  const data = composition.points.map((p) => ({
    turn: `#${p.turnId}`,
    ...p.sources,
  }));

  const badge = composition.source === 'otel'
    ? <span className={`${s.pill} ${s.live}`}>{t('composition.live')}</span>
    : <span className={`${s.pill} ${s.estimated}`} title={t('composition.enableAuditHint')}>{t('composition.estimated')}</span>;

  return (
    <ChartBox title={<span className={s.title}>{t('composition.title')} {badge}</span>}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{top: 20, right: 12, bottom: 4, left: 8}} onClick={onChartClick}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
          <XAxis dataKey="turn" tick={axisTickStyle} />
          <YAxis tick={axisTickStyle} tickFormatter={fmtTokens} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => fmtTokens(v)} />
          <Legend />
          {ORDER.map((k) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stackId="1"
              stroke={COLORS[k]}
              fill={COLORS[k]}
              fillOpacity={unknown.has(k) ? 0.1 : 0.6}
              strokeDasharray={unknown.has(k) ? '4 4' : undefined}
              name={t(`composition.sources.${k === 'system_prompt' ? 'systemPrompt' : k === 'tools_schema' ? 'toolsSchema' : k === 'messages_user' ? 'user' : k === 'messages_assistant' ? 'assistant' : k === 'messages_tool_use' ? 'toolUse' : k === 'messages_tool_result' ? 'toolResult' : 'thinking'}`)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
```

- [ ] **Step 3: CompositionStack.module.scss**

```scss
.title { display: inline-flex; align-items: center; gap: 8px; }
.pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.live { color: var(--success, #10b981); }
.estimated { color: var(--muted, #888); }
```

- [ ] **Step 4: SourceCards.tsx**

```tsx
import {useI18n} from '../../../i18n';
import {fmtTokens} from '../../../utils/format';
import StatCard from '../common/StatCard';
import CardGrid from '../common/CardGrid';
import type {CompositionResponse, CompositionSources} from '../../../types/api';
import s from './SourceCards.module.scss';

const ORDER: Array<keyof CompositionSources> = [
  'system_prompt', 'tools_schema', 'messages_user', 'messages_assistant',
  'messages_tool_use', 'messages_tool_result', 'messages_thinking',
];

const LABEL_KEY: Record<keyof CompositionSources, string> = {
  system_prompt: 'composition.sources.systemPrompt',
  tools_schema: 'composition.sources.toolsSchema',
  messages_user: 'composition.sources.user',
  messages_assistant: 'composition.sources.assistant',
  messages_tool_use: 'composition.sources.toolUse',
  messages_tool_result: 'composition.sources.toolResult',
  messages_thinking: 'composition.sources.thinking',
};

export default function SourceCards({composition}: {composition: CompositionResponse | null}) {
  const {t} = useI18n();
  if (!composition || composition.points.length === 0) return null;
  const last = composition.points[composition.points.length - 1]!;
  const prev = composition.points.length > 1 ? composition.points[composition.points.length - 2] : null;
  const unknown = new Set<string>(composition.unknownSources ?? []);

  return (
    <CardGrid>
      {ORDER.map((k) => {
        if (unknown.has(k)) {
          return (
            <StatCard
              key={k}
              label={t(LABEL_KEY[k])}
              value={t('composition.unknownPlaceholder')}
              sub={t('composition.enableAuditHint')}
            />
          );
        }
        const cur = last.sources[k];
        const prevVal = prev?.sources[k] ?? cur;
        const delta = cur - prevVal;
        const pct = last.total > 0 ? Math.round((cur / last.total) * 100) : 0;
        const color = Math.abs(delta) / Math.max(prevVal, 1) > 0.1 ? 'var(--warning)' : undefined;
        return (
          <StatCard
            key={k}
            label={t(LABEL_KEY[k])}
            value={fmtTokens(cur)}
            sub={`${pct}% · Δ ${delta >= 0 ? '+' : ''}${fmtTokens(delta)}`}
            color={color}
          />
        );
      })}
    </CardGrid>
  );
}
```

- [ ] **Step 5: SourceCards.module.scss**

```scss
// Empty intentionally; styling inherited from StatCard / CardGrid.
```

- [ ] **Step 6: Mount into ContextPanel**

在 `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx` 末尾、所有已有图表下方追加：

```tsx
  const sessionId = useSessionStore((st) => st.activeSessionId);
  const composition = useComposition(sessionId);
  ...
  // inside <Panel> ... </Panel>, after context.contextWindowGrowth chart:
  <CompositionStack composition={composition} />
  <SourceCards composition={composition} />
```

并补齐 import：

```tsx
import {useEffect, useState} from 'react';
import {getComposition} from '../../../services/api';
import type {CompositionResponse} from '../../../types/api';
import CompositionStack from './CompositionStack';
import SourceCards from './SourceCards';
```

- [ ] **Step 7: Build + manual verify**

```bash
cd plugins/token-reporter/frontend && npm run build
cd .. && export TOKEN_REPORTER_DEV_ROOT="$(pwd)" && bin/token-reporter-dev start
```

浏览器 `http://localhost:13737`，切到 Context tab，确认：
1. 有 OTel 数据时（可以手动 touch 一份 fixture 到 `~/.claude/token-reporter/otel/<id>.jsonl`）→ live 绿色徽章、7 层全显示
2. 无 OTel 数据 → estimated 灰色徽章、system_prompt / tools_schema 两张卡显示 `—`

停止服务：`bin/token-reporter-dev stop`。

- [ ] **Step 8: Commit**

```bash
git add plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/
git commit -m "feat(token-reporter): CompositionStack + SourceCards in ContextPanel"
```

---

## Task 14: 版本 bump + frontend dist 构建

通过 release-market skill 触发 bump；参考 CLAUDE.md「版本管理」章节。

- [ ] **Step 1: Build frontend dist**

```bash
cd plugins/token-reporter/frontend && npm run build
cd ..
```

- [ ] **Step 2: Invoke release-market skill**

在会话里对 Claude 说：

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

- [ ] **Step 4: Push** (by user command, after user review)

```bash
git push && git push --tags
```

---

## Self-Review 记录

**Spec 覆盖**

| Spec 条目 | 实现位置 |
|-----------|----------|
| §二 V1–V4 | Task 0 |
| §4.1 受管键常量 | Task 1 |
| §4.1 settings.local.json 读写 | Task 2 |
| §4.1 CLI on/off/status + 隐私提示 + 备份 | Task 3 |
| §4.1 config.json auditEnabled/auditPromptedAt 迁移 | Task 4 |
| §4.2 POST /v1/logs + /v1/metrics + 5MB + session fallback | Task 5 + Task 8 |
| §4.3 otel-parser 7 类 | Task 6 |
| §4.4 /api/sessions/:id/composition otel vs estimated | Task 7 + Task 8 |
| §4.1 引导路径 A（session-start console.error） | Task 9 |
| §4.5 AuditBanner（路径 B） | Task 12 |
| §4.5 CompositionStack + SourceCards | Task 13 |
| §4.6 i18n keys | Task 11 |
| §八 migrate | Task 4 |
| §九 范围外显式排除 | 未出现在任何 task |

**Placeholder 扫描**：无 TBD/TODO；每个 code step 都贴了实际代码；每个 run step 都给了命令与预期输出；Task 9 内含「若 V4=false → 跳过」的条件分支，而非 placeholder。

**Type consistency**
- `CompositionSources` / `CompositionPoint` / `CompositionResponse` 在 backend (`otel-parser.ts`) 与 frontend (`types/api.ts`) 同名同字段。
- `MANAGED_ENV_KEYS` 只在 `audit-keys.ts` 定义，其他文件 import。
- `SETTINGS_PATH` env 变量名 `TOKEN_REPORTER_SETTINGS_PATH` 在 bin、server、测试一致。

---

## Execution Handoff

Plan 已保存到 `docs/superpowers/plans/2026-04-19-context-auditing-dashboard.md`。两种执行方式：

1. **Subagent-Driven（推荐）**：每个 task 派新的 subagent，task 间做 review。迭代快、可追溯。
2. **Inline Execution**：当前 session 顺序跑，按 checkpoint 批次 review。

请选一个。
