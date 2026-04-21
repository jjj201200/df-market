---
name: skill-coding-review
description: "commit 前的**循环式**代码审查与修复方法论（不同于 Claude Code 内置 simplify 的单轮审查、不同于 skill-audit / skill-doc-audit 的周期性全量体检）。在 commit/push 前对本轮 git diff 做「代码复用 / 质量 / 效率」三维度审查，每轮按工作量弹性派发 1-3+ 个硬化过 prompt 的 subagent（每份报告受 skill-subagent-check 接收端守门），按 Critical / Important / Minor 等级分类问题，四分类决策（修 / 归档 backlog / 跳过 / 误报），直到某一轮 subagent 独立回合返回零发现才允许进入 commit。build 成功是流程前置门槛；backlog 项统一归档到项目单一入口文件，每轮 5 步整理。触发词：coding-review、coding review、code review、代码审查、commit 前审查、commit 前循环审查、pre-commit review、precommit cleanup、iterative code review loop、循环审查、零修改收敛、backlog 归档、commit 前守门、派发 reuse/quality/efficiency agent、subagent 硬化 prompt。"
---

# commit 前代码审查与修复（通用方法论）

commit 是本 skill 完成后的下一步，**不允许跳过直接 commit**，也不允许"先 commit 再审查"。本 skill 是针对本轮代码变更的循环式审查 + 修复框架。

## ⚠️ 收敛条件（硬性刚性约束）

本 skill **唯一**的退出条件是以下三项**同时成立**：

1. **最近一轮 subagent 独立回合返回零发现**（或所有发现均为"误报"/"已显式归档 backlog"）——必须来自 agent 新一轮独立执行，**不允许**主 skill 主观判断"这次修得干净没必要再跑"
2. **本轮零修改**——上一轮无任何代码改动
3. **build 通过** + **backlog 已整理**

任何一项不满足 → **继续循环**，回步骤 1 从 build 校验开始再跑完整一轮。

**破窗警告**：

- ❌ "第二轮应该更轻" 是错误直觉——真正的信号是 **agent 返回无遗漏**，不是主 agent 预判"没必要深查"
- ❌ "第一轮修完 build 通过就直接 commit" 是最常见破窗——禁止
- ❌ 每轮审查范围永远是 `git diff HEAD` **完整变更**，不是上一轮增量
- ❌ agent prompt 不允许写"只查新引入的问题"——会让 agent 放松标准、漏掉第一轮本该揭示但被遗漏的问题

---

## 流程概览

- 每轮并行派发 subagent（复用 / 质量 / 效率，数量按工作量弹性）
- 每份 subagent 报告必须过 `skill-subagent-check` 守门
- 按 Critical / Important / Minor 等级分类问题，四分类决策（修 / 归档 backlog / 跳过 / 误报）
- 每轮末尾做**全盘梳理**：以 agent 报告为线索扩展到未被报告但可能相关的代码路径
- 收敛条件三项全满足 → 进入 commit → 触发 `skill-recap` 做任务回顾

本 skill 不同于 `skill-audit` / `skill-doc-audit`（后者是周期性全量体检）——本 skill 的对象始终是**当前未 commit 的代码 diff**，且每次 commit 前必跑。

## 辅助文件

- `references/dimensions.md` —— 三维度定义（reuse / quality / efficiency）、等级化分类（Critical / Important / Minor）、典型误报模式
- `references/subagent-prompt-template.md` —— 每轮派发给 subagent 的硬化 prompt 骨架、项目 override 注入点、证据要求
- `references/backlog-flow.md` —— backlog 文件 5 步整理流程、单条归档格式、push 后总结模板

## 核心原则

- **commit 前置硬门槛**：没跑过本 skill / 上一轮非零修改 → **禁止** commit
- **循环直到收敛**：每轮修复后必须回到步骤 1 跑完整审查；直到 agent 独立回合返回零发现才允许退出
- **弹性派发**：默认三维度三 subagent，但允许按工作量（diff 规模 / 涉及子模块 / 改动类型）调整数量（见步骤 2 工作量分档）
- **build 先行**：审查前 build 必须成功；`getDiagnostics` 零诊断 ≠ build 通过
- **subagent 硬化 + 守门**：派发前硬化 prompt（见 template），派发后必过 `skill-subagent-check`
- **backlog 不丢失**：审查过程中被决策为"本次不做"的有价值建议硬性归档到项目 backlog 文件

