# glm 插件设计：/glm:usage 用量查询 + StatusBar 用量显示

- 日期：2026-08-16
- 状态：待审阅
- 里程碑：M1 `/glm:usage` 命令（先行）→ M2 StatusBar 包装脚本

## 背景与目标

用户通过 `ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic` + `ANTHROPIC_AUTH_TOKEN` 让 Claude Code 跑在智谱 GLM Coding Plan 上。两个痛点：

1. 现有 `zai-coding-plugins` 市场的 `glm-plan-usage` 插件链路冗长（command → agent → skill → 裸 Node 脚本输出**原始 JSON**），输出无格式化、模型转述环节多、体验差。
2. GLM 的 5 小时窗口 / 7 天限额无法出现在 Claude Code 官方 `/usage` 与 StatusBar 中（官方 statusline 只认 Anthropic 账户数据）。

目标：新建插件 `glm`（入驻 df-market），提供：

- **M1**：斜杠命令 `/glm:usage` —— 调智谱官方 monitor 接口，输出官方 `/usage` 风格的中文限额面板（5 小时窗口 + 7 天用量）。
- **M2**：statusline 包装脚本 —— 智谱后端时在 StatusBar 显示 5h / 7d 用量；非智谱后端时透传用户原有 statusline hook，不破坏原体验。

插件名 `glm` 为命名空间预留：后续 GLM 相关功能都以 `/glm:<name>` 命令挂在本插件下。

## 逆向工程结论：智谱 monitor API（非正式公开接口）

社区（cc-switch #1588、zai-usage-tracker 等）与实测（2026-08-16，国内端点）确认：

- 端点（origin 取自 `ANTHROPIC_BASE_URL` 的协议+域名）：
  - `GET {origin}/api/monitor/usage/quota/limit` —— 国内 `open.bigmodel.cn` / `dev.bigmodel.cn` 实测 200
  - `GET {origin}/api/monitor/usage/quota` —— 国际 `api.z.ai` 路径（国内 404），作 fallback
  - 另有 `model-usage` / `tool-usage`（带 `startTime`/`endTime` 查询参数），M1 核心面板不用，M2 不用
- 认证：请求头 `Authorization: <ANTHROPIC_AUTH_TOKEN>`（裸 token，无 `Bearer` 前缀，与 anthropic 兼容端点同款）
- `quota/limit` 响应结构（实测样例，数值真实）：

```json
{
  "code": 200,
  "data": {
    "limits": [
      {
        "type": "CREDIT_LIMIT",
        "unit": 3, "number": 5,
        "usage": 12000, "currentValue": 6866, "remaining": 5133,
        "percentage": 57, "nextResetTime": 1786858288851
      },
      {
        "type": "CREDIT_LIMIT",
        "unit": 6, "number": 1,
        "usage": 60000, "currentValue": 6866, "remaining": 53133,
        "percentage": 11, "nextResetTime": 1787308186998
      }
    ],
    "level": "pro"
  },
  "success": true
}
```

- `unit` 语义（逆向结论，**无官方文档**）：`unit=3` → 小时（`number=5` 即 5 小时窗口）；`unit=6` → 周（`number=1` 即 7 天窗口；依据 z.ai FAQ「5-hour + weekly」+ 实测第二个窗口重置点在 ~5.4 天后）。
- `level`：套餐档位（`lite` / `pro` / `max`）。
- 风险：非正式公开接口，结构可能变化。解析层对未知 `type` / `unit` 做兜底（见错误处理），不崩、不误标。

## M1：`/glm:usage` 命令

### 目录结构

```
plugins/glm/
  .claude-plugin/plugin.json     # name: glm, version: 0.1.0
  README.md                      # 安装、env 配置说明
  commands/usage.md              # /glm:usage 入口
  scripts/usage.mjs              # CLI 入口：读 env + fetch + 组装输出（~60 行）
  scripts/lib/core.mjs           # 纯逻辑：解析 / 渲染 / 格式化（无副作用，可测）
  test/test-core.js              # Node 内置 assert（仓库惯例，零框架）
```

### 数据流

`/glm:usage` → command 展开 → Bash 执行 `node "$CLAUDE_PLUGIN_ROOT/scripts/usage.mjs"`（`$CLAUDE_PLUGIN_ROOT` 为 Claude Code 插件 command 官方变量）→ 脚本：

