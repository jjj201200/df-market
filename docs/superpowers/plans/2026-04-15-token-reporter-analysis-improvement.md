# Token-Reporter 分析功能全面改进实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ 状态更新要求：** 每完成一个 Task 后，必须更新本计划文件的 Progress 章节，标记已完成项，并记录当前状态、遇到的问题和下一步行动。跨会话恢复时优先读取本计划的 Progress + Context 部分。

**Goal:** 基于调研报告发现的准确性、逻辑完整性、测试覆盖度问题，对 token-reporter 的分析功能进行全面改进，提升数据可靠性、推荐精准度和代码可维护性。

**Architecture:** 分四个阶段推进：先补测试（TDD 修复已知 bug）→ 再修推荐规则逻辑 → 然后优化估算指标的可信度与 UI 提示 → 最后更新定价表与文档。每个阶段独立可验证，频繁提交。

**Tech Stack:** Node.js (backend parser), TypeScript + React (frontend), built-in `assert` module for tests, no external test framework.

---

## Progress

**状态**：🟢 已完成  
**最后更新**：2026-04-15（实施完成）

### 阶段 0：前置准备（已完成）
- [x] 0a 确认当前工作区干净，无未提交更改
- [x] 0b 运行全部现有测试，记录基线结果
- [x] 0c 确认版本是否需要更新（运行 `node plugins/token-reporter/scripts/check-version.js`）

### 阶段 1：补全核心 Analytics 测试 + 修复 R18 规则（已完成）
- [x] Task 1：为 `computeCacheMetrics` 编写测试
- [x] Task 2：为 `computeToolEfficiency` 编写测试（含冗余检测精度验证）
- [x] Task 3：修复 R18 (Bloated Prompt) 推荐规则逻辑
- [x] Task 4：为 `generateRecommendations` 编写集成测试（重点覆盖 R12、R18）

### 阶段 2：改进估算指标与命名/语义问题（已完成）
- [x] Task 5：重命名 `mcpTokenPct` → `mcpTurnPct`
- [x] Task 6：明确 `readEditRatio` 语义并补充 `totalReadOps / totalEditOps` 指标
- [x] Task 7：为 Context Growth、Thinking Tokens、Prompt Tokens 增加 "Estimated" UI 标注

### 阶段 3：定价表维护与数据准确性（已完成）
- [x] Task 8：更新 `cost.ts` 定价表，补充最新模型并增加未知模型日志警告
- [x] Task 9：改进子代理成本计算，使用实际 turn 级模型而非默认 Haiku

### 阶段 4：回归验证与提交（已完成）
- [x] Task 10：运行全部测试并确认通过
- [x] Task 11：构建前端并确认无错误
- [x] Task 12：按规范提交并更新版本（如需要）

---

## Context

### 调研报告核心发现

1. **测试覆盖缺口巨大**：`analytics.ts` 中 10 个 `computeXxxMetrics` 函数仅 4 个有测试，`generateRecommendations` 完全无测试。
2. **R18 规则存在系统性误报**：`outputTokens < inputTokens * 0.1` 中的 `inputTokens` 是 API 报告的全上下文输入（包含历史对话），不是用户 prompt 长度。长会话后期几乎必然触发。
3. **冗余检测精度不足**：仅比较 tool 输出的前 200 字符，开头相同但后续不同的输出会被误判为冗余。
4. **命名与语义偏差**：`mcpTokenPct` 实际是 "含 MCP 的 turn 比例"；`readEditRatio` 是 unique files 比而非操作量比。
5. **估算指标未明确标注**：Context Growth、Thinking Tokens、Prompt Tokens 均为估算值，但 UI 未向用户说明。
6. **定价表维护风险**：新模型默认回退到 Sonnet 定价，可能导致显著成本失真；子代理默认使用 Haiku 定价也不准确。

### 本计划不涉及的内容

- 不重构前端 React 组件架构（只改显示文本/常量）
- 不引入新的测试框架（继续使用 Node.js 内置 `assert`）
- 不改动 parser 的 turn 合并逻辑（sidechain 合并风险为低概率理论问题，暂不处理）
- 不实现推荐阈值用户可配置（超出当前改进范围）

---

## File Structure

