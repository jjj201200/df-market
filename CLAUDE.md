# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库工作时提供指引。

## 本仓库是什么

**df-market** 是托管在 GitHub (`jjj201200/df-market`) 上的 Claude Code 插件市场。包含：

- `.claude-plugin/marketplace.json` —— 可用插件注册表
- `plugins/` —— 实际的插件源码

用户在 Claude Code 设置里注册本 marketplace，通过 `/plugin install <name>@df-market` 安装插件。

## 运行测试

测试使用 Node 内置 `assert` 模块——无需安装任何测试框架。

```bash
# 跑 token-reporter 的全部测试
cd plugins/token-reporter
node test/test-hooks.js
node test/test-migration.js
node test/test-single-instance.js
```

测试通过 `TOKEN_REPORTER_DATA_DIR` 环境变量把数据重定向到临时目录，避免干扰用户日常运行的实例。

### 开发服务器（手动测试）

手动测试运行插件时**始终使用端口 `13737`**。`3737` 端口是用户日常运行的生产实例专用——切勿让测试或开发服务器指向它。

开发服务器通过仓库脚本 `scripts/token-reporter-dev.mjs` 启动。该脚本不属于插件 CLI（不进入 PATH），始终以仓库内 `plugins/token-reporter/` 为代码源，避免和市场缓存版本混淆：

```bash
scripts/token-reporter-dev.mjs start    # 监听 13737
scripts/token-reporter-dev.mjs stop
scripts/token-reporter-dev.mjs status
```

## Plugin: token-reporter

实时 token 使用监控插件。后端 TypeScript（`backend/src/` → 编译到 `backend/dist/`），前端 React + Vite + TypeScript（`frontend/src/` → 构建到 `dist/`）。遵循 Claude Code 插件生命周期模型。

### Hooks（`hooks/`）

三个生命周期脚本，注册在 `hooks/hooks.json`：

- **`session-start.js`** —— 确保数据目录存在、加载配置、跑迁移、获取文件锁、以 detached 方式派生 HTTP 服务器进程
- **`post-tool-use.js`** —— 每次工具调用后向服务器 POST 通知，触发对 web 客户端的 SSE 广播
- **`session-end.js`** —— 退出时清理

### 服务器（`backend/src/server.ts`）

轻量 HTTP 服务器（生产端口 `3737`；开发/测试端口 `13737`——见上文"开发服务器"章节），提供以下端点：

- `GET /` → 返回 `dist/index.html`（web 仪表盘 SPA）
- `GET /events` → 仪表盘实时更新的 SSE 流
- `POST /notify` → 接收来自 hook 的工具调用通知
- `POST /notify-new-session` → 新 session 创建通知（触发前端徽标）
- `GET /api/sessions` → 列出所有 Claude Code session 文件
- `GET /api/sessions/:id` → 返回解析后的 session 数据
- `GET /api/sessions/:id/composition` → 返回单 session 的 context 7 类来源构成（live / estimated 双模式）
- `GET /api/limits` → 模型限额缓存读取
- `POST /api/limits` → 模型限额缓存写入
- `GET /api/audit/status` → 审计开启状态、hook 心跳、settings.local.json 关键键状态
- `POST /api/audit/ack-prompt` → 标记审计引导横幅已确认
- `POST /api/audit/purge` → 清空 captures/ 目录

### 解析器（`backend/src/parser/`）

读取 `~/.claude/projects/*/` 下的 JSONL session 文件（含 subagent）。模块化拆分：`session.ts`（主入口）/ `core.ts` / `content.ts` / `metadata.ts` / `parent.ts` / `subagent.ts` / `tools.ts` / `types.ts`。按轮次提取 token 使用量（input、output、cache_read、cache_creation）和工具调用详情。工具分类：bash、read、edit、write、grep、glob、web、agent、other。

### 审计系统（`backend/src/audit-*.ts` + `runtime/fetch-hook.cjs`）

通过 shell alias 注入 `NODE_OPTIONS=--require=<hook>` 拦截 Claude Code 主进程的 `globalThis.fetch`，将 Anthropic Messages API 的完整 request/response body 旁路写盘到 `~/.claude/token-reporter/captures/`，供 composition-service 拆解 7 类 context 来源。设计文档见 `docs/superpowers/specs/2026-04-19-context-auditing-dashboard-design-v2.md`。

相关组件：`audit-keys.ts`（受管 env 键白名单）/ `audit-settings.ts`（settings.local.json 合并/还原 + 心跳读取）/ `captures-parser.ts`（req.json → CompositionPoint）/ `composition-service.ts`（live/estimated/hookStale 三模式响应组装）。