1. 从 `process.env` 读 `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL`（与 Claude Code 共用同一份配置，零额外配置）
2. `GET {origin}/api/monitor/usage/quota/limit`（10s 超时）；404 时 fallback `GET {origin}/api/monitor/usage/quota`
3. 解析 `limits[]` → 窗口模型：`unit=3,number=5` → 「5 小时窗口用量」；`unit=6,number=1` → 「7 天用量」；未知 unit → `unit=N 窗口（×M）` 兜底标签
4. 渲染中文面板到 stdout
5. 模型按 command 约束**逐字转述**，不总结、不改写

### 输出面板（基于实测数据的高保真预览）

```
GLM Coding Plan 用量 · Pro 档

┌────────────────────────────────────────────┐
│ 5 小时窗口用量                              │
│ ────────────────────────────────────────── │
│ ████████████████░░░░░░░░░░░░  57%          │
│ 已用 6,866 / 12,000 · 3 小时 24 分后重置    │
│                                            │
│ 7 天用量                                   │
│ ────────────────────────────────────────── │
│ █████░░░░░░░░░░░░░░░░░░░░░░░  11%          │
│ 已用 6,866 / 60,000 · 5 天 4 小时后重置     │
└────────────────────────────────────────────┘
管理套餐: https://open.bigmodel.cn/usercenter/proj-mgmt
```

- 进度条 30 格（`█` 填充 + `░` 空位），百分比右对齐
- 中文按 East Asian Width 计 2 列做框内对齐（渲染核心测试点）
- 倒计时分档：`<1h` → `X 分`；`<1d` → `X 小时 Y 分`；`≥1d` → `X 天 Y 小时`
- 数字千分位；`level` 缺失时省略档位后缀
- 底部「管理套餐」链接按 BASE_URL 域名切换：`bigmodel.cn` → `https://open.bigmodel.cn/usercenter/proj-mgmt`；`z.ai` → `https://z.ai/subscribe`

### key 安全（不明文传递）

- token 仅在脚本内 `process.env` 读取：不进 argv（无任何携带值的参数）、不打印、不写日志、不落盘
- `commands/usage.md` 明文约束：「不要读取、打印或传递 ANTHROPIC_AUTH_TOKEN 的值——脚本自行从环境变量读取」
- frontmatter `allowed-tools: Bash(node:*)` 收窄权限面
- 所有错误输出只含变量名与指引，永不含值

### 错误处理（均 exit 1 + 中文提示）

| 场景 | 行为 |
|---|---|
| `ANTHROPIC_AUTH_TOKEN` 未设置 | 提示「设置与 Claude Code 相同的环境变量后重试」 |
| `ANTHROPIC_BASE_URL` 未设置或域名非智谱 | 提示支持的两个官方端点及设置方法 |
| 401 / 403 | 「API key 无效或无权限」 |
| 两端点均 404 | 「当前端点不提供用量接口（可能为中转站）」 |
| 网络错误 / 5xx / 超时 10s | 「接口暂时不可用，请稍后重试」 |
| 响应结构无法解析 | 降级展示原始 JSON 前 2000 字符，提示到仓库提 issue |

### 测试

`core.mjs` 全部纯函数；`fetchQuota(fetchImpl, url, token)` 参数化注入 fake fetch，测试不发真实请求：

- `formatDuration(ms)` 各档位、千分位、窗口标签映射（含未知 unit 兜底）
- `parseQuotaResponse(json)`：fixture → 窗口数组 + level；异常结构 → 抛结构错误
- `renderPanel(parsed)` 对 fixture 做精确字符串快照比对（对齐回归）
- fake fetch 覆盖：正常 / 401 / 404→fallback / 超时
- CLI 层：`env -u ANTHROPIC_AUTH_TOKEN node scripts/usage.mjs` → exit 1（spawn 子进程断言）

## M2：StatusBar 包装脚本

### 机制

Claude Code 的 statusline 由 `settings.json` 的 `statusLine: {type: "command", command: …}` 配置：Claude Code 把 session 上下文 JSON 写入脚本 stdin（字段含 `model.display_name`、`workspace.current_dir`、`cost` 等），脚本 stdout 的第一行即 StatusBar 内容。GLM 后端时官方数据（5h block / week）不存在，故由本插件接管。

### 双模式行为（核心需求：不破坏非智谱场景）

M2 复用 M1 的 `scripts/lib/core.mjs`（`fetchQuota` / `parseQuotaResponse` / 格式化函数），仅新增单行渲染与缓存逻辑。数据目录 `~/.claude/glm/`（备份 + 缓存）由 `glm-statusline-on` 首次执行时创建。