| 文件 | 职责变更 |
|------|----------|
| `plugins/token-reporter/frontend/src/utils/analytics.ts` | 修改 R18 规则、重命名 `mcpTokenPct`、补充 `totalReadOps/totalEditOps`、改进子代理成本计算 |
| `plugins/token-reporter/frontend/src/utils/cost.ts` | 更新定价表、增加未知模型警告 |
| `plugins/token-reporter/frontend/src/types/state.ts` | 如有需要，扩展 `FileMetrics` / `ToolEfficiency` / `SubagentEfficiency` 类型 |
| `plugins/token-reporter/frontend/src/components/Analytics/CachePanel/CachePanel.tsx` | 增加 "Estimated" 标注 |
| `plugins/token-reporter/frontend/src/components/Analytics/ThinkingPanel/ThinkingPanel.tsx` | 增加 "Estimated" 标注 |
| `plugins/token-reporter/frontend/src/components/Analytics/PromptPanel/PromptPanel.tsx` | 增加 "Estimated" 标注 |
| `plugins/token-reporter/frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx` | 增加 "Estimated" 标注 |
| `plugins/token-reporter/frontend/src/components/Analytics/ToolsPanel/ToolsPanel.tsx` | 更新 `mcpTokenPct` 引用为 `mcpTurnPct` |
| `plugins/token-reporter/frontend/src/components/Analytics/FilesPanel/FilesPanel.tsx` | 更新 `readEditRatio` 显示逻辑 |
| `plugins/token-reporter/frontend/src/i18n/locales/en.ts` | 增加/修改相关翻译键 |
| `plugins/token-reporter/frontend/src/i18n/locales/zh-CN.ts` | 增加/修改相关翻译键 |
| `plugins/token-reporter/test/test-analytics-cache.js` | 新建：cache metrics 测试 |
| `plugins/token-reporter/test/test-analytics-tools.js` | 新建：tool efficiency 测试 |
| `plugins/token-reporter/test/test-analytics-recommendations.js` | 新建：recommendations 测试 |

---

## 阶段 0：前置准备

### Task 0a：确认工作区状态

**Files:**
- 读取：`plugins/token-reporter/package.json`
- 读取：`.claude-plugin/marketplace.json`

- [ ] **Step 1: 检查 git 状态**

Run:
```bash
cd /Users/df2025/github/df-market && git status
```
Expected: 干净的工作区，无未提交更改。

- [ ] **Step 2: 运行现有测试基线**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
node test/test-parser.js
node test/test-file-metrics.js
node test/test-mcp-metrics.js
node test/test-pressure-metrics.js
node test/test-prompt-metrics.js
```
Expected: 全部通过。

- [ ] **Step 3: 检查版本**

Run:
```bash
node scripts/check-version.js
```
Expected: 若提示需要 bump，先记录当前版本，待全部修改完成后再统一 bump。

---

## 阶段 1：补全核心 Analytics 测试 + 修复 R18

### Task 1：为 `computeCacheMetrics` 编写测试

**Files:**
- Create: `plugins/token-reporter/test/test-analytics-cache.js`
- Read: `plugins/token-reporter/frontend/src/utils/analytics.ts:20-46`
- Read: `plugins/token-reporter/test/test-file-metrics.js`（参考测试风格）

- [ ] **Step 1: 编写测试文件**

```javascript
// plugins/token-reporter/test/test-analytics-cache.js
"use strict";
const assert = require("assert");

// Mock the analytics module dependencies
const { computeCacheMetrics } = require("../frontend/dist/utils/analytics.js");

// Since frontend is TS, we need to test against compiled output or create a JS test harness.
// Better approach: create a test harness that imports the TS logic via a small JS bridge.
```

**问题**：前端是 TypeScript，现有测试直接引用 backend JS 文件。需要一种方式测试 frontend TS 代码。

**方案**：在 `test/` 目录下创建轻量级 JS bridge，通过 `ts-node` 或预编译的 `dist` 运行测试。观察发现项目已有 `frontend/dist/`（构建产物）。若 `dist` 存在且较新，可直接引用 `dist/utils/analytics.js`。若不存在或过时，先构建前端。

**修正方案**：每个测试 task 的第一步是先确认 `frontend/dist/utils/analytics.js` 存在，若不存在则运行 `npm run build --prefix frontend`（或观察项目实际构建命令）。

重新设计 Task 1：

- [ ] **Step 1: 确认前端构建产物可用**

Run:
```bash
ls /Users/df2025/github/df-market/plugins/token-reporter/frontend/dist/utils/analytics.js
```
若不存在：
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend && npm run build
```

- [ ] **Step 2: 编写 cache metrics 测试**

Create `plugins/token-reporter/test/test-analytics-cache.js`:

```javascript
"use strict";
const assert = require("assert");
const { computeCacheMetrics } = require("../frontend/dist/utils/analytics.js");

function makeTurn(overrides) {
  return {
    id: 1,
    input: 0,
    output: 0,
    cacheR: 0,
    cacheC: 0,
    model: "claude-sonnet-4-6",
    ...overrides,
  };
}

// Test 1: empty turns
{
  const result = computeCacheMetrics([]);
  assert.strictEqual(result.totalCacheR, 0);
  assert.strictEqual(result.totalCacheC, 0);
  assert.strictEqual(result.totalInput, 0);
  assert.strictEqual(result.hitRate, 0);
  assert.strictEqual(result.efficiencyRatio, 0);
  assert.strictEqual(result.estimatedSavings, 0);
  assert.deepStrictEqual(result.perTurnHitRate, []);
  console.log("✓ empty turns");
}

// Test 2: single turn with cache read
{
  const turns = [makeTurn({id: 1, input: 1000, cacheR: 2000, cacheC: 500})];
  const result = computeCacheMetrics(turns);
  assert.strictEqual(result.totalCacheR, 2000);
  assert.strictEqual(result.totalCacheC, 500);
  assert.strictEqual(result.totalInput, 1000);
  assert.strictEqual(result.hitRate, 2000 / 3000);
  assert.strictEqual(result.efficiencyRatio, 2000 / 500);
  assert.ok(result.estimatedSavings > 0);
  assert.deepStrictEqual(result.perTurnHitRate, [{turnId: 1, rate: 2000 / 3000}]);
  console.log("✓ single turn with cache read");
}

// Test 3: multiple turns accumulate correctly
{
  const turns = [
    makeTurn({id: 1, input: 1000, cacheR: 2000, cacheC: 500}),
    makeTurn({id: 2, input: 500, cacheR: 0, cacheC: 0}),
  ];
  const result = computeCacheMetrics(turns);
  assert.strictEqual(result.totalCacheR, 2000);
  assert.strictEqual(result.totalCacheC, 500);
  assert.strictEqual(result.totalInput, 1500);
  assert.strictEqual(result.hitRate, 2000 / 3500);
  console.log("✓ multiple turns accumulate correctly");
}

// Test 4: per-turn hit rate with zero denominator
{
  const turns = [makeTurn({id: 1, input: 0, cacheR: 0, cacheC: 100})];
  const result = computeCacheMetrics(turns);
  assert.strictEqual(result.perTurnHitRate[0].rate, 0);
  console.log("✓ per-turn hit rate with zero denominator");
}

console.log("\nAll cache metrics tests passed!");
```

