# Claude Code 新功能调研与候选清单

**日期**: 2026-04-19
**范围**: 基于外部方法论调研 + df-market 现有数据能力，提出可落地的新功能候选
**状态**: 调研完成，待从第一档 + 第二档 #6 进入设计阶段

---

## 一、外部方法论调研摘要

### 1. Claude Code 使用规范（官方 + 社区）

- **CLAUDE.md 精简原则**：150-200 条指令为上限，超过后遵从度断崖下跌。去掉 Claude 能自推导的内容，保留「不写就出错」的规则。改用 `@文件引用`。
- **三层信息架构**：CLAUDE.md（每次加载、建筑层规则）+ Skills（按需加载、领域流程）+ Hooks（确定性执行、必须发生的自动化）。
- **团队协作（Agent Teams, 2026 初）**：lead 协调任务分配、多个 teammate 纯净上下文独立执行、TASKS.md 作为共享同步点、teammate 可互相挑战/审计。
- **上下文管理战术**：`/context` 查 token 分布；`.claudeignore` 隔离冗长文件；任务 switch 用 `/clear`，长会话用 `/compact <指引>`；验证工作流（跑测试/截图让 Claude 自反馈）减少往返。
- **提示精准度**：`@file` 引用、贴截图、指定约束、提供范例码。给 Claude 自验证的标准比补充描述更高效。

### 2. "Harness" 概念

- **架构本质**：不是 chatbot，而是 "LLM + 工具 + 内存 + 编排" 的本地运行时。核心循环是 TAOR（Think-Act-Observe-Repeat）。权限治理三层：Tier 1（自动读）/ Tier 2（提示写）/ Tier 3（背景分类器自动评估，2026/3 新增）。
- **与通用 agent scaffold 的差异**：harness 强调运行时保障——checkpoints 可重放、权限可审计、长会话可自压缩。scaffold 通常无状态。
- **开源实现**：`learn-claude-code` / `claude-code-harness`（Plan→Work→Review）/ OpenSpace 等 meta-harness 支持 agent 自身改进与 cost 优化。
- **核心设计目标**：长会话稳定性、可审计性、可扩展（subagent / skill / MCP）、人机在环（Esc 中断、Rewind 回放）。

### 3. 自动审计 / 自我迭代

- **Self-Reflection 模式**（官方已验证）：agent 跑偏时，不自己推演，而是让 Claude 反思"现有上下文里缺了什么"——比手动补上下文更高效。
- **Hyperagent 架构**（理论 + 初步实现）：Task Agent（执行）+ Meta Agent（修改自己和 Task Agent）。
- **Skill 自我演进**（2026 新概念，无成熟方案）：skill-creator 能从自然语言生成 SKILL.md，但**缺失自动评测、版本化、A/B 对比框架**，全靠人工审核。
- **Context Auditing**：当前靠手工规则（`.claudeignore` / hook），无 ML 驱动的异常检测。

### 4. 未解 pain point

1. **"Rush to Completion"**（Feb-Mar 2026 更新后）：Opus 4.6 Adaptive Thinking 默认努力度降为 medium。症状：编造 API 版本、跳过硬问题、幻觉 commit SHA。
2. **Token 消耗爆炸**（Mar 23, 2026 起）：单 prompt 3-7% 会话配额、5 小时窗口 19 分钟耗尽。根因：prompt 缓存 bug + session-resume bug + 政策变更。
3. **长会话"近因偏差"**：早期设定的约束被遗忘，晚期多轮纠正。现无标准解。
4. **团队一致性**（Agent Teams 后浮现）：多 teammate 运行时，同一份 CLAUDE.md + hook 是否真的被一致遵守。

---

## 二、df-market 现有数据能力盘点

### 数据采集（token-reporter parser，11 个维度）

Token 用量（input/output/cache_read/cache_creation）· 工具调用详情（名称、参数、返回大小、耗时、错误）· Thinking blocks · 轮次结构 · Sidechain 标记 · 模型种类 · Cache TTL 类型 · Stop Reason · Subagent 统计 · Hook 执行记录 · 系统事件（slash / bash / compact）

### 前端分析面板（9 个）

Overview · Cache · Tools · Context · Timing · Subagents · MCP · Prompt · Files

### 推荐引擎（25+ 规则）

高优先级告警（低缓存 / 高错误 / 高上下文压力 / MCP 错误）· 成本优化（高输出比 / Subagent 溢价 / Thinking 过度 / Opus 过度 / Sidechain 过度）· 性能（工具耗时 / MCP 延迟 / 高闲置 / 提示碎片 / 文件重复读）

### 现有 skill 生态套路

通用 SKILL.md + references/ 外挂长清单；渐进式 AUQ 派生（release-creator 为典范）；守门 skill 分工（sync-check / doc-audit / recap）；派生产物作为项目资产进 git。

### 未利用的数据维度

跨 session 聚合 · Token 成本预测 · Agent 工作流模式识别 · 上下文压力预警阈值 · 工具链依赖图 · 与 git 分支关联的性能对比