`scripts/statusline.mjs` 运行时按 **进程环境**（statusline 由 Claude Code spawn，继承其 env，含 `ANTHROPIC_BASE_URL`）分流：

- **智谱后端**（`ANTHROPIC_BASE_URL` 域名含 `bigmodel.cn` / `z.ai`）→ 查用量（带缓存）输出 GLM StatusBar 行
- **非智谱后端或未设置** → 读取备份的原 `statusLine` 配置，spawn 原命令并透传 stdin，原样回传 stdout；**无备份时**输出基础行（模型名 + 当前目录），保证 StatusBar 永不空白

安装/卸载通过 CLI（挂 `bin/`，启用插件后进 PATH，模式对齐 token-reporter 的 statusline 系列）：

- `glm-statusline-on`：读 `~/.claude/settings.json`，把现有 `statusLine` 配置备份到 `~/.claude/glm/statusline-backup.json`（无原配置则记 `null`），再写入 `statusLine.command = node "<插件绝对路径>/scripts/statusline.mjs"`
- `glm-statusline-off`：从备份还原原配置；备份为 `null` 时直接删除 `statusLine` 键
- `glm-statusline-status`：显示当前接管状态 + 备份指向

重复执行 `on` 幂等：检测 command 已指向本插件脚本则不重复备份/覆盖（防止把自己的 wrapper 备份进去）。

### StatusBar 输出（智谱模式）

```
⏱ 5h 57% (3h24m) │ 7d 11% │ GLM-5.3 │ ~/df-market
```

- `5h` / `7d` 两窗口百分比 + 5h 剩余时间；后接 `model.display_name` 与 `workspace.current_dir`（均取自 stdin JSON，目录缩写为 `~` 相对形式）
- 百分比 ≥80% 加 ANSI 红色，≥60% 黄色，其余绿色
- 单行、无框线（statusline 是常驻 UI，紧凑优先）

### 缓存与性能

- statusline 高频刷新，直接打接口会限流：结果缓存 `~/.claude/glm/cache.json`，TTL 300s；过期后下次刷新才拉新（拉新失败沿用旧值并标记 `?`）
- StatusBar 渲染同步阻塞，脚本整体预算 <3s：接口请求超时 2.5s，超时/失败立即回落缓存或兜底文案 `⏱ 5h ?% │ 7d ?% │ …`，绝不空行
- 缓存文件带进程锁不必要（单行写、原子 rename 写入即可）

### key 安全

与 M1 相同：token 仅 `process.env` 内存读取，不落盘（缓存文件只存解析后的窗口数据，不含 token）、不打印、不进 argv。

### 测试

- 解析 stdin JSON、双模式分流逻辑（fake env + fake fetch + fake 备份文件）
- 缓存 TTL 读写、过期重拉、失败沿用旧值
- 透传模式：fake 原 command（`cat` / `echo`）验证 stdin/stdout 透传完整
- `on/off` 对临时 `settings.json` 的备份 / 还原 / 幂等 / `null` 备份删除键
- 渲染：百分比着色档位、目录 `~` 缩写、字段缺失时的降级行

## 市场接入与发版

- `.claude-plugin/marketplace.json` 注册 `glm` 0.1.0（name / source / description / keywords）
- `CLAUDE.md` 增「Plugin: glm」章节（命令、env 前置、statusline CLI、维护约定）
- 发版走 `release-market` skill：`scripts/bump-version.cjs glm <bump>` 多插件参数化，无需改脚本；首个版本随 M1 + M2 一起发 0.1.0，或 M1 先行发 0.1.0、M2 发 0.2.0（实现时按实际节奏定）

## 风险与开放问题

- monitor API 为**非正式公开接口**：结构变更时 M1 降级展示原始 JSON、M2 显示 `?%` 兜底，两者都不崩；解析层集中一个模块，便于跟进修补
- `unit` 语义为逆向结论：渲染标签由 `unit/number` 映射表生成，未知值兜底显示原始数值，不误标
- statusline 的 stdin JSON 字段随 Claude Code 版本演进：wrapper 只依赖 `model.display_name` 与 `workspace.current_dir` 两个稳定字段，均缺失时退化为纯用量行
- `api.z.ai` 国际端点的 quota 端点路径差异已通过 404-fallback 覆盖；若其响应结构亦不同，按「结构无法解析」路径降级
