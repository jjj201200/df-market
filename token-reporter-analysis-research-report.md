# Token-Reporter 分析功能调研报告

**调研日期**: 2026-04-15  
**插件版本**: 基于 `plugins/token-reporter` 当前主分支代码  
**调研范围**: 数据解析层、指标计算层、前端展示层、推荐引擎、测试覆盖度

---

## 一、执行摘要

Token-Reporter 是一款 Claude Code 会话分析插件，通过解析本地 JSONL 会话日志，提供 10 个维度的分析面板和 24 条规则驱动的推荐引擎。整体架构清晰，数据流完整，但在**部分指标存在估算偏差、推荐规则阈值偏主观、测试覆盖不均**等方面存在改进空间。

**总体评级**:
- **准确性**: 7.5/10（核心 token 计数准确，部分指标为估算值）
- **逻辑完整性**: 8/10（数据流闭环，但存在少量边界处理缺陷）
- **分析全面性**: 8.5/10（覆盖 cache、tools、context、cost、timing、MCP 等 10 个维度）

---

## 二、架构与数据流

### 2.1 数据流路径

```
~/.claude/projects/*/*.jsonl
        ↓
backend/parser.js          ← JSONL 解析、turn 构造、tool 结果映射
        ↓
backend/server.js          ← REST API / SSE 实时推送
        ↓
frontend/src/services/adapter.ts   ← API 响应 → 前端状态
        ↓
frontend/src/utils/analytics.ts    ← 10 大指标计算 + 24 条推荐
        ↓
frontend/src/components/Analytics/ ← React 可视化面板
```

### 2.2 核心文件职责

| 文件 | 职责 | 关键度 |
|------|------|--------|
| `backend/parser.js` | 会话日志解析、turn 合并、子代理统计 | ★★★★★ |
| `backend/server.js` | HTTP 服务、API 路由、SSE 广播 | ★★★★☆ |
| `frontend/src/utils/analytics.ts` | 全部指标计算与推荐引擎 | ★★★★★ |
| `frontend/src/utils/cost.ts` | 模型定价表与成本计算 | ★★★★★ |
| `frontend/src/services/adapter.ts` | 后端数据 → 前端状态转换 | ★★★★☆ |

---

## 三、准确性评估

### 3.1 高准确性项

| 指标 | 准确性 | 说明 |
|------|--------|------|
| **Token 使用量** | 高 | 直接读取 Anthropic API 返回的 `usage` 字段，来源可靠 |
| **成本计算** | 高 | 基于精确 token 数 × 定价表，计算逻辑无误 |
| **Tool 调用分类** | 高 | `toolNameToCls()` 覆盖 bash/read/edit/write/grep/glob/web/agent/mcp/other |
| **子代理解析** | 高 | 复用 `parseSession()` 逻辑，保证主会话/子代理一致性 |
| **MCP 工具识别** | 高 | `parseMcpToolName()` 正确拆分 `mcp__server__method` 格式 |

### 3.2 存在估算偏差项

| 指标 | 偏差来源 | 影响程度 |
|------|----------|----------|
| **Context Growth** | 用 `input + cacheC + output` 近似上下文增长，未计入 system prompt、tool 结果截断、实际 compaction 行为 | 中 |
| **Thinking Tokens** | `chars / 4` 启发式估算，Anthropic 未暴露真实 thinking token 数 | 中 |
| **子代理成本** | 默认使用首 turn 模型或 Haiku 定价，若子代理切换模型则成本失真 | 中 |
| **Tool 耗时** | `tool_result.timestamp - tool_use.timestamp`，包含网络延迟、客户端等待，非纯执行时间 | 低-中 |
| **Prompt Tokens** | 用户输入长度按 `chars / 4` 估算，与实际 tokenizer 差异较大 | 低 |
| **Idle 时间** | 阈值固定 60s，可能将长 API 响应或用户思考误判为 idle | 低 |

### 3.3 定价表现状

`frontend/src/utils/cost.ts` 当前维护的定价：

- `claude-sonnet-4-6`: $3 / $15 / $0.3 / $3.75
- `claude-opus-4-6`: $15 / $75 / $1.5 / $18.75
- `claude-haiku-4-5-20251001`: $0.8 / $4 / $0.08 / $1

**风险**: 新模型发布时若未同步更新 `PRICING` 表，未知模型会回退到 Sonnet 定价，可能导致成本显著失真。

---

## 四、逻辑完整性评估

### 4.1 Parser 层 (`backend/parser.js`)