### CLI 命令（`bin/`）

`bin/` 下的可执行脚本在插件启用时加入 PATH：

- **服务器管理**：`token-reporter-start` / `token-reporter-stop` / `token-reporter-status`
- **自动启动**：`token-reporter-auto-launch-on` / `token-reporter-auto-launch-off`
- **状态栏集成**：`token-reporter-statusline-on` / `token-reporter-statusline-off` / `token-reporter-statusline-status`
- **审计**：`token-reporter-audit`（on / off / status / purge）—— 启停 fetch hook 注入并管理 captures

> 开发服务器不在此列——见上文"开发服务器"章节，使用仓库脚本 `scripts/token-reporter-dev.mjs`。

### 持久化

所有运行时数据存放在 `~/.claude/token-reporter/`：

- `config.json` —— 端口、`autoStart`、`auditEnabled`、`auditPromptedAt` 等
- `server.pid` —— 运行中服务器的进程 PID
- `server.lock` —— 防止重复实例的文件锁
- `captures/` —— 审计 hook 落盘的 `<pid>-<ts>-<seq>.req.json` / `.resp.json`（仅 audit 启用时生成）
- `captures/.heartbeat` —— hook 心跳（hookStale 探测依据）

### 前端 stores（`frontend/src/stores/`）

7 个 Zustand store 各司其职：`sessionStore`（session 列表 + 当前 session）/ `analyticsStore`（解析后指标）/ `chartStore`（图表交互状态）/ `uiStore`（视图模式 / 折叠状态）/ `limitsStore`（模型限额缓存）/ `auditStore`（audit 启用状态 / 横幅）/ `i18nStore`（语言）。

### 版本迁移（`backend/src/migrate.ts`）

一个会在 session 启动时运行的迁移框架。添加破坏性配置变更时，在这里追加一条迁移。

## 国际化（i18n）

前端仪表盘支持多语言（英文和中文）。i18n 系统是基于 Zustand + React hooks 的自制轻量实现（约 2KB）。

### 文件结构

```
frontend/src/
  i18n/
    index.ts              # 统一出口：useI18n, TFunction, Locale, TranslationKey
    types.ts              # Locale 类型、FlattenKeys 工具、TranslationKey 联合类型
    useI18n.ts            # useI18n() hook 和非组件代码用的 createT()
    locales/
      en.ts               # 英文翻译（类型的唯一事实来源）
      zh-CN.ts            # 中文翻译
  stores/
    i18nStore.ts          # 负责 locale 状态 + 浏览器语言检测的 Zustand store
```

### 添加一个新的可翻译字符串

1. 在 `frontend/src/i18n/locales/en.ts` 对应 namespace 下添加 key 和英文文案
2. 在 `frontend/src/i18n/locales/zh-CN.ts` 添加同一个 key 的中文翻译
3. 组件里 `const {t} = useI18n()`，然后 `t('namespace.key')`

含变量的字符串用 `{varName}` 占位：

```ts
// en.ts
nTurns: '{count} turns';
// 组件里
t('overview.nTurns', {count: 42}); // → "42 turns"
```

### key 命名约定

key 用点号分隔，按功能域组织：

- `common.*` —— 共享标签（Input、Output、Copy 等）
- `error.*` —— 错误和空状态消息
- `nav.*` —— 导航标签
- `overview.*`、`cache.*`、`tools.*`、`context.*`、`subagents.*`、`timing.*` —— 分析面板字符串
- `session.*` —— session 栏标签
- `chart.*` —— 图表标题
- `compact.*`、`conversation.*` —— 会话列表字符串
- `toolStats.*` —— 工具统计标签
- `rec.*` —— 推荐模板（嵌套：`rec.lowCache.title`、`rec.lowCache.detail` 等）

### 在工具函数中使用 i18n

非组件代码（如 `utils/analytics.ts` 里的 `generateRecommendations`），把 `t` 函数作为参数传入：

```ts
import type {TFunction} from '../i18n';

export function generateRecommendations(input: Input, t: TFunction): Result[] {
  // 使用 t('rec.lowCache.title', {rate: '30%'})
}
```

### 添加一门新语言

