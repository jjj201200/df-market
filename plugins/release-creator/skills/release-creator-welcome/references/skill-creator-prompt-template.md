# skill-creator 委派 prompt 模板

welcome 环节 9.3 调用 skill-creator 时使用本模板。按变量填空后将文本作为指令传入 skill-creator。

---

## 模板原文

```
请使用 skill-creator 创建一份新的 release skill：

## 基本参数
- 目标 name：{{targetName}}
- 目标绝对路径：{{targetRoot}}/{{targetName}}/SKILL.md
- 正文语言：{{docLanguage}}

## frontmatter 要求
- name 字段必须等于 {{targetName}}
- description 用 {{docLanguage}} 书写，必须包含以下触发词（用顿号或逗号分隔）：
  - release / 发布 / 打 tag / bump version / ship it
  - {{projectCode}} release
  - {{targetName}}

## 正文要求

### 第一段必须是简短说明
> 本 skill 是 {{projectCode}} 项目专属的 release 流程。由 release-creator 派生生成，记录本项目在 {{timestamp}} 时刻对版本决策 / 打包 / tag 的明确选择。

### 后续章节按以下模板拼装

{{masterTemplateBody}}

### 然后拼入对应的子模板章节

{{subTemplateBlocks}}

### 最后补入本项目特有字段

{{projectFieldsBlock}}

## 硬性约束
- 未填字段必须用 `TODO: 请补充 <字段名>` 占位符保留在正文，不得凭空生成内容
- 不要添加 emoji、不要添加 "Created by AI" 之类的末尾注脚
- 文件路径必须落到上面指定的绝对路径，不要落到其他地方
- 生成的 skill 不得调用 release-creator 本身——release-creator 是派生器，不是 release 执行器
- 落盘后重启前不会自动生效，提醒使用者这一点不属于本定制版的职责
```

---

## 变量说明

| 变量                        | 来源                                           | 示例                              |
| --------------------------- | ---------------------------------------------- | --------------------------------- |
| `{{targetName}}`            | 环节 7.2 命名方案的结果                        | `release-df-market`               |
| `{{targetRoot}}`            | 环节 7.3 生成位置                              | `.claude/skills` 或 `~/.claude/skills` |
| `{{docLanguage}}`           | 环节 1 第二问                                  | `中文` / `English`                 |
| `{{projectCode}}`           | 环节 7.1 项目代号                              | `df-market`                       |
| `{{timestamp}}`             | 派生时的 ISO 日期                              | `2026-04-17`                      |
| `{{masterTemplateBody}}`    | 根据 `{{dimension}}` 选取的主模板正文          | 见 `template-master-*.md` 三份     |
| `{{subTemplateBlocks}}`     | 根据 `{{projectAnswers}}` 拼入的所有子模板正文 | 生态 + 哲学 + tag 三类子模板拼接   |
| `{{projectFieldsBlock}}`    | 环节 6 追问 + 环节 8 override 的答案汇总       | 逐项列表，未填留 `TODO:`          |

---

## `{{subTemplateBlocks}}` 的拼装规则

根据 `{{projectAnswers}}` 中采集到的值，读取对应的子模板文件并拼接：

| answers 字段       | 取值示例                           | 拼入的子模板                                    |
| ------------------ | ---------------------------------- | ----------------------------------------------- |
| `ecosystem`        | `npm`                              | `template-ecosystem-npm.md`                     |
| `ecosystem`        | `python`                           | `template-ecosystem-python.md`                  |
| `ecosystem`        | `claude-plugin`                    | `template-ecosystem-claude-plugin.md`           |
| `ecosystem`        | `docs`                             | `template-ecosystem-docs.md`                    |
| `philosophy`       | `commit-derived`                   | `template-philosophy-commit.md`                 |
| `philosophy`       | `changeset`                        | `template-philosophy-changeset.md`              |
| `philosophy`       | `manual`                           | `template-philosophy-manual.md`                 |
| `tagFormat`        | `simple`                           | `template-tag-simple.md`                        |
| `tagFormat`        | `prefixed`                         | `template-tag-prefixed.md`                      |
| `tagFormat`        | `scoped`                           | `template-tag-scoped.md`                        |

拼装顺序：主模板 → 生态子模板 → 哲学子模板 → tag 子模板 → 项目特有字段。

---

## `{{projectFieldsBlock}}` 的拼装规则

从环节 6 追问 + 环节 8 override 收集到的字段逐项列出：

```
- <字段名>：<用户答案 / TODO: 请补充 <字段名>>
```

示例（df-market 场景，选 packaging 维度）：

```
- 包管理器：无（Claude Code plugin 直接发行）
- 发行载体：plugin.json + marketplace.json
- 版本决策哲学：commit 推导 + 手动复核
- 打包粒度：monorepo 多插件（单 plugin 单次 release）
- tag 格式：<plugin-name>-v<version>
- tag 示例：token-reporter-v2.9.9 / skill-keeper-v0.1.2
- marketplace 镜像字段：.claude-plugin/marketplace.json > plugins[].version
- pre-push 钩子：node plugins/token-reporter/scripts/check-version.cjs
- push 动作：git push origin main + git push origin <tag-name>（不用 --tags）
```

---

## 调用纪律

1. **一次一份**：welcome 流程只派生 1 份 release skill；不要在一次 prompt 里让 skill-creator 同时建多份
2. **串行**：即使走穷举维度生成的 skill 很长，也仍然是一次 skill-creator 调用搞定
3. **失败处理**：skill-creator 返回错误 → welcome 提示用户错误信息，AUQ 让用户选择「重试 / 终止」，不要静默失败
4. **落盘后**：收尾提示里**用加粗和 emoji 强调**：**⚠️ 修改了 skill 文件，需要重启 Claude Code 才能使改动生效。**
