# #6 工具链依赖图 — 设计文档

**日期**: 2026-04-19
**范围**: token-reporter 新增 Tools Graph 面板，从工具调用时序、共现、文件作用三种语义刻画工具依赖网络
**关联**:
- [2026-04-19-claude-code-new-features-research.md](./2026-04-19-claude-code-new-features-research.md)
- [2026-04-19-context-auditing-dashboard-design-v2.md](./2026-04-19-context-auditing-dashboard-design-v2.md)（硬依赖：F 路径 fetch hook 提供完整 API request body，从中拆解 tool_use / tool_result block 的精确 token 占比）
- [2026-04-19-skill-evolution-audit-design.md](./2026-04-19-skill-evolution-audit-design.md)（复用 PivotView 组件与 pivot 引擎）
**状态**: 设计待用户复核 → 通过后进入 writing-plans

---

## 一、目标与非目标

### 目标
- 回答「我这个项目里工具是怎么被组合使用的？哪些工具序列是高效的？哪些是反模式？」
- 提供**三种边语义**的工具依赖图：时序转移、同轮共现、同文件作用
- 识别常见反模式：重复读同文件、Grep 后无 Read、Edit 没先 Read、工具轮空占位等

### 非目标
- 不做跨 session 聚合（→ #4）
- 不做 MCP 服务的深度替代性分析（→ 未来独立项）
- 不写回代码或建议修改 skill（只产出提示）
- 不做工具 token 成本预测（→ #5 token-budget-forecaster）

---

## 二、关键前置结论

1. **硬依赖 #1**：#6 面板在 `config.auditEnabled === false` 时直接显示空态引导。原因：
   - 工具 schema 自身对 context 的占用只有 OTel 能拿到
   - insight 里的「该工具对 token 成本的实际贡献」需要 OTel 的 `usage` 真值
   - 保持与 #3 相同的门槛：避免用户在 audit off 下拿到"半真半假"的图
2. **节点建模**：默认以**工具类别**为节点（9 类 + 每个 MCP 服务一类），下钻层级为具体调用实例
3. **pivot 引擎与 SkillInsights 卡片来自 #3**：`backend/src/skill-pivot.ts` 与 `frontend/PivotView` 是通用基础设施，#6 以另一份维度/度量配置复用

### 待落地前验证的假设

| ID | 假设 | 验证方式 | 失败退路 |
|----|------|----------|---------|
| T1 | 现有 JSONL parser 的 tool_use 记录里含足够信息做"文件作用"归属（Read 的 file_path / Edit 的 file_path / Bash 命令参数） | 跑 parser 对 3 个 session 抽 tool_use list | 缺失时对 Bash 只做正则抽取 cwd + arg0，标 confidence 降级 |
| T2 | OTel response 的 `usage` 字段在 tool_use 层级可分摊（否则只有 turn 级总量） | 抓真实 OTel payload 观察 | 若只有 turn 总量 → 边权重退化为「占该 turn 比例 × turn 总成本」 |

T1/T2 在 Task 0 `scripts/verify-tool-graph.js` 里固化。

---

## 三、架构概览

