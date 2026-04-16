# 维度 2 · 哲学派 追问清单

用户在环节 5 选了「维度 2 · 哲学」——从「版本号怎么决策」出发反推打包粒度与 tag 格式。本 flow 的问答顺序：

1. **预扫项目档案**（同 dimension-1 预扫，但侧重 commit 格式）
2. **哲学选择**（AUQ 单选 3 + Other）
3. **基于哲学的具体字段追问**
4. **推导默认生态 / 打包粒度 / tag 格式**

---

## 1. 预扫项目档案

按顺序扫：

- Bash `git log --oneline -50` → **重点**：统计 commit message 前缀分布
  - 80% 以上有 `feat:` / `fix:` / `chore:` 等前缀 → 强推 `commit-derived`
  - 出现 `BREAKING CHANGE:` 或 `!` 标记 → commit 推导可以自动识别 major bump
  - 全是自由文本 → 强推 `manual`
- Glob `<repo>/.changeset/**` → 命中即暗示已用 Changesets（`changeset` 哲学）
- Glob `<repo>/.release-please-manifest.json` → 命中即暗示 release-please（`commit-derived` 哲学）
- Read `<repo>/release.config.js` / `.releaserc*` → 命中即 semantic-release
- Read `<repo>/CHANGELOG.md` → 看格式是否「conventional-changelog 自动生成」样式
- Read `<repo>/package.json` → 找 `release` / `semantic-release` / `@changesets/cli` 依赖
- Read `<repo>/.github/workflows/release.yml` → 看 CI 是否已自动化

**关键启发**：预扫结果直接决定下一步 AUQ 的默认高亮——不要让用户跟一个明显已经用了 Changesets 的项目去选 manual。

---

## 2. 哲学选择（AUQ 单选 3 + Other）

```json
{
  "question": "版本号决策哲学？",
  "header": "Philosophy",
  "multiSelect": false,
  "options": [
    {
      "label": "commit 推导",
      "description": "feat: / fix: / BREAKING CHANGE: 自动推导 semver bump，代表工具：semantic-release / release-please / conventional-changelog"
    },
    {
      "label": "手写变更清单",
      "description": "每次 PR 附一份 changeset 文件（patch/minor/major），release 时汇总。代表工具：Changesets（npm monorepo 主流）"
    },
    {
      "label": "人工指定",
      "description": "每次 release 由维护者直接指定版本号，commit message 自由。最简单，但完全依赖维护者经验"
    }
  ]
}
```

Other 自由输入（如 `calendar-versioning` / `date-based`）→ welcome 不拼子模板，直接在 `{{projectFieldsBlock}}` 留 `TODO: 请补充 <哲学>-specific 版本决策步骤`。

---

## 3. 基于哲学的具体字段追问

### 3.a · 哲学 = commit-derived

```json
{
  "questions": [
    {
      "question": "bump 规则是？",
      "header": "Rules",
      "multiSelect": false,
      "options": [
        { "label": "标准 conventional", "description": "feat=minor / fix=patch / BREAKING=major" },
        { "label": "严格（所有 chore 不 bump）", "description": "只有 feat/fix/BREAKING 触发 release" },
        { "label": "自定义", "description": "留 `TODO:` 让用户手填规则" }
      ]
    },
    {
      "question": "是否自动生成 CHANGELOG？",
      "header": "Changelog",
      "multiSelect": false,
      "options": [
        { "label": "是，conventional-changelog", "description": "从 commit message 自动拼" },
        { "label": "是，release-please", "description": "PR 自动生成" },
        { "label": "否，手动写", "description": "release 时手动更新 CHANGELOG.md" },
        { "label": "不维护 CHANGELOG", "description": "只靠 git log / GitHub release notes" }
      ]
    },
    {
      "question": "触发 release 的方式？",
      "header": "Trigger",
      "multiSelect": false,
      "options": [
        { "label": "CI 自动（push main 即发布）", "description": "semantic-release 典型模式" },
        { "label": "CI 半自动（release-please PR）", "description": "生成 PR，合并后发布" },
        { "label": "手动命令", "description": "本地跑脚本" }
      ]
    }
  ]
}
```

