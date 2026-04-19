# #1 Context Auditing Dashboard — 设计文档

**日期**: 2026-04-19
**范围**: token-reporter 新增「真实 context 构成」视图，数据源来自官方 OpenTelemetry 通道
**关联**: [2026-04-19-claude-code-new-features-research.md](./2026-04-19-claude-code-new-features-research.md)
**状态**: 设计待用户复核 → 通过后进入 writing-plans

---

## 一、目标与非目标

### 目标
- 回答用户的核心问题：**「现在的 context 里，什么东西占了多少 token？」**
- 把系统提示 / tools schema / skills / 历史消息 / tool results / thinking 的真实占比呈现到前端
- 支持跨轮次观察「哪一类来源增长最快」「下次 compact 会砍掉什么」

### 非目标
- 不替代现有 ContextPanel 的总量/压力/compact 曲线（那是「总量维度」，本设计是「构成维度」，两者并存）
- 不尝试拿 `/context` slash 命令的渲染结果（前置调研确认不可行）
- 不覆盖 Anthropic API 之外的 provider

---

## 二、关键前置结论（调研已完成）

1. **`/context` 无机器可读通道**：不写 JSONL、不进 hook payload、不支持 headless 输出。
2. **官方 OpenTelemetry 通道可用**：`CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_LOG_RAW_API_BODIES=1` 后，每轮完整 API request body（系统提示 / tools schema / 历史消息全在内）发到 OTLP endpoint。这是**真值**，比 `/context` 的彩色 grid 还精确。
3. **`settings.json` 的 `env` 字段可持久化 OTEL 环境变量**：声明式、官方支持，不需要改用户 shell rc、不需要 wrapper。
4. **token-reporter server 本身可直接当 OTLP/HTTP JSON receiver**：新增两个 endpoint 即可，零新进程。

### 待落地前验证的假设（不是已知，必须用最小脚本跑通再写代码）

| ID | 假设 | 验证方式 | 失败的退路 |
|----|------|----------|-----------|
| V1 | Claude Code OTel 的 logs exporter 键名确为 `OTEL_LOGS_EXPORTER=otlp`（也可能是 `OTEL_LOG_EXPORTER` 或只支持 `console`） | 起一个最小 HTTP receiver 打印 req，设 env 后跑一次 claude | 若只支持 console exporter，改成拦截 stdout 的 stream，不走 HTTP receiver |
| V2 | `OTEL_LOG_RAW_API_BODIES=1` 能让 request body 作为 log attribute 发出，而且 body 结构是 Anthropic Messages API JSON | 同上，看抓到的 attribute key 和 value 结构 | 若仅发 summary 而非 raw body，Composition 只能基于 `usage.*_input_tokens` 的分段拆，粒度变粗 |
| V3 | OTel payload 的 session 标识 attribute 名称与值（`session.id` / `claude.session_id` / 其他） | 抓到 payload 后 grep attribute key | 若未暴露 session 维度，退化为按 receiver 到达顺序 + 时间戳关联本地 JSONL |
| V4 | SessionStart hook 的 `console.error` 是否会显示在 Claude Code 交互界面 | 写一个临时 hook 回显特定字符串，观察是否可见 | 若不可见，引导改走 token-reporter 前端顶部横幅（见 §4.1 引导机制） |

这 4 条在 implementation plan 的 Task 0 里落成一个 `scripts/verify-otel-channel.js` 脚本，验证通过才允许继续后续 task。

---

## 三、架构概览