## 触发条件

用户表达以下意图时，主 skill 必须先声明"进入 review 流程"，**不允许直接进入 commit 流程**：

- "commit" / "push" / "发版" / "ship it" / "发布到 X.Y.Z" / "release"
- 明确表示当前改动已完成、准备进入版本控制

**不触发**：

- 纯文档改动，diff 里没有代码文件（走 `skill-doc-sync-check` 即可）
- skill-keeper 范围内的 SKILL.md 修改（走 `skill-sync-check`）
- git 操作本身（checkout / fetch / 查看 status），不涉及新 commit

## 流程（严格顺序 · 7 步 + 全盘梳理子步骤 4.5）

### 步骤 0. build 前置校验（硬性门槛）

调用项目定制版指定的 build 命令。**build 成功（零错误返回）才进入步骤 1**。

- 跨子模块改动：每个涉及的子模块都跑对应 build
- `getDiagnostics` 零诊断 ≠ build 通过——tsconfig 范围、路径别名、生成产物等都可能只在 build 时暴露
- build 失败 → 先修根因 → **从步骤 0 重新开始**
- 没有 build 概念的项目（纯脚本 / 纯文档仓库）：定制版声明"跳过步骤 0"

通用版不规定具体命令；定制版必须写明（如 `npm run -w frontend build` / `cargo build` / `pnpm build`）。

### 步骤 1. 收集本轮 diff

`git diff HEAD` 拿到**完整本轮变更**（不是上一轮增量）。每一轮审查的代码范围都是当前全量 diff。

### 步骤 2. 派发硬化 subagent（数量按工作量定 · 默认 3 维度）

**Read `references/subagent-prompt-template.md`** 获取骨架，按骨架组装 prompt。每份 prompt 必须带：

1. **硬性证据要求**：工具调用 ≥ 5 次、报告末尾附已读文件清单（绝对路径）
2. **项目规则 override**：从定制版 SKILL.md 的 `{{projectOverrides}}` 字段读取注入（`skill-keeper` memory 约束不到 subagent，必须写进 prompt）
3. **维度聚焦**：reuse / quality / efficiency 之一（或组合，见下方工作量分档）
4. **全量审查指令**：禁止 "只看第一轮修了什么"——每轮都要审全量 diff
5. **关联路径扩展要求**：发现共享性问题（可抽的字面量 / 可复用的函数 / 跨模块的错误处理模式）时，**subagent 必须主动 Grep 全仓**确认其它同类位置有没有也该一起改——不能只报本轮 diff 里的一处
6. **backlog 指示**：有价值但本次范围外的建议明确标记 "suggest-backlog"

#### 工作量分档（决定本轮派发几个 subagent）

| 工作量信号 | 派发策略 |
| --- | --- |
| **默认 · 中等改动**（多文件、混合类型改动） | **3 个 subagent 并行**：reuse / quality / efficiency 各一 |
| **大改动**（跨多个子模块、> 500 行 diff、含架构调整） | **3 个 subagent + 按模块再切**：每个子模块派一轮完整三维度，或在 quality 维度里再切 "类型安全 / 错误处理 / 测试覆盖" 三子 agent |
| **小改动**（单文件、< 100 行、边界清晰） | **合并为 1-2 个 subagent**：若 diff 明显只涉及某一维度（纯重构 → 只派 reuse；纯性能调优 → 只派 efficiency），单派该维度即可；否则合并为一个"综合审查" agent |
| **极小改动**（typo、单行 fix、注释） | **可跳过 subagent 派发**，主 skill 直接用 Read/Grep 走步骤 4 决策表 |

"工作量信号" 由主 skill 在步骤 1 看完 diff 后判定，**判定结果要在本轮输出里显式标注**（例：`工作量：中等 / 派发策略：默认 3 subagent`）。

**并行派发**：Agent 工具调用放在**单条消息**的多个 tool_use 块中（2 个及以上 subagent 时）。

### 步骤 3. 接收端守门（调用 skill-subagent-check）

对每份 subagent 报告分别调用 `skill-subagent-check`。任一阻断 → 按 A/B/C 处理：

