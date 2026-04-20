---
name: skill-keeper-welcome
description: "skill-keeper 插件首次安装后的渐进式派生引导。当用户首次安装 skill-keeper、运行 /skill-keeper-welcome、或表达「想为本项目派生 recap/audit/sync-check/subagent-check/coding-review 的定制版」「把 skill-keeper 的 skill 接入本项目」等意图时使用。职责：用 AskUserQuestion 同时收集沟通语言 + 骨架正文语言 → 价值阐述 → 意向分流 → skill-creator 依赖检测 → 派生范围（多选）/ 通用参数 / 命名方案 → 逐份收集项目特有字段 → 委派 skill-creator 落盘 → 主动提醒是否登记到 CLAUDE.md / AGENTS.md / MEMORY.md。允许用户随时放弃。触发词：skill-keeper 欢迎、派生定制版、welcome、skill-keeper-welcome、派生 recap/audit/sync-check/subagent-check/coding-review 定制版。"
---

# skill-keeper 首次安装引导（派生定制版）

本 skill 的唯一职责是**用渐进式 AskUserQuestion 引导用户**决定是否为本项目派生 7 份通用方法论 skill 的定制版。本 skill **不直接写任何 SKILL.md 文件**——最终落盘交给官方 `skill-creator`。

## 背景：skill-keeper 内置的 7 份通用 skill

| 通用 skill                | 角色                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `skill-recap`             | 任务回顾 + 改进编排入口（流程主轴）                            |
| `skill-doc-sync-check`    | 文档落盘前增量守门（被 recap 串联）                            |
| `skill-sync-check`        | SKILL.md 落盘前增量守门（被 recap 串联）                       |
| `skill-coding-review`            | commit 前循环式代码审查与修复（零修改收敛前阻断 commit）       |
| `skill-subagent-check`    | Subagent 报告接收端守门（主 skill 派发 subagent 后消费结论前） |
| `skill-doc-audit`         | 文档与代码一致性全量审计                                       |
| `skill-audit`             | SKILL.md 全量审计                                              |

每份 skill 的末尾都写有「如何派生项目定制版」章节——因为**通用版不绑定任何项目拓扑**，真正要在某个项目里跑顺必须派生一个 `-<project>` 后缀的定制版。派生**是可选的**：用户也可以只装 skill-keeper 用通用版。

## 本 skill 的辅助文件

- `references/language-options.md` —— 环节 1 语言 AUQ（同时采集沟通语言与骨架正文语言）
- `references/scope-split-plan.md` —— 环节 4 派生范围 AUQ 的固定拆分方案
- `references/derivation-fields-catalog.md` —— 逐份追问的字段清单、默认推导规则、预扫项目档案策略
- `references/skill-creator-prompt-template.md` —— 委派 skill-creator 的 prompt 模板
- `references/doc-registration-flow.md` —— 环节 9 文档登记子环节 flow（落盘后主动提醒是否登记到 CLAUDE.md / AGENTS.md / MEMORY.md）

执行到对应环节时 Read 对应 reference；不要在本 SKILL.md 中重复那里的内容。

## 执行流程

流程分为下述 10 个有序环节。**对用户不要展示环节编号或"Step X"标题**——直接用自然段和 AUQ 与用户沟通；编号只供本 SKILL.md 内部交叉引用。

### 环节 1. 语言（一次 AUQ 同时发起两问）

**Read `references/language-options.md`**，按其中 JSON 骨架同时发起**两个问题**（AUQ 的 `questions` 数组含 2 个 object）：

- 第一问 → `{{uiLanguage}}`：welcome 跟用户沟通用的语言（所有后续纯文本段、AUQ 文案、错误提示都用这个）
- 第二问 → `{{docLanguage}}`：派生出的 SKILL.md 正文语言（frontmatter 的 YAML 标识符保持英文不变，只有 description 值与正文受此影响）

> 两个变量相互独立——用户可能用中文沟通但生成英文 SKILL.md，反之亦然。不要凭一个答案推断另一个。

### 环节 2. 价值阐述（纯文本，不用 AUQ）

用 `{{uiLanguage}}` 写一段简短文本向用户说明：

1. 7 个通用 skill 当前都已经可用——只想用通用版可以立即退出本引导
2. 派生定制版的价值：把本项目的绝对路径 / 核心业务链路 / 忽略项台账 / commit 约定写进一份 `-<project>` 后缀的 skill；否则 recap 里"调用项目定制版"的指令就是悬空的
3. 派生成本很低：每份骨架 1-3 句话填空即可，其余部分留 TODO

### 环节 3. 意向分流（AUQ 单选，2 选项）