### 3.b · 哲学 = changeset

```json
{
  "questions": [
    {
      "question": "changeset 工具是？",
      "header": "Tool",
      "multiSelect": false,
      "options": [
        { "label": "@changesets/cli", "description": "npm 生态主流" },
        { "label": "自制 markdown 清单", "description": "每次 PR 加一份 docs/changes/*.md，release 时合并" },
        { "label": "其他", "description": "留 `TODO:` 让用户手填" }
      ]
    },
    {
      "question": "PR 要求 changeset 文件吗？",
      "header": "PR gate",
      "multiSelect": false,
      "options": [
        { "label": "强制（CI 阻断）", "description": "PR 无 changeset 不能合" },
        { "label": "建议（CI 警告）", "description": "提醒但不阻断" },
        { "label": "无 PR 要求", "description": "release 时再补写" }
      ]
    },
    {
      "question": "release 时的流程？",
      "header": "Flow",
      "multiSelect": false,
      "options": [
        { "label": "CI 自动（changeset version + publish）", "description": "全自动化" },
        { "label": "本地 `pnpm changeset version` 后人工审" , "description": "半自动" },
        { "label": "完全手动合并 changelog", "description": "不用工具，靠人" }
      ]
    }
  ]
}
```

### 3.c · 哲学 = manual

```json
{
  "questions": [
    {
      "question": "版本号规则是？",
      "header": "Rules",
      "multiSelect": false,
      "options": [
        { "label": "semver（MAJOR.MINOR.PATCH）", "description": "业界默认" },
        { "label": "calver（YYYY.MM.DD / YY.MM）", "description": "基于日期" },
        { "label": "serial（单调递增）", "description": "v1, v2, v3..." },
        { "label": "其他", "description": "留 `TODO:` 让用户手填" }
      ]
    },
    {
      "question": "release 前的检查清单？",
      "header": "Checklist",
      "multiSelect": true,
      "options": [
        { "label": "跑测试", "description": "`npm test` / `pytest` 等" },
        { "label": "更新 CHANGELOG", "description": "人工追加一段" },
        { "label": "同步镜像文件", "description": "如 marketplace.json 这类需要镜像 version 的文件" },
        { "label": "review commit message", "description": "确认 commit 符合约定" }
      ]
    }
  ]
}
```

### 3.d · 哲学 = Other

退回自由输入：让用户用一段话描述「本项目的版本决策规则」。welcome 把整段文本作为 `TODO:` 占位说明。

---

## 4. 推导默认生态 / 打包粒度 / tag 格式

welcome 根据哲学 + 预扫结果合成默认值：

| 哲学             | 默认生态                             | 默认打包粒度          | 默认 tag 格式           |
| ---------------- | ------------------------------------ | --------------------- | ----------------------- |
| commit-derived   | 预扫生态（npm / Python / ...）       | 单包 / monorepo 单包  | `v<version>` 或 `<pkg>-v<version>` |
| changeset        | npm（强相关）                        | monorepo 批量 release | `@scope/pkg@<version>`  |
| manual           | 预扫生态                             | 单包                  | `v<version>`            |

展示 AUQ 单选让用户复核：

```json
{
  "question": "以下默认已为你选好，满意直接继续；要改哪一项？",
  "header": "Defaults",
  "multiSelect": false,
  "options": [
    { "label": "都满意，继续", "description": "进入通用参数（命名 / 落盘位置）" },
    { "label": "改生态", "description": "跳到 Override 改 ecosystem" },
    { "label": "改 tag 格式", "description": "跳到 Override 改 tag" },
    { "label": "改打包粒度", "description": "跳到 Override 改 packaging" }
  ]
}
```

选「都满意」→ 进入环节 7。选其他 → 暂存并跳到环节 8 对应 override，再回来走环节 7。
