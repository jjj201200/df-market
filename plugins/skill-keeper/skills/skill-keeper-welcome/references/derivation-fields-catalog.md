# 派生字段清单（逐份追问时使用）

本文件在 welcome 环节 7 逐份追问时被 Read。对每份 `selected` 中的定制版，按本表决定 AUQ 追问哪些字段、哪些是必填哪些是可选、默认值如何推导。

**字段分类**：
- **必填（required）**：不填则生成的定制版无法守门，必须让用户至少回答一次
- **推荐（recommended）**：不填也能跑，但会影响守门质量；AUQ 提供"跳过"选项
- **可选（optional）**：锦上添花；如果用户选"最精简"可以整体跳过

---

## 预扫项目档案（追问前必做）

进入本环节前，welcome 必须先读取项目档案，把能自动回答的字段预填为 AUQ 的**第一选项**，让用户一键确认而不必手动输入：

| 预扫来源                                           | 可预填的字段                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `<repo>/CLAUDE.md`（根规范）                        | recap.commit 约定、doc-sync-check.硬性索引规则、doc-audit.文档拓扑矩阵（根节） |
| `<repo>/.claude-plugin/marketplace.json`            | doc-sync-check.触发范围（含 marketplace 元数据）、doc-audit.插件内配套文件      |
| `<repo>/plugins/*/`（Glob）                          | sync-check.触发范围（插件内 skill 路径）、audit.项目 skill 清单                 |
| `git log --oneline -20`                              | recap.commit 约定的真实格式（Conventional / 自由文本）                         |
| `<repo>/package.json` / `pyproject.toml`             | doc-audit.并行切分方案（根据项目规模估算）                                    |
| `git log --grep='subagent\|agent' --oneline -30` + Glob `<repo>/**/retrospective*.md` + Glob `<repo>/.claude/agents/` | subagent-check.高危盲区清单（从历史 bug/retro 提取候选）、subagent-check.主 skill 派发位置清单 |
| `<repo>/package.json` / `pyproject.toml` / `Cargo.toml` 扫 scripts / `<repo>/.husky/` / `<repo>/.githooks/` | review.build 命令（按子模块）、review.项目 override 初稿（从 CLAUDE.md 风格段提取）、review.backlog 文件路径（若已存在则复用） |

**预填策略**：预扫到的默认值作为 AUQ 选项列表的**第一项**（标签前缀"默认：..."），其他候选或"留 TODO" 排后。用户可选 / 可改 / 可走 Other 自由输入。

**反模式**：不要把预扫值塞进正文作为"自动填入"——必须经用户 AUQ 确认。预扫只提高默认值质量，不替代用户授权。

---

## recap 定制版

| 字段                    | 分类      | 说明                                                                 | 默认推导                       |
| ----------------------- | --------- | -------------------------------------------------------------------- | ------------------------------ |
| skill 清单来源          | 必填      | 通常填该项目的 audit 定制版名称（如 `skill-audit-df`）               | 若 `selected` 含 audit → 自动填入对应 `targetName`；否则留 TODO |
| 核心业务链路            | 推荐      | 一句话描述：本项目的核心模块、主流程                                  | 留 TODO                         |
| 忽略项台账路径          | 必填      | doc-audit-ignored.md 的具体路径                                      | 默认 `memory/doc-audit-ignored.md`；用户可覆盖 |
| commit 约定             | 可选      | 是否有特殊 commit 格式（如禁用 Co-Authored-By）                       | 留 TODO                         |
| 新增手册入口            | 可选      | 建立手册库的位置和索引规则                                            | 留 TODO                         |

---

## doc-sync-check 定制版

| 字段                    | 分类      | 说明                                                                 | 默认推导                       |
| ----------------------- | --------- | -------------------------------------------------------------------- | ------------------------------ |
| 触发范围（文档路径）    | 必填      | 本项目受守门覆盖的 CLAUDE.md / memory / 手册目录 绝对路径列表         | 至少列 1 条；可先给 `<repo>/CLAUDE.md` 作默认 |
| 硬性索引规则            | 推荐      | 例："子项目指南必须登记到根 CLAUDE.md 索引节"                         | 留 TODO                         |
| 与 recap 的衔接阶段     | 可选      | 通常是 recap 阶段 5.1                                                 | 默认 `recap 阶段 5.1`            |
| 专项检查                | 可选      | 项目独有的索引完整性规则                                              | 留 TODO                         |

---

## sync-check 定制版

| 字段                      | 分类      | 说明                                                                 | 默认推导                       |
| ------------------------- | --------- | -------------------------------------------------------------------- | ------------------------------ |
| 触发范围（SKILL.md 路径） | 必填      | 本项目 SKILL.md 的存放位置                                           | 默认 `.claude/skills/**/SKILL.md` 和 `~/.claude/skills/**/SKILL.md` |
| 专项检查项                | 推荐      | 例："修改 recap 定制版不得破坏对 sync-check 定制版的引用"             | 留 TODO                         |
| 与 recap 的衔接阶段       | 可选      | 通常是 recap 阶段 5.1                                                 | 默认 `recap 阶段 5.1`            |

---

## doc-audit 定制版

