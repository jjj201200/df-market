# Token Reporter 分析功能增强设计文档

> 版本：v1.0  
> 日期：2026-04-14  
> 状态：设计阶段，待逐条实现并更新

---

## 1. 背景与目标

### 1.1 现有分析能力盘点

token-reporter 当前已具备 6 个分析面板：

| 面板 | 核心指标 | 数据来源 |
|------|---------|---------|
| Overview | 总成本、token 统计、模型分布、思考成本、stop reasons、cache TTL、智能推荐 | `turns`, `stopReasons`, `cacheTtl` |
| Cache | 命中率、效率比、节省金额、逐 turn 命中率趋势 | `turns` |
| Tools | 工具调用总数、错误率、冗余调用、大返回结果、sidechain 分析 | `turns` |
| Context | 上下文窗口增长、compaction 事件、逐 turn delta | `data`, `turns` |
| Subagents | 子代理成本占比、各子代理 token/cost 明细 | `subagents`, `turns` |
| Timing | 会话时长、空闲时间、工具耗时、hook 性能 | `turns`, `hooks` |

### 1.2 设计原则

1. **先增广度，再挖深度** — 第一批优先新增独立面板（新维度），后续再在各面板内增加细分指标。
2. **切实有用** — 每个新指标必须对应一个用户可执行的优化动作。
3. **按紧急/严重程度排序** — 优先实现与 Claude 官方最佳实践直接对应、降本增效最明显的功能。
4. **总览聚合** — 最终需要一个「Executive Summary」式总览面板，汇总各维度的高价值告警/建议。

---

## 2. 新增独立面板设计（按优先级排序）

### 2.1 面板一：MCP 开销分析 (`mcp`)

**优先级：P0（最高）**

**为什么重要：**
Claude 官方文档明确指出 MCP 工具定义会占用上下文空间，建议「禁用未使用的 servers」、「Prefer CLI tools when available」。目前 parser 已标记 MCP 工具，但缺乏专门分析。

**新增指标：**

| 指标 | 说明 | 优化动作 |
|------|------|---------|
| MCP 调用总次数 | 所有 `cls === 'mcp'` 的工具调用计数 | 评估是否过度依赖 MCP |
| MCP 占总工具调用比例 | `mcpCalls / totalCalls` | 比例过高时考虑替换为 CLI |
| 各 MCP Server 调用分布 | 按 `tool.mcp.server` 聚合的调用次数/耗时/错误率 | 识别低频但高成本的 server |
| MCP 平均耗时 vs 原生工具 | 对比 MCP 与 bash/read 等同类操作的耗时 | 发现性能瓶颈 |
| MCP 错误率 | MCP 专属错误统计 | 排查不稳定 server |
| 「可替换为 CLI」提示 | 检测简单操作（如纯查询类 MCP）是否可用 CLI 替代 | 直接降本 |

**推荐系统规则（Recommendations 扩展）：**
- MCP 工具占比 > 30% 且存在简单查询型 MCP → 建议替换为 CLI
- 某个 MCP server 错误率 > 20% → 建议检查配置或禁用
- MCP 平均耗时 > 5s 且调用次数 > 3 → 建议评估必要性

**依赖变更：**
- 前端：新增 `McpPanel.tsx`
- 分析函数：新增 `computeMcpMetrics(turns)`
- i18n：新增 `mcp.*` 命名空间

---

### 2.2 面板二：Prompt 效率分析 (`prompt`)

**优先级：P0（最高）**

**为什么重要：**
Claude 官方强调「Write specific prompts」、「vague requests trigger broad scanning」。用户输入质量直接影响 token 成本和输出质量，但目前没有任何输入侧分析。

**新增指标：**

