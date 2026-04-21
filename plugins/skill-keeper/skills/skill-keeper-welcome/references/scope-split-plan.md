# 派生范围 AUQ 拆分方案（固定）

AUQ 单个问题最多 4 个 options，而 skill-keeper 的派生候选有 7 个，必须拆分。本文件固定下来拆分方案，welcome 环节 5.1 **直接 Read 本文件后按结构填 AUQ**，不要临时设计新拆法。

---

## 方案（同轮发起 2 个 multiSelect 问题）

**问题 A（multiSelect = true）**：勾选要派生的「主轴+轻守门四件套」（都是主流程必跑的）

```json
{
  "question": "勾选要派生的「主轴+轻守门四件套」（可多选）",
  "header": "主轴/轻守门",
  "multiSelect": true,
  "options": [
    {
      "label": "skill-recap",
      "description": "推荐 · 任务回顾 + 改进编排入口，是主流程主轴。"
    },
    {
      "label": "skill-doc-sync-check",
      "description": "推荐 · 文档落盘前增量守门，在 recap 的阶段 5.1 被串联调用。"
    },
    {
      "label": "skill-sync-check",
      "description": "推荐 · SKILL.md 落盘前增量守门,同在 recap 的阶段 5.1 被串联调用。"
    },
    {
      "label": "skill-coding-review",
      "description": "推荐 · commit 前循环式代码审查与修复，零修改收敛前阻断 commit。"
    }
  ]
}
```

**问题 B（multiSelect = true）**：勾选要派生的「全量审计+接收端核验三件套」（周期性或 subagent 场景触发的）

```json
{
  "question": "勾选要派生的「全量审计+接收端核验三件套」（可多选，可不选）",
  "header": "全量/核验",
  "multiSelect": true,
  "options": [
    {
      "label": "skill-doc-audit",
      "description": "文档与代码一致性全量审计，周期性体检用。"
    },
    {
      "label": "skill-audit",
      "description": "SKILL.md 全量审计，检测触发词漂移 / description↔正文脱节 / 职责重叠 等隐性失效。"
    },
    {
      "label": "skill-subagent-check",
      "description": "Subagent 报告接收端审计，主 skill 派发 subagent 后消费结论前调用，防空载回答 / 抽样降级。"
    }
  ]
}
```

---

## 结果合并

两个问题答案合并为 `selected` 列表（最多 7 项）。

**全部不勾 → 视为"放弃派生"**，welcome 结束流程，不生成任何文件。

---

## 本地化

上述 JSON 文案以中文书写。`{{uiLanguage}} = English` 时 welcome 应将 `question` / `header` / `description` 按原义翻译为英文后再填 AUQ。`label` 字段（skill 的真实 name）不翻译。

---

## 为什么这样拆

按调用强度分组：A 是主流程主轴 + 每次任务都跑的轻量守门（全推荐）；B 是周期性或 subagent 场景才触发的核验（不推荐默认勾选）。
