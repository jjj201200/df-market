---
name: release-creator-welcome
description: "release-creator 插件首次安装后的渐进式派生引导。当用户首次安装 release-creator、运行 /release-creator-welcome、或表达「为本项目派生一份 release skill」「把 release 流程固化成 skill」等意图时使用。职责：用 AskUserQuestion 同时收集沟通语言 + 骨架正文语言 → 价值阐述 → 意向分流 → skill-creator 依赖检测 → 选分支维度（生态 / 哲学 / 打包+tag / 穷举）→ 按维度追问 → Bump+Check 子环节（版本结构 / bump 方式 / check 范围与时机）→ 通用参数 / 命名 / 脚本落盘位置 → Override（展示骨架 + 各维度替代 + 自定义）→ 委派 skill-creator 同时落盘 SKILL.md + 配套脚本/hook/CI → 主动提醒是否登记到 CLAUDE.md / AGENTS.md / MEMORY.md。允许用户随时放弃。触发词：release-creator 欢迎、派生 release skill、welcome、release-creator-welcome、为本项目定制发布流程。"
---

# release-creator 首次安装引导（派生专属 release skill）

本 skill 的唯一职责是**用渐进式 AskUserQuestion 引导用户**为本项目派生一份 `release-<project>` skill。本 skill **不直接写任何 SKILL.md 文件**——最终落盘交给官方 `skill-creator`。

## 背景：为什么是元 skill 而不是通用发布器

业界主流 release 工具（Changesets / release-please / semantic-release）已经证明「通用发布器 + 零配置」不可兼得——每种工具都在版本决策哲学、打包粒度、tag 格式上被迫取舍。本插件跳出这个悖论：

- **release-creator 本身通用**——派生流程不绑定任何生态或仓库拓扑
- **被派生的 release skill 特化**——针对本项目的生态、哲学、打包方式、tag 约定写死，后续 release 直接按这份 skill 执行

派生一次、使用多次。不追求「下一个项目也能直接复用」。

## 本 skill 的辅助文件

- `references/language-options.md` —— 环节 1 语言 AUQ（同时采集沟通语言与骨架正文语言）
- `references/dimension-1-ecosystem-flow.md` —— 维度 1 生态派的分支追问清单（npm / Python / claude-plugin / docs ...）
- `references/dimension-2-philosophy-flow.md` —— 维度 2 哲学派的分支追问清单（commit 推导 / changeset / manual）
- `references/dimension-3-packaging-flow.md` —— 维度 3 打包+tag 派的分支追问清单（single-repo / monorepo / tag 格式）
- `references/dimension-4-exhaustive-flow.md` —— 维度 4 穷举派的完整字段矩阵（生态 × 哲学 × 打包 × tag 四象限都问）
- `references/template-master-ecosystem.md` —— 主模板：生态派骨架
- `references/template-master-philosophy.md` —— 主模板：哲学派骨架
- `references/template-master-packaging.md` —— 主模板：打包派骨架
- `references/template-ecosystem-npm.md` —— 生态子模板：npm / pnpm / yarn
- `references/template-ecosystem-python.md` —— 生态子模板：pyproject / poetry / hatch
- `references/template-ecosystem-claude-plugin.md` —— 生态子模板：Claude Code plugin（plugin.json + marketplace.json）
- `references/template-ecosystem-docs.md` —— 生态子模板：纯文档 / 静态站点
- `references/template-philosophy-commit.md` —— 哲学子模板：commit 约定推导版本（semantic-release 派）
- `references/template-philosophy-changeset.md` —— 哲学子模板：手写变更清单（Changesets 派）
- `references/template-philosophy-manual.md` —— 哲学子模板：人工指定版本号
- `references/template-tag-simple.md` —— tag 子模板：`v<version>`
- `references/template-tag-prefixed.md` —— tag 子模板：`<plugin>-v<version>`
- `references/template-tag-scoped.md` —— tag 子模板：`@scope/pkg@<version>` / monorepo 聚合
- `references/bump-check-flow.md` —— 环节 6.5 Bump+Check 子环节 flow（6 道 AUQ 题干 / 去重规则 / 默认值推导表）
- `references/bump-catalog.md` —— 6.5 Q2 每个选项的命令片段 + 脚本骨架库（生态 × 触发方式交叉）
- `references/check-catalog.md` —— 6.5 Q4 每个检查项的 bash/hook/CI 三种宿主展开
- `references/hook-templates.md` —— 6.5 Q5 pre-push/pre-commit/CI yaml 的宿主文件骨架
- `references/override-catalog.md` —— 环节 8 Override 的替代选项清单 + 自定义字段提示
- `references/skill-creator-prompt-template.md` —— 委派 skill-creator 的 prompt 模板（含附属资产落盘段）
- `references/doc-registration-flow.md` —— 环节 9.5 文档登记子环节 flow（落盘后主动提醒是否登记到 CLAUDE.md / AGENTS.md / MEMORY.md）

