# #1 Context Auditing Dashboard — 设计文档 v2（F 路径）

**日期**: 2026-04-19
**范围**: token-reporter 新增「真实 context 构成」视图，数据源来自 Node 进程内 fetch hook
**关联**:
- 前版本（v1，已废弃）: [2026-04-19-context-auditing-dashboard-design.md](./2026-04-19-context-auditing-dashboard-design.md)
- 证据: [evidence/2026-04-19-f-path/](./evidence/2026-04-19-f-path/)
- 研究: [2026-04-19-claude-code-new-features-research.md](./2026-04-19-claude-code-new-features-research.md)
**状态**: v1 OTel 路径因 60KB body 硬截断已废弃；v2 改走 F 路径，已 spike 证实可行

---

## 版本演进简史

v1 设计基于 Anthropic 官方 OpenTelemetry 通道（`CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_LOG_RAW_API_BODIES=1`）。实测发现 Claude Code CLI 在 `cli.js` 里**硬编码 61440（60KB）字面量**，任何超过 60KB 的 API request body 都会被截断并附 `[TRUNCATED - Content exceeds 60KB limit]` 标记，且没有任何 env 变量可以覆盖这个限制。由于真实对话很快就会突破 60KB，OTel 路径拿不到完整 body，无法精确拆解 `system_prompt` / `tools_schema` / `messages_*` 7 类来源。

v2 改走 **F 路径**：通过 `NODE_OPTIONS=--require=<hook>` 在 Claude Code 的 Node 进程启动时注入一份 fetch hook，在 TLS 加密之前截取 `api.anthropic.com` 的完整请求体。**纯旁路，不修改原请求，Claude Code 无感知。**

### v2 hotfix（2026-04-19）：NODE_OPTIONS 改走 shell alias 注入

原 v2 设计把 `NODE_OPTIONS=--require=<hook>` 写入 `~/.claude/settings.local.json.env`，期望 Claude Code 启动时把它注入到自身 `process.env`。源码阅读验证 Claude Code 确实会 `Object.assign(process.env, settings.env)`——但**发生在 Node runtime 初始化之后**。`NODE_OPTIONS` 里的 `--require` 语义只在 **Node binary 启动瞬间**读取 env 时生效；启动后才塞进 `process.env` 的 `NODE_OPTIONS` 对当前 Node 无效，只会传给 spawn 的子进程，而 Messages API `fetch()` 由 Claude Code **主进程**发出，拦不到。

**修复过程中的方案演进**：

1. **尝试 #1（PATH shim）**：在 `~/.claude/bin/claude` 写 bash wrapper `exec env NODE_OPTIONS=... real-claude "$@"`，往 shell rc 的 PATH 前面加 `~/.claude/bin`。实测失败——zsh 的 command hash cache 在 rc 末尾改 PATH 后不自动刷新，仍命中原 real claude；且 `whence` 始终报 user's `alias claude`，展开后第二次查 `claude` 走 PATH 时 hash 表陈旧。
2. **最终方案（Shell alias 注入）**：`token-reporter-audit on` 往 `~/.zshrc` / `~/.bashrc` 追加一行：

   ```zsh
   # token-reporter-audit: alias wrapper
   alias claude='NODE_OPTIONS="--require=/abs/path/fetch-hook.cjs" claude'
   ```

   zsh 遇到 `claude` 时先展开 alias（变成 `NODE_OPTIONS="..." claude arg1 arg2...`），第二个 `claude` 不再展开（防递归），走 PATH 到 real claude binary。Node 启动读到 NODE_OPTIONS → `--require` 生效 → hook 加载 → 拦截主进程 fetch。  
   **优势**：alias 是 shell 的本命机制，不依赖 hash 刷新；用户已有的 `alias claude='HTTPS_PROXY=... claude'` 可以被我们自动检测并把 HTTPS_PROXY 烘焙进新 alias；`audit off` 只删两行（marker + alias）精确还原。

**详细设计**：