- **A) 重派** → 硬化 prompt（提高 N、加枚举要求）→ 回步骤 2
- **B) 显式忽略** → 归档到项目忽略台账（同 skill-recap 阶段 6）→ 继续
- **C) 放弃该 subagent 结论** → 主 skill 亲自核查该维度 → 继续

三份全部通过（或已按 A/B/C 处理）→ 进入步骤 4。

### 步骤 4. 决策表 + 修复 + 回归

把所有 subagent 发现项列成决策表：

| 发现项 | 维度 | 等级 | 决策 | 理由 |
| --- | --- | --- | --- | --- |
| [file:line] | reuse/quality/efficiency | Critical/Important/Minor | 修 / 归档 backlog / 跳过 / 误报 | ... |

**四分类定义**（顺序即优先级）：

- **修** → 本轮立即修复
- **归档 backlog** → 同主题但本次刻意不做的（需要前端配合 / 独立 PR 处理 / 需要协议讨论等）；写进项目 backlog 文件（走步骤 5）
- **跳过** → 与本次范围完全无关但 agent 顺带提到的，不值得进 backlog 也不值得修
- **误报** → 不记录、不修复；必须给出 "为什么是误报" 的一句话理由

**等级约束**：

- Critical 不允许"归档 backlog / 跳过"——必须修或显式向用户请示
- Important 可归档 backlog，但理由必须具体；不允许"跳过"
- Minor 自由决策

执行"修"后：

- 再跑一次步骤 0（build）确认未引入新错误
- 对修复处附近抽样验证未引入回归

#### 步骤 4.5. 全盘梳理（硬性必跑，不允许因 subagent 报告已空就跳过）

subagent 报告只覆盖它**当轮读过的文件**——其价值的最大延展在于：把报告作为线索，主动扩展到**未出现在报告里但可能相关**的代码路径。

**必跑场景**（符合其一即必须做）：

- 本轮有"修"决策——尤其是抽共享常量 / 共享函数 / 改类型声明 / 改接口签名 时
- subagent 报告指出某类问题（如"此处 `try/catch` 吞错"），即使只报了一处也要全仓扫同类
- 修了任何持久层 / 路由 / 全局状态 / 配置相关的代码

**执行手法**：

- 抽了共享常量 → `Grep` 全仓确认其它模块没有类似字面量未被纳入
- 修了一类错误处理 → `Grep` 全仓扫同类 `try/catch`、`.catch(...)`、静默 `return null` 的位置
- 改了接口签名 → `Grep` 全仓所有调用点（不只本轮 diff 里的）
- 抽了共享函数 → `Grep` 原始实现的每一处，确认都替换了

**输出**：全盘梳理结果必须进入本轮的"决策表"——发现的新问题按四分类处理（修 / 归档 backlog / 跳过 / 误报）；即使零发现也要在本轮输出显式写"全盘梳理：已扫 N 个关联路径，无新增问题"（有数字，不含糊）。

**为什么这是硬步骤**：simplify 最有价值的功能是"以新鲜视角重新审视完整代码面"。如果只依赖 subagent 报告的局部条目，第一轮没被 agent 抽中的文件永远不会被检查——这是跳过"全盘梳理"的真实代价。

### 步骤 5. backlog 归档

**Read `references/backlog-flow.md`**，按其中 5 步流程整理项目 backlog 文件（路径由定制版指定，默认 `memory/pending-tasks.md`），然后追加本轮的"归档 backlog"项。

**硬规则**：

- 不允许新建专题 memory 文件分散归档——单一 backlog 入口
- 不允许跳过整理直接追加——整理 → 追加 → 写入是硬性顺序
- 不征求用户意见——自动执行，一句话汇报"清理 X 条、合并 Y 条、新增 Z 条"

### 步骤 6. 收敛判定

对照首段「⚠️ 收敛条件」：

- **本轮有任何修改** → 回步骤 1 再跑完整一轮
- **本轮零修改** + **最近一轮 subagent 独立回合（过了步骤 3 守门）报告零发现或全部为误报/已 backlog** + **步骤 4.5 全盘梳理无新增问题** + **build 通过** + **backlog 已整理** → 允许进入步骤 7

完整破窗清单已在首段「⚠️ 收敛条件」列出——此步只做判定，不重复警示。

### 步骤 7. 进入 commit + push 后总结 + 触发 recap

