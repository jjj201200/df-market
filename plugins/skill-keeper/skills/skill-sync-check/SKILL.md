---
name: skill-sync-check
description: "Skill 落盘前增量一致性快检方法论。在修改、新增、删除、重命名任何 SKILL.md 之前被调用，核查触发词是否仍覆盖正文、description 与正文是否同步、交叉引用是否仍可达、职责是否与已有 skill 冲突，发现漂移则阻断落盘。通常由 skill-recap 的项目定制版串联调用。文档快检请用 skill-doc-sync-check。触发词：skill 快检、skill-sync-check、skill 落盘守门。"
---

# Skill 落盘前增量一致性快检（通用方法论）

在 SKILL.md 变更写入磁盘之前，快速核对本次变更引发的级联影响。本 skill 只管**本次变更涉及的 skill 及其级联**，不做全量扫描——全量由 `skill-audit` 承担。

## 辅助文件

- `references/cascade-patterns.md` —— 6 种变更类型（改 description / 改正文 / 改 name / 删除 / 搬家 / 新增）各自的级联检查清单 + 工具选择建议

## 核心原则

- **增量、轻量、守门**：只核查本次待落盘的 SKILL.md 变更点
- **默认阻断**：发现任一不一致即中止落盘，由主进程三选一处理
- **只读**：仅 Read/Grep/Glob/LSP；禁止任何修改
- **级联敏感**：改一个 skill 可能影响多个 skill，本 skill 的核心价值是捕捉这些级联

## 触发条件

主调方（通常是项目的 retrospective 类编排 skill）判断本轮建议将**新增 / 修改 / 删除 / 重命名 / 搬家**任何 `SKILL.md` 时，必须在落盘前调用本 skill。

## 输入

主调方必须提供：

1. **待变更 skill 清单**：每份 SKILL.md 的绝对路径 + 变更类型（新增/修改/删除/重命名/搬家）
2. **变更明细**：frontmatter 变更、正文新增/删除章节、name 改变前后值

## 级联检查执行

1. Read `references/cascade-patterns.md`
2. 对每份待变更 skill 的每种变更类型，执行 reference 中对应章节列出的检查项
3. 多种变更叠加时依次执行；任一发现不一致即进入「阻断」路径

## 输出格式

### 通过

```
✅ Skill 快检通过

覆盖变更：
- [路径 1]（变更类型：修改 description）
- [路径 2]（变更类型：新增）

级联验证数：X
无一致性问题。
```

### 阻断

```
❌ Skill 快检阻断 — 发现 N 处不一致

### [SKILL.md 路径]

1. **[问题类型]**：[定位]
   - 变更：[具体变更点]
   - 失效原因：[例如"改 name 为 skill-abc，但 skill-xyz:12 仍引用旧 name skill-old"]
   - 建议：[修正方向]

2. ...

### 处理选项（由主进程决定）
- A) 修正建议条目后重跑本 skill
- B) 显式声明"忽略本条继续"（主进程应归档到 `doc-audit-ignored.md`）
- C) 放弃本次落盘
```

## 阻断策略

**默认阻断**。skill 失效是隐性的（"该触发时不触发"），一旦落盘影响深远且难以发现，必须守门严格。

## 记录落点（与 doc-sync-check 共享）

主调方若选择"显式忽略本条继续"，**必须**将忽略项归档到项目约定的忽略台账文件（通常是 memory 目录下的 `doc-audit-ignored.md`）。每条格式：

```
[YYYY-MM-DD] [skill] [SKILL.md 路径] [问题摘要] 理由：[用户陈述]
```

该台账在下次 `skill-audit` 全量审计时被读取，用于对账已修复 / 仍忽略。

## 与全量审计的区别

| 维度     | 本 skill               | skill-audit        |
| -------- | ---------------------- | ------------------ |
| 触发时机 | 落盘前自动串联         | 用户手动发起       |
| 覆盖范围 | 本次变更的 skill + 级联 | 所有 skill         |
| 输出     | 通过 / 阻断            | 按 skill 列修订建议 |
| 作用     | 守门阀                 | 体检报告           |

## 如何派生项目定制版

项目应派生定制版（命名 `skill-sync-check-<project>`）。定制版的字段清单、分工、预扫规则见 `skill-keeper-welcome/references/derivation-fields-catalog.md`。

**定制 skill 开头必须声明**：

> 前置：先阅读并遵循 `skill-sync-check`（通用方法论）。本 skill 只列出本项目特有触发范围与专项检查，不重复通用内容。