执行到对应环节时 Read 对应 reference；不要在本 SKILL.md 中重复那里的内容。

## 执行流程

流程分为下述 12 个有序环节（其中 6.5 是 6 之后、7 之前的子环节；9.5 是 9 之后、10 之前的子环节）。**对用户不要展示环节编号或"Step X"标题**——直接用自然段和 AUQ 与用户沟通；编号只供本 SKILL.md 内部交叉引用。

### 环节 1. 语言（一次 AUQ 同时发起两问）

**Read `references/language-options.md`**，按其中 JSON 骨架同时发起**两个问题**（AUQ 的 `questions` 数组含 2 个 object）：

- 第一问 → `{{uiLanguage}}`：welcome 跟用户沟通用的语言（所有后续纯文本段、AUQ 文案、错误提示都用这个）
- 第二问 → `{{docLanguage}}`：派生出的 SKILL.md 正文语言（frontmatter 的 YAML 标识符保持英文不变，只有 description 值与正文受此影响）

> 两个变量相互独立——用户可能用中文沟通但生成英文 SKILL.md，反之亦然。不要凭一个答案推断另一个。

### 环节 2. 价值阐述（纯文本，不用 AUQ）

用 `{{uiLanguage}}` 写一段简短文本向用户说明：

1. 本插件不做任何 release 动作——它只帮你生成一份 `release-<project>` skill
2. 派生的价值：把本项目的生态（npm / pyproject / plugin.json ...）、版本决策哲学（commit 推导 / changeset / 手动）、打包粒度（单包 / monorepo）、tag 格式写死进一份 skill，之后 release 就是「调用这份 skill」而不是每次现搭
3. 派生成本较低：平均 5–8 次 AUQ 回合，每道题都支持「Other 自由输入」或「跳过/终止」

### 环节 3. 意向分流（AUQ 单选，2 选项）

问题：「是否现在为本项目派生一份专属 release skill？」

- **直接开始派生** → 进入环节 4
- **暂时跳过** → 直接结束，用一句话提示「随时可再跑 `/release-creator-welcome`」后退出

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

### 环节 5. 第一道核心 AUQ：选分支维度（单选 4 选项）

这是本 welcome 最关键的一道题。**不要试图自动推断**——用户自己最清楚想用哪种视角切入。

问题：「想以什么视角来为本项目定制 release skill？」

- **维度 1 · 生态** → 从「项目属于哪种生态」（npm / Python / claude-plugin / docs / ...）出发反推版本哲学与 tag 格式。适合技术栈单一、想要「开箱即用套餐」的项目
- **维度 2 · 哲学** → 从「版本号怎么决策」（commit 自动推导 / 手写 changeset / 完全人工）出发反推打包粒度与 tag 格式。适合对版本决策有明确主张的团队
- **维度 3 · 打包 + tag** → 从「一次 release 动哪些包」和「tag 长什么样」出发反推其他。适合 monorepo / 多插件仓库（如 df-market 本身）
- **维度 4 · 穷举** → 四象限全问一遍。适合既不确定、又想一次把所有决策显式化的项目（生成的 skill 最长但最明确）

记录用户选择为 `{{dimension}}`（取值 `ecosystem` / `philosophy` / `packaging` / `exhaustive`）。