- [ ] **Step 3: 运行测试**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
node test/test-analytics-cache.js
```
Expected: 全部通过。

- [ ] **Step 4: Commit**

```bash
git add test/test-analytics-cache.js
git commit -m "test(token-reporter): add cache metrics tests"
```

---

### Task 2：为 `computeToolEfficiency` 编写测试

**Files:**
- Create: `plugins/token-reporter/test/test-analytics-tools.js`
- Read: `plugins/token-reporter/frontend/src/utils/analytics.ts:48-171`

- [ ] **Step 1: 确认前端构建产物可用**

同上 Task 1 Step 1。

- [ ] **Step 2: 编写 tool efficiency 测试**

Create `plugins/token-reporter/test/test-analytics-tools.js`:

```javascript
"use strict";
const assert = require("assert");
const { computeToolEfficiency } = require("../frontend/dist/utils/analytics.js");

function makeTurn(overrides) {
  return {
    id: 1,
    input: 0,
    output: 0,
    cacheR: 0,
    cacheC: 0,
    model: "claude-sonnet-4-6",
    tools: [],
    ...overrides,
  };
}

function makeTool(overrides) {
  return {
    name: "read",
    cls: "read",
    input: [{k: "file_path", v: "/tmp/test.js"}],
    output: "content",
    retSize: "10 B",
    retLines: "1 line",
    isErr: false,
    dur: "—",
    ...overrides,
  };
}

// Test 1: empty turns
{
  const result = computeToolEfficiency([]);
  assert.strictEqual(result.totalCalls, 0);
  assert.strictEqual(result.totalErrors, 0);
  assert.strictEqual(result.errorRate, 0);
  assert.deepStrictEqual(result.redundantGroups, []);
  assert.deepStrictEqual(result.largeCalls, []);
  console.log("✓ empty turns");
}

// Test 2: basic counts and error rate
{
  const turns = [
    makeTurn({id: 1, tools: [
      makeTool({name: "read", cls: "read"}),
      makeTool({name: "bash", cls: "bash", isErr: true}),
    ]}),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.totalCalls, 2);
  assert.strictEqual(result.totalErrors, 1);
  assert.strictEqual(result.errorRate, 0.5);
  assert.strictEqual(result.errorsByClass.read.total, 1);
  assert.strictEqual(result.errorsByClass.bash.total, 1);
  assert.strictEqual(result.errorsByClass.bash.errors, 1);
  console.log("✓ basic counts and error rate");
}

// Test 3: redundant detection with identical outputs
{
  const turns = [
    makeTurn({id: 1, tools: [makeTool({output: "same content"})]}),
    makeTurn({id: 2, tools: [makeTool({output: "same content"})]}),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.redundantGroups.length, 1);
  assert.strictEqual(result.redundantGroups[0].count, 2);
  console.log("✓ redundant detection with identical outputs");
}

// Test 4: redundant detection should NOT flag diverging outputs beyond 200 chars
{
  const prefix = "a".repeat(200);
  const turns = [
    makeTurn({id: 1, tools: [makeTool({output: prefix + "-suffix-1"})]}),
    makeTurn({id: 2, tools: [makeTool({output: prefix + "-suffix-2"})]}),
  ];
  const result = computeToolEfficiency(turns);
  // This documents the CURRENT behavior (false positive) — will be fixed in later task
  assert.strictEqual(result.redundantGroups.length, 1);
  console.log("✓ redundant detection 200-char truncation behavior documented");
}

// Test 5: large calls detection (>50KB)
{
  const turns = [
    makeTurn({id: 1, tools: [makeTool({retSize: "60 KB"})]}),
  ];
  const result = computeToolEfficiency(turns);
  assert.strictEqual(result.largeCalls.length, 1);
  assert.strictEqual(result.largeCalls[0].retBytes, 60 * 1024);
  console.log("✓ large calls detection");
}