- 用户的 shell env 里如果已有 `HTTPS_PROXY`，CLI 自动把它烘焙进 alias（`HTTPS_PROXY="..." NODE_OPTIONS="..." claude`），保证代理继续生效
- 如果 shell env 没 proxy 但 rc 里已有 `alias claude='HTTPS_PROXY=URL claude'`，CLI 从该 alias 里**提取 URL** 烘焙到新 alias（替代用户原 alias 的代理作用）
- 发布版里默认不带 proxy（干净安装时用户 env 没 HTTPS_PROXY 的常见情况）
- rc 里的两行（marker 注释 + alias）由 `SHELL_RC_MARKER` 标识，`off` 时按 marker 精确删除；不触碰用户其它 rc 内容
- `settings.local.json.env` 仅保留 `TOKEN_REPORTER_AUDIT_OUT` + `TOKEN_REPORTER_AUDIT_ACTIVE` —— 这两个是 hook 启动后才读的目标目录 / flag，不属于 runtime-only env，Claude Code 后加载到 process.env 后传给 spawn 的子进程（hook 在主进程也能读到，因为主进程就是 Node 本身）

**设计文件变更**：

- `backend/src/audit-keys.ts`：`MANAGED_ENV_KEYS` 从 3 个降到 2 个（去掉 NODE_OPTIONS）；`SHELL_RC_MARKER` 从 PATH shim 注释改为 alias wrapper 注释
- `backend/src/audit-settings.ts`：引入 `buildAliasLine()` / `detectExistingProxy()` / `patchShellRc(rcPath, aliasLine)` / `unpatchShellRc()`；`enableAudit` / `disableAudit` 不再管 shim 只管 alias 行；保留 `disableAudit` 里**清理旧 PATH shim** 的兜底（给已从尝试 #1 升级上来的用户）
- `backend/src/migrate.ts` 2.11.0：新增 `userClaudeBin: null` + `shellRcPatched: null`（前者是尝试 #1 遗留字段，最终方案不写入但保留在 schema 以兼容）
- `bin/token-reporter-audit`：flow「问 proceed → 检测已有 proxy（env 或 rc 的现有 alias）→ 问 rc 写入 → 追加 alias」；新增 `-y` / `--yes` flag for scripting
- spike/证据仍成立（153KB body 完整可抓），变的是**如何让 NODE_OPTIONS 在 Node 启动前就位**：改用 shell alias 而非 PATH shim/settings.env

---

## 一、目标与非目标

### 目标
- 回答核心问题：**「现在的 context 里，什么东西占了多少 token？」**
- 把 system prompt / tools schema / messages 的 5 类细分（user / assistant / tool_use / tool_result / thinking）**真值**呈现到前端
- 支持跨轮次观察「哪一类来源增长最快」「下次 compact 会砍掉什么」

### 非目标（本期）
- 不替代现有 ContextPanel 的总量/压力/compact 曲线（那是总量维度；本设计是构成维度；两者并存）
- 不做跨 session 聚合（归 #4）
- 不做 CLAUDE.md 瘦身推荐（归 #10）
- 不做 thinking 语义分析（归 #12）
- 不做 cost forecaster（归 #5）
- 不覆盖 Bun / Deno / 原生二进制形态的 Claude Code —— **本期只支持 Node 版 CLI**

---

## 二、F 路径的技术契约

### 关键前置结论（已验证）

| ID | 结论 | 证据 |
|----|------|------|
| F1 | Claude Code CLI（npm 包 `@anthropic-ai/claude-code`）运行在 Node 上，HTTP 请求走 `globalThis.fetch`（undici） | cli.js grep `"undici"` + `globalThis.fetch` 命中 |
| F2 | `NODE_OPTIONS=--require=<hook>` preload 能 patch `globalThis.fetch`，新 fetch 会拿到完整未截断 body | spike 实测：153KB body 完整到手，JSON 可 parse；远超 OTel 通道 60KB 截断 |
| F3 | `x-claude-code-session-id` HTTP header 直接携带 session ID | spike 捕获 header 列表确认 |
| F4 | Claude Code 会在多个 Node 子进程中继承 `NODE_OPTIONS`，每个子进程都被独立 patch | spike `_status.log` 显示 4 个 pid 均 patched |
| F5 | `globalThis.fetch` 被 patch **不改变** Claude Code 自身行为（只读取 body 副本） | hook 里 `return originalFetch.apply(this, arguments)`，原请求原样发 |

### 设计边界