#### 优点
- 处理了多种 Claude Code 格式演进：
  - 旧版 `system/local_command`
  - 新版 `type:user` 字符串包装（slash command、bash input/output）
  - `attachment` 链式查找（`findParentUser`）
- Tool 结果内容提取 robust：支持 string、array-of-text、JSON fallback
- Turn 合并逻辑处理多段 assistant 响应：`shouldMerge` 检测同 userText 的连续 assistant 记录

#### 发现的缺陷

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| 1 | **Sidechain 合并风险** | `shouldMerge` 未显式检查 `isSidechain`，理论上 sidechain assistant 可能与主链 turn 合并（若 userText 相同/为空） | 低 |
| 2 | **Compact 事件时间戳映射** | `computeContextGrowth` 用 `<=` 查找最近 turn，若 compact 发生在最后 turn 之后会映射到最后一个 index，可能产生视觉误导 | 低 |
| 3 | **空会话处理** | `parseSession` 返回 `null`，前端显示 "No session data loaded"，处理正确 | 无 |
| 4 | **缺失 parentUuid** | `findParentUser` 返回 `null` 时 `userText` 为空，不影响后续计算 | 无 |

### 4.2 Analytics 层 (`frontend/src/utils/analytics.ts`)

#### 优点
- 模块化设计：10 个 `computeXxxMetrics` 函数职责单一
- 推荐引擎 `generateRecommendations` 规则清晰，按 severity 排序
- 冗余 tool 检测通过 `cls::keyParam` 分组 + 前 200 字符输出比对

#### 发现的缺陷

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| 1 | **冗余检测精度不足** | 仅比较前 200 字符，开头相同但后续不同的输出会被误判为冗余 | 中 |
| 2 | **R12 (Opus 简单任务)** | `avgOutputPerTurn < 500` 阈值较武断，可能误标复杂推理 | 低 |
| 3 | **R18 (Bloated Prompt)** | `outputTokens < inputTokens * 0.1` 中 `inputTokens` 是 API 报告的全上下文输入（非仅用户 prompt），长会话后期易误触发 | 中 |
| 4 | **Pressure Metrics 短会话外推** | `< 10 turn` 时按 `((last-first)/points.length)*10` 外推 10 turn 增长率，样本过少时结果不可靠 | 低 |
| 5 | **readEditRatio 语义偏差** | 计算的是 "unique read files / unique edit files"，衡量的是文件覆盖度而非操作量 | 低 |
| 6 | **mcpTokenPct 命名误导** | `computeToolEfficiency` 中 `mcpTokenPct` 实际是 "含 MCP 的 turn 比例"，与 token 无关 | 低 |

### 4.3 测试覆盖度

#### 已通过的测试
```bash
node test/test-parser.js        # 12/12 passed
node test/test-file-metrics.js  # passed
node test/test-mcp-metrics.js   # passed
node test/test-pressure-metrics.js # passed
node test/test-prompt-metrics.js   # passed
```

#### 测试覆盖缺口

| 模块 | 是否有测试 | 备注 |
|------|-----------|------|
| `computeCacheMetrics` | ❌ | 无 |
| `computeToolEfficiency` | ❌ | 无 |
| `computeContextGrowth` | ❌ | 无 |
| `computeSubagentEfficiency` | ❌ | 无 |
| `computeModelBreakdown` | ❌ | 无 |
| `computeThinkingMetrics` | ❌ | 无 |
| `computeSidechainMetrics` | ❌ | 无 |
| `computeTimingMetrics` | ❌ | 无 |
| `generateRecommendations` | ❌ | 无 |
| 前端 React 组件 | ❌ | 无 |

**注意**: `test-mcp-metrics.js` 中的测试实现与前端 `computeMcpMetrics` 存在差异（测试版缺少 per-method 细分），但测试本身通过，说明测试并未完全覆盖真实实现逻辑。

---

## 五、分析全面性评估

### 5.1 十大数据分析面板

