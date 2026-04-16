# Override 清单（环节 8 使用）

环节 8 展示默认骨架预览后，用户可以选择改动某个维度的默认决策，或追加自定义字段。本文件列出**每个维度的 3 个常见替代选项**，供 AUQ 选择使用。

## 使用方式

环节 8 的 AUQ 顶层单选（4 选项）命中「**改某个维度的决策**」后，追加一轮 AUQ 单选让用户选「改哪个维度」（4 选项：生态 / 哲学 / tag / 打包粒度）。用户选定一个维度后，Read 本文件对应章节，按其中的 JSON 骨架发起 AUQ（每问 ≤ 4 选项）。

用户选「**添加自定义字段**」→ 纯文本自由采集：字段名 + 默认值（空值允许，生成时会留 `TODO:`）。

---

## 改生态（ecosystem）

```json
{
  "question": "切换到哪种生态的子模板？",
  "header": "Ecosystem",
  "multiSelect": false,
  "options": [
    {
      "label": "npm",
      "description": "Node / pnpm / yarn 生态，版本源 package.json"
    },
    {
      "label": "Python",
      "description": "pyproject.toml / poetry / hatch / setuptools 生态"
    },
    {
      "label": "Claude plugin",
      "description": "Claude Code plugin，双文件版本同步（plugin.json + marketplace.json）"
    },
    {
      "label": "Docs-only",
      "description": "纯文档 / 静态站点 / 无代码产物"
    }
  ]
}
```

其他生态走 Other 自由输入，welcome 不拼子模板，直接在 `{{projectFieldsBlock}}` 里留 `TODO: 请补充 <生态>-specific release 步骤`。

---

## 改哲学（philosophy）

```json
{
  "question": "切换版本决策哲学？",
  "header": "Philosophy",
  "multiSelect": false,
  "options": [
    {
      "label": "commit 推导（semantic-release 派）",
      "description": "feat: / fix: / BREAKING CHANGE: 自动推导 semver bump"
    },
    {
      "label": "手写变更清单（Changesets 派）",
      "description": "每次 PR 附一份变更文件，release 时汇总"
    },
    {
      "label": "人工指定",
      "description": "每次 release 由维护者直接指定版本号"
    }
  ]
}
```

---

## 改 tag 格式

```json
{
  "question": "切换 tag 格式？",
  "header": "Tag",
  "multiSelect": false,
  "options": [
    {
      "label": "v<version>",
      "description": "单包仓库最常见：v1.2.3"
    },
    {
      "label": "<name>-v<version>",
      "description": "多包/多插件仓库：token-reporter-v2.9.9"
    },
    {
      "label": "@scope/pkg@<version>",
      "description": "npm scoped monorepo：@acme/core@1.2.3"
    }
  ]
}
```

---

## 改打包粒度

```json
{
  "question": "切换打包粒度？",
  "header": "Packaging",
  "multiSelect": false,
  "options": [
    {
      "label": "Single-repo",
      "description": "一个仓库 = 一个发行单元，只有一个版本号"
    },
    {
      "label": "Monorepo · 单包 release",
      "description": "monorepo 但一次只 release 一个子包（df-market 即此类）"
    },
    {
      "label": "Monorepo · 批量 release",
      "description": "一次 release 所有变更包，Changesets 的默认模式"
    }
  ]
}
```

---

## 自定义字段采集模板

用户选「**添加自定义字段**」后，按下述纯文本对话采集（不走 AUQ，用 free-text 问答——AUQ 对自由输入场景不友好）：

```
welcome：想加什么字段？给字段一个简短的名字即可（示例：pre-release-checklist、changelog-location、gh release notes 模板等）。
用户：...
welcome：这个字段的默认值是什么？留空我会在派生出的 skill 正文里用 `TODO: 请补充 <字段名>` 占位。
用户：...
welcome：好的，已记录。再加一条、还是继续落盘？（AUQ 单选 2 选项）
```

自定义字段合并到 `{{projectFieldsBlock}}`。

---

## Override 合并规则

环节 6 采集到的 `{{projectAnswers}}` 是基准，环节 8 的 `{{overrides}}` 覆盖上去：

```
finalAnswers = merge(projectAnswers, overrides)
```

override 命中已有 key → 覆盖该 key 的值（提示用户「原值：X，新值：Y」）；未命中 key → 追加新字段。

Override 结束后回到环节 9，按 `finalAnswers` 拼模板并委派 skill-creator。
