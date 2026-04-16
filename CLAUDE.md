# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

**df-market** is a Claude Code plugin marketplace hosted on GitHub (`jjj201200/df-market`). It contains:
- `.claude-plugin/marketplace.json` — the registry of available plugins
- `plugins/` — the actual plugin source code (currently: `token-reporter`)

Users register this marketplace in their Claude Code settings and install plugins via `/plugin install <name>@df-market`.

## Running Tests

Tests use Node's built-in `assert` module — no test framework to install.

```bash
# Run all tests for token-reporter
cd plugins/token-reporter
node test/test-hooks.js
node test/test-migration.js
node test/test-single-instance.js
```

Tests use the `TOKEN_REPORTER_DATA_DIR` env var to redirect data to a temp directory, avoiding interference with a live install.

### Development server (manual testing)

When running the plugin for hands-on testing, **always use port `13737`**. Port `3737` is reserved for the production instance that the user runs day-to-day — never point tests or the dev server at it.

The dev server is launched via `token-reporter-dev` (in `plugins/token-reporter/bin/`). **Always export `TOKEN_REPORTER_DEV_ROOT` to the current project root before invoking it**, so the script resolves to this checkout rather than a cached/previous path:

```bash
export TOKEN_REPORTER_DEV_ROOT="$(pwd)"   # from the repo root
token-reporter-dev start                  # listens on 13737
token-reporter-dev stop
```

## Plugin Architecture (token-reporter)

The plugin follows the Claude Code plugin lifecycle model:

### Hooks (`hooks/`)
Three lifecycle scripts registered in `hooks/hooks.json`:
- **`session-start.js`** — ensures data dirs exist, loads config, runs migrations, acquires a file lock, spawns the HTTP server as a detached process
- **`post-tool-use.js`** — POSTs a notification to the server after every tool call, triggering SSE broadcasts to web clients
- **`session-end.js`** — cleans up on exit

### Server (`src/server.js`)
Lightweight HTTP server (production port `3737`; dev/test port `13737` — see "Development server" above) with:
- `GET /` → serves `src/report.html` (the web dashboard)
- `GET /events` → SSE stream for real-time dashboard updates
- `POST /notify` → receives tool-use notifications from the hook
- `GET /api/sessions` → lists all Claude Code session files
- `GET /api/sessions/:id` → returns parsed session data

### Parser (`src/parser.js`)
Reads JSONL session files from `~/.claude/projects/*/` (including subagents). Extracts turn-by-turn token usage (input, output, cache_read, cache_creation) and tool call details. Tools are classified into categories: bash, read, edit, write, grep, glob, web, agent, other.

### CLI Commands (`bin/`)
Executable scripts in `bin/` are added to PATH when the plugin is enabled. Available commands:
- `token-reporter-start` — start the server
- `token-reporter-stop` — stop the server
- `token-reporter-status` — show server status
- `token-reporter-auto-launch-on` — enable auto-start
- `token-reporter-auto-launch-off` — disable auto-start

### Persistence
All runtime data lives in `~/.claude/token-reporter/`:
- `config.json` — port and `autoStart` flag
- `server.pid` — PID of the running server process
- `server.lock` — file lock to prevent duplicate instances

### Version Migrations (`src/migrate.js`)
A migration framework that runs on session start. When adding breaking config changes, add a migration entry here.

## Internationalization (i18n)

The frontend dashboard supports multiple languages (English and Chinese). The i18n system is a custom lightweight implementation (~2KB) using Zustand + React hooks.

### File Structure

```
frontend/src/
  i18n/
    index.ts              # Barrel export: useI18n, TFunction, Locale, TranslationKey
    types.ts              # Locale type, FlattenKeys utility, TranslationKey union
    useI18n.ts            # useI18n() hook and createT() for non-component code
    locales/
      en.ts               # English translations (source of truth for types)
      zh-CN.ts            # Chinese translations
  stores/
    i18nStore.ts          # Zustand store for locale state + browser detection
```

### Adding a New Translatable String