1. 创建 `frontend/src/i18n/locales/<code>.ts`（例如 `ja.ts`）
2. 从 `en.ts` 导入 `Translation` 类型并实现所有 key
3. 在 `types.ts` 的 `Locale` 联合类型里加上新语言码
4. 在 `stores/i18nStore.ts` 的 `SUPPORTED` 数组里加上新语言码
5. 在 `i18n/useI18n.ts` 的 translations map 里导入并注册
6. 更新 `i18nStore.ts` 的 `detectLocale()` 以匹配浏览器语言

### 语言检测

优先级：localStorage（`token-reporter:locale`）→ `navigator.languages` → 默认 `en`。
语言切换按钮位于 StickyChart 的 header 栏。

### 图表轮次跳转交互

所有 x 轴表示单轮对话（如 `#1`、`#2`）的分析图表必须支持点击跳转到对应轮次。这适用于：

- `LineChart` / `AreaChart` / `BarChart` 里 x 轴用 `dataKey="turn"` 的图表
- 每个数据点映射到具体 `turnId` 的图表

实现模式：

1. 在 Recharts 图表组件上挂 `onClick` handler
2. 从点击事件里提取轮次序号（`activeLabel` 或坐标映射）
3. 调用 `scrollToTurnIndex(turns, idx)` 和 `setSelected(turnId)` 完成跳转和高亮

跨轮次聚合的图表（如饼图、按类目的纵向柱状图）不需要此行为。

## Plugin: glm

`plugins/glm/` 是 GLM Coding Plan 工具箱。插件名 `glm` 是命名空间——后续 GLM 相关功能都以 `/glm:<name>` 命令挂在本插件下。

### /glm:usage（`commands/usage.md` + `scripts/usage.mjs`）

调智谱官方 monitor 接口，输出官方 `/usage` 风格的中文限额面板（5 小时窗口 + 7 天用量）。command 只做一件事：执行脚本并要求模型**逐字转述 stdout**——所有格式化都在脚本内完成，杜绝模型自由发挥。

- **数据来源**：`{ANTHROPIC_BASE_URL origin}/api/monitor/usage/quota/limit`（国内端点；`api.z.ai` 为 `/quota`，404 自动回退）。**非正式公开接口**，结构变化时降级展示原始 JSON，不崩溃。
- **key 安全（强约束）**：token 仅在脚本内从 `process.env.ANTHROPIC_AUTH_TOKEN` 读取——不进 argv、不打印、不落盘。修改本插件时不得引入任何携带 token 的参数或日志。
- **核心逻辑**（`scripts/lib/core.mjs`）：纯函数 + 依赖注入（`fetchQuota(fetchImpl, …)`），`test/test-core.js`（Node 内置 assert）不发真实请求。`unit` 语义（3→小时、6→周）为逆向结论，未知值兜底显示，勿硬编码假设。

### StatusBar 包装（`scripts/statusline.mjs` + `bin/glm-statusline-*`）

官方 statusline 在智谱后端下拿不到 GLM 限额（stdin JSON 无 `rate_limits` 字段）。`glm-statusline-on` 备份 `settings.json` 原 `statusLine` 配置到 `~/.claude/glm/statusline-backup.json` 并写入接管命令；`glm-statusline-off` 完整还原（备份为 `null` 时删除该键）；重复 `on` 幂等。

- **双模式**（每次刷新按 `ANTHROPIC_BASE_URL` 动态判定）：智谱后端渲染用量单行（5h/7d 百分比 + 着色 + ctx% + 模型 + 目录）；非智谱后端 spawn 原命令透传 stdin/stdout。任何失败都降级输出，状态栏永不空白。
- **stub 动态发现**：settings 指向 `~/.claude/glm/statusline.mjs`（stub），stub 每次刷新扫描 `~/.claude/plugins/cache/*/glm/<version>/` 选最新版转发——插件升级换版本目录后无需重新接管。改 stub 生成逻辑在 `scripts/install-statusline.mjs` 的 `STUB_SOURCE`。
- **缓存**：`~/.claude/glm/cache.json`，TTL 5 分钟；拉新失败沿用旧值加 `?` 标记。缓存只存解析后的窗口数据，不含 token。
- **测试**：`test/test-statusline.js`（临时目录 + HOME 重定向端到端，不碰真实 `~/.claude`）。

## Plugin: skill-keeper

`plugins/skill-keeper/` 捆绑 7 份通用方法论 skill（`skill-recap` / `skill-doc-sync-check` / `skill-sync-check` / `skill-coding-review` / `skill-subagent-check` / `skill-doc-audit` / `skill-audit`）并附带一份渐进式引导 skill `skill-keeper-welcome`。

### 关键约束