| 项 | 处理 |
|----|------|
| Claude Code 改 HTTP 客户端（从 `globalThis.fetch` → 私有闭包 fetch） | 装 `Module._load` 拦截 `require('undici')` 双保险；仍失效则启动 60s 内 **hookStale 探针**，前端 banner 提示版本升级 |
| 用户 shell 里自带 `NODE_OPTIONS` | audit on 时读取当前 settings.local.json 已有值，**合并追加**而非覆盖；CLI 输出警告列出原有值 |
| 子进程 `process.env.NODE_OPTIONS = '...'` 覆盖 | hook 内**不尝试固化**（会引入更多奇怪副作用）；若用户遇到漏抓、hookStale 探针会在 60s 内亮起 |
| hook 文件被删 | hook 放插件目录 `plugins/token-reporter/runtime/fetch-hook.cjs`，随插件分发，用户正常使用不会动 |
| 多进程写同目录冲突 | 文件名格式 `<pid>-<timestamp>-<seq>.jsonl`，pid 前缀保证进程间唯一 |
| Node < 18 | audit on 的前置检查里校验 `process.versions.node` 主版本 ≥18；低版本拒绝启用 |
| 非 Node 版 Claude Code（Bun / 二进制） | audit on 通过 `claude --version` 或 `which claude` 检查，非 Node 入口给出明确错误 + 退出 |

---

## 三、架构概览

```
┌────────────────────────────────────────────────────────────────┐
│ 用户一次性同意 → token-reporter-audit on →                      │
│   写 ~/.claude/settings.local.json:                            │
│     env.NODE_OPTIONS = "--require=<plugin>/runtime/fetch-hook.cjs" │
│     env.TOKEN_REPORTER_AUDIT_OUT = "~/.claude/token-reporter/captures" │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ claude 下次启动 → Node 执行 --require=<hook> →                  │
│   hook patch globalThis.fetch + undici.fetch                   │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Claude Code 发请求到 api.anthropic.com →                       │
│   hook 先复制 request body 到 <OUT_DIR>/<pid>-<ts>-<seq>.req.json │
│   响应回来时追加写 <pid>-<ts>-<seq>.resp.json                   │
│   原请求/响应不修改，Claude Code 无感知                          │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ token-reporter server 有新路由 GET /api/sessions/:id/composition │
│   → 读 captures/*.req.json 解析 7 类来源 → 返回前端             │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 前端 ContextPanel 新增 CompositionStack + SourceCards          │
│   audit 未启用时 → estimated 徽章 + unknownSources 占位         │
│   audit 启用 + 有 capture → live 徽章 + 7 类全真值             │
│   audit 启用但 60s 内 hook 未触发 → hookStale banner           │
└────────────────────────────────────────────────────────────────┘
```

---

## 四、组件设计

### 4.1 启用联动（后端）

**受管 env 键白名单**（`backend/src/audit-keys.ts`，供 CLI / server / 测试共用）：
- `NODE_OPTIONS` —— 追加 `--require=<hook>`（**追加模式**，保留用户原值）
- `TOKEN_REPORTER_AUDIT_OUT` —— captures 落盘目录（默认 `~/.claude/token-reporter/captures`）
- `TOKEN_REPORTER_AUDIT_ACTIVE` —— 探针用 `"1"`，hook 启动时写入 heartbeat 文件

注：v1 OTel 的 6 个键不再写入。

#### config.json 新增字段
```json
{
  "port": 3737,
  "autoStart": true,
  "lastVersion": "0.x.x",
  "auditEnabled": false,
  "auditPromptedAt": null,
  "userNodeOptions": null
}
```
`userNodeOptions` 记录启用时 `NODE_OPTIONS` 的原值，`audit off` 时还原。

#### 首次引导机制

**触发条件**：`auditEnabled === false` 且 `auditPromptedAt === null`（只看这两个字段——首次为 null，提示一次后写时间戳，之后永不再弹）。

**引导渠道**：前端 AnalyticsPage 顶部 banner 常驻一条软色提示，点击展开详细说明 + 「Enable」按钮（按钮仅打印 CLI 指令，不代用户执行）。**不走 session-start 的 `console.error`**——因为 v1 V4 假设（SessionStart hook stderr 可见性）已不再需要，我们不想再为一条引导赌 hook 输出能被用户看到。

#### 新增 CLI：`token-reporter-audit`