console.log("\nAll tool efficiency tests passed!");
```

- [ ] **Step 3: 运行测试**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
node test/test-analytics-tools.js
```
Expected: 全部通过。

- [ ] **Step 4: Commit**

```bash
git add test/test-analytics-tools.js
git commit -m "test(token-reporter): add tool efficiency tests"
```

---

### Task 3：修复 R18 (Bloated Prompt) 推荐规则逻辑

**Files:**
- Modify: `plugins/token-reporter/frontend/src/utils/analytics.ts:1085-1097`
- Read: `plugins/token-reporter/frontend/src/utils/analytics.ts:675-739`（prompt metrics）

**问题分析：**
当前 R18：
```ts
if (prompt && prompt.longestPromptChars > 2000) {
  const turn = prompt.promptTrend.find((p) => p.turnId === prompt.longestPromptTurn);
  if (turn && turn.outputTokens < turn.inputTokens * 0.1) {
    // trigger bloated-prompt recommendation
  }
}
```
`turn.inputTokens` 是 API 报告的 `input_tokens`，包含全上下文历史。对于长会话后期，这个值很大，导致 `outputTokens < inputTokens * 0.1` 几乎恒成立。

**修复方案：** 改用用户 prompt 的估算 token 数 `turn.tokens`（即 `chars / 4`）作为输入长度基准。这个指标更接近"用户本次输入的长度"，而非全上下文长度。

修改后逻辑：
```ts
if (prompt && prompt.longestPromptChars > 2000) {
  const turn = prompt.promptTrend.find((p) => p.turnId === prompt.longestPromptTurn);
  if (turn && turn.outputTokens < turn.tokens * 0.1) {
    // trigger bloated-prompt recommendation
  }
}
```

- [ ] **Step 1: 修改 analytics.ts 中的 R18 逻辑**

Edit `plugins/token-reporter/frontend/src/utils/analytics.ts` line ~1088:

Old:
```ts
    if (turn && turn.outputTokens < turn.inputTokens * 0.1) {
```

New:
```ts
    if (turn && turn.outputTokens < turn.tokens * 0.1) {
```

- [ ] **Step 2: 重新构建前端**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend
npm run build
```
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/analytics.ts frontend/dist/
git commit -m "fix(token-reporter): use estimated prompt tokens instead of full context input for R18 bloated-prompt rule"
```

---

### Task 4：为 `generateRecommendations` 编写集成测试

**Files:**
- Create: `plugins/token-reporter/test/test-analytics-recommendations.js`
- Read: `plugins/token-reporter/frontend/src/utils/analytics.ts:864-1175`

**测试策略：** 由于 `generateRecommendations` 依赖 `t: TFunction`，测试中需要传入一个 mock translate 函数。

- [ ] **Step 1: 编写 mock t 函数和推荐测试**

Create `plugins/token-reporter/test/test-analytics-recommendations.js`:

```javascript
"use strict";
const assert = require("assert");
const { generateRecommendations } = require("../frontend/dist/utils/analytics.js");

function mockT(key, vars) {
  let s = key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

function makeInput(overrides) {
  return {
    cache: {
      totalCacheR: 0,
      totalCacheC: 0,
      totalInput: 0,
      hitRate: 0,
      efficiencyRatio: 0,
      estimatedSavings: 0,
      perTurnHitRate: [],
    },
    tools: {
      totalCalls: 0,
      totalErrors: 0,
      errorRate: 0,
      errorsByClass: {},
      redundantGroups: [],
      largeCalls: [],
      mcpTurnPct: 0,
    },
    context: {points: [], compactEvents: [], avgGrowthPerTurn: 0},
    subagent: {
      mainTokens: {input: 0, output: 0, cacheR: 0, cacheC: 0, cost: 0, turns: 0},
      agents: [],
      totalSubagentCost: 0,
      subagentCostPct: 0,
    },
    cost: {total: 0, byType: {input: 0, output: 0, cacheRead: 0, cacheCreation: 0}, perTurn: [], avgPerTurn: 0, maxTurnIdx: 0, maxTurnCost: 0},
    modelBreakdown: {models: [], modelSwitches: 0, dominantModel: "", dominantModelId: ""},
    thinking: {turnsWithThinking: 0, turnsTotal: 0, thinkingPct: 0, totalThinkingChars: 0, avgThinkingLength: 0, estimatedThinkingTokens: 0, estimatedThinkingCost: 0, perTurn: []},
    sidechain: {mainTurns: 0, sidechainTurns: 0, sidechainPct: 0, mainCost: 0, sidechainCost: 0, sidechainCostPct: 0, sidechainToolCounts: {}},
    timing: {sessionDurationMs: 0, totalToolDurationMs: 0, avgTurnIntervalMs: 0, idleTimeMs: 0, idlePct: 0, costPerMinute: 0, toolDurByClass: {}, slowestTools: [], turnIntervals: []},
    mcp: {totalMcpCalls: 0, totalMcpErrors: 0, mcpPct: 0, avgMcpDurationMs: 0, byServer: {}, totalCalls: 0, turnUsage: []},
    prompt: {avgUserLength: 0, avgUserTokens: 0, inputOutputRatio: 0, shortPromptStreak: 0, longestPromptTurn: -1, longestPromptChars: 0, promptTrend: []},
    pressure: {peakTokens: 0, peakTurnId: -1, compactionCount: 0, avgTurnsBetweenCompact: 0, highSpikeTurns: [], growthRatePer10Turns: 0, estimatedTurnsToLimit: null},
    files: {topReads: [], readEditRatio: 0, totalReadFiles: 0, totalEditFiles: 0, bloatedGreps: [], unreadReads: []},
    ...overrides,
  };
}

// Test 1: empty input returns no recommendations
{
  const recs = generateRecommendations(makeInput(), mockT);
  assert.deepStrictEqual(recs, []);
  console.log("✓ empty input returns no recommendations");
}

// Test 2: R12 - Opus simple tasks
{
  const input = makeInput({
    modelBreakdown: {
      models: [{
        model: "claude-opus-4-6",
        displayName: "Opus",
        turns: 10,
        tokens: {input: 1000, output: 3000, cacheR: 0, cacheC: 0},
        cost: 1.0,
        costPct: 1,
        avgCostPerTurn: 0.1,
        avgOutputPerTurn: 300, // < 500 threshold
      }],
      modelSwitches: 0,
      dominantModel: "Opus",
      dominantModelId: "claude-opus-4-6",
    },
  });
  const recs = generateRecommendations(input, mockT);
  const r12 = recs.find((r) => r.id === "opus-simple-tasks");
  assert.ok(r12, "R12 should trigger for Opus with avgOutputPerTurn < 500");
  assert.strictEqual(r12.severity, "medium");
  console.log("✓ R12 Opus simple tasks triggers correctly");
}

// Test 3: R18 - Bloated prompt (FIXED logic)
{
  const input = makeInput({
    prompt: {
      avgUserLength: 100,
      avgUserTokens: 25,
      inputOutputRatio: 0.05,
      shortPromptStreak: 0,
      longestPromptTurn: 3,
      longestPromptChars: 3000,
      promptTrend: [
        {turnId: 1, chars: 10, tokens: 3, inputTokens: 100, outputTokens: 50, ratio: 2},
        {turnId: 2, chars: 20, tokens: 5, inputTokens: 200, outputTokens: 100, ratio: 2},
        {turnId: 3, chars: 3000, tokens: 750, inputTokens: 5000, outputTokens: 30, ratio: 166.7},
      ],
    },
  });
  const recs = generateRecommendations(input, mockT);
  const r18 = recs.find((r) => r.id === "bloated-prompt");
  assert.ok(r18, "R18 should trigger when outputTokens < tokens * 0.1");
  // 30 < 750 * 0.1 = 75  → should trigger
  console.log("✓ R18 bloated prompt triggers with fixed logic");
}

// Test 4: R18 should NOT trigger when output is proportional to prompt tokens
{
  const input = makeInput({
    prompt: {
      avgUserLength: 100,
      avgUserTokens: 25,
      inputOutputRatio: 0.05,
      shortPromptStreak: 0,
      longestPromptTurn: 3,
      longestPromptChars: 3000,
      promptTrend: [
        {turnId: 3, chars: 3000, tokens: 750, inputTokens: 5000, outputTokens: 500, ratio: 10},
      ],
    },
  });
  const recs = generateRecommendations(input, mockT);
  const r18 = recs.find((r) => r.id === "bloated-prompt");
  assert.strictEqual(r18, undefined, "R18 should NOT trigger when outputTokens >= tokens * 0.1");
  console.log("✓ R18 correctly suppressed when output is proportional to prompt tokens");
}

// Test 5: R18 should NOT trigger for short prompts
{
  const input = makeInput({
    prompt: {
      avgUserLength: 100,
      avgUserTokens: 25,
      inputOutputRatio: 0.05,
      shortPromptStreak: 0,
      longestPromptTurn: 1,
      longestPromptChars: 500, // <= 2000 threshold
      promptTrend: [
        {turnId: 1, chars: 500, tokens: 125, inputTokens: 1000, outputTokens: 10, ratio: 100},
      ],
    },
  });
  const recs = generateRecommendations(input, mockT);
  const r18 = recs.find((r) => r.id === "bloated-prompt");
  assert.strictEqual(r18, undefined, "R18 should NOT trigger for prompts <= 2000 chars");
  console.log("✓ R18 correctly suppressed for short prompts");
}

console.log("\nAll recommendation tests passed!");
```

- [ ] **Step 2: 运行测试**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
node test/test-analytics-recommendations.js
```
Expected: 全部通过。

- [ ] **Step 3: Commit**

```bash
git add test/test-analytics-recommendations.js
git commit -m "test(token-reporter): add recommendation engine tests covering R12 and fixed R18"
```

---

## 阶段 2：改进估算指标与命名/语义问题

### Task 5：重命名 `mcpTokenPct` → `mcpTurnPct`

**Files:**
- Modify: `plugins/token-reporter/frontend/src/utils/analytics.ts:64`, `:169`
- Modify: `plugins/token-reporter/frontend/src/components/Analytics/ToolsPanel/ToolsPanel.tsx`（查找引用）
- Modify: `plugins/token-reporter/frontend/src/components/Analytics/SummaryPanel/SummaryPanel.tsx`（如引用）

- [ ] **Step 1: 查找所有 `mcpTokenPct` 引用**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
grep -r "mcpTokenPct" frontend/src/
```

