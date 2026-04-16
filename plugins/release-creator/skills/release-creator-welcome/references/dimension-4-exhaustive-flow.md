# 维度 4 · 穷举派 追问清单

用户在环节 5 选了「维度 4 · 穷举」——四象限全问一遍，生成的 skill 最长但最明确。本 flow 不做任何推导默认值，所有字段必问，用户回答形成完整的 `{{projectAnswers}}`。

本 flow 适合：

- 既不确定又想一次把所有决策显式化的项目
- 有独特发行场景（如混合生态、非常规 tag 格式）
- 想作为团队内部 release SOP 的明确底稿

---

## 1. 预扫项目档案（同其他 flow，但不作为筛选，只作为默认值）

按 dimension-1 / dimension-2 / dimension-3 预扫步骤全跑一遍，把所有扫到的值汇入 `{{prescan}}` 字典。后续 AUQ 把 `{{prescan}}` 里对应值作为 option 默认排序的第一位。

---

## 2. 完整字段矩阵

共 4 轮 AUQ，每轮最多 4 问，完整走下来约 12–16 道题。用户可以随时终止（每轮最后有「跳过剩余，直接落盘 + 留 TODO:」按钮）。

### 2.a · 第一轮：生态维度

直接读 `dimension-1-ecosystem-flow.md` 的第 2 节「生态选择」+ 3.x 对应的 3–4 问（按用户第 2 节的选择展开）。

### 2.b · 第二轮：哲学维度

直接读 `dimension-2-philosophy-flow.md` 的第 2 节「哲学选择」+ 3.x 对应的 3 问。

### 2.c · 第三轮：打包 + tag 维度

直接读 `dimension-3-packaging-flow.md` 的第 2 节 + 3 节 + 4 节 + 5 节（完整 4 轮）。

### 2.d · 第四轮：项目特有扩展字段

```json
{
  "questions": [
    {
      "question": "是否维护 CHANGELOG.md？",
      "header": "Changelog",
      "multiSelect": false,
      "options": [
        { "label": "是，自动生成", "description": "conventional-changelog / release-please" },
        { "label": "是，手动维护", "description": "人工追加" },
        { "label": "否", "description": "只靠 git log / GH release notes" }
      ]
    },
    {
      "question": "是否发布 GitHub Release（附 release notes）？",
      "header": "GH release",
      "multiSelect": false,
      "options": [
        { "label": "是，人工写 notes", "description": "`gh release create <tag> --notes \"...\"`" },
        { "label": "是，自动生成 notes", "description": "release-please / semantic-release 自动" },
        { "label": "否", "description": "只打 git tag" }
      ]
    },
    {
      "question": "pre-release 分支策略？",
      "header": "Pre-release",
      "multiSelect": false,
      "options": [
        { "label": "无 pre-release", "description": "只发正式版" },
        { "label": "有，next 分支", "description": "next 分支发 `1.2.3-next.0`" },
        { "label": "有，beta / rc", "description": "`1.2.3-beta.0` / `1.2.3-rc.0`" },
        { "label": "其他", "description": "留 `TODO:` 让用户手填" }
      ]
    },
    {
      "question": "release 后要通知的渠道？",
      "header": "Notify",
      "multiSelect": true,
      "options": [
        { "label": "无", "description": "静默 release" },
        { "label": "Slack / Discord webhook", "description": "CI 发通知" },
        { "label": "邮件列表", "description": "项目订阅列表" },
        { "label": "社交媒体", "description": "Twitter / 掘金 / 公众号等" }
      ]
    }
  ]
}
```

---

## 3. 跳过按钮（每轮之间插入）

每轮 AUQ 跑完后，插入一道单选 AUQ：

```json
{
  "question": "已回答当前维度的问题。接下来？",
  "header": "Continue",
  "multiSelect": false,
  "options": [
    { "label": "继续下一维度", "description": "穷举一直走下去" },
    { "label": "已够用，直接落盘（剩余字段留 TODO:）", "description": "跳到环节 7，剩余字段以 `TODO:` 占位" }
  ]
}
```

选「已够用」→ 剩余维度的所有字段标记为 `TODO:`，直接跳到环节 7。

---

## 4. 不做默认推导

与 dimension 1 / 2 / 3 不同，穷举派**不合成默认值**——用户选了穷举就是想自己决定每一项。所以本 flow 跳过「推导默认值」步骤，直接把 `{{projectAnswers}}` 完整值交给环节 7 / 8 / 9。

环节 8 的 override 对穷举派也意义不大（已经全问过），welcome 可以在展示骨架预览时提示：「穷举派的默认骨架已是你所有的选择，如有补充再走 Override 自定义字段；否则直接落盘。」

---

## 5. 拼模板规则

穷举派的输出 SKILL.md 拼装顺序：

1. `template-master-ecosystem.md` 主骨架（作为生态入口章节）
2. `template-master-philosophy.md` 主骨架（作为哲学入口章节）
3. `template-master-packaging.md` 主骨架（作为打包入口章节）
4. 对应的三份子模板全部拼入
5. `{{projectFieldsBlock}}` 完整列出所有字段

生成的 SKILL.md 会比其他三派长 2–3 倍，但所有决策都显式写死，团队交接不会有模糊地带。
