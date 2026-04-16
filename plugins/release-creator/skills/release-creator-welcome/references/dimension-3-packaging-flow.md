# 维度 3 · 打包 + tag 派 追问清单

用户在环节 5 选了「维度 3 · 打包 + tag」——从「一次 release 动哪些包 / tag 长什么样」出发反推生态与哲学。本 flow 的问答顺序：

1. **预扫项目档案**（侧重仓库拓扑）
2. **打包粒度选择**（AUQ 单选 3）
3. **tag 格式选择**（AUQ 单选 3 + Other）
4. **基于打包 + tag 推导生态 / 哲学**

---

## 1. 预扫项目档案

侧重仓库结构：

- Glob `<repo>/plugins/*/` → 命中即多插件 monorepo
- Glob `<repo>/packages/*/` → 命中即 npm monorepo（Changesets / pnpm workspaces）
- Glob `<repo>/apps/*/` → Turborepo / Nx 风格
- Read `<repo>/pnpm-workspace.yaml` / `<repo>/lerna.json` / `<repo>/nx.json` → 命中即 monorepo
- Bash `git tag --list | head -50` → **重点**：统计 tag 格式分布
  - 全部 `v\d+\.\d+\.\d+` → 单包 / `v<version>`
  - 出现 `<name>-v<version>` → 多插件 prefixed
  - 出现 `@scope/pkg@<version>` → npm scoped monorepo
  - 混合多种 → 暗示历史迁移过，需要用户确认当前标准
- Read `<repo>/.claude-plugin/marketplace.json` → 命中即 Claude plugin 场景
- Read `<repo>/package.json` → 看 workspaces 字段

---

## 2. 打包粒度选择（AUQ 单选 3）

```json
{
  "question": "一次 release 动哪些发行单元？",
  "header": "Packaging",
  "multiSelect": false,
  "options": [
    {
      "label": "Single-repo",
      "description": "仓库 = 发行单元，只有一个版本号。单包 npm / 单插件仓库 / 单应用"
    },
    {
      "label": "Monorepo · 单包 release",
      "description": "monorepo，但一次 release 只动一个子包。多版本号独立演进。df-market 即此类"
    },
    {
      "label": "Monorepo · 批量 release",
      "description": "一次 release 所有变更包，Changesets 默认模式。每包独立版本号但 release 同一批次"
    }
  ]
}
```

---

## 3. tag 格式选择（AUQ 单选 3 + Other）

基于上一问的打包粒度推默认值：

- Single-repo → 默认 `v<version>`
- Monorepo · 单包 release → 默认 `<name>-v<version>`
- Monorepo · 批量 release → 默认 `@scope/pkg@<version>` 或每包独立 `<name>@<version>`

```json
{
  "question": "tag 格式？",
  "header": "Tag",
  "multiSelect": false,
  "options": [
    {
      "label": "v<version>",
      "description": "单包最常见：v1.2.3"
    },
    {
      "label": "<name>-v<version>",
      "description": "多插件 / 多包：token-reporter-v2.9.9（df-market 用此格式）"
    },
    {
      "label": "@scope/pkg@<version>",
      "description": "npm scoped monorepo：@acme/core@1.2.3"
    }
  ]
}
```

Other 走自由输入，welcome 在 `{{projectFieldsBlock}}` 留 `TODO: 请补充 tag 格式约定`。

---

## 4. 关键追问：monorepo 场景的独立版本号维护

如果打包粒度是 monorepo（任意一种），额外一轮 AUQ：

```json
{
  "questions": [
    {
      "question": "各子包的版本号写在哪？",
      "header": "Version src",
      "multiSelect": true,
      "options": [
        { "label": "各自 package.json / pyproject.toml", "description": "每个子包自带 version 字段" },
        { "label": "一个外部注册表 / manifest", "description": "如 .claude-plugin/marketplace.json 把各插件 version 镜像一份" },
        { "label": "git tag 推导（hatch-vcs 风格）", "description": "不在文件里写死 version" }
      ]
    },
    {
      "question": "是否需要同步镜像 version（一处改动、多处需同步）？",
      "header": "Mirror",
      "multiSelect": false,
      "options": [
        { "label": "是", "description": "有 bump 脚本或手动同步（df-market 的 plugin.json + marketplace.json）" },
        { "label": "否", "description": "版本号只在一处" }
      ]
    },
    {
      "question": "bump 版本的命令是？",
      "header": "Bump cmd",
      "multiSelect": false,
      "options": [
        { "label": "脚本", "description": "如 node plugins/<name>/scripts/bump-version.cjs" },
        { "label": "npm version / pnpm version", "description": "npm 官方命令" },
        { "label": "手动编辑 JSON", "description": "没有工具支持" },
        { "label": "其他", "description": "留 `TODO:` 让用户手填" }
      ]
    }
  ]
}
```

> 预扫到 `scripts/bump-version.*` → 第三问默认选「脚本」并把检测到的路径填入。

---

## 5. 关键追问：push 策略

```json
{
  "questions": [
    {
      "question": "push tag 的方式？",
      "header": "Push tag",
      "multiSelect": false,
      "options": [
        {
          "label": "只 push 本次新 tag",
          "description": "`git push origin <tag-name>`（推荐，不会误推无关 WIP tag）"
        },
        {
          "label": "push --tags",
          "description": "推送所有本地 tag，风险较高但最简单"
        },
        {
          "label": "CI 自动打 tag",
          "description": "本地不 push tag，由 CI 根据 commit 自动打"
        }
      ]
    },
    {
      "question": "是否用 pre-push hook 做版本检查？",
      "header": "Pre-push",
      "multiSelect": false,
      "options": [
        { "label": "是", "description": "已有 .git/hooks/pre-push 或想加上" },
        { "label": "否", "description": "依赖人工检查" }
      ]
    }
  ]
}
```

---

## 6. 推导默认生态 / 哲学

| 打包 + tag                          | 默认生态                 | 默认哲学              |
| ----------------------------------- | ------------------------ | --------------------- |
| Single-repo + `v<version>`          | 预扫生态                 | manual 或 commit-derived |
| Monorepo 单包 + `<name>-v<version>` | claude-plugin 优先       | commit-derived + manual 复核 |
| Monorepo 批量 + `@scope/pkg@<version>` | npm                    | changeset             |

展示 AUQ 单选让用户复核：

```json
{
  "question": "以下默认已为你选好，满意直接继续；要改哪一项？",
  "header": "Defaults",
  "multiSelect": false,
  "options": [
    { "label": "都满意，继续", "description": "进入通用参数（命名 / 落盘位置）" },
    { "label": "改生态", "description": "跳到 Override 改 ecosystem" },
    { "label": "改 philosophy", "description": "跳到 Override 改 philosophy" }
  ]
}
```

选「都满意」→ 进入环节 7。选其他 → 暂存并跳到环节 8 对应 override。
