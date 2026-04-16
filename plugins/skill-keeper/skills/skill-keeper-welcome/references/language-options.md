# 语言选项清单（给 AUQ 用）

welcome 的**环节 1（沟通语言）**与**环节 5.3（骨架正文语言）**发起 AUQ 时直接 Read 本文件，按下表 1:1 映射到 AUQ 的 options。

**核心约定**：每个语言候选的 `label` 与 `description` 都用**该语言本身书写**，让用户扫一眼就能判断选项是不是自己想要的语言。不要用中文解释英文，也不要用英文解释中文——用户根本还没告诉我们他看懂哪种。

---

## 环节 1 使用（沟通语言 `{{uiLanguage}}`）

```json
{
  "question": "Choose the conversation language for this guide / 请选择本次引导的沟通语言",
  "header": "Language",
  "multiSelect": false,
  "options": [
    {
      "label": "English",
      "description": "All prompts, options, and messages in this guide will be shown in English."
    },
    {
      "label": "中文",
      "description": "本次 welcome 引导的所有提问、选项和提示都用中文显示。"
    }
  ]
}
```

> 用户要其他语言 → Claude Code 会自动提供 Other 输入框，用户自由输入语言标识（如 `Deutsch`、`日本語`、`한국어`）。记录到 `{{uiLanguage}}`。

---

## 环节 5.3 使用（骨架正文语言 `{{docLanguage}}`）

与环节 1 选项顺序一致，但 question 文案改为向用户解释"这是派生 SKILL.md 的正文语言，与刚才的对话语言无关"：

```json
{
  "question": "What language should the derived SKILL.md bodies be written in? (Independent from the UI language chosen earlier) / 派生出的定制版 SKILL.md 正文用什么语言书写？（与刚才的对话语言独立）",
  "header": "Doc language",
  "multiSelect": false,
  "options": [
    {
      "label": "English",
      "description": "Derived SKILL.md bodies and description values will be written in English. Recommended for broader readability."
    },
    {
      "label": "中文",
      "description": "派生出的 SKILL.md 正文与 description 字段用中文书写。"
    }
  ]
}
```

> `{{docLanguage}}` 与 `{{uiLanguage}}` 独立——用户用中文跟 Claude 沟通，却可能想生成英文 SKILL.md 给国际协作用，反之亦然。AUQ 的 question 文案**务必显式提醒这一点**。

---

## 维护指南

- 预设列表刻意保持精简（English + 中文），其他语言走 Other 自由输入
- 新增预设：在**两套 options 数组**各加一条，`label` 用目标语言的自称（如 `한국어`、`日本語`、`Deutsch`）、`description` 用该语言写；新增前先评估真实使用率
- 每个单次 AUQ 最多 4 个 options（Other 不占额），避免一次性堆满预设——让用户自己输入反而更显得该选项是被认真对待的
- 不要用罗马化转写（如"Zhongwen"代替"中文"）——语言自称是识别的一部分