- 7 份通用 skill 的 frontmatter `name` 字段**必须保持原值**（不加 `-keeper` 前缀 / 后缀）。它们彼此通过 name 交叉引用——`skill-recap` 正文调用 `skill-sync-check` / `skill-doc-sync-check`，`skill-coding-review` 调用 `skill-subagent-check`，定制版"前置"声明也按原名引用通用版。改名会让整套引用链失效。
- 目录名与 frontmatter `name` 必须一致。
- 新增/修改本插件内的 skill 时，**权威源是插件版**（`plugins/skill-keeper/skills/<name>/`）——进 git、随插件分发、有版本历史。个人版 `~/.claude/skills/<name>/` 是按需同步的本地镜像，**不是权威源**。迭代流程：先改插件版，再 `cp -R` 同步到个人版（SKILL.md / references/ / scripts/）。

### welcome skill 流程（10 环节）

`/skill-keeper-welcome` 命令 → 触发 `skill-keeper-welcome` skill → 渐进式 AskUserQuestion：

1. 语言（一次 AUQ 同时采集沟通语言 + 骨架正文语言）
2. 价值阐述
3. 意向分流（直接派生 / 暂时跳过 · 2 选项）
4. 检测官方 `skill-creator`
5. 派生范围 + 通用参数（项目代号 / 生成位置）
6. 命名方案
7. 逐份追问项目特有字段（先预扫项目档案提供默认值）
8. 落盘清单确认 + 委派 `skill-creator`（串行，每份独立）
9. **文档登记子环节**（主动提醒：登记到 CLAUDE.md / AGENTS.md / MEMORY.md，多选；文件不存在时单独询问新建/打印/跳过；见 `doc-registration-flow.md`）
10. 收尾提示（重启 Claude Code 警告 + docIndexResult 展示）

welcome skill 本身不写任何 SKILL.md 文件——落盘交给 `skill-creator`。未填字段以 `TODO:` 占位符保留。**例外**：环节 9 允许 Write 目标文件（仅限 CLAUDE.md / AGENTS.md 的新建分支），经用户在 AUQ 里显式授权；MEMORY.md 永远不自动新建。

### references / scripts 拓扑

为避免 SKILL.md 正文过长，skill-keeper 内每份 skill 把"可抽离的长清单"移到同级 `references/` 子目录。SKILL.md 正文保留骨架 + 指向 reference 的指针；执行到对应步骤时主流程 Read 对应 reference。

| skill                  | references                                                                                                                                                                                              | 抽出的内容                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `skill-recap`          | `references/decision-trees.md`                                                                                                                                                                          | 改进维度、过程反哺、四问归类、综合考量维度                                                     |
| `skill-sync-check`     | `references/cascade-patterns.md`                                                                                                                                                                        | 6 种变更类型的级联检查清单、工具选择                                                           |
| `skill-doc-sync-check` | `references/check-catalog.md`                                                                                                                                                                           | 四项核查清单、索引完整性五步闭环、工具选择                                                     |
| `skill-coding-review`  | `references/dimensions.md` / `references/subagent-prompt-template.md` / `references/backlog-flow.md`                                                                                                    | 三维度定义 + 等级分类、硬化 subagent prompt 骨架、backlog 5 步整理流程                         |
| `skill-subagent-check` | `references/dimensions.md`                                                                                                                                                                              | 五项核查判定规则、常见降级模式、4 条通用高危盲区模板                                           |
| `skill-audit`          | `references/dimensions.md`                                                                                                                                                                              | 7 核查维度                                                                                     |
| `skill-doc-audit`      | `references/dimensions.md`                                                                                                                                                                              | 5 核查维度、索引强制步骤、并行切分策略                                                         |
| `skill-keeper-welcome` | `references/language-options.md` / `references/scope-split-plan.md` / `references/derivation-fields-catalog.md` / `references/skill-creator-prompt-template.md` / `references/doc-registration-flow.md` | 语言 AUQ（一次两问）、派生范围拆分方案、追问字段清单+预扫规则、委派 prompt 模板、文档登记 flow |

**脚本**：`skill-audit/scripts/validate-frontmatter.sh` 对一份或多份 SKILL.md 做机械校验（YAML 合法 / name↔目录一致 / description 非空）。退出码 0=通过、1=违规、2=参数错。支持 `--dir <skills-root>` 扫描全目录。`skill-audit` 主流程的"frontmatter 合规"维度优先跑该脚本做初筛。

**维护约定**：