问题：「是否现在为本项目派生 skill-keeper 的 7 份通用 skill 的定制版？」

- **直接开始派生** → 进入环节 4
- **暂时跳过** → 直接结束，用一句话提示"随时可再跑 `/skill-keeper-welcome`"后退出

### 环节 4. 前置依赖检测：skill-creator

进入派生流程前，必须先检测官方 `skill-creator` 是否可用，否则落盘环节将失败。

**检测方式**（用 Glob 工具）：
- `~/.claude/skills/skill-creator/SKILL.md`
- `~/.claude/plugins/cache/**/skill-creator/SKILL.md`
- `~/.claude/plugins/**/skills/skill-creator/SKILL.md`

任一命中即视为已安装 → 进入环节 5。全部 miss → 阻断式引导：

1. 纯文本说明：「本 welcome 流程依赖官方 `skill-creator` 来生成骨架 skill，当前未检测到安装。」
2. 给出安装提示：官方渠道通常在 `claude-plugins-official` marketplace，命令形如 `/plugin install skill-creator@claude-plugins-official`（以官方文档为准）
3. AUQ 单选 3 选项：
   - **我已装好，请继续** → 重新做 Glob 检测；若仍 miss 则再次阻断并 AUQ 询问，不要无限循环 poll
   - **暂时先不派生，退出** → 结束流程，不生成任何文件
   - **打开安装文档** → 提示用户参考 `https://docs.claude.com/en/docs/claude-code/plugins`（以官方路径为准）

重检测通过后进入环节 5。

### 环节 5. 通用参数 + 派生范围

本环节一次性采集多项参数。**派生范围用 multiSelect**，其余按下述类型。因为派生范围候选有 7 个（超出单个 AUQ 的 4 选项上限），需要**拆成两个 AUQ 同轮发起**。

#### 环节 5.1 派生范围（**multiSelect = true，拆成 2 个 AUQ**）

AUQ 单个问题最多 4 个 options，派生候选有 7 个，必须拆。**Read `references/scope-split-plan.md`**，按其中固定方案的 JSON 骨架同轮发起 2 个 multiSelect 问题（问题 A：主轴+轻守门四件套；问题 B：全量审计+接收端核验三件套）。

合并两个问题答案为 `selected`。**全部不勾 → 视为"放弃派生"**，结束流程，不生成任何文件。

`{{uiLanguage}} = English` 时 welcome 需把 scope-split-plan 里的中文 question / description 译为英文再填 AUQ（`label` 字段即 skill name 不翻译）。

#### 环节 5.2 项目代号 `{{projectCode}}`（单选，Other 自由输入）

- 默认：**用 `git rev-parse --show-toplevel` 取仓库根目录名**，再 `basename` 取最末段。不要用 `pwd` / `basename $(pwd)`——用户可能从子目录启动 welcome，会得到错误的代号
- 备选：仓库根目录名的首字母缩写；其他（Other 自由输入）
- 如果 `git rev-parse` 失败（不在 git 仓库内）→ fallback 到 `basename $(pwd)`，并在 AUQ 里提醒用户"未检测到 git 仓库，代号基于当前目录"

#### 环节 5.3 生成位置 `{{targetRoot}}`（单选）

- **项目层** `.claude/skills/`（随 git 共享）
- **个人层** `~/.claude/skills/`（只对当前用户）

### 环节 6. 命名方案（单独 AUQ 单选，后置于环节 5）

环节 5 已经拿到 `projectCode` 才能为命名提供默认值，所以命名放这里单问：

- **机械式默认**：`<原 name>-{{projectCode}}`
- **统一短代号**：让用户一次输入短代号（如 `df`、`jjj`），所有派生版复用（Other 走自由文本）
- **逐份完全自定义**：对 `selected` 每一份发起独立 AUQ 让用户输入（批量时分批，每批最多 4 题）

输出映射表 `namingMap = {原 name: 目标 name}`。

### 环节 7. 逐份追问项目特有内容

#### 环节 7.1 预扫项目档案（**必做，在任何追问前**）

**Read `references/derivation-fields-catalog.md` 的「预扫项目档案」章节**，按其中规则对项目做一轮静态扫描：

- Read `<repo>/CLAUDE.md`
- Read `<repo>/.claude-plugin/marketplace.json`（如存在）
- Glob `<repo>/plugins/*/`
- Bash `git log --oneline -20`（读出真实 commit 格式）
- Read `<repo>/package.json` / `pyproject.toml`（如存在）

收集到的值作为后续 AUQ 选项的**默认项**（"默认：..."前缀 + 一键确认）。**预扫失败不阻断**——该字段退回 catalog 里规定的通用默认 / `留 TODO`。