```
┌──────────────────────────────────────────────────────────────┐
│ JSONL parser（已有） + OTel jsonl（来自 #1）                   │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ backend/src/tool-graph.ts（新）                                │
│  buildSequentialEdges(session) → 时序转移邻接矩阵              │
│  buildCooccurEdges(session)    → 同轮共现矩阵                  │
│  buildFileOverlapEdges(session)→ 同文件作用矩阵                │
│  classifyToolCategory(call)    → 9 类 + MCP 服务名             │
│  extractFileTarget(call)       → Read/Edit/Grep 的 file_path    │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ backend/src/tool-insights.ts（新）                              │
│  4 条规则：重读 / Grep-无-Read / Edit-无-Read / 工具死链         │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ Server API (backend/src/server.ts)                             │
│  GET /api/tools/graph?edgeType=sequential|cooccur|file         │
│  GET /api/tools/drilldown?category=&sessionId=                 │
│  GET /api/tools/insights?sessionId=                            │
│  （Pivot 复用 #3 的 /api/skills/pivot 路径或新建 /api/tools/pivot）│
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 前端 Tools Graph 面板                                         │
│  上：ToolGraph（tabs: 时序 / 共现 / 文件）                     │
│  中：PivotView（tool 维度）                                    │
│  下：ToolInsights 卡片                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 四、组件设计

### 4.1 节点分类（classifyToolCategory）

沿用现有 token-reporter 的 9 类（见 `backend/src/parser/*` 已用的分类）：`bash` · `read` · `edit` · `write` · `grep` · `glob` · `web` · `agent` · `other`。
**MCP 工具**：按 `mcp__<server>__<tool>` 前缀拆出 `mcp/<server>` 作为独立节点（例如 `mcp/google-calendar`），同一 server 下多工具合并到同一节点。

### 4.2 三种边构建（tool-graph.ts）

#### 边类型 1：sequential（时序转移）
- 遍历 session 内所有 assistant turn 的 tool_use 按时序展开
- 对每对相邻调用 `(A, B)` 在类别层面 +1 权重
- 边为有向：`A → B` 与 `B → A` 分别统计
- 忽略跨 turn：不把 turn N 的尾部 tool 与 turn N+1 的头部 tool 连边（是新思考周期）

#### 边类型 2：cooccur（同轮共现）
- 对每个 assistant turn，取该 turn 所有 tool_use 的类别集合 S
- 对 S 中任意两类别 `{A, B}` 在无向图上 +1
- 自环（`{A, A}`）也记录：用于识别"单轮内重复调用同类"

#### 边类型 3：file（同文件作用）
- 仅对能抽出 file_path 的工具（Read / Edit / Write / Grep glob 限定、Bash 中 `cat`/`sed`/`rg`）构图
- 同一 session 对同一文件作用过的两个工具 `(A, B)` → 边 +1
- 边属性附加：`files`（该边涉及的所有文件数组，前 5 个在 tooltip 里展示）

### 4.3 下钻（extractFileTarget + drilldown）
点击图上节点或边调 `GET /api/tools/drilldown?category=<cat>&sessionId=<id>`：
- 返回该类别下的所有具体调用：`{turnId, toolName, args, result_size, target_file?, cost?}`
- 若 OTel 有数据 → cost 字段为真值；否则缺省
- 前端右侧 panel 表格展示，支持按 turnId 跳转到现有 session 波形视图

### 4.4 Insights（tool-insights.ts）

4 条规则：

#### 规则 1：same_file_reread
- 同 session 同文件 Read ≥ 3 次 且 文件之间无 Edit
- 建议："consider caching the file content in context or using Grep"
- 严重度：warn

#### 规则 2：grep_without_read
- Grep 返回非空结果但后续 3 个 tool 未调用 Read 访问命中文件
- 建议："Grep result seems unused — did you mean to read the match?"
- 严重度：info

#### 规则 3：edit_without_read
- Edit 某文件前 5 个 tool 内未 Read 过该文件
- 建议："editing without reading may cause context mismatch"
- 严重度：critical（`Edit` 文档本身要求先 Read，违反即告警）

#### 规则 4：tool_deadlink
- 某 tool 的调用频次 ≥ 3，但 assistant 后续文本从未引用其结果（heuristic：result 字段的非空内容未在后续 assistant turn 的 text block 出现）
- 建议："this tool's output seems ignored — consider skipping the call"
- 严重度：info
- confidence：low（heuristic 易误报，标 confidence 到输出）

### 4.5 Server API

| Route | 作用 |
|-------|------|
| `GET /api/tools/graph?edgeType=sequential|cooccur|file&sessionId=&minWeight=` | 返回 `{nodes: [{id, category, callCount}], edges: [{source, target, weight, meta?}]}` |
| `GET /api/tools/drilldown?category=&sessionId=&filter=` | 节点下钻的调用列表 |
| `GET /api/tools/insights?sessionId=` | 4 条规则输出 |
| `GET /api/tools/pivot?groupBy=&measure=&filter=&sessionId=` | 复用 #3 的 pivot 引擎，tool 相关维度集合 |

audit 未启用时，所有路由返回 `{enabled: false, reason: 'audit_disabled'}`。

pivot 引擎在 #3 建的 `skill-pivot.ts` **重构为通用 `pivot-engine.ts`**（移除 skill 特化），#6 传入 tool 维度表即可：
- 新增维度：`fromTool` · `toTool` · `fileCategory`（src / test / docs / other，按路径归类）
- 新增度量：`edgeWeight` · `avgGapTurns`（同序列里两次出现的轮距均值）

### 4.6 前端 Tools Graph 面板

新增 `frontend/src/components/Analytics/ToolsGraph/ToolsGraph.tsx`（与现有 ToolsPanel 并列，不合并——旧面板是"工具使用统计"，本面板是"工具关系图"）。

#### AnalyticsNav 新增条目 `nav.toolsGraph`，置于 Tools 面板之后。

#### 布局
```
┌─────────────────────────────────────────────────────────┐
│ [时序 | 共现 | 文件]  ← 顶部 Tab                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │   ToolGraph（有向图 / 无向图 / 热图）                 │ │
│ │   节点 = 工具类别；节点大小 = 调用次数                │ │
│ │   边粗细 = 权重；颜色按类别区分                       │ │
│ └─────────────────────────────────────────────────────┘ │
│ [slider: min weight]  [drilldown: 选中节点后显示]       │
├─────────────────────────────────────────────────────────┤
│ PivotView（tool 维度）                                   │
│ 预设：tool×errRate · fromTool×toTool 热图 · tool×avgGap  │
├─────────────────────────────────────────────────────────┤
│ ToolInsights（4 条规则输出卡）                           │
└─────────────────────────────────────────────────────────┘
```

#### ToolGraph 渲染库
- 时序图：用 `@visx/network` 或 `reactflow` 轻量版，有向 + 箭头
- 共现图：同上，无向 + 边粗细
- 文件作用图：热图矩阵（Recharts 可做，tool × tool 方格）

> **库选择待验证**：brainstorming 阶段不固化具体库，由 writing-plans 阶段权衡 bundle size 与功能。

#### 下钻交互
点击节点 → 右侧抽屉展开该类别的具体调用（表格），每行可跳回现有 session 波形。

### 4.7 i18n

新增键：
- `nav.toolsGraph` · `tools.graph.title`
- `tools.graph.tab.sequential` / `.cooccur` / `.file`
- `tools.graph.edgeWeight` / `.minWeight`
- `tools.drilldown.title` · `tools.drilldown.column.turnId` / `.name` / `.target` / `.cost`
- `tools.pivot.preset.*` （3 个预设）
- `tools.insight.sameFileReread.title` / `.suggestion`
- `tools.insight.grepWithoutRead.title` / `.suggestion`
- `tools.insight.editWithoutRead.title` / `.suggestion`
- `tools.insight.toolDeadlink.title` / `.suggestion`
- `tools.emptyState.auditDisabled`

---

## 五、组件隔离与边界

| 组件 | 职责 | 依赖 |
|------|------|------|
| `backend/src/tool-graph.ts` | 3 种边矩阵构建、分类、文件提取 | 读 JSONL（必需）+ OTel jsonl（可选 cost） |
| `backend/src/tool-insights.ts` | 4 条规则，纯函数 | 调用 tool-graph |
| `backend/src/pivot-engine.ts` | 从 #3 `skill-pivot.ts` 重构为通用 | 输入任意维度表 |
| `backend/src/server.ts` 新 Route | HTTP 层 + audit 门控 | 调用上述 |
| `frontend/ToolsGraph` | 面板容器 + tab 切换 + 下钻 | 纯前端 fetch |
| `frontend/PivotView` | 来自 #3，不改 | props 接新维度/度量配置 |

---

## 六、错误处理

1. **audit 未启用** → API 返回 `{enabled: false}`，前端空态引导
2. **session 内工具调用 < 5 个** → 图显示"数据量不足"占位
3. **minWeight 滤掉所有边** → 画出孤立节点，不报错
4. **下钻匹配不到记录** → 空列表 + "no calls"提示
5. **insights 的 heuristic confidence < 0.5** → 仍输出，但卡片带灰色 "low confidence" 标记
6. **MCP tool 的服务名无法从 tool 名解析** → 归入 `mcp/unknown` 单节点，不丢失数据

---

## 七、测试策略

- `test/test-verify-tool-graph.js` —— Task 0 跑 T1/T2 验证
- `test/test-tool-graph.js` —— 给 3 个 fixture session（小 / 复杂 / 含 MCP），断言三种边矩阵正确、节点数正确
- `test/test-tool-insights.js` —— 每条规则构造阳/阴样本，验证 confidence 分层
- `test/test-pivot-engine.js` —— 重构后通用引擎的回归（覆盖 #3 + #6 两份维度配置）
- `test/test-tools-api.js` —— 4 个新路由的空态 / 正常态 / 参数错误
- 前端：手工验证（dev server 13737）

---

## 八、迁移与兼容

- 不改现有 parser / session JSONL 解析
- #3 的 `skill-pivot.ts` 重构为通用 `pivot-engine.ts`：
  - `skill-pivot.ts` 导出函数签名从 `(session, opts)` → `pivot(dimensions, measures, rows, opts)`
  - `server.ts` 里 `/api/skills/pivot` 改为调用通用 engine + 传 skill 维度表
  - 如果 #3 尚未合入 → #6 先独立实现 engine，后续 #3 合入时对齐
- 旧 session 无 OTel → 空态

---

## 九、范围外

- 跨 session 聚合 → #4
- 跨项目的工具使用模式对比 → 未来
- 工具替代性推荐（"该场景 Grep 可替代这次 Read"）→ 需 LLM 参与，归未来
- 自动 Edit PR 修正反模式 → 永远不做
- Checkpoint / Replay 时序动画 → 归 #7 Checkpoint / Replay 浏览器

---

## 十、与 #3 的耦合点与解耦原则

**强耦合点**：
- pivot-engine 是两者共享的核心模块
- PivotView 组件同时被 SkillsPanel 和 ToolsGraph 使用

**解耦原则**：
- pivot-engine 不认识 skill 或 tool 的语义，只认 `dimension[]` `measure[]` `rows[]`
- SkillsPanel 和 ToolsGraph 各自构造 rows 送给 engine
- 任何一方单独合入都不阻塞另一方

**落实施顺序建议**：
1. 先实施 #1（数据通道）
2. 实施 #3 时同步把 `skill-pivot.ts` 命名为 `pivot-engine.ts` 并抽出 skill 维度
3. #6 落地时直接 import pivot-engine

---

## 十一、下一步

1. 用户复核本 spec
2. 通过后，Task 0 跑 T1/T2 验证
3. 验证通过 → invoke writing-plans 生成实施计划
4. 实施顺序：tool-graph（三种边） → tool-insights → pivot-engine 通用化 → API → ToolsGraph 前端 → i18n → 手工验证