- [ ] **Step 2: 修改 analytics.ts 中的定义和返回字段**

Edit `frontend/src/utils/analytics.ts`:

Line ~64 (ToolEfficiency interface):
Old:
```ts
  mcpTokenPct: number;
```
New:
```ts
  mcpTurnPct: number;
```

Line ~169 (return statement in computeToolEfficiency):
Old:
```ts
    mcpTokenPct: turns.length > 0 ? mcpTurns / turns.length : 0,
```
New:
```ts
    mcpTurnPct: turns.length > 0 ? mcpTurns / turns.length : 0,
```

- [ ] **Step 3: 修改所有前端组件引用**

根据 grep 结果，将所有 `mcpTokenPct` 替换为 `mcpTurnPct`。

- [ ] **Step 4: 重新构建前端**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "refactor(token-reporter): rename mcpTokenPct to mcpTurnPct for accuracy"
```

---

### Task 6：明确 `readEditRatio` 语义并补充操作量指标

**Files:**
- Modify: `plugins/token-reporter/frontend/src/utils/analytics.ts:751-835`
- Modify: `plugins/token-reporter/frontend/src/types/state.ts`（FileMetrics 类型）
- Modify: `plugins/token-reporter/frontend/src/components/Analytics/FilesPanel/FilesPanel.tsx`
- Modify: `plugins/token-reporter/frontend/src/i18n/locales/en.ts`
- Modify: `plugins/token-reporter/frontend/src/i18n/locales/zh-CN.ts`

**分析：**
当前 `readEditRatio = editSet.size > 0 ? readMap.size / editSet.size : readMap.size`，这是 unique files 的覆盖比。用户可能误解为"读了多少次才编辑一次"。

**方案：**
1. 保留 `readEditRatio`（unique files 比），但 UI 显示时加上说明
2. 新增 `totalReadOps` 和 `totalEditOps` 表示实际操作次数

- [ ] **Step 1: 扩展 FileMetrics 类型和计算逻辑**

Edit `frontend/src/types/state.ts`（查找 FileMetrics 相关类型，若内联在 analytics.ts 则直接修改 analytics.ts）。

假设 `FileMetrics` 定义在 `analytics.ts` line ~751-758，修改如下：

Old:
```ts
export interface FileMetrics {
  topReads: FileReadEntry[];
  readEditRatio: number;
  totalReadFiles: number;
  totalEditFiles: number;
  bloatedGreps: {pattern: string; glob: string; retLines: number; turnId: number}[];
  unreadReads: FileReadEntry[];
}
```

New:
```ts
export interface FileMetrics {
  topReads: FileReadEntry[];
  readEditRatio: number; // unique read files / unique edit files (coverage ratio)
  totalReadFiles: number;
  totalEditFiles: number;
  totalReadOps: number;  // total read tool invocations
  totalEditOps: number;  // total edit + write tool invocations
  bloatedGreps: {pattern: string; glob: string; retLines: number; turnId: number}[];
  unreadReads: FileReadEntry[];
}
```

Edit `frontend/src/utils/analytics.ts` line ~784-835 (`computeFileMetrics`):

在函数开头增加计数器：
```ts
  let totalReadOps = 0;
  let totalEditOps = 0;
```

在循环中计数：
```ts
      if (tool.cls === 'read') {
        totalReadOps++;
        // ... existing read logic
      }
      if (tool.cls === 'edit' || tool.cls === 'write') {
        totalEditOps++;
        // ... existing edit logic
      }
```

在 return 中增加：
```ts
    totalReadOps,
    totalEditOps,
```

- [ ] **Step 2: 修改 FilesPanel 显示逻辑**

Read `frontend/src/components/Analytics/FilesPanel/FilesPanel.tsx`，找到 `readEditRatio` 的显示位置。

修改显示为：
```tsx
<div>
  <span>{t('files.readEditRatio')}: {files.readEditRatio.toFixed(1)}</span>
  <span className={styles.hint}> ({t('files.uniqueFilesHint')})</span>
</div>
<div>
  <span>{t('files.readEditOps')}: {files.totalReadOps} / {files.totalEditOps}</span>
</div>
```

（若 UI 结构不同，请适配现有组件结构，保持风格一致。）

- [ ] **Step 3: 添加 i18n 翻译**

Edit `frontend/src/i18n/locales/en.ts`，在 `files` 命名空间下添加：
```ts
  files: {
    // ... existing keys
    readEditOps: 'Read / Edit Operations',
    uniqueFilesHint: 'unique files',
  }
```

Edit `frontend/src/i18n/locales/zh-CN.ts`：
```ts
  files: {
    // ... existing keys
    readEditOps: '读 / 写 操作次数',
    uniqueFilesHint: '基于唯一文件数',
  }
```

- [ ] **Step 4: 重新构建前端并运行测试**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend
npm run build
cd ..
node test/test-file-metrics.js
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat(token-reporter): add totalReadOps/totalEditOps to file metrics and clarify readEditRatio semantics"
```