### 环节 6. 分维度追问

根据 `{{dimension}}` Read 对应 reference 并按其中的问答清单发起 AUQ。

- `ecosystem` → Read `references/dimension-1-ecosystem-flow.md`
- `philosophy` → Read `references/dimension-2-philosophy-flow.md`
- `packaging` → Read `references/dimension-3-packaging-flow.md`
- `exhaustive` → Read `references/dimension-4-exhaustive-flow.md`

每份 flow reference 自带「预扫项目档案」章节——在追问前先做静态扫描（Read `package.json` / `pyproject.toml` / `.claude-plugin/marketplace.json` / `plugins/*/` / `git log --oneline -20` 等），把扫到的值作为 AUQ 的**默认项**。预扫失败不阻断——该字段退回 reference 里规定的通用默认 / 留 `TODO:` 占位。

追问过程中 AUQ 纪律：

- 每次 AUQ 最多 4 道题，超过分批
- 单个问题最多 4 个 options（Other 不占额）
- 必填字段未填 → 再次追问（单独 AUQ，只问未填项），不得继续
- 推荐/可选字段未填 → `TODO: 请补充 <字段名>` 占位
- 不得凭空编造答案

输出一个键值映射 `{{projectAnswers}}`，供环节 6.5 / 7 / 9 使用。

### 环节 6.5. Bump + Check 子环节（所有维度共同后置）

**无论环节 5 选了哪个维度，本子环节都必须走一遍**（穷举派把它作为第四轮前半强制展示）。

**Read `references/bump-check-flow.md`**，按其中 6 道 AUQ（分 2 轮）采集版本决策的执行细节：

- 轮 A（单选 × 3）：版本号结构 / Bump 触发方式 / Bump 范围（仅 monorepo）
- 轮 B（多选 × 1 + 单选 × 2）：Check 范围 / Check 时机 / 镜像字段复用

本子环节的核心产出是 `{{projectAnswers}}` 里新增的 7 个字段：`versionStructure` / `versionRegex` / `bumpTrigger` / `bumpScope` / `checkScope[]` / `checkTiming` / `extraMirrorFiles[]`。

这些字段将在环节 9 被 skill-creator **查表组装成**：

1. 派生 SKILL.md 里的 `{{bumpBlock}}` / `{{checkBlock}}` 章节文字
2. 配套脚本 `{{scriptsDir}}/bump-version.<ext>` / `{{scriptsDir}}/check-version.<ext>`（按 `bumpTrigger` / `checkTiming` 决定是否生成）
3. Hook / CI 文件 `.githooks/pre-push` / `.github/workflows/release-check.yml`（按 `checkTiming` 决定）

**去重规则**：进入 6.5 前按 `bump-check-flow.md` 第 1 节"去重快速通道"表判断跳过哪些题；穷举派即使命中跳过条件也强制展示，继承值作为 option 第一位。

### 环节 7. 通用参数（命名 + 落盘位置）

无论维度怎么选，最终都要决定下述参数：

#### 环节 7.1 项目代号 `{{projectCode}}`（单选，Other 自由输入）

- 默认：用 `git rev-parse --show-toplevel` 取仓库根目录名，再 `basename` 取最末段。不要用 `pwd` / `basename $(pwd)`——用户可能从子目录启动 welcome
- 备选：仓库根目录名的首字母缩写；其他（Other 自由输入）
- `git rev-parse` 失败（不在 git 仓库内）→ fallback 到 `basename $(pwd)`，并在 AUQ 里提醒「未检测到 git 仓库，代号基于当前目录」

#### 环节 7.2 派生 skill 命名 `{{targetName}}`（单选）

- 机械式默认：`release-{{projectCode}}`
- 简短：`release-<短代号>`（用户输入短代号，走 Other）
- 完全自定义：用户直接输入目标 name

#### 环节 7.3 生成位置 `{{targetRoot}}`（单选）

- **项目层** `.claude/skills/`（随 git 共享，推荐）
- **个人层** `~/.claude/skills/`（只对当前用户）