1. Add the key and English text to `frontend/src/i18n/locales/en.ts` under the appropriate namespace
2. Add the same key with Chinese translation to `frontend/src/i18n/locales/zh-CN.ts`
3. In the component, use `const {t} = useI18n()` then `t('namespace.key')`

For strings with variables, use `{varName}` placeholders:
```ts
// en.ts
nTurns: '{count} turns'
// Component
t('overview.nTurns', {count: 42})  // → "42 turns"
```

### Key Naming Convention

Keys are dot-separated and organized by feature area:
- `common.*` — shared labels (Input, Output, Copy, etc.)
- `error.*` — error and empty state messages
- `nav.*` — navigation labels
- `overview.*`, `cache.*`, `tools.*`, `context.*`, `subagents.*`, `timing.*` — analytics panel strings
- `session.*` — session bar labels
- `chart.*` — chart titles
- `compact.*`, `conversation.*` — conversation list strings
- `toolStats.*` — tool statistics labels
- `rec.*` — recommendation templates (nested: `rec.lowCache.title`, `rec.lowCache.detail`, etc.)

### Using i18n in Utility Functions

For non-component code (like `generateRecommendations` in `utils/analytics.ts`), pass the `t` function as a parameter:
```ts
import type {TFunction} from '../i18n';

export function generateRecommendations(input: Input, t: TFunction): Result[] {
  // use t('rec.lowCache.title', {rate: '30%'})
}
```

### Adding a New Language

1. Create `frontend/src/i18n/locales/<code>.ts` (e.g., `ja.ts`)
2. Import `Translation` type from `en.ts` and implement all keys
3. Add the locale code to the `Locale` union in `types.ts`
4. Add the locale code to `SUPPORTED` array in `stores/i18nStore.ts`
5. Import and register the new locale in `i18n/useI18n.ts` translations map
6. Update `detectLocale()` in `i18nStore.ts` for browser language matching

### Language Detection

Priority order: localStorage (`token-reporter:locale`) → `navigator.languages` → default `en`.
The language toggle button is in the StickyChart header bar.

### Chart Turn Jump Interaction

All analytics charts whose x-axis represents individual turns (e.g. `#1`, `#2`) must support clicking the chart to jump to the corresponding turn in the conversation list. This applies to:
- `LineChart` / `AreaChart` / `BarChart` where `dataKey="turn"` is used on the x-axis
- Charts where each data point maps to a specific `turnId`

Implementation pattern:
1. Attach an `onClick` handler to the Recharts chart component
2. Extract the turn number from the click event (`activeLabel` or coordinate mapping)
3. Call `scrollToTurnIndex(turns, idx)` and `setSelected(turnId)` to navigate and highlight the turn

Charts that aggregate across turns (e.g. Pie charts, vertical bar charts by category) do not need this behavior.

## Plugin: skill-keeper

`plugins/skill-keeper/` 捆绑 5 份通用方法论 skill（`skill-recap` / `skill-doc-sync-check` / `skill-sync-check` / `skill-doc-audit` / `skill-audit`）并附带一份渐进式引导 skill `skill-keeper-welcome`。

### 关键约束

- 5 份通用 skill 的 frontmatter `name` 字段**必须保持原值**（不加 `-keeper` 前缀 / 后缀）。它们彼此通过 name 交叉引用——`skill-recap` 正文调用 `skill-sync-check` / `skill-doc-sync-check`，定制版"前置"声明也按原名引用通用版。改名会让整套引用链失效。
- 目录名与 frontmatter `name` 必须一致。
- 新增/修改本插件内的 skill 时，**5 份通用 skill 原则上整份搬运、不就地编辑**；如需改动请直接修改用户个人 `~/.claude/skills/<name>/SKILL.md` 后重新搬运，以便上游（个人 skills）与插件内保持一致。

### welcome skill 流程（v0.1.2 起 8 环节）

`/skill-keeper-welcome` 命令 → 触发 `skill-keeper-welcome` skill → 渐进式 AskUserQuestion：

1. 语言（一次 AUQ 同时采集沟通语言 + 骨架正文语言）
2. 价值阐述
3. 意向分流（直接派生 / 暂时跳过 · 2 选项）
4. 检测官方 `skill-creator`
5. 派生范围 + 通用参数（项目代号 / 生成位置）
6. 命名方案
7. 逐份追问项目特有字段（先预扫项目档案提供默认值）
8. 落盘清单确认 + 委派 `skill-creator` + 收尾提示

