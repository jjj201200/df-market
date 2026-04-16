# 环节 9 · 文档登记子环节 flow

环节 8.3 串行委派 skill-creator 全部成功落盘之后、环节 10 收尾提示之前，welcome 主动提醒用户把本次派生的定制版**登记到项目级文档索引**里。登记是可选的——skill 发现机制基于 frontmatter 自动扫描，不登记也能跑。登记的价值是**让协作者一眼看到本项目有哪些定制版**。

本子环节严格不越界：

- welcome 只**提醒并询问**；执行落点由用户在 AUQ 里选
- 用户选"不登记"→ 静默跳过，不留痕
- 用户选"登记"→ welcome 用 Edit 工具把固定短文本**追加**到用户指定的文件；不编排、不改动已有段落、不重写文件
- 目标文件不存在 → 再问一次"新建 / 输出到终端供手动粘贴 / 跳过"，永远不会无声新建文件

---

## 1. 触发条件

- 环节 8.3 至少有 1 份 skill **成功落盘**
- 全失败 / 中途 "终止全部" 用户选项触发 → 本环节整段跳过

## 2. 第一道 AUQ：是否登记 + 登记到哪里

```json
{
  "question": "要不要把本次派生的定制版登记到项目文档索引，方便协作者发现？（可多选；不登记也完全 OK，skill 本身已经能被 Claude Code 自动发现）",
  "header": "Doc index",
  "multiSelect": true,
  "options": [
    {
      "label": "CLAUDE.md",
      "description": "项目级 Claude Code 主文档。追加到 Plugin: skill-keeper 段末尾（或新建该段）"
    },
    {
      "label": "AGENTS.md",
      "description": "其他 agent 工具的共享文档。追加到文件末尾的 Project Skills 段（或新建该段）"
    },
    {
      "label": "MEMORY.md",
      "description": "auto-memory 索引。在 ## Reference 段加一行指针。注意：MEMORY.md 属于 auto-memory 系统，welcome 从外部写入属于显式授权行为"
    },
    {
      "label": "都不登记",
      "description": "skill 已经能被 Claude Code 扫描发现；如果你的项目不需要在文档里显式提及，选这个即可"
    }
  ]
}
```

- 勾选「都不登记」或一个选项都不勾 → 跳到环节 10 收尾
- 勾选了 N 个目标文件（1–3）→ 对每个文件单独走第 3 节的"存在性检查 → 写入 / 兜底"流程（串行，不并行避免 Edit 竞态）

## 3. 每个目标文件的处理流程

### 3.1 存在性检查

Glob `<repo>/<fileName>`（fileName ∈ CLAUDE.md / AGENTS.md / MEMORY.md）。`<repo>` 取 `git rev-parse --show-toplevel`；MEMORY.md 的实际路径是 `~/.claude/projects/<project-hash>/memory/MEMORY.md`（welcome 读 env 推断），不在仓库里。

- 命中 → 进入 3.2 抽取 description
- 未命中 → 进入 3.3 缺失分支

### 3.2 抽取派生 skill 的 description（固定模板 + description 组装）

对每份已落盘的定制版：

1. Read `<targetRoot>/<targetName>/SKILL.md`
2. 从 frontmatter 抽 description 字段（`grep -E '^description:'` + 剥引号）
3. 取 description 首个完整句（以中文句号 `。` / 英文 `.` 截断；不含「Use when...」样板前缀）
4. 如果 description 不足 1 句 → 退回到 `TODO: 描述一下 <targetName> 的用途`

组装成每份 skill 一行的登记条目，按目标文件的**风格模板**格式化（见 3.4）。

### 3.3 目标文件缺失分支（AUQ 单选）

```json
{
  "question": "<fileName> 不存在。怎么处理？",
  "header": "Missing",
  "multiSelect": false,
  "options": [
    {
      "label": "新建文件并写入登记段",
      "description": "welcome 会用 Write 工具创建 <fileName>，写入一个最小骨架 + 本次登记条目"
    },
    {
      "label": "输出登记文本到终端",
      "description": "welcome 把要追加的完整文本打印到对话，你自己决定贴到哪里"
    },
    {
      "label": "跳过该文件",
      "description": "本次不登记到 <fileName>，其他目标文件继续处理"
    }
  ]
}
```

- 新建 → 用 Write 工具创建文件（仅此一处 welcome 允许 Write）；骨架最小化，见 3.5
- 输出到终端 → 纯文本打印完整 snippet，用户自己 Edit
- 跳过 → 不做任何事

### 3.4 登记条目风格模板（每目标文件独立）

