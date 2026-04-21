---
name: skill-audit
description: "Skill 全量审计方法论。对个人 skill（~/.claude/skills/）与项目 skill（.claude/skills/）进行系统性核对，验证触发词覆盖度、description 与正文一致性、前置 skill 声明、交叉引用有效性、职责边界、frontmatter 合规性、正文引用的工具/路径有效性，产出修订建议但不改文件。文档审计请用 skill-doc-audit。触发词：审计 skill、skill-audit、skill 核查、skill 一致性检查。"
---

# Skill 全量审计（通用方法论）

对项目中所有 SKILL.md（个人层 + 项目层）做一次系统性体检，识别 skill 失效、职责重叠、触发词漂移等问题。本 skill 是**通用方法论**，项目定制版应补充本项目的 skill 清单与硬性规则。

## 辅助文件

- `references/dimensions.md` —— 7 核查维度的详细方法与典型漂移
- `scripts/validate-frontmatter.sh` —— frontmatter 合规维度的机械校验脚本（YAML lint + name↔目录名一致性）

执行核查时 Read `references/dimensions.md`，frontmatter 合规维度允许**优先调用脚本**做初筛，发现命中再 Claude 回读核对。

## 为什么独立于 `skill-doc-audit`

| 维度         | 文档审计                           | Skill 审计（本 skill）                                                 |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------- |
| 主语         | 规范 / 指南 / 索引 / 时效性         | 可触发的流程说明 + frontmatter 元数据                                  |
| 失效信号     | 路径不存在、符号改名、规则过时      | 触发词覆盖不到实际说法、description ↔ 正文脱节、skill 搬家后其他 skill 引用失效 |
| 漏检代价     | 索引残缺（可见）                    | skill 不被触发（**隐性失效**，更危险）                                 |
| 修复工具链   | memory-refine、指南创建手册         | skill-creator                                                          |
| 变更频率     | 较低                                | 较高                                                                   |

**文档审计的维度无法替代本 skill**——反之亦然。两者分工，一个项目应同时拥有两套审计能力。

## 核心原则

- **只读审计**：全程 Read/Grep/Glob/LSP；不改任何文件（脚本 `validate-frontmatter.sh` 也是只读）
- **产出建议**：修订由 skill-creator / sync-check 类 skill 在用户确认后执行
- **聚焦隐性失效**：skill 最大的失效模式不是"路径错了"而是"该触发时没触发"，审计需直面这一点

## 适用场景

- 周期性 skill 体检
- 新增/删除/重命名 skill 后的集中核对
- skill 规模扩大后怀疑职责边界出现重叠
- 用户多次抱怨"XX 场景没触发正确 skill"

## 审计对象

| 层级                 | 典型路径                                                   |
| -------------------- | ---------------------------------------------------------- |
| 个人 skill           | `~/.claude/skills/**/SKILL.md`                             |
| 项目 skill           | 项目内 `.claude/skills/**/SKILL.md`                        |
| 插件 skill（如适用） | `.claude/plugins/**/skills/**/SKILL.md`（通常只读，审计时只看不建议改） |

## 核查维度

7 维度详情见 `references/dimensions.md`。条目摘要：

1. 触发词覆盖度
2. description ↔ 正文一致性
3. 职责边界
4. 前置 skill 声明
5. 交叉引用有效性
6. frontmatter 合规（**可用 `scripts/validate-frontmatter.sh` 做机械初筛**）
7. 正文引用的工具/路径有效性（含 `references/*.md` 的枚举与孤儿检查）

## 并行切分策略

skill 数量通常不多（~20 以下），**单 agent 即可完成**；若超过 40 个，按"个人 skill / 项目 skill"拆 2 组。

## 汇总规则（与其他 audit 类 skill 统一）

1. **去重**：按 `(SKILL.md 路径, 维度, 问题指纹)` 三元组去重
2. **排序**：frontmatter 合规违反 > 触发词覆盖度 > 交叉引用失效 > 前置声明缺失 > description/正文一致性 > 职责边界模糊 > 工具引用失效
3. **二次核验**：主 agent 对 top 5 高优先级建议再亲自 Read 一次 SKILL.md，确认问题属实；避免 subagent 误报
4. **证据要求**：每条建议必须附 `文件:行 + 原文引用`

## 输出格式

```markdown
## Skill 审计结果

### [SKILL.md 路径]
- **[维度]**：[问题定位] → [建议]
  - 当前内容：[引用原文 + 文件:行]
  - 建议修改：[具体动作]

### [下一份 skill]
...

## 无发现的 skill
- [路径 1]
- [路径 2]

## 高优先级修订建议（按排序规则）
1. [建议]
2. [建议]
...
```

## 执行约束

- 审计过程禁止修改任何文件
- 输出仅为建议，由用户确认后走 skill-creator 或 sync-check 守门后落盘
- 大规模修订（> 3 份 SKILL.md）建议分批；每批改完后重跑本 skill 验证
- 修订后用户需看到：**⚠️ 修改了 skill 文件，需要重启 Claude Code 才能使改动生效**

## 判断标准：何时跳过

- skill 数量 < 5 → 人工核对即可
- 近一周已审计且无新增/删除 skill → 跳过
- 只改 1 份 SKILL.md → 走 `skill-sync-check` 而非本 skill

## 如何派生项目定制版

项目应派生定制版（命名 `skill-audit-<project>`）。定制版的字段清单、分工、预扫规则见 `skill-keeper-welcome/references/derivation-fields-catalog.md`。

**定制 skill 开头必须声明**：

> 前置：先阅读并遵循 `skill-audit`（通用方法论）。本 skill 只列出本项目特有 skill 清单与硬性规则，不重复通用内容。
