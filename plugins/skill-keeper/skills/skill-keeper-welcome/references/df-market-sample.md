# df-market 派生范例（welcome「先看示例」分支用）

本文件在 welcome 环节 3 用户选「先看示例」分支时被 Read。包含两份示范（`recap` 与 `sync-check` 定制版），覆盖**编排型**与**守门型**两种 skill 的差异化填法。

**展示纪律**：

- welcome 读取本文件后，**按 `{{uiLanguage}}` 翻译或改写展示文案**（以下示范以中文为主；`{{uiLanguage}} = English` 时需把文案译为英文后展示）
- 不要把整份 SKILL.md 示例塞进一个代码块——那会让 Markdown 预览不生效。改为**段落性叙述 + 关键字段分行展示 + 必要时用短代码块**
- 只展示骨架轮廓，**不要逐字复述所有正文**——目的是让用户直观感受"定制版的填空粒度"，而不是让用户抄

---

## 示范 1：编排型定制版（基于 recap）

**文件**：`.claude/skills/skill-recap-df-market/SKILL.md`

### frontmatter

- `name`：`skill-recap-df-market`
- `description`：项目任务回顾编排定制版，触发词含"回顾 / df-market retro / 总结改进"等

### 正文首段（必须有的"前置"声明）

> 前置：先阅读并遵循 `skill-recap`（通用方法论）。本 skill 只列出本项目特有衔接点与路径，不重复通用内容。

### 本项目特有字段（编排型的典型构成）

**skill 清单来源** —— 指向 audit 定制版：`skill-audit-df-market`

**核心业务链路** —— 一句话给"业务核心度"做具体化：

> Claude Code 插件分发（marketplace.json + 各 plugin 目录） / token-reporter 的 hooks + server + frontend 三段架构 / skill-keeper 的方法论套装

触及以上任一模块的任务 → **默认记录为项目资产**（不走 memory）。

**守门衔接** —— 阶段 5.1 必须调用的定制版：

- 文档类变更（CLAUDE.md / memory / README） → `skill-doc-sync-check-df-market`
- SKILL.md 变更 → `skill-sync-check-df-market`

**忽略项台账路径** —— `/Users/df2025/.claude/projects/-Users-df2025-github-df-market/memory/doc-audit-ignored.md`

**commit 约定** —— Conventional Commits + 禁止署名行（Co-Authored-By / Signed-off-by）+ 中文描述允许

**新增手册入口** —— `TODO: 如后续引入 docs/ 手册库，补充索引规则`

---

## 示范 2：守门型定制版（基于 sync-check）

**文件**：`.claude/skills/skill-sync-check-df-market/SKILL.md`

### frontmatter

- `name`：`skill-sync-check-df-market`
- `description`：df-market 项目 SKILL.md 落盘前增量守门定制版，触发词含"skill 快检 df-market / sync-check-df-market"等

### 正文首段

> 前置：先阅读并遵循 `skill-sync-check`（通用方法论）。本 skill 只列出本项目特有触发范围与专项检查，不重复通用内容。

### 本项目特有字段（守门型的典型构成）

**触发范围（SKILL.md 绝对路径列表）**：

- `/Users/df2025/github/df-market/plugins/skill-keeper/skills/**/SKILL.md`（插件内通用版）
- `/Users/df2025/github/df-market/.claude/skills/**/SKILL.md`（项目层定制版）
- `/Users/df2025/.claude/skills/**/SKILL.md`（个人层）

**专项检查项**：

1. 修改插件内 skill（`plugins/skill-keeper/skills/**`）时，必须同步 bump `plugin.json` 与 `marketplace.json` 的 version
2. 修改 `skill-recap` 相关文件时，不得破坏对 `skill-sync-check` 与 `skill-doc-sync-check` 的正文引用

**与 recap 的衔接阶段** —— recap 阶段 5.1（默认）

---

## 可以从这两份示范看出什么

- **编排型**（recap）重点是"业务链路 + 守门衔接 + 落点路径"——它是流程的组织者
- **守门型**（sync-check）重点是"触发范围绝对路径 + 专项检查清单"——它是精细的验证器
- **两者的 description 触发词必须明显不同**——否则 skill-audit 会判定为职责边界模糊
- **所有字段尽量给绝对路径、具体命名**；不得用"相关文档"、"对应目录"这类抽象词
- **没想好的字段用 `TODO: 请补充 <字段名>` 显式标注**，不凭空编造

---

## 展示完后的指引

展示完两份示范后，welcome **不要自己追问用户**，直接回到环节 3 的 AUQ 再问一次「直接开始派生 / 暂时跳过」。