---

### Task 7：为估算指标增加 "Estimated" UI 标注

**Files:**
- Modify: `plugins/token-reporter/frontend/src/i18n/locales/en.ts`
- Modify: `plugins/token-reporter/frontend/src/i18n/locales/zh-CN.ts`
- Modify: 以下面板组件（查找标题/标签位置）：
  - `frontend/src/components/Analytics/CachePanel/CachePanel.tsx`
  - `frontend/src/components/Analytics/ThinkingPanel/ThinkingPanel.tsx`
  - `frontend/src/components/Analytics/PromptPanel/PromptPanel.tsx`
  - `frontend/src/components/Analytics/ContextPanel/ContextPanel.tsx`

**分析：**
需要标注的估算指标：
- **Context Growth**: `computeContextGrowth` 中的 cumulative context 是估算值
- **Thinking Tokens**: `estimatedThinkingTokens` 基于 `chars / 4`
- **Prompt Tokens**: `avgUserTokens` 基于 `chars / 4`

Cache 的 `estimatedSavings` 虽然带 "estimated" 前缀，但 UI 可能未明确提示，也可以一并加上标注。

**方案：** 在相关面板的标题或数值旁增加 `(Estimated)` / `(估算)` 提示，通过 i18n 管理。

- [ ] **Step 1: 添加 i18n 键**

Edit `frontend/src/i18n/locales/en.ts`：
```ts
  common: {
    // ... existing keys
    estimated: '(Estimated)',
  }
```

Edit `frontend/src/i18n/locales/zh-CN.ts`：
```ts
  common: {
    // ... existing keys
    estimated: '(估算值)',
  }
```

- [ ] **Step 2: 修改各面板组件**

对每个面板组件，找到对应的标题/标签，追加 `t('common.estimated')`。

示例（以 ThinkingPanel 为例）：
```tsx
// 原标题
<h3>{t('thinking.estimatedTokens')}</h3>
// 修改为
<h3>{t('thinking.estimatedTokens')} {t('common.estimated')}</h3>
```

需要对以下指标追加标注：
1. **ContextPanel**: "Cumulative Context" / "上下文累积增长"
2. **ThinkingPanel**: "Estimated Thinking Tokens" / "思考 Token 估算"
3. **PromptPanel**: "Avg User Tokens" / "平均输入 Token"
4. **CachePanel**: "Estimated Savings" / "预估节省金额"

（若组件中这些文本的 i18n key 不同，请根据实际代码调整。）

- [ ] **Step 3: 重新构建前端**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat(token-reporter): add estimated labels to context growth, thinking tokens, prompt tokens and cache savings"
```

---

## 阶段 3：定价表维护与数据准确性

### Task 8：更新 `cost.ts` 定价表并增加未知模型警告

**Files:**
- Modify: `plugins/token-reporter/frontend/src/utils/cost.ts`
- Read: Anthropic 最新定价文档（若本地无信息则通过 WebSearch 查询）

- [ ] **Step 1: 查询 Anthropic 2026 年最新定价**

Run:
```bash
# 或者使用 WebSearch 工具查询
```
使用 WebSearch 查询 "Anthropic Claude API pricing 2026" 或 "Claude model pricing April 2026"。

- [ ] **Step 2: 更新 pricing 表**

Edit `frontend/src/utils/cost.ts`：

在 `PRICING` 中补充最新模型。例如若存在 `claude-sonnet-4-7` 等新模型，添加对应条目。

同时修改 `getModelPricing`：

Old:
```ts
export function getModelPricing(model: string): ModelPricing {
  if (PRICING[model]) return PRICING[model];
  const key = Object.keys(PRICING).find((k) => model.startsWith(k) || model.includes(k));
  if (key) return PRICING[key]!;
  if (model.includes('opus')) return PRICING['claude-opus-4-6']!;
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5-20251001']!;
  return DEFAULT_PRICING;
}
```

New:
```ts
export function getModelPricing(model: string): ModelPricing {
  if (PRICING[model]) return PRICING[model];
  const key = Object.keys(PRICING).find((k) => model.startsWith(k) || model.includes(k));
  if (key) return PRICING[key]!;
  if (model.includes('opus')) return PRICING['claude-opus-4-6']!;
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5-20251001']!;
  // Warn about unknown models so users know the cost estimate may be inaccurate
  if (typeof console !== 'undefined') {
    console.warn(`[token-reporter] Unknown model "${model}", falling back to Sonnet pricing. Cost estimate may be inaccurate.`);
  }
  return DEFAULT_PRICING;
}
```

- [ ] **Step 3: 重新构建前端**

Run:
```bash
cd /Users/df2025/github/df-market/plugins-token-reporter/frontend
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/cost.ts frontend/dist/
git commit -m "feat(token-reporter): update model pricing table and add warning for unknown models"
```

---

### Task 9：改进子代理成本计算，使用实际 turn 级模型

**Files:**
- Modify: `plugins/token-reporter/frontend/src/utils/analytics.ts:295-341`
- Read: `plugins/token-reporter/frontend/src/types/state.ts`（SubagentStats 类型）

**分析：**
当前 `computeSubagentEfficiency`：
```ts
const model = sa.turns[0]?.model ?? 'claude-haiku-4-5-20251001';
const p = getModelPricing(model);
const tk = sa.totalTokens;
const cost = (tk.input * p.input + tk.output * p.output + tk.cacheR * p.cacheRead + tk.cacheC * p.cacheCreation) / 1_000_000;
```

问题：子代理可能使用多种模型，但当前只用首 turn 的模型定价计算全部 token 成本。

**修复方案：** 逐 turn 计算成本再求和，而不是用单一模型定价乘以总 token。

- [ ] **Step 1: 修改 computeSubagentEfficiency**

Edit `frontend/src/utils/analytics.ts` line ~311-318：

Old:
```ts
    // Estimate cost from subagent token counts using haiku pricing as default for subagents
    const model = sa.turns[0]?.model ?? 'claude-haiku-4-5-20251001';
    const p = getModelPricing(model);
    const tk = sa.totalTokens;
    const cost =
      (tk.input * p.input + tk.output * p.output + tk.cacheR * p.cacheRead + tk.cacheC * p.cacheCreation) / 1_000_000;