welcome skill 本身不写任何 SKILL.md 文件——落盘交给 `skill-creator`。未填字段以 `TODO:` 占位符保留。

### references / scripts 拓扑

为避免 SKILL.md 正文过长，skill-keeper 内每份 skill 把"可抽离的长清单"移到同级 `references/` 子目录。SKILL.md 正文保留骨架 + 指向 reference 的指针；执行到对应步骤时主流程 Read 对应 reference。

| skill                  | references                                  | 抽出的内容                                              |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `skill-recap`          | `references/decision-trees.md`              | 改进维度、过程反哺、四问归类、综合考量维度              |
| `skill-sync-check`     | `references/cascade-patterns.md`            | 6 种变更类型的级联检查清单、工具选择                    |
| `skill-doc-sync-check` | `references/check-catalog.md`               | 四项核查清单、索引完整性五步闭环、工具选择              |
| `skill-audit`          | `references/dimensions.md`                  | 7 核查维度                                              |
| `skill-doc-audit`      | `references/dimensions.md`                  | 5 核查维度、索引强制步骤、并行切分策略                  |
| `skill-keeper-welcome` | `references/language-options.md` / `references/scope-split-plan.md` / `references/derivation-fields-catalog.md` / `references/skill-creator-prompt-template.md` | 语言 AUQ（一次两问）、派生范围拆分方案、追问字段清单+预扫规则、委派 prompt 模板 |

**脚本**：`skill-audit/scripts/validate-frontmatter.sh` 对一份或多份 SKILL.md 做机械校验（YAML 合法 / name↔目录一致 / description 非空）。退出码 0=通过、1=违规、2=参数错。支持 `--dir <skills-root>` 扫描全目录。`skill-audit` 主流程的"frontmatter 合规"维度优先跑该脚本做初筛。

**维护约定**：

- 修改 SKILL.md 前，如果要动"reference 已承接"的章节，考虑直接改 reference 并保留正文指针
- 新增 reference → 必须在 SKILL.md 正文显式引用（避免孤儿），见 `skill-audit` 维度 7
- `validate-frontmatter.sh` 属于机械校验工具，不替代 skill-audit 的语义维度

## Adding a New Plugin

1. Create `plugins/<name>/` with the plugin source
2. Add a `.claude-plugin/plugin.json` inside it with metadata
3. Register it in `.claude-plugin/marketplace.json` at the repo root

## Version Management

### Before Every Push

**Always check if version needs to be bumped before pushing.** Run:

```bash
node plugins/token-reporter/scripts/check-version.cjs
```

This will prompt you to bump the version if it hasn't been updated.

### Version Bump Script

Interactive version bumping (recommended):

```bash
node plugins/token-reporter/scripts/bump-version.cjs
```

Or specify the bump type directly:

```bash
node plugins/token-reporter/scripts/bump-version.cjs patch   # 1.0.0 → 1.0.1
node plugins/token-reporter/scripts/bump-version.cjs minor   # 1.0.0 → 1.1.0
node plugins/token-reporter/scripts/bump-version.cjs major   # 1.0.0 → 2.0.0
```

The script updates both files automatically:
- `plugins/token-reporter/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

### Version Locations

Version appears in these places for `token-reporter`:
- `plugins/token-reporter/.claude-plugin/plugin.json` — plugin manifest
- `.claude-plugin/marketplace.json` — marketplace registry
- Git commit message (convention: `chore: bump version to X.Y.Z`)

### Commit Guidelines

**Keep commit messages clean and simple.**

- Use concise, descriptive messages without attribution lines
- Do not add `Co-Authored-By:`, `Signed-off-by:`, or similar trailer lines
- Follow conventional commit format: `type(scope): description`

### Git Hook (Optional)

To automatically check version before every push, add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
node plugins/token-reporter/scripts/check-version.cjs || exit 1
```

Then make it executable:

```bash
chmod +x .git/hooks/pre-push
```