---

## 三、新功能候选清单（四档）

### 第一档：与外部方法论强对齐，依托现有数据可直接起步

#### #1 Context Auditing Dashboard（上下文审计面板）
- **依据**：`/context` 是官方推荐做法；长会话"近因偏差"是未解 pain point。
- **已有积木**：token-reporter 已解析 token 分布 + 轮次时序 + compact 事件。
- **缺**：系统提示 / skills / 文件 / 历史 / 工具 schema 的**占比拆解**，及压力趋势告警。
- **价值**：把"context 怎么被吃掉的"从黑盒变白盒。

#### #2 Session Self-Reflection Skill（会话自省 skill）
- **依据**：Anthropic 官方推荐"反思缺什么上下文"优于手工补。
- **已有积木**：token-reporter 已识别高错误工具 / 冗余调用 / 高 compact 频率。
- **缺**：把"session 数据 → 反思 prompt → 可执行建议"串起来的 skill。
- **价值**：喂入 session id，输出"这次会话该改哪条 CLAUDE.md / 哪个 skill"。

#### #3 Skill 自我迭代审计（skill-evolution-audit）
- **依据**：OpenSpace 的"每次任务反哺 skill 库" + skill-keeper 已有 audit 框架。
- **已有积木**：`skill-audit` / `skill-doc-audit` / session 数据。
- **缺**：**skill 调用效果评测**——哪些 skill 被触发却没改善结果？哪些 description 误触发率高？
- **价值**：关闭"skill 写完就不管"的反馈环。

### 第二档：跨 session 聚合，挖掘未利用的数据维度

#### #4 跨 Session 趋势扫描器（session-trend-scanner）
- **依据**：parser 已支持 `listSessions`，前端未做聚合。
- **缺**：多 session token 成本曲线 / 工具调用分布漂移 / 越来越贵的 prompt 模式。
- **价值**：项目级成本健康度。

#### #5 Token 成本预测（token-budget-forecaster）
- **依据**：社区痛点"19 分钟耗尽 5 小时窗口"。
- **缺**：基于前 N 轮的 cache miss 率 / 输入增长率外推全会话成本，提前预警。

#### #6 工具链依赖图（tool-dependency-graph）
- **缺**：工具常搭配（Grep→Read→Edit）· 低效反模式（重复 Read 同文件）· 可被本地替代的 MCP。
- **价值**：给 skill 作者提供"常用工具序列"的客观依据。

### 第三档：对齐 harness 概念，本地运行时增强

#### #7 Checkpoint / Replay 浏览器
- **依据**：harness 核心目标之一是"可重放"。
- **缺**：基于 JSONL 的 session 回放 UI——选轮次、看当时的 context、看工具调用 diff。

#### #8 权限治理可视化
- **依据**：harness 权限三层（Tier 1/2/3）是 2026/3 新增设计。
- **缺**：哪些工具被 auto-approve / 被 deny / settings.json 与实际行为漂移。

#### #9 团队一致性检查器（team-consistency-linter）
- **依据**：Agent Teams 是 2026 初官方新功能。
- **缺**：扫描 CLAUDE.md + skills + hooks 的冲突点。

### 第四档：文档自动化，复用 skill-keeper 派生器

#### #10 CLAUDE.md 瘦身器
- **依据**：官方最佳实践"150-200 条上限"。
- **缺**：扫描每条指令，标记"代码已表达 / 与其他 skill 冲突 / 从未被触发"。

#### #11 文档-代码漂移监控（doc-drift-monitor）
- **缺**：把 skill-doc-sync-check 改造成 hook——PostToolUse 时自动查 Edit 是否触发文档漂移。

#### #12 Agent 行为归因报告（attribution-reporter）
- **依据**：Rush to Completion 痛点需要细粒度证据。
- **缺**：从 session JSONL 挖"何时开始走捷径"——对比轮次间思考深度 / 工具调用数 / 重试率。

---

## 四、推进决策

- **本次落地范围**：第一档（#1 / #2 / #3）+ 第二档 #6（tool-dependency-graph）
- **推进方式**：逐项进入 brainstorming 设计对话 → 每项单独产出设计文档与实施计划
- **优先级**：#2 > #1 > #3 > #6（#2 是串起其他三项的用户动线锚点）

---

## 参考来源

- [Best Practices for Claude Code - Claude Code Docs](https://code.claude.com/docs/en/best-practices)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Agent Harness: Architecture Breakdown](https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/)
- [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Self-Evolving Agents: Open-Source Projects Redefining AI in 2026](https://evoailabs.medium.com/self-evolving-agents-open-source-projects-redefining-ai-in-2026-be2c60513e97)
- [Claude Code's Feb–Mar 2026 Updates Quietly Broke Complex Engineering](https://dev.to/shuicici/claude-codes-feb-mar-2026-updates-quietly-broke-complex-engineering-heres-the-technical-5b4h)
- [Using Claude Code: session management and 1M context](https://claude.com/blog/using-claude-code-session-management-and-1m-context)
