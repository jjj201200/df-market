# skill-creator 委派 prompt 模板

welcome Step N 对 `selected` 中每份 skill **串行调用** skill-creator 时使用本模板。按变量填空后将文本作为指令传入 skill-creator。

---

## 模板原文

```
请使用 skill-creator 创建一份新的 skill：

## 基本参数
- 目标 name：{{targetName}}
- 目标绝对路径：{{targetRoot}}/{{targetName}}/SKILL.md
- 正文语言：{{docLanguage}}

## frontmatter 要求
- name 字段必须等于 {{targetName}}
- description 用 {{docLanguage}} 书写，必须包含以下触发词（用顿号或逗号分隔）：
  - {{targetName}}
  - {{sourceSkillDisplayName}} 定制版
  - {{projectCode}} 回顾 / {{projectCode}} 审计 / {{projectCode}} 守门（按 sourceSkill 类别选取合适的动词）
  - 其他能触发本项目场景的具体说法

## 正文要求

### 第一段必须是前置声明（{{docLanguage}} 书写，保持语义等价）
> 前置：先阅读并遵循 `{{sourceSkillName}}`（通用方法论）。本 skill 只列出本项目特有衔接点与路径，不重复通用内容。

### 后续章节覆盖的本项目字段
{{projectFieldsBlock}}

## 硬性约束
- 不要复述 {{sourceSkillName}} 通用版的流程或维度——用户调用定制版时会一并加载通用版，重复只会浪费 token
- 未填字段必须用 `TODO: 请补充 <字段名>` 占位符保留在正文，不得凭空生成内容
- 不要添加 emoji、不要添加 "Created by AI" 之类的末尾注脚
- 文件路径必须落到上面指定的绝对路径，不要落到其他地方
- 落盘后重启前不会自动生效，提醒使用者这一点不属于本定制版的职责
```

---

## 变量说明

| 变量                        | 来源                                           | 示例                              |
| --------------------------- | ---------------------------------------------- | --------------------------------- |
| `{{targetName}}`            | Step 5.4 命名方案的结果                        | `skill-recap-df-market`           |
| `{{targetRoot}}`            | Step 5.2 生成位置                              | `.claude/skills` 或 `~/.claude/skills` |
| `{{docLanguage}}`           | Step 5.3 正文语言                              | `中文` / `English` / 用户自定义    |
| `{{sourceSkillName}}`       | 对应通用版 name                                | `skill-recap`                     |
| `{{sourceSkillDisplayName}}`| 源 skill 的简称（去掉 `skill-` 前缀用于展示）   | `recap`                           |
| `{{projectCode}}`           | Step 5.1 项目代号                              | `df-market`                       |
| `{{projectFieldsBlock}}`    | Step 6 该份 skill 字段追问收集到的答案         | 逐项列表，未填留 `TODO:`          |

---

## `{{projectFieldsBlock}}` 的拼装规则

从 `derivation-fields-catalog.md` 对应 skill 的字段表里取出**被追问过的每一项**，按如下格式拼：

```
- <字段名>：<用户答案 / TODO: 请补充 <字段名>>
```

示例（recap 定制版）：

```
- skill 清单来源：skill-audit-df-market
- 核心业务链路：Claude Code 插件分发 + token-reporter 架构 + skill-keeper welcome
- 忽略项台账路径：memory/doc-audit-ignored.md
- commit 约定：TODO: 请补充 commit 约定
- 新增手册入口：TODO: 请补充 新增手册入口
```

---

（调用纪律见 welcome SKILL.md 环节 8.3）