| 面板 | 核心指标 | 评价 |
|------|----------|------|
| **Summary** | 总成本、总 token、cache 命中率、错误率、5 大洞察、Top 5 推荐 | 信息密度高，适合快速概览 |
| **Overview** | 成本构成饼图、工具分布柱状图、模型细分、stop reason、cache TTL、全部推荐 | 可视化丰富 |
| **Cache** | 命中率、效率比、预估节省金额、逐 turn 命中率折线图 | 全面 |
| **Tools** | 总调用数、错误率、冗余分组、大返回 (>50KB)、按类错误率、sidechain 工具分析 | 全面 |
| **Context** | 上下文累积增长面积图、每 turn 增量、compact 事件、峰值、高压 turn | 全面 |
| **Subagents** | 主会话 vs 子代理成本、各子代理 token/成本明细、每 turn token | 全面 |
| **Timing** | 会话时长、每分钟成本、idle 占比、平均 turn 间隔、总工具耗时、逐 turn 间隔图、最慢工具 | 全面 |
| **MCP** | MCP 调用占比、错误率、平均耗时、按 server/method 统计、逐 turn MCP 使用清单 | 全面 |
| **Prompt** | 平均输入长度/估算 token、I/O 比、短 prompt 连击、最长输入 turn、输入趋势图 | 较全面，但 token 为估算值 |
| **Files** | 读/写比、Top 读取文件、膨胀 grep (>100 行)、只读未编辑文件 | 较全面 |

### 5.2 推荐引擎 (24 条规则)

| 类别 | 规则数 | 覆盖场景 |
|------|--------|----------|
| Cache | 2 | 低命中率预警、高命中率正向反馈 |
| Tools | 6 | 高错误率、冗余调用、大返回、慢工具、重复读取、膨胀 grep、低编辑覆盖率 |
| Context | 4 | 频繁 compaction、高压、上下文 spike |
| Cost | 12 | 高输出占比、高子代理成本、高 idle、高 thinking 成本、Opus 简单任务、高 sidechain、高 MCP、碎片化 prompt、膨胀 prompt、模糊 prompt |

**评价**: 规则覆盖面广，但部分阈值（如 R12 的 500 tokens、R18 的 2000 chars、idle 的 60s）缺乏用户可配置性，且部分规则在长会话中易产生误报。

---

## 六、问题汇总与改进建议

### 6.1 高优先级

| 建议 | 原因 | 建议方案 |
|------|------|----------|
| **补全核心 analytics 测试** | 当前 50% 以上的核心计算函数无单元测试 | 为 `computeCacheMetrics`、`computeToolEfficiency`、`computeTimingMetrics`、`generateRecommendations` 等补充测试 |
| **修正 R18 规则逻辑** | `inputTokens` 包含全上下文，非用户 prompt 长度，长会话易误报 | 改用 `promptTrend.chars` 或 `promptTrend.tokens` 作为输入长度基准 |
| **改进冗余检测** | 200 字符截断比对会误判 | 增加哈希比对完整输出，或提高截断长度阈值 |

### 6.2 中优先级

| 建议 | 原因 | 建议方案 |
|------|------|----------|
| **Context Growth 增加免责声明** | 当前为估算值，用户可能误以为是精确值 | 在 UI 中标注 "Estimated" 或增加 tooltip 说明计算方式 |
| **Thinking Cost 增加免责声明** | `chars/4` 为粗略估算 | 同上，增加估算说明 |
| **模型定价表自动化更新** | 新模型发布时手动维护易遗漏 | 考虑从 Anthropic API 或文档自动同步定价 |
| **子代理成本使用实际模型** | 当前默认 Haiku 或首 turn 模型 | 在子代理 turn 级别记录模型并精确计算 |

### 6.3 低优先级

| 建议 | 原因 | 建议方案 |
|------|------|----------|
| **重命名 `mcpTokenPct`** | 命名与实际含义不符 | 改为 `mcpTurnPct` 或类似 |
| **明确 `readEditRatio` 语义** | 当前为 unique files 比，非操作量比 | 增加 tooltip 说明，或补充 `totalReads / totalEdits` 指标 |
| **推荐阈值可配置** | 固定阈值无法适应不同用户习惯 | 在设置中暴露关键阈值配置 |

---

## 七、结论

Token-Reporter 的分析功能在**架构设计、数据流完整性、分析维度覆盖**方面表现优秀，能够满足大多数用户的会话分析需求。核心 token 计数和成本计算逻辑准确可靠。

主要改进空间集中在：
1. **测试覆盖度不足** — 大量核心计算函数缺乏自动化测试
2. **部分指标为估算值** — Context Growth、Thinking Tokens、Prompt Tokens 等应向用户明确标注估算性质
3. **推荐引擎存在少量误报风险** — 尤其是 R18 (Bloated Prompt) 和 R12 (Opus Simple Tasks) 的阈值设计
4. **长期维护风险** — 模型定价表需随新模型发布同步更新

建议优先补全测试覆盖，其次修正 R18 规则逻辑并增加估算指标的 UI 提示。

---

*报告生成者: Claude Code*  
*生成时间: 2026-04-15*