| 指标 | 说明 | 优化动作 |
|------|------|---------|
| 平均用户输入长度 | 逐 turn `userText` 字符数/估算 token 数 | 发现过长/过短的输入模式 |
| 输入长度趋势图 | 逐 turn 用户输入长度曲线 | 识别输入膨胀或碎片化 |
| Input/Output 比例 | 每 turn 及整体的 `input / output` 比值 | input 远大于 output 可能意味着 prompt 太啰嗦；output 远大于 input 可能意味着请求太模糊 |
| 低效 Prompt 模式检测 | 连续短输入（<20 字符，≥3 轮）= 试探/修正模式；单条超长输入（>2000 字符）= 可能塞入无关上下文 | 建议合并短输入、精简长输入 |
| 文件引用效率 | 统计用户消息中 `@file` 或隐式文件引用的数量 vs 实际被工具读取的文件数 | 发现「引用但未使用」的浪费 |
| 重复提问检测 | 检测语义相似的连续用户输入 | 提示用户 `/clear` 或更精确表达 |

**推荐系统规则：**
- 连续 3+ 轮输入 < 20 字符 → 建议合并为一条完整 prompt
- 单条输入 > 2000 字符且 output < 输入 10% → 建议精简上下文
- input/output 比例 < 0.1 且 output > 5K tokens → 建议写更具体的 prompt

**依赖变更：**
- 前端：新增 `PromptPanel.tsx`
- 分析函数：新增 `computePromptMetrics(turns)`
- i18n：新增 `prompt.*` 命名空间
- **注意**：用户输入文本已在 `turns[].userText` 中可用，无需后端改动。

---

### 2.3 面板三：上下文压力分析 (`pressure`)

**优先级：P1**

**为什么重要：**
Context 面板已有增长曲线，但缺少「压力」视角。用户需要知道什么时候该 `/clear`、什么时候该拆分会话。

**新增指标：**

| 指标 | 说明 | 优化动作 |
|------|------|---------|
| Compaction 前峰值 | 每次 compaction 事件前的上下文 token 数 | 评估窗口使用极限 |
| 距 compaction 平均 turn 数 | 两次 compaction 之间平均有多少 turn | 频率过高时优化上下文管理 |
| 高危 Turn 识别 | 单 turn 增长超过阈值（如 20K tokens）的 turn 列表 | 定位哪个操作导致上下文暴涨 |
| Context 增长率 | 每 10 turns 的平均增长斜率 | 预测何时再次触顶 |
| 建议 `/clear` 时机 | 基于增长率和当前总量估算 | 主动提示用户清理上下文 |

**推荐系统规则：**
- compaction 频率 > 每 10 turns 一次 → 建议更频繁使用 `/clear` 或拆分会话
- 单 turn 增长 > 20K tokens → 提示检查该 turn 的大文件读取或长输出

**依赖变更：**
- 前端：新增 `PressurePanel.tsx`（或作为 ContextPanel 的增强页签）
- 分析函数：新增 `computePressureMetrics(data, turns)`
- i18n：新增 `pressure.*` 命名空间

---

### 2.4 面板四：文件操作效率分析 (`files`)

**优先级：P1**

**为什么重要：**
代码探索是 Claude Code 的核心场景，但低效的 read/edit/grep 模式会显著增加 token 消耗和会话时长。

**新增指标：**

| 指标 | 说明 | 优化动作 |
|------|------|---------|
| 高频读取文件 TOP N | 被 read 次数最多的文件，区分是否使用了 offset/limit | 未使用 offset 的反复读取 = 浪费 |
| Read→Edit 转化率 | 读取文件后是否在后续 3 turns 内被编辑 | 评估 read 的有效性 |
| Grep 结果膨胀检测 | grep 工具返回结果行数分布，识别返回 >100 行的 grep | 建议更精确的 pattern |
| 文件读取覆盖范围 | 被读取的不同文件总数 vs 被编辑的文件总数 | 发现「广撒网」式探索 |
| 未命中编辑的 read 列表 | 读取后未被编辑的文件清单 | 提示减少无效读取 |

**推荐系统规则：**
- 同一文件被 read ≥3 次且未使用 offset/limit → 建议缓存或精简读取范围
- grep 返回 >100 行且次数 >2 → 建议缩小 pattern 或增加 glob 过滤
- read 文件数 / edit 文件数 > 5 → 建议更精准地指定目标文件

**依赖变更：**
- 前端：新增 `FilesPanel.tsx`
- 分析函数：新增 `computeFileMetrics(turns)`
- i18n：新增 `files.*` 命名空间

---