- 修改 SKILL.md 前，如果要动"reference 已承接"的章节，考虑直接改 reference 并保留正文指针
- 新增 reference → 必须在 SKILL.md 正文显式引用（避免孤儿），见 `skill-audit` 维度 7
- `validate-frontmatter.sh` 属于机械校验工具，不替代 skill-audit 的语义维度

## Plugin: release-creator

`plugins/release-creator/` 是一个**元 skill 派生器插件**。本插件本身**不执行任何 release 动作**，它通过渐进式 AskUserQuestion + 动态模板库，引导用户为当前项目派生一份 `release-<project>` skill（落盘由官方 `skill-creator` 完成）。

### 设计动机

业界主流 release 工具（Changesets / release-please / semantic-release）已经证明「通用发布器 + 零配置」不可兼得。本插件跳出这个悖论：**release-creator 本身通用，派生出的 release skill 特化**。每个项目决定一次、落盘为明确可读的 SKILL.md，后续 release 直接按这份 skill 执行。

### 关键约束

- release-creator 插件本身**不包含任何可执行 release 的 skill**——它只提供 `release-creator-welcome` 派生器
- 派生出的 `release-<project>` skill **不得反向调用 release-creator**——派生完成即独立
- 派生流程从 4 个维度分支（`ecosystem` / `philosophy` / `packaging` / `exhaustive`），每个维度对应一份 flow reference + 主模板 + 若干子模板
- 派生出的 release skill 的 frontmatter `name` / `description` 的 YAML key 保持英文；只有 description 值与正文受用户选择的 `docLanguage` 影响

### welcome skill 流程（12 环节）

`/release-creator-welcome` 命令 → 触发 `release-creator-welcome` skill → 渐进式 AskUserQuestion：

1. 语言（一次 AUQ 同时采集沟通语言 + 骨架正文语言）
2. 价值阐述
3. 意向分流（直接派生 / 暂时跳过 · 2 选项）
4. 检测官方 `skill-creator`
5. **第一道核心 AUQ：选分支维度**（生态 / 哲学 / 打包+tag / 穷举 · 单选 4）
6. 分维度追问（读对应 flow reference，含预扫项目档案）
7. **Bump + Check 子环节**（所有维度共同后置，6 题分 2 轮 + 1 个条件子问：版本号结构 / Bump 触发方式 / Bump 范围 / Check 范围 / Check 时机 / 镜像字段复用 / **Q5 选 hook 时追问 hook 落盘位置** `.git/hooks/` vs `.githooks/` vs `.husky/` ——见 `bump-check-flow.md`）
8. 通用参数（项目代号 / 命名 / 落盘位置 / 脚本落盘目录 / 脚本语言）
9. Override（展示默认骨架 + 各维度替代 + 自定义字段；新增「改 bump 策略」「改 check 范围」）
10. 落盘清单确认 + 委派 `skill-creator`（同时落派生 SKILL.md + 配套脚本/hook/CI）
11. **文档登记子环节**（主动提醒：登记到 CLAUDE.md / AGENTS.md / MEMORY.md，多选；登记条目含实际落盘的附属资产清单；见 `doc-registration-flow.md`）
12. 收尾提示（重启 Claude Code 警告 + docIndexResult 展示 + hook 启用步骤提示）

> 环节 6.5 的 bump/check 决策统一采集，不再分散在生态/哲学/packaging 维度；claude-plugin 多镜像场景默认推荐 `generate-script`（skill-creator 动态组装 bump 脚本本体落盘），其他场景按生态推导。**release-creator 插件本身不预置任何脚本**——所有配套脚本/hook/CI 文件都由 skill-creator 在派生时从 catalog 骨架动态拼装。
>
> 环节 11 文档登记是**主动提醒、不强制**——welcome 自身仅在该环节被允许用 Write（仅限 CLAUDE.md / AGENTS.md 的新建分支），MEMORY.md 永远不自动新建。

### references 拓扑

为避免 SKILL.md 过长，`release-creator-welcome` 把所有可抽离内容移到 `references/` 下（25 份）：

| 类别       | 数量 | 文件                                                                                |
| ---------- | ---- | ----------------------------------------------------------------------------------- |
| 语言       | 1    | `language-options.md`                                                               |
| 维度 flow  | 4    | `dimension-{1-ecosystem,2-philosophy,3-packaging,4-exhaustive}-flow.md`             |
| Bump+Check | 4    | `bump-check-flow.md` / `bump-catalog.md` / `check-catalog.md` / `hook-templates.md` |
| 主模板     | 3    | `template-master-{ecosystem,philosophy,packaging}.md`                               |
| 生态子模板 | 4    | `template-ecosystem-{npm,python,claude-plugin,docs}.md`                             |
| 哲学子模板 | 3    | `template-philosophy-{commit,changeset,manual}.md`                                  |
| tag 子模板 | 3    | `template-tag-{simple,prefixed,scoped}.md`                                          |
| 工具       | 2    | `override-catalog.md` / `skill-creator-prompt-template.md`                          |
| 文档登记   | 1    | `doc-registration-flow.md`                                                          |