- `token-reporter-audit on`
  1. 环境前置检查：
     - `which claude` 必须存在 + `claude --version` 匹配 `\d+\.\d+\.\d+ \(Claude Code\)` 格式
     - `node --version` ≥ 18
     - `plugins/token-reporter/runtime/fetch-hook.cjs` 文件存在
  2. 打印隐私声明并要求 y 确认：启用后**每次 API 请求/响应的完整 body**（含 system prompt、tools schema、你的 prompt、assistant 输出、thinking）都会**明文**写到本地 `~/.claude/token-reporter/captures/`。永不上传，但能读本机磁盘的人可见。提供 `token-reporter-audit purge` 一键清空。
  3. 备份：`cp settings.local.json settings.local.json.bak-<ts>`
  4. 读当前 `settings.local.json` 的 `env.NODE_OPTIONS`（可能是空）；存到 config.json 的 `userNodeOptions`；合并写入：
     ```json
     {
       "env": {
         "NODE_OPTIONS": "<原值拼接> --require=/path/to/plugin/runtime/fetch-hook.cjs",
         "TOKEN_REPORTER_AUDIT_OUT": "/Users/<u>/.claude/token-reporter/captures",
         "TOKEN_REPORTER_AUDIT_ACTIVE": "1"
       }
     }
     ```
  5. 写 config.json 的 `auditEnabled: true`
- `token-reporter-audit off` —— 把 `NODE_OPTIONS` 还原为 `userNodeOptions`（若为 null 则从 env 里删掉该键），同时删 `TOKEN_REPORTER_AUDIT_OUT` + `TOKEN_REPORTER_AUDIT_ACTIVE`；config.json `auditEnabled: false`
- `token-reporter-audit status` —— 输出 `auditEnabled` / `auditPromptedAt` / hook 路径 / 当前 settings.local.json 的 3 个键各自状态 / 最近一次 hook heartbeat 时间（`<OUT>/.heartbeat` 文件 mtime） / 是否 hookStale
- `token-reporter-audit purge` —— 清空 `<OUT>` 目录（保留目录本身）；要求 y 确认

**安全原则**：白名单精确操作；`NODE_OPTIONS` **追加而非替换**；写入前备份；off 完整还原。

### 4.2 Hook 脚本（plugins/token-reporter/runtime/fetch-hook.cjs）

**职责**
- 作为 CJS 文件（Node preload 必须 CJS），patch `globalThis.fetch` 和 `Module._load('undici')` 的 `fetch`
- 每次拦截到 `api.anthropic.com/*` 请求，把 request body、url、method、headers 写到 `<OUT_DIR>/<pid>-<ts>-<seq>.req.json`
- 异步读取响应（克隆 Response 对象），把 status/headers/body 写到 `<OUT_DIR>/<pid>-<ts>-<seq>.resp.json`
- 启动时写 `<OUT_DIR>/.heartbeat`，内容 = `{"pid": <pid>, "startedAt": <iso>, "hookVersion": "<plugin ver>"}`；每次拦截到请求再 touch 一次
- **永不让任何 throw 逃出 hook**——所有错误吞掉并 append 到 `<OUT_DIR>/.errors.log`

**隐私**
- 目录权限 `0700`
- 不采集 `Authorization` header 值（整键删除）
- 其他 `x-*` header 按白名单保留（`x-claude-code-session-id` / `anthropic-version` / `anthropic-beta` / `x-client-request-id`）

**输入管道兼容性**
- `init.body` 类型覆盖：string / Uint8Array / ArrayBuffer / Buffer / Object / ReadableStream
- 其中 ReadableStream：用 `request.clone()` 消费一份再还给原请求；成本 = 多一次 body 复制

### 4.3 Captures Parser（backend/src/captures-parser.ts）

读 `<OUT_DIR>/*.req.json`，按 `x-claude-code-session-id` header 分组。对每个属于某 session 的 `.req.json`：

```ts
type CompositionPoint = {
  turnId: number;
  capturedAt: string;
  requestId: string | null;
  total: number;
  sources: {
    system_prompt: number;
    tools_schema: number;
    messages_user: number;
    messages_assistant: number;
    messages_tool_use: number;
    messages_tool_result: number;
    messages_thinking: number;
  };
};
```

拆解规则（body 是完整 Anthropic Messages API JSON）：

| 类别 | 来源 | 计算 |
|------|------|------|
| system_prompt | `body.system` 字段（字符串或数组 block） | 字符 / 4 |
| tools_schema | `body.tools[]`（JSON 序列化） | 字符 / 4 |
| messages_user | `messages[].role=user` 里 text block | 字符 / 4 |
| messages_assistant | `messages[].role=assistant` 里 text block | 字符 / 4 |
| messages_tool_use | assistant 里 tool_use block（JSON 序列化） | 字符 / 4 |
| messages_tool_result | user 里 tool_result block | 字符 / 4 |
| messages_thinking | assistant 里 thinking block | 字符 / 4 |

