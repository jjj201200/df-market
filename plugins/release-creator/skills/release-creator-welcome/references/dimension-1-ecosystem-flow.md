# 维度 1 · 生态派 追问清单

用户在环节 5 选了「维度 1 · 生态」——从项目的技术栈出发反推版本哲学与 tag 格式。本 flow 的问答顺序：

1. **预扫项目档案**（welcome 自己执行，不问用户）
2. **生态选择**（AUQ 单选 4 + Other）
3. **基于生态的具体字段追问**（AUQ 多轮）
4. **推导默认哲学和 tag 格式**（welcome 内部合成，展示给用户复核）

---

## 1. 预扫项目档案（必做，在任何追问前）

使用下列工具按顺序扫描，把扫到的值作为后续 AUQ 的默认项：

- Read `<repo>/package.json` → 如果存在，`ecosystem` 默认预填 `npm`；读出 `name` / `version` 作为后续默认值
- Read `<repo>/pyproject.toml` → 如果存在，`ecosystem` 默认预填 `python`
- Read `<repo>/.claude-plugin/marketplace.json` → 如果存在，`ecosystem` 默认预填 `claude-plugin`
- Glob `<repo>/plugins/*/` → 如果命中，暗示 monorepo 多插件（后续 packaging 维度会用到）
- Bash `git log --oneline -20` → 用 regex 粗判 commit message 格式：
  - 出现 `feat:` / `fix:` / `BREAKING CHANGE:` → 推荐 `philosophy = commit-derived`
  - 全是自由文本 → 推荐 `philosophy = manual`
- Read `<repo>/CHANGELOG.md` → 存在即暗示已有版本记录习惯（参考不决策）
- Bash `git tag --list | head -20` → 读出现有 tag 格式供默认值
- Read `<repo>/README.md` → 扫 `Installation` 段落辅助判断发行载体

预扫失败不阻断——对应字段退回通用默认或留 `TODO:` 占位。

---

## 2. 生态选择（AUQ 单选 4 + Other）

```json
{
  "question": "项目属于哪种生态？",
  "header": "Ecosystem",
  "multiSelect": false,
  "options": [
    {
      "label": "npm",
      "description": "Node / pnpm / yarn。版本源 package.json，通常 `npm publish` 或 GitHub release"
    },
    {
      "label": "Python",
      "description": "pyproject.toml / poetry / hatch / setuptools。版本源 pyproject 或 __version__"
    },
    {
      "label": "Claude plugin",
      "description": "Claude Code plugin。双文件版本同步：plugin.json + marketplace.json entry"
    },
    {
      "label": "Docs-only",
      "description": "纯文档 / 静态站点。可能只需要 git tag，无产物发布"
    }
  ]
}
```

预扫命中的生态作为默认选中项（AUQ 第一个 option）。没命中 → 按上面的顺序展示，用户走 Other 输入（如 `rust-cargo` / `go-modules` / `dotnet-nuget`）。

---

## 3. 基于生态的具体字段追问

### 3.a · 生态 = npm

一次 AUQ，最多 4 问：

```json
{
  "questions": [
    {
      "question": "包管理器是？",
      "header": "PM",
      "multiSelect": false,
      "options": [
        { "label": "npm", "description": "默认 npm CLI" },
        { "label": "pnpm", "description": "pnpm workspaces 友好" },
        { "label": "yarn", "description": "Yarn 1 / Berry" }
      ]
    },
    {
      "question": "发布目标是？",
      "header": "Target",
      "multiSelect": false,
      "options": [
        { "label": "public npm registry", "description": "`npm publish`" },
        { "label": "private registry", "description": "公司内部 npm" },
        { "label": "GitHub release only", "description": "不发 registry，只打 tag + GH release" },
        { "label": "都要", "description": "npm publish + GH release 并行" }
      ]
    },
    {
      "question": "是否 scoped 包（@scope/name）？",
      "header": "Scope",
      "multiSelect": false,
      "options": [
        { "label": "否", "description": "普通包名" },
        { "label": "是，public 访问", "description": "`npm publish --access public`" },
        { "label": "是，restricted", "description": "仅 scope 内可见" }
      ]
    }
  ]
}
```

### 3.b · 生态 = Python

