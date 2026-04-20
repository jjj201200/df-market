# 派生范围 AUQ 拆分方案（固定）

AUQ 单个问题最多 4 个 options，而 skill-keeper 的派生候选有 6 个，必须拆分。本文件固定下来拆分方案，welcome 环节 5.1 **直接 Read 本文件后按结构填 AUQ**，不要临时设计新拆法。

---

## 方案（同轮发起 2 个 multiSelect 问题）

**问题 A（multiSelect = true）**：勾选要派生的「流程主轴+守门四件套」

```json
{
  "question": "勾选要派生的「流程主轴+守门四件套」（可多选）",
  "header": "主轴/守门",
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
      "description": "推荐 · SKILL.md 落盘前增量守门，同在 recap 的阶段 5.1 被串联调用。"
    },
    {
      "label": "skill-subagent-audit",
      "description": "推荐 · Subagent 报告接收端守门，主 skill 派发 subagent 后、消费结论前调用。"
    }
  ]
}
```

**问题 B（multiSelect = true）**：勾选要派生的「全量审计」两件套

```json
{
  "question": "勾选要派生的「全量审计」两件套（可多选，可不选）",
  "header": "全量审计",
  "multiSelect": true,
  "options": [
    {
      "label": "skill-doc-audit",
      "description": "文档与代码一致性全量审计，周期性体检用。"
    },
    {
      "label": "skill-audit",
      "description": "SKILL.md 全量审计，检测触发词漂移 / description↔正文脱节 / 职责重叠 等隐性失效。"
    }
  ]
}
```

---

## 结果合并

两个问题答案合并为 `selected` 列表（最多 6 项）。

**全部不勾 → 视为"放弃派生"**，welcome 结束流程，不生成任何文件。

---

## 本地化

上述 JSON 文案以中文书写。`{{uiLanguage}} = English` 时 welcome 应将 `question` / `header` / `description` 按原义翻译为英文后再填 AUQ。`label` 字段（skill 的真实 name）不翻译。

---

## 为什么这样拆

| 拆法                             | 理由                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| 四件套 A + 两件套 B              | 按**触发频率**分组：A 是每次任务/派发都会触发的主轴+守门；B 是周期性体检                |
| A 全打推荐标，B 不打             | 引导用户至少选完 A（跑通最小闭环）；B 根据是否做周期审计自由决定                         |
| subagent-audit 归 A 而非 B       | 虽含"audit"字样，但语义是**每次派发 subagent 都要跑的守门**，与 doc-sync / sync-check 同类 |
| 不按"文档类 vs skill 类"拆       | 那样拆会把 recap 孤零零放一组，用户直觉上难以选                                         |
