# 语言选项清单（给 AUQ 用）

welcome 的**环节 1（语言）**一次 AUQ 同时发起两个问题：沟通语言 `{{uiLanguage}}` 和骨架正文语言 `{{docLanguage}}`。按下列 JSON 骨架直接映射到 AskUserQuestion 的 `questions` 数组（含 2 个 question object）。

**核心约定**：每个语言候选的 `label` 与 `description` 都用**该语言本身书写**，让用户扫一眼就能判断选项是不是自己想要的语言。不要用中文解释英文，也不要用英文解释中文——用户根本还没告诉我们他看懂哪种。

---

## 环节 1 使用（一次 AUQ · 两个问题）

```json
{
  "questions": [
    {
      "question": "Choose the conversation language for this guide / 请选择本次引导的沟通语言",
      "header": "UI lang",
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
    },
    {
      "question": "What language should the derived release SKILL.md body be written in? (Independent from the UI language) / 派生出的 release SKILL.md 正文用什么语言书写？（与对话语言独立）",
      "header": "Doc lang",
      "multiSelect": false,
      "options": [
        {
          "label": "English",
          "description": "The derived release SKILL.md body and description will be written in English. Recommended for broader readability."
        },
        {
          "label": "中文",
          "description": "派生出的 release SKILL.md 正文与 description 字段用中文书写。"
        }
      ]
    }
  ]
}
```

记录结果：

- 第一个问题 → `{{uiLanguage}}`（welcome 后续文本、AUQ 文案、错误提示都用这个语言书写）
- 第二个问题 → `{{docLanguage}}`（派生出的 release SKILL.md 正文语言）

> 用户要其他语言 → Claude Code 会自动提供 Other 输入框，用户自由输入语言标识。两个问题分别独立，可一个选 English 一个选中文。

> 两个变量**相互独立**：用户可能用中文跟 Claude 沟通却想生成英文 SKILL.md（给国际协作用），反之亦然。

---

## 维护指南

- 预设列表刻意保持精简（English + 中文），其他语言走 Other 自由输入
- 新增预设：在**两个 questions 的 options 数组**各加一条，`label` 用目标语言的自称（如 `한국어`、`日本語`、`Deutsch`）、`description` 用该语言写
- 每个单次 AUQ 的 option 最多 4 个（Other 不占额）
- 不要用罗马化转写——语言自称是识别的一部分