### 2.5 面板五：Executive Summary 总览面板 (`summary`)

**优先级：P2（在所有独立面板完成后实现）**

**为什么重要：**
当面板数量增多后，用户需要一个「一眼看全」的入口，只展示各维度最紧急、最有价值的信息。

**设计：**
- 不替代现有的 Overview 面板
- 作为新增的首个默认面板，或 Overview 的「Summary」子页签
- 内容结构：
  1. **今日/本会话总成本** + 环比（如果有历史数据）
  2. **🔴 紧急告警**（最多 3 条）：跨面板的高 severity 推荐
  3. **🟡 关注事项**（最多 5 条）：中 severity 推荐
  4. **🟢 良好实践**（最多 2 条）：正向反馈
  5. **各维度健康度卡片**（微型）：Cache / Tools / Prompt / MCP / Context / Timing 的 1-2 个核心指标 + 红绿灯状态

**依赖变更：**
- 前端：新增 `SummaryPanel.tsx`
- 分析函数：复用所有已有/新增的分析结果，新增 `generateExecutiveSummary(allMetrics)`
- i18n：新增 `summary.*` 命名空间

---

## 3. 推荐系统扩展规划

现有 `generateRecommendations` 已支持 13 条规则。每新增一个面板，同步扩展对应推荐规则。

| 新规则 ID | 触发条件 | 类别 | 优先级 |
|-----------|---------|------|--------|
| `high-mcp-usage` | mcp 占比 > 30% | cost | high |
| `mcp-high-errors` | 某 mcp server 错误率 > 20% | tools | high |
| `slow-mcp` | mcp 平均耗时 > 5s | tools | medium |
| `fragmented-prompts` | 连续 3+ 轮输入 < 20 字符 | cost | medium |
| `bloated-prompt` | 单条输入 > 2000 字符且 output < 10% | cost | medium |
| `vague-prompt` | input/output < 0.1 且 output > 5K | cost | medium |
| `frequent-compact` | 已存在，增强为 pressure 视角 | context | medium |
| `high-context-spike` | 单 turn 增长 > 20K | context | medium |
| `repeated-reads` | 同文件 read ≥3 次无 offset | tools | medium |
| `bloated-grep` | grep 返回 >100 行 >2 次 | tools | medium |
| `low-edit-coverage` | read/edit 比 > 5 | tools | low |

---

## 4. 实现顺序

按以下顺序逐步实现，每完成一个面板更新本文档状态：

1. **MCP 开销面板** (`mcp`) — P0
2. **Prompt 效率面板** (`prompt`) — P0
3. **上下文压力面板** (`pressure`) — P1
4. **文件操作效率面板** (`files`) — P1
5. **Executive Summary 总览面板** (`summary`) — P2
6. **各面板深化** — 在每个面板中增加 2-3 个衍生指标

---

## 5. 技术实现注意事项

### 5.1 前端规范
- 新面板遵循现有 `AnalyticsPanel` 模式：`<Panel>` + `<CardGrid>` + `<ChartBox>`/`<ChartGrid>`
- 图表使用 `recharts`，颜色从 `chartTheme.ts` 获取
- 所有新增字符串必须同步写入 `en.ts` 和 `zh-CN.ts`

### 5.2 分析函数规范
- 新增函数统一放入 `frontend/src/utils/analytics.ts`
- 输入类型尽量复用 `TurnItem[]`，必要时扩展
- 推荐函数 `generateRecommendations` 的 `RecommendationInput` 逐步扩展字段

### 5.3 导航扩展
- `analyticsStore.ts` 的 `AnalyticsTab` union 类型增加新 tab key
- `AnalyticsNav.tsx` 增加对应导航项
- 图标复用现有或新增简洁文字标签

### 5.4 测试
- 每新增一个分析函数，在 `test/` 目录补充对应单元测试（使用 Node `assert`）
- 测试数据使用 mock `TurnItem[]`，避免依赖真实会话文件

---

## 6. 文档更新记录

| 日期 | 版本 | 更新内容 | 更新人 |
|------|------|---------|--------|
| 2026-04-14 | v1.0 | 初始设计，确定 5 个新面板及实现顺序 | Claude |
| | | | |
