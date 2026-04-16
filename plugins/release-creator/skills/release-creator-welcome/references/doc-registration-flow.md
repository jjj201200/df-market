# 环节 9.5 · 文档登记子环节 flow

环节 9.3 委派 skill-creator 成功落盘之后、环节 10 收尾提示之前，welcome 主动提醒用户把派生的 release skill **登记到项目级文档索引**里。登记是可选的——skill 发现机制基于 frontmatter 自动扫描，不登记也能跑。登记的价值是**让协作者一眼看到本项目有专属的 release skill**（以及附属的 bump/check 脚本、hook、CI yaml 这些"看起来像项目基础设施"的资产是从哪里来的）。

本子环节严格不越界：

- welcome 只**提醒并询问**；执行落点由用户在 AUQ 里选
- 用户选"不登记"→ 静默跳过，不留痕
- 用户选"登记"→ welcome 用 Edit 工具把固定短文本**追加**到用户指定的文件
- 目标文件不存在 → 再问一次"新建 / 输出到终端供手动粘贴 / 跳过"

---

## 1. 触发条件

- 环节 9.3 skill-creator **成功落盘** SKILL.md（附属资产失败不阻断，但需要在登记条目里标注"部分资产失败"）
- 整份失败 → 本环节整段跳过

## 2. 第一道 AUQ：是否登记 + 登记到哪里

```json
{
  "question": "要不要把本次派生的 release skill 登记到项目文档索引，方便协作者发现？（可多选；不登记也完全 OK，skill 本身已经能被 Claude Code 自动发现）",
  "header": "Doc index",
  "multiSelect": true,
  "options": [
    {
      "label": "CLAUDE.md",
      "description": "项目级 Claude Code 主文档。追加到现有的 Plugin: release-creator 段末尾（或新建该段）"
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
- 勾选了 N 个目标文件 → 对每个文件单独走第 3 节流程（串行）

## 3. 每个目标文件的处理流程

### 3.1 存在性检查

同 skill-keeper 的 `doc-registration-flow.md` 第 3.1 节（路径检测）。

### 3.2 抽取派生 skill 的 description + 附属资产清单

对已落盘的定制版：

1. Read `<targetRoot>/<targetName>/SKILL.md`
2. 从 frontmatter 抽 description 字段，取首个完整句
3. **特别地**：release skill 通常附带脚本/hook/CI yaml，登记条目要列出这些资产路径（让协作者明白仓库里的 `scripts/bump-version.cjs` 是 release-creator 派生出来的，不是手写的）
4. 组装登记文本（见 3.4）

### 3.3 目标文件缺失分支（AUQ 单选）

与 skill-keeper 的 `doc-registration-flow.md` 第 3.3 节完全一致：

- 新建文件并写入登记段
- 输出登记文本到终端
- 跳过该文件

### 3.4 登记条目风格模板

#### CLAUDE.md

追加到现有 `## Plugin: release-creator` 段末尾（若存在），或追加到文件末尾新段。登记文本模板：

```markdown
### 本项目已派生的 release skill

- `{{targetName}}` (.claude/skills/{{targetName}}/) —— {{descriptionFirstSentence}}

**附属资产**（由 skill-creator 在派生时生成）：

- `{{scriptsDir}}/bump-version.{{scriptExt}}` —— bump 脚本（仅当 bumpTrigger=generate-script）
- `{{scriptsDir}}/check-version.{{scriptExt}}` —— check 脚本（仅当 checkTiming=pre-push-hook / pre-commit-hook）
- `{{hookLocation}}pre-push` / `{{hookLocation}}pre-commit` —— git hook（按 checkTiming；hookLocation 可能是 `.git/hooks/` / `.githooks/` / `.husky/`）
- `.github/workflows/release-check.yml` —— CI workflow（仅当 checkTiming=ci）
```

**条件填充**：welcome 读 `{{projectAnswers}}.bumpTrigger` / `.checkTiming`，只列**实际落盘**的资产，未落盘的整行省略。如果一个资产都没有（`bumpTrigger=manual` 且 `checkTiming=inline`），整段「附属资产」省略。

**幂等性**：Edit 之前 Grep 查 `` `{{targetName}}` `` 是否已存在；已存在则整段跳过。

#### AGENTS.md

追加到文件末尾 `## Project Skills` 段：

```markdown
## Project Skills

- `{{targetName}}` — {{descriptionFirstSentence}}（含 bump 脚本 / check / hook 等附属资产——详见项目 CLAUDE.md）
```

若用户未同时登记 CLAUDE.md 但勾了 AGENTS.md → 把附属资产路径直接展开到 AGENTS.md 这一行的末尾括号内（避免协作者只看 AGENTS.md 时信息不全）。

#### MEMORY.md

MEMORY.md 的 ## Reference 段追加：

```markdown
- [{{targetName}}](<relpath>) — 本项目专属 release skill
```

`<relpath>` 的取值规则与 skill-keeper 版 `doc-registration-flow.md` 的第 3.4 节 MEMORY.md 段完全一致（项目层 vs 个人层 targetRoot 的路径不同）。

### 3.5 新建文件时的最小骨架

新建 CLAUDE.md 骨架：

```markdown
# CLAUDE.md

本文件为 Claude Code 在本仓库工作时提供指引。

## Plugin: release-creator

### 本项目已派生的 release skill

- `{{targetName}}` (.claude/skills/{{targetName}}/) —— {{descriptionFirstSentence}}
```

新建 AGENTS.md / 不新建 MEMORY.md 的规则同 skill-keeper 版 `doc-registration-flow.md`。

## 4. 幂等与失败处理

- Edit 前必 Grep 查重
- Edit 失败 → AUQ 让用户选"重试 / 输出到终端 / 跳过"
- 串行处理目标文件

## 5. 输出汇总

```
docIndexResult = {
  updated: [<path>, ...],
  created: [<path>, ...],
  printed: [<name>, ...],
  skipped: [<name>, ...]
}
```

交给环节 10 收尾提示里展示。

## 6. 硬性约束

- **绝不自动 Write MEMORY.md 新文件**
- **Edit 之前必 Grep 查重**
- **目标文件 = 用户选**
- **文本固定短模板**，不调用 skill-creator 二次生成
- **附属资产列表按实际落盘情况条件填充**，不凭空列出不存在的文件
- **welcome 仅允许 Write 骨架文件**（3.3 新建分支），除此之外不得 Write