```
┌─────────────────────────────────────────────────────────────┐
│ 用户一次性同意 → token-reporter 写 ~/.claude/settings.local.json │
│   "env": { CLAUDE_CODE_ENABLE_TELEMETRY, OTEL_* }            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ claude 下次启动 → 内置 OTel SDK 读 env → 向 127.0.0.1:3737    │
│   发送 /v1/logs（含 API request/response body）              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ token-reporter server.ts (dist/server.js) 新增 POST /v1/logs │
│   → 解析 OTLP JSON → 落到 ~/.claude/token-reporter/otel/      │
│     <sessionId>.jsonl（独立文件、不污染 parser 主路径）       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 前端 ContextPanel → 新增 Composition 模块                    │
│   若 otel/<sessionId>.jsonl 存在 → 按来源拆解 request body   │
│   否则 → 用现有 JSONL 估算 + 打「估算」徽章 + 顶部引导横幅   │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、组件设计

### 4.1 启用联动（后端）

**受管键常量集中位置**：`backend/src/audit-keys.ts` 导出 `MANAGED_ENV_KEYS`（字符串数组）与 `MANAGED_ENV_DEFAULTS`（值映射）。`bin/token-reporter-audit`、`server.ts` 的 `/api/audit/status`、test 用例全部 import 同一份——避免列表分叉。

#### config.json 新增字段
```json
{
  "port": 3737,
  "autoStart": true,
  "lastVersion": "0.x.x",
  "auditEnabled": false,
  "auditPromptedAt": null
}
```

#### 首次引导机制

**触发条件**：`auditEnabled === false` 且 `auditPromptedAt === null`（只看这两个字段即可——首次值为 null，打一次后写入时间戳，之后永远不再打）。

**引导渠道**：由 V4（见 §二）验证结果决定。验证阶段同时落盘两路引导能力：
- 路径 A（优选）：在 `session-start.js` 用 `console.error` 打印引导文案，内容：
  ```
  [token-reporter] Context Audit (OpenTelemetry) is disabled.
  Run `token-reporter-audit on` to enable real context composition.
  This adds 6 keys to ~/.claude/settings.local.json (see /audit-info in the web UI).
  ```
- 路径 B（兜底）：前端 AnalyticsPage 顶部横幅——直接从 `GET /api/audit/status` 读 `auditEnabled` 与 `auditPromptedAt`，未启用时常驻一条软色横幅，点击展开引导详情。

V4 通过 → 只走路径 A；V4 失败 → 路径 A 不再尝试、路径 B 成为唯一引导。两种情况下"打完记一次"都通过 `POST /api/audit/ack-prompt` 更新 `auditPromptedAt`。

#### 新增 CLI：`token-reporter-audit`

**受管键白名单**（集中定义，on/off 共用一份常量）：
```
CLAUDE_CODE_ENABLE_TELEMETRY
OTEL_LOGS_EXPORTER
OTEL_EXPORTER_OTLP_PROTOCOL
OTEL_EXPORTER_OTLP_ENDPOINT
OTEL_LOG_RAW_API_BODIES
OTEL_LOG_USER_PROMPTS
```

- `token-reporter-audit on`
  1. 打印**隐私声明**并要求用户按 y 确认：启用后 user prompts 全文和 API request body 将写到本地 `~/.claude/token-reporter/otel/`，永不上传，但对读本机磁盘的人可见
  2. 确认后 `cp settings.local.json settings.local.json.bak-<ts>`（若文件存在）
  3. 合并写入上述 6 个键对应值（值来自 §二 V1/V2 验证后的确定列表，先按以下初始值，V1/V2 有修正时替换）：
     ```json
     {
       "env": {
         "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
         "OTEL_LOGS_EXPORTER": "otlp",
         "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
         "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:3737",
         "OTEL_LOG_RAW_API_BODIES": "1",
         "OTEL_LOG_USER_PROMPTS": "1"
       }
     }
     ```
  4. 写 config.json 的 `auditEnabled: true`
- `token-reporter-audit off` —— 遍历白名单，从 `settings.local.json` 的 `env` 里精确 `delete` 这些键；设 `auditEnabled: false`
- `token-reporter-audit status` —— 输出 `auditEnabled`、`auditPromptedAt`、当前 settings.local.json 的这 6 个键各自是否存在

**安全原则**：键名白名单精确删除；永远不做整段 env 替换；写入前备份。

### 4.2 OTLP Receiver（backend/src/server.ts，落盘到 backend/dist/server.js）

> 注：本项目后端是 TypeScript，源文件 `.ts` 位于 `backend/src/`，tsc 编译到 `backend/dist/*.js`，运行时加载 dist。下文所有"新增文件"都在 `backend/src/`。

#### 新增路由
- `POST /v1/logs` —— 接收 OTLP/HTTP JSON payload
- `POST /v1/metrics` —— 接收 metrics（本期只落盘不展示，为后续 #5 token-budget-forecaster 铺路）
- `GET /api/audit/status` —— 返回 `{auditEnabled, auditPromptedAt, settingsLocalKeys: {...}}`（前端横幅 + CLI status 复用）
- `POST /api/audit/ack-prompt` —— 把 `auditPromptedAt` 写成当前时间（引导被看到即记录）

#### 解析与落盘
- 解析 OTLP JSON（`resourceLogs[].scopeLogs[].logRecords[]`）
- **session 维度归属**（对应 §二 V3）：按优先级尝试 attribute key：`session.id` → `claude.session_id` → `claude.session.id` → `user_session_id`。全部落空时：fallback 为按 receiver 端每次 HTTP 连接的时间窗口（比如连续 60s 内无新连接视为同一 session）合成一个本地 ID，并在 payload 里打 `_sessionInferred: true` 标记
- 关注的 attribute：`anthropic.request.body` / `anthropic.response.body` / session 标识字段 / turn 序号（V2 验证时确认真实 key 名再固化）
- 落到 `~/.claude/token-reporter/otel/<sessionId>.jsonl`，每行一个 logRecord
- **不进现有 `sessions/` 目录**——保持旧 parser 不受影响

#### 依赖
不引入 `@opentelemetry/*` 包（我们是**接收方**不是发送方）。OTLP/HTTP JSON 是开放 schema，手写一个 validator 足够。

### 4.3 构成解析（backend/src/otel-parser.ts，新文件）

从 OTel jsonl 读取每轮的 `anthropic.request.body`（是 Anthropic Messages API 的 JSON），按以下类别拆分 token：

| 类别 | 来源 | 计算方式 |
|------|------|----------|
| **system_prompt** | `system` 字段（字符串或数组） | 字符计数 / 4 估算，或用响应里的 `usage.cache_read_input_tokens` 矫正 |
| **tools_schema** | `tools[]` 字段 | 序列化后字符 / 4 |
| **messages_user** | `messages[].role=user` 里 text block | 字符 / 4 |
| **messages_assistant** | `messages[].role=assistant` 里 text block | 字符 / 4 |
| **messages_tool_use** | assistant 里 tool_use block | 序列化后字符 / 4 |
| **messages_tool_result** | user 里 tool_result block | 字符 / 4 |
| **messages_thinking** | assistant 里 thinking block | 字符 / 4 |
| **cache_read** | response 的 `usage.cache_read_input_tokens` | 真值（用于校对 system + tools 估算的偏差） |

> 字符 / 4 只是经验换算，与实际 tokenizer 存在偏差；每轮用 response `usage.input_tokens = cache_read + cache_creation + 非缓存部分` 做总量校对，按比例回缩各类估算值，减少累计误差。

输出数据结构：
```ts
type CompositionPoint = {
  turnId: number;
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

### 4.4 Server API（backend/src/server.ts）

新增 `GET /api/sessions/:id/composition`：
- 若 `otel/<sessionId>.jsonl` 存在 → 返回 `{source: "otel", points: CompositionPoint[]}`，全部 7 类来源都是真值
- 否则 → 返回 `{source: "estimated", points: CompositionPoint[], unknownSources: ["system_prompt", "tools_schema"]}`
  - `messages_*` 五类从 JSONL 按字符 / 4 估算（JSONL 已含）
  - `system_prompt` 与 `tools_schema` **不给数字**，在 `unknownSources` 数组里标记不可估
  - 前端对不可估来源显示占位"—"+ tooltip"enable audit"，不能显示 0 或"约 X tokens"

### 4.5 前端强化（ContextPanel.tsx）

保留现有所有模块。**追加**在 `context.contextWindowGrowth` 图表之后：

#### CompositionStack 组件
```
┌────────────────────────────────────────────────────────┐
│ Context Composition                         [estimated]│  ← source 徽章
├────────────────────────────────────────────────────────┤
│                                                        │
│   堆叠面积图：x=turn, y=tokens                           │
│   颜色从下到上：system_prompt / tools / user / ...       │
│                                                        │
└────────────────────────────────────────────────────────┘
```
- 数据源 = estimated 时，图标右上角显示灰色「estimated」pill + tooltip「Enable audit for exact data: `token-reporter-audit on`」
- 数据源 = otel 时显示绿色「live」pill
- `unknownSources` 里的类别在堆叠图上**显示为虚线覆盖的占位段**或直接隐去该分层、图例区用灰字 "—" 标注"enable audit"

#### SourceCards 组件
最新一轮每类来源一张卡：当前 tokens / 与上一轮 delta / 占比。delta > 10% 标红。`unknownSources` 里的类别卡片显示大号 "—" + 引导文字，不显示数字。

#### 退化横幅（整页级，不在 ContextPanel 内）
放在 `AnalyticsPage` 或 `AnalyticsDrawer` 顶部，由 `GET /api/audit/status` 驱动：
- `auditEnabled === false` 时显示一条淡色横幅：
  > Context composition is estimated. Run `token-reporter-audit on` for real data.
- 用户点 "Dismiss" → 前端 `POST /api/audit/ack-prompt` 把 `auditPromptedAt` 置为当前时间，本周期内不再弹（等价于引导路径 B）
- 横幅纯前端读，ContextPanel 不重复渲染

### 4.6 i18n

新增键（en.ts / zh-CN.ts）：
- `composition.title` — "Context Composition" / "上下文构成"
- `composition.estimated` / `composition.live`
- `composition.enableAuditHint`
- `composition.unknownPlaceholder` — 占位符文案，如 "— (enable audit)"
- `composition.sources.systemPrompt` / `.toolsSchema` / `.user` / `.assistant` / `.toolUse` / `.toolResult` / `.thinking`
- `audit.banner.title` / `audit.banner.cta` / `audit.banner.dismiss`
- `audit.privacy.warning` —— CLI `audit on` 的隐私提示文案

---

## 五、组件隔离与边界

| 组件 | 职责 | 依赖 |
|------|------|------|
| `bin/token-reporter-audit` | 读写 settings.local.json + config.json（需触发 backend 的受管键常量） | 只读 config.json，只写 settings.local.json 的 env 键子集 |
| `backend/src/server.ts` 的 OTLP 路由 | HTTP 接收 + JSON 合法性校验 + 落盘 | 不解析内容，只分拣 |
| `backend/src/server.ts` 的 /api/audit/* | `GET /api/audit/status`、`POST /api/audit/ack-prompt` | 读写 config.json、读 settings.local.json |
| `backend/src/otel-parser.ts` | OTel JSONL → CompositionPoint | 只读 otel/*.jsonl |
| `backend/src/server.ts` 的 /api/sessions/:id/composition | 组装前端需要的结构 | 调用 otel-parser 或估算 fallback |
| `frontend/AuditBanner` | 读 `/api/audit/status` 并在 AnalyticsPage 顶部展示 | 仅前端 fetch |
| `frontend/CompositionStack` + `SourceCards` | 纯渲染 | 通过现有 sessionStore 获取数据 |

每个组件都能独立测试：
- audit CLI：给 fixture settings.local.json，跑 on/off 后对比输出
- OTLP 路由：POST 合法/非法 payload，验证落盘与 4xx 响应
- otel-parser：给 fixture OTel JSONL，断言 CompositionPoint 正确
- 前端：给 mock composition 数据，截图比对

---

## 六、错误处理

1. **settings.local.json 不存在** → audit on 时创建，只含 env 那 6 个键
2. **settings.local.json 非法 JSON** → audit on 拒绝操作，打印「settings.local.json is invalid, please fix manually」
3. **OTLP 请求体过大** → server 限 5MB，超限返 413
4. **otel/*.jsonl 写失败** → server 日志记录但继续响应 200（不让 Claude 的 telemetry export 失败连累本进程）
5. **前端 composition API 失败** → 面板显示空态，不影响其他 panel
6. **OTel payload 无 session 标识且 receiver fallback 触发** → 合成 ID 以 `_inferred-<epochMs>` 为前缀；前端在横幅里提示"session mapping is inferred, please report if inaccurate"
7. **隐私提示拒绝确认** → `audit on` 退出码 2，settings.local.json 与 config.json 均不改

---

## 七、测试策略

沿用现有 `node test/test-hooks.js` 风格、`assert` 模块、`TOKEN_REPORTER_DATA_DIR` 定向。新增：

- `test/test-verify-otel-channel.js` —— 运行 §二 V1/V2/V3/V4 的验证脚本并断言结果写入 `test/otel-verification-result.json`；后续任务以此文件为准
- `test/test-audit-cli.js` —— audit on/off/status 的 settings.local.json 读写、备份、隐私确认分支
- `test/test-otlp-receiver.js` —— POST /v1/logs 的合法/非法 payload、5MB 限制、session 标识缺失的 fallback ID
- `test/test-otel-parser.js` —— 给 3 个真实 fixture（无 tool / 有 tool / 有 thinking），验证拆解准确
- `test/test-audit-status-api.js` —— GET /api/audit/status 对各种 config.json / settings.local.json 组合的返回
- 前端：暂走手工验证（dev server 13737，参考 CLAUDE.md 的手动测试约定）

---

## 八、迁移与兼容

- 在 `backend/src/migrate.ts` 增加一条迁移：旧 config.json 补 `auditEnabled: false`, `auditPromptedAt: null`
- 旧 session（没有 OTel 数据）→ Composition 图全走估算路径，横幅引导启用
- 本设计**不改** `parser/` 主路径，零回归风险

---

## 九、范围外（显式列出，避免 scope creep）

- 跨 session 的 composition 聚合 → 归 #4 session-trend-scanner
- 基于 composition 的「CLAUDE.md 瘦身推荐」→ 归 #10 claude-md-pruner
- Thinking blocks 的语义分析 → 归 #12 attribution-reporter
- OTel metrics 的展示 → 本期只落盘不展示

---

## 十、下一步

1. 用户复核本 spec
2. 通过后，invoke writing-plans skill 生成 implementation plan
3. plan 的 Task 0 **必须是**跑 `scripts/verify-otel-channel.js` 把 §二 的 V1/V2/V3/V4 四个假设验证完、固化到 `test/otel-verification-result.json`——V1/V2 失败直接回到 brainstorming
4. plan 的后续 task 覆盖 bin / backend（TypeScript 源文件 + tsc 构建）/ frontend 的具体改动点 + 测试 + 迁移步骤
