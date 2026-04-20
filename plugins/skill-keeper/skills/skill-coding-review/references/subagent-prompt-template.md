# Subagent 派发 Prompt 硬化模板

本 reference 是 `skill-coding-review` 步骤 2 派发 subagent 时使用的 prompt 骨架。每次派发**必须**按本模板组装，不允许跳过"硬性证据要求"、"项目规则 override"、"全量审查指令"三块。

memory 约束不到 subagent——项目规则 override 必须写进 prompt，不能只依赖记忆。

---

## 骨架（填完变量后直接作为 Agent prompt 使用）

```
# {{dimension}} 审查（第 {{round}} 轮）

## 任务

对本轮 diff（见下方"审查代码范围"）做 **{{dimension}}** 维度的审查。仅报告该维度的发现，不越界到其他维度。

## 硬性证据要求（必须满足，否则结论无效）

- **必须实际执行** `git diff HEAD` / `Read` / `Grep` 等工具调用，**总数 ≥ 5 次**才能下结论
- 报告末尾**必须附已读文件清单**（绝对路径，不是相对路径也不是仅文件名）
- 报告末尾**必须汇报工具调用次数**（例：`tool_uses: 7`）
- 若某项声称"未发现问题"，必须附具体差集数字（|A|=..., |B|=..., A−B=...）
- 严禁"大致对照"、"未见明显问题"、"整体看起来一致"这类定性陈述——这些属于抽样降级，会被接收端守门（skill-subagent-check）阻断

## 审查代码范围

**本轮完整 diff**（不是增量）：

```
{{diffContent}}
```

每一轮审查的范围都是**完整当前变更**——即使是第 N 轮，也要审全量 diff，不要"只看第一轮修了什么"。

## 维度聚焦

{{dimensionFocus}}

（从 `skill-coding-review/references/dimensions.md` 对应维度节复制）

## 项目规则 override（硬性遵守）

{{projectOverrides}}

（由定制版 SKILL.md 填充。常见 override 示例：
- "本项目保留 WHAT 注释、方法 JSDoc、分节注释（`// ========== xxx ==========`）——只要 CLAUDE.md 没明说要删，**不要**建议删除"
- "本项目字符串字面量抽常量只在真复制粘贴 ≥ 3 处时建议，纯风格偏好不建议"
- "本项目使用 Mongoose，`.lean()` 查询返回 POJO 非 Document，不要建议 `.save()`"
- "本项目 backend 目录下禁止使用 lodash"
- ……）

## 输出格式

```
## {{dimension}} 审查结果（第 {{round}} 轮）

### Critical（必修）
- [file:line] <问题> · 为什么 <原因> · 修复建议 <具体做法>
- ...

### Important（应修）
- [file:line] <问题> · 为什么 · 修复建议
- ...

### Minor（锦上添花）
- [file:line] <问题> · 为什么 · 修复建议
- ...

### Backlog 建议（suggest-backlog）
对本次范围外但值得做的建议，明确标记：
- [file:line] <问题> · 为什么不属于本次范围 · 建议
- ...

### 证据
- tool_uses: {{N}}
- 已读文件清单：
  - /abs/path/to/file1
  - /abs/path/to/file2
  - ...
```

## 审查纪律

- 不修改任何文件（本 agent 是纯审查角色）
- 不征求用户意见（主 skill 来决策）
- 每条发现必须带 `file:line` 或 `file#section` 定位
- 发现为零时，明确说明"审查了哪些文件（见已读清单）+ 差集为空"而不是 "看起来没问题"
- 如果当前 diff 对本维度无意义（如 efficiency agent 遇到纯重命名 diff），如实汇报"本维度无可审内容"并说明理由
```

---

## 变量说明

| 变量名 | 内容 | 由谁填充 |
| --- | --- | --- |
| `{{dimension}}` | `reuse` / `quality` / `efficiency`（或项目自定义子维度名） | 主 skill 步骤 2 |
| `{{round}}` | 本次 simplify 循环的轮次编号（从 1 开始） | 主 skill |
| `{{dimensionFocus}}` | 从 `dimensions.md` 对应维度节摘要 | 主 skill 步骤 2 |
| `{{diffContent}}` | `git diff HEAD` 的原文 | 主 skill 步骤 1 拿到 |
| `{{projectOverrides}}` | 定制版 SKILL.md 的 `projectOverrides` 段原文 | 定制版写死，主 skill 直接读取插入 |

---

## 硬性约束

- **永远不要省略"硬性证据要求"段**——observer 历史会话多次观察到 subagent 在长 diff 下 `tool_uses = 0` 直接返回"零发现"，如果 prompt 没硬化就会被绕过
- **永远不要用相对路径**：`已读清单` 必须是绝对路径，否则无法验证读的是哪份 repo
- **永远不要复用上一轮 prompt**：每轮的 `{{round}}` 和 `{{diffContent}}` 都要更新——第 2 轮的 diff 包含第 1 轮的修复，agent 需要看到完整新 diff
- **不在 prompt 里说"只查新引入的问题"**：会让 agent 放松标准、漏掉第一轮本该揭示但被遗漏的问题
- **按工作量弹性调整**（见 SKILL.md 步骤 2 工作量分档）：小改动可合并维度、大改动可再切子维度，但每份 prompt 的"硬性证据要求"段不变

---

## 合并派发时的变体

当按"小改动"档合并为 1 个综合 subagent 时（见 SKILL.md 步骤 2），`{{dimension}}` 填 `reuse + quality + efficiency 综合`，`{{dimensionFocus}}` 把三个维度节合并摘要。**硬性证据要求不合并**——仍是 `tool_uses ≥ 5`。