Bump+Check 4 份 reference 的职责：

- `bump-check-flow.md` —— 环节 6.5 主 flow（6 题 AUQ 题干 + 去重规则 + 默认值推导）
- `bump-catalog.md` —— Q2 命令片段 + 脚本骨架库（生态 × 触发方式交叉）
- `check-catalog.md` —— Q4 检查项的 bash / hook / CI 三种宿主展开
- `hook-templates.md` —— Q5 pre-push / pre-commit / CI yaml 的宿主骨架

`validate-frontmatter.sh`（来自 `skill-keeper`）同样适用于本插件的 SKILL.md 合规校验。

### 与 skill-keeper 的关系

架构同构、彼此独立。两者都是渐进式派生器 + 委派 `skill-creator` 落盘 + 不自己写 SKILL.md 文件。可以只装其中一个。

## 添加一个新插件

1. 在 `plugins/<name>/` 放插件源码
2. 在其中放一份 `.claude-plugin/plugin.json` 描述 metadata
3. 到仓库根目录的 `.claude-plugin/marketplace.json` 注册

## 版本管理

本仓库的 release 流程由 **`release-market` skill**（`.claude/skills/release-market/`）接管——它是由 `release-creator` 插件派生而来的项目特化 release skill，覆盖 plugins/ 下所有插件的 bump / check / tag / push 全流程。

### 触发 release

直接对 Claude 说「release 一下 `<plugin>`」「发布 `<plugin>` 到 X.Y.Z」「ship `<plugin>`」—— `release-market` skill 会自动触发。

### 脚本入口（由 release-market 调用；也可直接手跑）

`scripts/` 下的两个 Node 脚本是由 skill-creator 按 `release-creator` 的 catalog 骨架动态生成的（非手写），多插件参数化：

- **`scripts/bump-version.cjs <plugin-name> [major|minor|patch|X.Y.Z]`** —— bump 指定插件版本，同步更新 `plugin.json` 和 `marketplace.json` 两个镜像字段
- **`scripts/check-version.cjs <plugin-name>`** —— 校验：镜像一致性 / tag 冲突 / 工作区干净 / 正则合规

脚本本身（以及 `.git/hooks/pre-push`）不应手工编辑——若需要改行为，改 `release-creator` 的 catalog 骨架后重新派生 `release-market` skill。

**派生产物的存放原则**：release-creator / skill-keeper 派生出的 skill（`.claude/skills/release-market/` 等）和脚本（`scripts/bump-version.cjs` / `scripts/check-version.cjs` / `scripts/build-frontend.sh`）作为**项目资产进 git**——协作者 clone 仓库后直接获得完整 release 流程，不需要重跑派生。派生资产不是本地产物。

### 版本号出现位置（所有插件通用）

每个插件的版本号出现在：

- `plugins/<name>/.claude-plugin/plugin.json` > `version` —— 插件 manifest
- `.claude-plugin/marketplace.json` > `plugins[name=<name>].version` —— marketplace 注册表
- Git tag：`<plugin-name>-v<version>`（多插件仓库强制前缀）
- Git commit message（约定：`chore(<plugin-name>): bump version to X.Y.Z`）

### pre-push hook

`.git/hooks/pre-push` 做两件事：

1. **推 branch 时** —— 调 `scripts/build-frontend.sh` 构建 token-reporter frontend（dist/ 有变动时自动追加一次 commit）
2. **推 tag 时** —— 解析 `<plugin>-v<version>` tag，调 `scripts/check-version.cjs <plugin>` 校验

hook 保留在 `.git/hooks/`（而非 `.githooks/`）—— 单人仓库无需 `git config core.hooksPath`；副作用是 hook 不随 clone 传播，新协作者需手动 setup。

### Commit 规范

**commit message 保持简洁。**

- 使用简明扼要的描述性消息，不加 attribution 行
- 不添加 `Co-Authored-By:`、`Signed-off-by:` 等 trailer 行
- 遵循 conventional commit 格式：`type(scope): description`