```

New:
```ts
    // Calculate cost per-turn to handle model switching within subagents
    let cost = 0;
    for (const t of sa.turns) {
      cost += computeTurnCost(t);
    }
```

- [ ] **Step 2: 重新构建前端**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/analytics.ts frontend/dist/
git commit -m "fix(token-reporter): compute subagent cost per-turn to support model switching"
```

---

## 阶段 4：回归验证与提交

### Task 10：运行全部测试

- [ ] **Step 1: 运行所有测试**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
node test/test-parser.js
node test/test-file-metrics.js
node test/test-mcp-metrics.js
node test/test-pressure-metrics.js
node test/test-prompt-metrics.js
node test/test-analytics-cache.js
node test/test-analytics-tools.js
node test/test-analytics-recommendations.js
```
Expected: 全部通过。

- [ ] **Step 2: 更新计划 Progress**

标记 Task 10 完成，记录测试通过状态。

---

### Task 11：构建前端并确认无错误

- [ ] **Step 1: 前端构建**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter/frontend
npm run build
```
Expected: 0 errors, 0 warnings（或仅有不相关的警告）。

- [ ] **Step 2: 检查 dist 产物是否已更新**

确认 `frontend/dist/` 中有更新的时间戳。

- [ ] **Step 3: 更新计划 Progress**

标记 Task 11 完成。

---

### Task 12：按规范提交并更新版本

- [ ] **Step 1: 检查是否需要 bump 版本**

Run:
```bash
cd /Users/df2025/github/df-market/plugins/token-reporter
node scripts/check-version.js
```

若提示需要更新：
```bash
node scripts/bump-version.js patch
```

- [ ] **Step 2: 确认所有修改已提交**

Run:
```bash
git status
```
Expected: 干净。

- [ ] **Step 3: 最终 commit（如有未提交的 dist 或版本变更）**

```bash
git add -A
git commit -m "chore(token-reporter): bump version after analysis improvements"
```

- [ ] **Step 4: 更新计划最终状态**

在 Progress 顶部标记：
```
**状态**：🟢 全部完成
**最后更新**：2026-04-15（Task 12 完成）
```

---

## Verification

- [ ] `computeCacheMetrics` 测试覆盖空输入、单 turn、多 turn、零分母场景
- [ ] `computeToolEfficiency` 测试覆盖计数、错误率、冗余检测、大返回检测
- [ ] R18 规则使用 `turn.tokens` 而非 `turn.inputTokens` 作为判断基准
- [ ] `generateRecommendations` 测试覆盖 R12 触发、R18 触发与抑制场景
- [ ] `mcpTokenPct` 在全代码库中零引用，`mcpTurnPct` 替换完成
- [ ] `FileMetrics` 包含 `totalReadOps` 和 `totalEditOps`，FilesPanel 正确显示
- [ ] Context/Thinking/Prompt/Cache 面板中的估算指标带有 "(Estimated)" / "(估算值)" 标注
- [ ] `cost.ts` 包含最新模型定价，未知模型有 console.warn
- [ ] 子代理成本按 turn 级模型计算
- [ ] 全部现有测试 + 新增测试通过
- [ ] 前端构建成功无错误
- [ ] 版本号已更新（如需要）

---

## Risk & 已知债

1. **前端构建产物 `dist/` 与源码不同步**：本计划多次修改 TS 源码并重新构建。若用户环境构建失败，需优先解决构建问题再继续后续 task。
2. **i18n 键可能冲突**：添加新翻译键时若 `files` / `common` 命名空间下已存在同名键，需合并而非覆盖。
3. **子代理 turn 级成本计算性能**：子代理 turn 数通常较少（<1000），逐 turn `computeTurnCost` 的性能影响可忽略。
4. **未修复的问题（本计划范围外）**：
   - 冗余检测仍使用 200 字符截断（已在 Task 2 测试中记录当前行为，全面修复需额外设计）
   - R12 阈值 500 tokens 仍偏主观
   - Context Growth 仍为估算值（已通过 UI 标注缓解）