#### 环节 7.4 脚本落盘目录 `{{scriptsDir}}`（单选，仅当环节 6.5 会生成脚本/hook/CI 时出现）

当 `{{projectAnswers}}.bumpTrigger = generate-script` 或 `{{projectAnswers}}.checkTiming ∈ {pre-push-hook, pre-commit-hook, ci}` 时出现。否则跳过。

- **仓库根 `scripts/`**（推荐默认）
- **`.claude/scripts/`**（不与仓库其他构建脚本混淆）
- **`<targetRoot>/../scripts/`**（与派生 skill 同级 skills 目录平级）
- **Other**（用户自由输入）

#### 环节 7.5 脚本语言 `{{scriptLanguage}}`（单选，仅当 6.5 会生成脚本时出现）

默认值按生态推导（npm→`cjs` / Python→`py` / claude-plugin→`cjs` / docs-only→`sh` / Other→`sh`），用户可在此 override：

- `cjs`（Node.js CommonJS，无需额外依赖）
- `py`（Python 3.11+，需要 `tomllib` 或用户生态自带）
- `sh`（POSIX bash，任意平台兜底）

### 环节 8. Override（展示默认骨架 + 各维度替代 + 自定义字段）

**Read `references/override-catalog.md`**，根据 `{{dimension}}` 和 `{{projectAnswers}}` 组装一份**默认骨架预览**（纯文本展示章节标题与关键决策；**不展示完整正文**——完整 SKILL.md 由环节 9 的 skill-creator 生成）。

给用户 4 选项（AUQ 单选）：

- **接受默认骨架** → 直接进入环节 9
- **改某个维度的决策**（展示 3 个常见替代供选择）→ 多轮 AUQ 采集
- **添加自定义字段**（用户自由输入字段名 + 默认值）→ 自由文本采集
- **终止** → 结束流程，不生成任何文件

改动产生 `{{overrides}}` 映射，合并到 `{{projectAnswers}}`。

### 环节 9. 落盘清单确认 + 委派 skill-creator

#### 环节 9.1 展示落盘清单（纯文本，不用 AUQ）

用 `{{uiLanguage}}` 输出：

- 目标 name、目标绝对路径
- 维度、选中的生态 / 哲学 / 打包模式 / tag 格式
- 版本结构 / Bump 触发方式 / Check 时机（来自环节 6.5）
- **附属资产清单**（根据 6.5 + 7.4 + 7.5 派生）：
  - 若 `bumpTrigger = generate-script` → `{{scriptsDir}}/bump-version.{{scriptExt}}`
  - 若 `checkTiming ∈ {pre-push-hook, pre-commit-hook}` → `{{scriptsDir}}/check-version.{{scriptExt}}` + `.githooks/<timing>`
  - 若 `checkTiming = ci` → `.github/workflows/release-check.yml`
- 必填字段是否全部有实值（有/留 `TODO:`）

简洁列出，不要逐段粘贴完整正文。

#### 环节 9.2 单次 AUQ 确认

AUQ 单选 2 选项：

- **确认落盘** → 进入环节 9.3
- **终止** → 结束流程，不生成任何文件；已采集的参数在会话结束后丢失

#### 环节 9.3 委派 skill-creator

**Read `references/skill-creator-prompt-template.md`**，按模板变量填空后用 Skill 工具调用 `skill-creator`。单次调用让 skill-creator 建**一份 SKILL.md + 若干附属资产**（脚本 / hook / CI yaml）。

根据 `{{dimension}}` 选择主模板：

- `ecosystem` → `template-master-ecosystem.md`
- `philosophy` → `template-master-philosophy.md`
- `packaging` → `template-master-packaging.md`
- `exhaustive` → 三份主模板按需组合（穷举维度自带四象限，正文最长）

再根据 `{{projectAnswers}}` 里的具体值拼入对应的生态 / 哲学 / tag 子模板，以及 **bump-catalog.md / check-catalog.md / hook-templates.md 对应章节**（由 6.5 采集的字段决定拼入哪些）。

skill-creator 需要同时完成：