| 字段                    | 分类      | 说明                                                                 | 默认推导                       |
| ----------------------- | --------- | -------------------------------------------------------------------- | ------------------------------ |
| 文档拓扑矩阵            | 必填      | 根规范 / 手册库 / 子项目规范 / 外部 memory 各自的绝对路径列表         | 根 CLAUDE.md 可自动填；其余留 TODO |
| 并行切分方案            | 可选      | 通常默认 4-agent 切分；小项目可合并                                   | 默认 `4-agent`                  |
| 硬性索引规则            | 推荐      | 同 doc-sync-check 的答案，可复用                                      | 从 doc-sync-check 复用；无则留 TODO |

---

## audit 定制版

| 字段                    | 分类      | 说明                                                                 | 默认推导                       |
| ----------------------- | --------- | -------------------------------------------------------------------- | ------------------------------ |
| 项目 skill 清单         | 必填      | 个人 + 项目层所有 SKILL.md 的绝对路径                                 | 默认 Glob `.claude/skills/**/SKILL.md` + `~/.claude/skills/**/SKILL.md` |
| 命名约定                | 推荐      | 例："定制版 name 必须以 `-<projectCode>` 结尾"                        | 默认 `-<projectCode>` 后缀     |
| 硬性规则                | 可选      | 例："定制版必须声明前置通用版"                                        | 留 TODO                         |

---

## coding-review 定制版

| 字段                         | 分类      | 说明                                                                             | 默认推导                                                                                           |
| ---------------------------- | --------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| build 命令（按子模块）       | 必填      | 步骤 0 的具体 build 命令；跨子模块改动时每个子模块列一条。没有 build 概念的项目声明"跳过步骤 0" | 从 `package.json` scripts / `Cargo.toml` / `pyproject.toml` 提取候选（如 `npm run -w frontend build` / `npm run build` / `cargo build` / `pnpm build`）；多 workspace 列多条；无则留 TODO |
| 项目规则 override            | 必填      | 注入到每次 subagent prompt 的 `{{projectOverrides}}` 块；列出项目与默认 code-reviewer 模板冲突的点 | 默认 4 条通用起始：`保留 WHAT 注释/JSDoc/分节注释（CLAUDE.md 没明说要删则保留）` / `字面量抽常量仅在真复制粘贴 ≥ 3 处时建议` / `不引入新依赖（lodash/moment 等）` / `命名风格偏好不算 quality 问题`；用户可增删 |
| backlog 文件路径             | 必填      | 项目单一 backlog 入口的绝对路径                                                  | 默认 `memory/pending-tasks.md`；若项目已有其他命名（如 `docs/backlog.md` / `TODO.md`）则预填为候选 |
| 与 recap 定制版的衔接        | 推荐      | recap 的"commit 前置规则"引用本 skill 的定制版名；写"recap 阶段 5.3 触发 skill-coding-review-<project>" | 从 `selected` 中已派生的 recap 定制版自动填入；无则留 TODO                                         |
| push 后总结模板的措辞定制    | 可选      | 根据项目 commit 约定定制（如"不加 Co-Authored-By"、"commit message 用中文"）     | 从 CLAUDE.md commit 约定段提取；无则使用通用模板                                                   |
| 历史踩坑高危盲区（送 subagent-check） | 可选 | 作为派发 subagent 时附的"高危维度清单"，与 subagent-check 定制版的该字段复用     | 从 `selected` 中已派生的 subagent-check 定制版该字段复用；无则留 TODO                              |

---

## subagent-check 定制版

| 字段                         | 分类      | 说明                                                                             | 默认推导                                                                                           |
| ---------------------------- | --------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 项目历史踩坑的高危盲区清单   | 必填      | 项目内 subagent 易漏的维度（一句话/条），写入定制版作为"跨 agent 盲区覆盖"的清单 | 默认给 4 条通用占位：`签名↔持久层 required 字段对照` / `类型断言宽泛化` / `索引硬性规则` / `YAGNI 死代码`；用户可一键接受或增删；预扫 retro/git log 若命中更多候选则加到选项列表 |
| 主 skill 派发位置清单        | 推荐      | 项目内哪些主 skill 会派 subagent，定制版写明接入点                                 | 从 `selected` 中已派生的 recap/doc-audit/audit 定制版名罗列；无则留 TODO                           |
| 项目专属忽略台账路径         | 推荐      | 与 recap / doc-sync-check 定制版共享同一份忽略台账                                | 从 recap 定制版字段复用；否则默认 `memory/doc-audit-ignored.md`                                    |
| 与 retrospective 接入阶段    | 可选      | 通常是"recap 阶段 5.0（在 sync-check 之前）"                                     | 默认 `recap 阶段 5.0`                                                                               |

---

## 填写纪律

- **每一项用户未填/跳过的"推荐"或"可选"字段**，welcome 生成 prompt 时用 `TODO: 请补充 <字段名>` 占位
- **必填字段未填** → welcome **不得**继续调用 skill-creator，应再次用 AUQ 追问，附说明"该字段不填会让定制版无法守门"
- **不得凭空编造答案**——所有占位符都应该是显式 `TODO:`