如果对应 `.resp.json` 存在并解析成功，用 `usage.input_tokens` 作为**总量校对**，按比例回缩 7 类估算值（"字符 / 4" 的标准误差 ≤5%，校对后 ≤2%）。

turn 序号：在该 session 内按 `capturedAt` 升序排列。

### 4.4 Server API（backend/src/server.ts）

新增：
- `GET /api/sessions/:id/composition` —— 返回 `{source: 'live' | 'estimated', points: CompositionPoint[], unknownSources?: string[], hookStale?: boolean}`
- `GET /api/audit/status` —— 返回 `{auditEnabled, auditPromptedAt, hookHeartbeatAt: string|null, hookStale: boolean, settingsLocalKeys: {...}}`。hookStale 定义：`auditEnabled === true` 且 heartbeat 文件不存在或 mtime 距今 > 5 分钟
- `POST /api/audit/ack-prompt` —— 把 `auditPromptedAt` 写成当前时间

composition 路由的数据源优先级：
1. 若 audit 启用且对应 session 的 capture 文件存在 → `source: 'live'`（全 7 类真值）
2. 否则 → `source: 'estimated'`，从现有 JSONL 估算 messages_* 五类，`system_prompt` 和 `tools_schema` 放进 `unknownSources`

### 4.5 前端强化

#### ContextPanel 追加（v1 原设计照搬，只改数据源标签）

- **CompositionStack**：堆叠面积图（x=turn, y=tokens），7 层分色。右上角徽章：
  - `source: 'live'` → 绿色「live」pill
  - `source: 'estimated'` → 灰色「estimated」pill + tooltip「Enable audit for exact data: `token-reporter-audit on`」
  - `hookStale: true` → 黄色「hook stale」pill + tooltip「Hook hasn't captured in 5+ minutes. Try restarting Claude Code or run `token-reporter-audit status`.」
- **SourceCards**：最新一轮每类 1 张卡片（tokens / 与上一轮 delta / 占比）；`unknownSources` 类别显示 `—` + 引导文字
- **Stack 行为**：`unknownSources` 里的类别用虚线边框 + 低透明度填充

#### AuditBanner（v1 原设计保留）

- 位置：`AnalyticsPage` 顶部
- 驱动：`GET /api/audit/status`
  - `auditEnabled === false` 且 `auditPromptedAt === null` → 软色引导横幅
  - `auditEnabled === true` 且 `hookStale === true` → 黄色「hook stale」横幅
- 横幅右侧 Dismiss 按钮 → `POST /api/audit/ack-prompt`

### 4.6 i18n（en.ts / zh-CN.ts 新增键）

- `composition.title` / `composition.live` / `composition.estimated` / `composition.hookStale` / `composition.enableAuditHint` / `composition.unknownPlaceholder`
- `composition.sources.systemPrompt` / `.toolsSchema` / `.user` / `.assistant` / `.toolUse` / `.toolResult` / `.thinking`
- `audit.banner.title` / `audit.banner.cta` / `audit.banner.dismiss`
- `audit.banner.hookStaleTitle` / `audit.banner.hookStaleCta`
- `audit.privacy.warning` / `audit.privacy.purgeHint`
- `audit.cli.nodeTooOld` / `audit.cli.claudeNotFound` / `audit.cli.hookFileMissing`（CLI 侧错误文案）

---

## 五、组件隔离与边界