```json
{
  "questions": [
    {
      "question": "打包后端是？",
      "header": "Backend",
      "multiSelect": false,
      "options": [
        { "label": "hatchling", "description": "pyproject [build-system] hatchling" },
        { "label": "poetry", "description": "poetry-core" },
        { "label": "setuptools", "description": "经典 setup.py / setup.cfg" },
        { "label": "flit", "description": "flit_core" }
      ]
    },
    {
      "question": "发布目标？",
      "header": "Target",
      "multiSelect": false,
      "options": [
        { "label": "PyPI", "description": "`twine upload` 或 poetry publish" },
        { "label": "私有 index", "description": "公司内部 PyPI 镜像" },
        { "label": "GitHub release only", "description": "不上 PyPI" }
      ]
    },
    {
      "question": "版本号位置？",
      "header": "Version src",
      "multiSelect": false,
      "options": [
        { "label": "pyproject.toml > project.version", "description": "PEP 621 标准" },
        { "label": "__version__ in package/__init__.py", "description": "经典做法" },
        { "label": "动态（hatch-vcs / setuptools-scm）", "description": "从 git tag 自动推导" }
      ]
    }
  ]
}
```

### 3.c · 生态 = Claude plugin

```json
{
  "questions": [
    {
      "question": "仓库只有一个插件、还是多插件？",
      "header": "Packaging",
      "multiSelect": false,
      "options": [
        { "label": "单插件", "description": "仓库根即插件根；tag 用 `v<version>` 也可" },
        { "label": "多插件", "description": "plugins/ 子目录多份，每份独立 version；tag 必须 `<plugin>-v<version>`" }
      ]
    },
    {
      "question": "marketplace.json 怎么维护？",
      "header": "Marketplace",
      "multiSelect": false,
      "options": [
        { "label": "本仓库自维护", "description": ".claude-plugin/marketplace.json 在本仓库里" },
        { "label": "外部仓库集中维护", "description": "其他仓库统一列出所有插件" },
        { "label": "无 marketplace", "description": "用户直接 git 源安装" }
      ]
    },
    {
      "question": "是否有 version bump 脚本？",
      "header": "Bump script",
      "multiSelect": false,
      "options": [
        { "label": "有（例：plugins/<name>/scripts/bump-version.cjs）", "description": "welcome 会把命令写进派生 skill" },
        { "label": "没有", "description": "派生 skill 里留 `TODO: 请补充 version bump 命令或手动步骤`" }
      ]
    }
  ]
}
```

> 预扫到 `plugins/*/scripts/bump-version.*` → 最后一问默认选「有」并把检测到的路径作为 default。

### 3.d · 生态 = Docs-only

```json
{
  "questions": [
    {
      "question": "要打 git tag 吗？",
      "header": "Tag",
      "multiSelect": false,
      "options": [
        { "label": "要", "description": "用于标记文档版本" },
        { "label": "不要", "description": "只 commit + push，不打 tag" }
      ]
    },
    {
      "question": "是否自动部署（GitHub Pages / Netlify / Vercel）？",
      "header": "Deploy",
      "multiSelect": false,
      "options": [
        { "label": "有，push 即自动部署", "description": "release skill 只需 commit + push" },
        { "label": "有，但要手动触发", "description": "release skill 要加 deploy 命令" },
        { "label": "无自动部署", "description": "手动 rsync 或 scp" }
      ]
    }
  ]
}
```

### 3.e · 生态 = Other

退回自由输入：让用户用一段话描述「本项目如何发行 / 版本号在哪 / 用什么命令打包」。welcome 把整段文本作为 `TODO: 请补充 <ecosystem>-specific release 步骤` 的占位说明。

---

## 4. 推导默认哲学和 tag 格式

welcome 根据生态 + 预扫结果合成默认值，用纯文本展示给用户复核：

| 生态              | 默认 philosophy                   | 默认 tag 格式                       |
| ----------------- | --------------------------------- | ----------------------------------- |
| npm 单包          | commit-derived（若预扫到 conventional commits）否则 manual | `v<version>` |
| npm scoped monorepo | changeset                       | `@scope/pkg@<version>`              |
| Python            | manual（commit 约定在 Python 社区较少）| `v<version>`                       |
| Claude plugin 单插件 | commit-derived + manual 复核    | `v<version>`                        |
| Claude plugin 多插件 | commit-derived + manual 复核    | `<plugin>-v<version>` **（强烈推荐）**|
| Docs-only         | manual                            | `docs-v<version>` 或不打 tag        |

展示给用户时用 AUQ 单选：

```json
{
  "question": "以下默认已为你选好，满意直接继续；要改哪一项？",
  "header": "Defaults",
  "multiSelect": false,
  "options": [
    { "label": "都满意，继续", "description": "进入通用参数（命名 / 落盘位置）" },
    { "label": "改 philosophy", "description": "跳到 Override 改哲学" },
    { "label": "改 tag 格式", "description": "跳到 Override 改 tag" },
    { "label": "改打包粒度", "description": "跳到 Override 改 packaging" }
  ]
}
```

选非「都满意」→ 暂存 `dimension-1` 的结果，先跳到环节 8 对应 override，再回来走环节 7。
选「都满意」→ 直接进入环节 7（通用参数）。