退出本 skill，移交 commit 流程。

#### 7.1 commit / push

commit message 规范由项目定制版补充（如"用中文 / 不加 Co-Authored-By / 按子模块顺序"等）。通用版只规定：commit message 要能让人一句话看懂本轮做了什么。

#### 7.2 push 后总结（强制）

**commit/push 完成后**由主流程输出总结（**不征求用户意见，仅汇报**）：

```
已 commit/push：<一句话描述>

backlog 当前积压 N 项（详见 <backlog 文件路径>）：
- [位置] 问题摘要
- ...（最多 10 条，超出用"... 等 X 条"省略）

如需处理任意一项告诉我。
```

#### 7.3 主动触发 recap（硬规则 · 闭环）

push 后总结输出完 → 主流程**主动**触发 `skill-recap`（或项目定制版 `skill-recap-<project>`）做任务回顾。

**不允许等用户开口才触发 recap**——coding-review → commit → recap 是闭环，recap 会把本次会话的经验沉淀为 memory / 文档 / skill 改进。跳过 recap = 经验丢失。

定制版可指定触发的具体 skill name（通用版或项目定制版）与衔接提示语。

## 输出格式（每轮）

```
## Review 第 N 轮

### Build
✅ <项目定制版指定的命令> 通过

### 工作量判定
本轮 diff：<规模 · 中等/大/小/极小> · 派发策略：<默认三维度 / 按子模块切 / 合并为单 agent / 跳过 subagent>

### Subagent 报告（已过 skill-subagent-check）
- reuse: N1 个发现       [派发：是/否]
- quality: N2 个发现     [派发：是/否]
- efficiency: N3 个发现  [派发：是/否]
- 守门阻断处理：X 条（A=重派 / B=忽略 / C=放弃）

### 决策表
[table]

### 本轮修复
- [file:line] <修复>

### Backlog
清理 X 条已完成、合并 Y 条重复、新增 Z 条本轮累积

### 收敛
- [ ] 本轮有修改 → 回步骤 1
- [x] 本轮零修改 + agent 回合零发现 → 退出 review，进入 commit
```

subagent 报告被守门**阻断**时，单独列出处理方式（A/B/C）并说明未通过的具体原因。

## 与其他 skill 的区别

| 维度 | 本 skill（review） | skill-audit | skill-doc-audit | skill-sync-check | skill-subagent-check |
| --- | --- | --- | --- | --- | --- |
| 对象 | 当前未 commit 代码 diff | 全部 SKILL.md | 全部规范/手册/memory | 单次 SKILL.md 落盘 | subagent 报告本身 |
| 触发 | commit 前 | 周期性/手动 | 周期性/手动 | SKILL.md 落盘前 | subagent 派发后 |
| 循环 | **是**（零修改收敛） | 否 | 否 | 否 | 否 |
| 修复 | 本 skill 内完成 | 只给建议不改 | 只给建议不改 | 守门通过即落盘 | 只给阻断信号 |

本 skill 是唯一**循环式 + 会修改代码**的守门 skill——职责最重、最接近代码变更本身。

## 如何派生项目定制版

每个项目应创建 `skill-coding-review-<project>`。分工：

| 通用 skill 负责 | 定制 skill 负责 |
| --- | --- |
| 7 步刚性流程 | 步骤 0 的具体 build 命令（按子模块列出） |
| 三维度审查框架 | 项目规则 override（注入到每次 subagent prompt 的 `{{projectOverrides}}`） |
| 等级化分类标准 | 项目 backlog 文件的绝对路径（默认 `memory/pending-tasks.md`） |
| backlog 5 步整理流程 | 与 skill-recap 定制版的衔接（通常在 recap 阶段 5.3 的"commit 前置"引用本 skill） |
| 循环收敛规则 | commit 约定、push 后总结的具体措辞 |
| 与 skill-subagent-check 的守门配对 | 本项目历史踩坑过的高危盲区（作为 subagent 派发时附的"高危维度清单"输入） |

**定制 skill 开头必须声明**：

> 前置：先阅读并遵循 `skill-coding-review`（通用方法论）。本 skill 只列出本项目特有 build 命令、规则 override、backlog 路径、commit 衔接点、历史踩坑盲区清单，不重复通用内容。