#### 环节 7.2 逐份 AUQ

对 `selected` 中每一份 skill，按 catalog 文件的字段表发起追问：

- 每份 skill 建议合并为 1 次 AUQ（最多 4 道子问题）
- 字段分类：**必填 / 推荐 / 可选**
  - 必填字段未填 → 不得继续，再次追问（单独 AUQ，只问未填项）
  - 推荐/可选字段未填 → 用 `TODO: 请补充 <字段名>` 占位
- 字段若有明确候选用单选或 multiSelect；否则 Other 自由文本
- **优先使用环节 7.1 预扫得到的默认值**作为首选项

不得凭空编造答案。

### 环节 8. 落盘清单确认 + 委派 skill-creator

#### 环节 8.1 展示落盘清单（纯文本，不用 AUQ）

用 `{{uiLanguage}}` 输出一张表：每行一份定制版，包含 `目标 name` / `目标绝对路径` / 必填字段是否全部有实值（有/留 TODO）。简洁列出，不要逐份粘贴完整内容（完整预览**不做**——用户随时可在落盘后打开文件检查，或随时中止）。

#### 环节 8.2 单次 AUQ 确认

AUQ 单选 2 选项：

- **确认落盘** → 进入环节 8.3
- **终止** → 结束流程，不生成任何文件；已采集的参数在会话结束后丢失

#### 环节 8.3 委派 skill-creator

**Read `references/skill-creator-prompt-template.md`**，对 `selected` 中每份 skill 按模板变量填空后，用 Skill 工具**串行**调用 `skill-creator`（不要并行）。

每次调用只建一份 skill。skill-creator 返回错误 → AUQ 单选让用户选择"重试 / 跳过该份 / 终止全部"，不要静默失败。

至少 1 份成功落盘 → 进入环节 9。全部失败 / 用户在失败后选"终止全部" → 跳过环节 9，直接到环节 10 收尾。

### 环节 9. 文档登记子环节（主动提醒，不强制）

**Read `references/doc-registration-flow.md`**，按其中流程：

1. AUQ 多选询问要登记到哪些文档：`CLAUDE.md` / `AGENTS.md` / `MEMORY.md` / `都不登记`
2. 对每个勾选的目标文件，Glob 检测存在性；不存在则单独 AUQ 询问"新建 / 输出到终端 / 跳过"
3. 存在则 Grep 查重后用 Edit 工具追加固定短文本；文本由「派生 skill 的 frontmatter description 首句」+ 固定模板组装，**不重新调用 skill-creator**
4. 产出 `docIndexResult`（updated / created / printed / skipped）给环节 10 收尾展示

关键约束：

- welcome 只在本环节被允许用 Write 工具（仅限 3.3 新建分支）；其他地方仍遵守"welcome 不写 SKILL.md 文件"的边界
- Edit 必须幂等（先 Grep 查重）
- 所有目标文件串行处理，不并行

### 环节 10. 收尾提示（纯文本）

用 `{{uiLanguage}}` 书写：

1. 列出 skill-creator 本次落盘的所有文件路径
2. 展示环节 9 的 `docIndexResult`——已更新 / 已新建 / 已输出到终端（需手贴）/ 已跳过
3. **⚠️ 修改了 skill 文件，需要重启 Claude Code 才能使改动生效**（加粗 + emoji 强调）
4. 告知用户：未填字段以 `TODO:` 形式留在正文，可稍后手动补全；补全后无需再跑 welcome

## 交互纪律

- **不展示环节编号或"Step X"标题给用户**——直接用自然段与 AUQ 沟通，编号只供本 SKILL.md 内部使用
- **选项互斥用单选；选项可共存用 multiSelect**——典型：派生范围（多选），命名方案（单选，方案互斥），意向分流（单选，分支互斥）
- **AUQ 单个问题最多 4 个选项**——超出需拆成独立问题（5.1 就是典型案例）
- **AUQ 每次调用最多 4 道题**——超过分批发起
- **用户回答"放弃 / 跳过"** → 立即退出，不要追问
- **纯文本段落精简**，避免长篇
- **不并行调用 skill-creator**（防 name 冲突 / 路径竞争）
- **frontmatter name/description 字段的 YAML 标识符保持英文**，只有 description 值与正文受 `{{docLanguage}}` 影响
- **welcome 自身不写 SKILL.md 文件**，落盘全部交给 skill-creator
- **`{{uiLanguage}}` 与 `{{docLanguage}}` 是独立变量**——一个管对话、一个管骨架正文，不要混用