#### CLAUDE.md

追加到**现有的** `## Plugin: skill-keeper` 段末尾（若存在）。定位方法：

- Read CLAUDE.md → 用 Grep 找 `^## Plugin: skill-keeper$`
- 命中 → 找到该段的下一个 `^## ` 或 EOF 作为段结束位置
- 未命中 → 追加到文件末尾一个新段：`## Plugin: skill-keeper`

登记文本模板：

```markdown
### 本项目已派生的定制版

- `{{targetName}}` (.claude/skills/{{targetName}}/) —— {{descriptionFirstSentence}}
<!-- 对每份 skill 重复一行 -->
```

**幂等性**：Edit 之前先 Grep 检查 `` `{{targetName}}` `` 在 CLAUDE.md 是否已存在；已存在则跳过该行（不重复追加）。子标题 `### 本项目已派生的定制版` 若已存在 → 追加在其下；不存在则连带追加。

#### AGENTS.md

追加到文件末尾新段（或现有的 `## Project Skills` 段）：

```markdown
## Project Skills

- `{{targetName}}` — {{descriptionFirstSentence}}
```

同样做幂等检查。

#### MEMORY.md

MEMORY.md 是 auto-memory 索引。Read 现有文件，找到 `## Reference` 段，追加一行：

```markdown
- [{{targetName}}](../../skills/{{targetName}}/SKILL.md) — {{descriptionFirstSentence}}
```

**注意**：MEMORY.md 实际路径是 `~/.claude/projects/<hash>/memory/MEMORY.md`；登记条目的相对路径 `../../skills/<name>/SKILL.md` 是指向 `~/.claude/skills/`——仅当 `{{targetRoot}} = ~/.claude/skills/` 时路径才通。若 `{{targetRoot}} = .claude/skills/`（项目层），MEMORY.md 登记的链接需要改写成项目绝对路径。welcome 在 AUQ 里对这种情况**加一行提示**：

> "你的派生版落在项目层（.claude/skills/），MEMORY.md 的链接将使用项目绝对路径。"

### 3.5 新建文件时的最小骨架

#### CLAUDE.md（若从零开始）

```markdown
# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库工作时提供指引。

## Plugin: skill-keeper

### 本项目已派生的定制版

- `{{targetName}}` (.claude/skills/{{targetName}}/) —— {{descriptionFirstSentence}}
```

#### AGENTS.md

```markdown
# AGENTS.md

本文件列出本项目对各类 agent 工具可见的 skill 与约定。

## Project Skills

- `{{targetName}}` — {{descriptionFirstSentence}}
```

#### MEMORY.md

如果 welcome 检测到 `~/.claude/projects/<hash>/memory/MEMORY.md` 不存在，**不新建**——MEMORY.md 属于 auto-memory 系统的产物，它的创建时机由 Claude 决定；welcome 从外部 Write 会与 auto-memory 的语义冲突。此分支改为"输出到终端"，提示用户"自行决定何时 / 以何种方式写入 auto-memory 索引"。

## 4. 幂等与失败处理

- 每个目标文件 Edit 前先 Grep 查重，避免重复追加同一 `{{targetName}}` 行
- Edit 失败（如文件被锁 / 权限问题）→ 报错后 AUQ 让用户选"重试 / 输出到终端 / 跳过该文件"
- 所有目标文件串行处理；单文件失败不影响其他文件

## 5. 输出汇总（给环节 10 收尾提示用）

本环节结束时产出 `docIndexResult` 给环节 10:

```
docIndexResult = {
  updated: [<文件绝对路径>, ...],        # 成功 Edit 的文件
  created: [<文件绝对路径>, ...],        # Write 新建的文件
  printed: [<文件名>, ...],              # 输出到终端的目标
  skipped: [<文件名>, ...]               # 用户显式跳过 / 失败后跳过的目标
}
```

环节 10.4 收尾时把这份汇总展示给用户：

- "已更新: <updated>"
- "已新建: <created>"
- "已输出到终端: <printed>（请手动粘贴到这些文件）"
- "已跳过: <skipped>"

## 6. 硬性约束

- **绝不自动 Write MEMORY.md 新文件**——只读 + 可追加
- **Edit 之前必须 Grep 查重**——避免重复登记
- **串行处理目标文件**——不并行 Edit 同一文件簇
- **目标文件 = 用户选**——不在 AUQ 之外做任何"自作主张"的登记
- **文本固定短模板**——不调用 skill-creator 二次生成（Q5 决策 c）
- **welcome 仅允许 Write 骨架文件**（3.3 新建分支），除此之外不得 Write