| 组件 | 职责 | 依赖 |
|------|------|------|
| `bin/token-reporter-audit` | 读写 settings.local.json + config.json；调用 purge | audit-settings.ts |
| `backend/src/audit-keys.ts` | 受管 env 键白名单常量 | 无 |
| `backend/src/audit-settings.ts` | settings.local.json 的合并/还原、config.json 的 audit 字段读写、hook 心跳读取 | 无 |
| `runtime/fetch-hook.cjs` | patch fetch + 抓 body + 写文件 + 心跳 | 无（纯 CJS，不能依赖 backend/dist） |
| `backend/src/captures-parser.ts` | captures/*.req.json → CompositionPoint | 无 |
| `backend/src/composition-service.ts` | 组装 composition 响应：captures 有则 live、否则 estimated | captures-parser + 现有 parser |
| `backend/src/server.ts` 新增路由 | HTTP 入口 | composition-service + audit-settings |
| `frontend/AuditBanner` + `CompositionStack` + `SourceCards` | 纯渲染 | sessionStore + auditStore |

每组件可独立测试。

---

## 六、错误处理

1. **settings.local.json 不存在** → audit on 创建，只含 env 那 3 个键
2. **settings.local.json 非法 JSON** → audit on 拒绝 + 打印「settings.local.json is invalid, please fix manually」
3. **NODE_OPTIONS 已含 --require=<我们的 hook>** → 幂等，不重复追加
4. **用户已有其他 `--require`** → 合并追加，在 audit status 输出里列出完整 chain
5. **hook 运行时 throw** → 吞掉、append `.errors.log`、继续返回原 fetch 结果（永不阻断宿主）
6. **captures 目录写满磁盘** → hook 内 catch ENOSPC，吞掉 + 心跳停；status API 暴露 `diskFull: true`；前端 banner 提示
7. **body 无法解析 JSON**（极少见，比如 form-data 上传） → parser 跳过，不进 composition，但 capture 文件保留
8. **response 抓取失败** → composition 仍可用（只是少了 usage 校对）
9. **hookStale** → audit enabled 但 5 分钟无心跳 → banner 提示 + composition 回退 estimated

---

## 七、测试策略

沿用 Node `assert` + `TOKEN_REPORTER_DATA_DIR` 约定。

- `test/test-audit-keys.js` —— 白名单 3 个键断言
- `test/test-audit-settings.js` —— settings.local.json 合并/追加/还原、NODE_OPTIONS 拼接保留用户原值、hook 心跳读取
- `test/test-audit-cli.cjs` —— on/off/status/purge，含环境前置检查失败分支
- `test/test-fetch-hook.cjs` —— 独立起一个 node 子进程 `--require=fetch-hook.cjs`，spawn 里跑一份 mock server + `globalThis.fetch('http://127.0.0.1:<port>/')`，断言 hook 写出了 req/resp 文件、心跳存在、非 anthropic host 不抓
- `test/test-captures-parser.js` —— 3 个 fixture（小对话 / 含 tool_use / 含 thinking）→ 断言 7 类拆解
- `test/test-composition-service.js` —— live / estimated / hookStale 三种返回
- `test/test-audit-status-api.js` —— API 四种场景（未启用、启用活、启用 stale、磁盘满）
- 前端：dev server 13737 手工验证（沿用 CLAUDE.md 约定）

**废弃的测试**：v1 的 `test/verify-otel-channel.js` 保留但标记为「历史参考，已不跑」，结果文件 `otel-verification-result.json` 同样保留作为设计演进证据。

---

## 八、迁移与兼容

- `backend/src/migrate.ts` 增加一条迁移：旧 config.json 补 `auditEnabled: false` / `auditPromptedAt: null` / `userNodeOptions: null`
- 如果用户之前跟着 v1 设计自己设过 OTel env 键（极罕见，因为 v1 没落地）→ audit on 不清理这些；audit status 如果检测到 OTel 键存在会打印一条提示
- 零回归：不改 `backend/src/parser/`；不改任何现有路由

---

## 九、范围外（显式列出，避免 scope creep）

- 跨 session 的 composition 聚合 → #4
- CLAUDE.md 瘦身推荐 → #10
- Thinking 语义分析 → #12
- Cost forecaster → #5
- 非 Node 形态 Claude Code 支持 → 放着等 Anthropic 发了再说
- 抓 response body 做 TTFT / 生成速率分析 → 本期只落盘不分析，为后续解锁
- 跨轮次 cache breakpoint 定位 → 数据已有，UI 留给后续

---

## 十、下一步

1. 用户复核本 v2 spec
2. 通过后 → writing-plans v2 生成 plan
3. Plan Task 0 的内容变更：**不再**跑 OTel 验证脚本；新的 Task 0 = 把 `/tmp/f-spike/hook.cjs` 改写成生产级 `runtime/fetch-hook.cjs`，跑一次实盘测试验证 capture 落盘
4. 后续 task 覆盖：audit-keys + audit-settings + audit CLI + migrate + fetch-hook + captures-parser + composition-service + server 路由 + banner + stack + cards + i18n + 版本 bump