1. 落派生 SKILL.md（路径：`{{targetRoot}}/{{targetName}}/SKILL.md`）
2. 按 6.5 Q2/Q5 落附属资产文件（bump 脚本 / check 脚本 / hook / CI yaml）；不需要时**不落**
3. 为所有脚本 / hook 文件设可执行位

skill-creator 返回错误 → AUQ 单选让用户选择「重试 / 终止」，不要静默失败。

派生 SKILL.md 成功落盘 → 进入环节 9.5。若整份失败（SKILL.md 都没成功）→ 跳过 9.5，直接到环节 10 收尾。附属资产失败但 SKILL.md 成功 → 仍进入 9.5，但登记条目里要标注"部分附属资产失败"。

### 环节 9.5. 文档登记子环节（主动提醒，不强制）

**Read `references/doc-registration-flow.md`**，按其中流程：

1. AUQ 多选询问要登记到哪些文档：`CLAUDE.md` / `AGENTS.md` / `MEMORY.md` / `都不登记`
2. 对每个勾选的目标文件，Glob 检测存在性；不存在则单独 AUQ 询问"新建 / 输出到终端 / 跳过"
3. 存在则 Grep 查重后用 Edit 工具追加固定短文本；文本由「派生 SKILL.md 的 frontmatter description 首句」+ 固定模板 + 实际落盘的附属资产清单条件展开，**不重新调用 skill-creator**
4. 产出 `docIndexResult`（updated / created / printed / skipped）给环节 10 收尾展示

关键约束：

- welcome 只在本环节被允许用 Write 工具（仅限 `doc-registration-flow.md` 3.3 新建分支）；其他地方仍遵守"welcome 不写 SKILL.md 文件"的边界
- Edit 必须幂等（先 Grep 查重）
- 所有目标文件串行处理，不并行
- 附属资产列表按 `{{projectAnswers}}.bumpTrigger / .checkTiming` 条件填充，不列不存在的文件

### 环节 10. 收尾提示（纯文本）

用 `{{uiLanguage}}` 书写：

1. 列出 skill-creator 本次落盘的**所有文件路径**（SKILL.md + 附属脚本 / hook / CI yaml）
2. 展示环节 9.5 的 `docIndexResult`——已更新 / 已新建 / 已输出到终端（需手贴）/ 已跳过
3. **⚠️ 修改了 skill 文件，需要重启 Claude Code 才能使改动生效**（加粗 + emoji 强调）
4. 若 `checkTiming ∈ {pre-push-hook, pre-commit-hook}` 且落盘位置是 `.githooks/` → 提醒用户执行 `git config core.hooksPath .githooks` 启用
5. 若 `checkTiming = ci` 且仓库非 GitHub → 提醒用户按顶部 TODO 翻译 workflow 到目标 CI 平台
6. 告知用户：未填字段以 `TODO:` 形式留在正文，可稍后手动补全；补全后无需再跑 welcome
7. 提示：首次 release 时直接对 Claude 说「release 一下」或「发布 `<plugin>` 到 X.Y.Z」即可触发派生出的 skill

## 交互纪律

- **不展示环节编号或"Step X"标题给用户**——直接用自然段与 AUQ 沟通，编号只供本 SKILL.md 内部使用
- **选项互斥用单选；选项可共存用 multiSelect**
- **AUQ 单个问题最多 4 个选项**——超出需拆成独立问题
- **AUQ 每次调用最多 4 道题**——超过分批发起
- **用户回答"放弃 / 跳过"** → 立即退出，不要追问
- **纯文本段落精简**，避免长篇
- **不并行调用 skill-creator**（防 name 冲突 / 路径竞争）
- **frontmatter name/description 字段的 YAML 标识符保持英文**，只有 description 值与正文受 `{{docLanguage}}` 影响
- **welcome 自身不写 SKILL.md 文件**，落盘全部交给 skill-creator
- **`{{uiLanguage}}` 与 `{{docLanguage}}` 是独立变量**——一个管对话、一个管骨架正文，不要混用
- **派生出的 release skill 是「项目特化」的**——不追求跨项目复用；下一个项目重新跑一遍 welcome 即可
