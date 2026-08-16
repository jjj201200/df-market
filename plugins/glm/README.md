# glm

GLM Coding Plan 工具箱。插件名 `glm` 是命名空间：后续 GLM 相关功能都以 `/glm:<name>` 挂在本插件下。

## 新电脑快速开始

前置（zclaude 环境，一次性，与 glm 无关）：

```bash
export ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic   # 或 https://api.z.ai/api/anthropic
export ANTHROPIC_AUTH_TOKEN=<你的智谱 API key>
export CLAUDE_CONFIG_DIR=<你的独立配置目录>   # 可选：zclaude 与官方 Claude Code 隔离配置
```

然后两步：

```text
1. Claude Code 里：/plugin marketplace add jjj201200/df-market → /plugin install glm@df-market
2. Claude Code 里：/glm:statusline-on
```

完成。`/glm:usage` 查用量，状态栏显示 5h/7d 限额。全程无需离开对话、无需手工编辑任何文件。

> 斜杠命令以 skill 形态实现（官方推荐）：`${CLAUDE_PLUGIN_ROOT}` 变量替换仅在插件 skill 中生效，command 正文不替换——v0.5.1 起全部命令迁移为 skill。终端 CLI（`glm-usage` / `glm-statusline-*`）同样可用（插件启用时进 Bash PATH）。

## /glm:usage —— 用量查询

调智谱官方 monitor 接口，输出官方 `/usage` 风格的中文限额面板（5 小时窗口 + 7 天用量）：

```
GLM Coding Plan 用量 · Pro 档

5 小时窗口用量
  ███████████████████████░░░░░░░   76%
  已用  9,153 / 12,000
  重置  29 分后 · 8月16日 14:31

7 天用量
  █████░░░░░░░░░░░░░░░░░░░░░░░░░   15%
  已用  9,153 / 60,000
  重置  5 天 5 小时后 · 8月21日 19:29

管理套餐: https://open.bigmodel.cn/coding-plan
```

> 样式学官方 `/usage`：无框线、无 emoji——空行分区块 + 中文标签等宽键值列；█░ 进度条整行同种字符、不参与跨字宽对齐，跨终端字体渲染稳定。重置行同时给出倒计时与具体日期时间（跨年自动带年份）。

## key 安全

- token 仅在脚本内从 `process.env` 读取：不进 argv、不打印、不写日志、不落盘
- 脚本无任何携带 token 的命令行参数
- 所有错误输出只含变量名与指引，永不含值

## StatusBar 用量显示（glm-statusline-*）

官方 statusline 看不到 GLM 的 5 小时窗口 / 7 天限额（智谱后端不提供官方 `rate_limits` 字段）。本插件用包装脚本接管 statusline。对话内斜杠命令与终端 CLI 等价（一一对应）：

```text
/glm:statusline-on      备份原 statusLine 配置并接管（幂等）    ≙ glm-statusline-on
/glm:statusline-status  查看接管状态                            ≙ glm-statusline-status
/glm:statusline-off     还原原 statusline 配置                  ≙ glm-statusline-off
```

**只改当前场景的配置**：所有操作的目标是 `CLAUDE_CONFIG_DIR` 下的 `settings.json`（zclaude 的独立配置目录；未设置该变量时为 `~/.claude`）。zclaude 场景接管不影响官方 Claude Code 的配置，反之亦然。插件数据（备份 / 缓存 / stub）也集中存放在同一目录的 `glm/` 子目录下，便于清理与迁移。

接管后的行为（每次状态栏刷新动态判定）：

- **智谱后端**（`ANTHROPIC_BASE_URL` 指向 `bigmodel.cn` / `z.ai`）：

  ```
  5h 76% (29m) | 7d 15% | ctx 11% | glm-5.3[1m] | ~/df-market
  ```

  百分比按档位着色（<60% 绿、60-79% 黄、≥80% 红）；数据缓存 5 分钟，刷新不打接口；拉新失败沿用旧值并加 `?` 标记。
- **非智谱后端**：透传执行你原来的 statusline 命令（stdin/stdout 原样转发）——切回官方 API 时体验零变化。无原配置时输出模型名 + 目录的基础行，状态栏永不空白。

实现细节：接管写入的是 `<配置目录>/glm/statusline.mjs`（stub），stub 每次刷新时在 `CLAUDE_CONFIG_DIR` 与 `~/.claude` 两处插件缓存中动态发现最新版入口——插件升级换版本目录后**无需重新接管**。多套 `CLAUDE_CONFIG_DIR` 配置各自独立，每套跑一次 `glm-statusline-on` 即可。

### 数据刷新机制（本地渲染 + 活跃时校准）

- **渲染路径零网络**：statusline 每次刷新纯读本地缓存（`<配置目录>/glm/cache.json`），瞬时渲染、永不卡顿
- **PostToolUse hook 校准**：活跃会话中每次工具调用后检查缓存，距上次拉取超过 60s 才调一次 monitor 接口（纯查询，**零 token / 零积分消耗**）；闲时零请求
- 数值始终来自服务端真值（无本地估算误差），新鲜度最多滞后 1 分钟；缓存首次建立前 statusline 会同步拉一次引导
- 背景：智谱兼容端点的响应头/响应体均无配额字段（实测确认），官方 statusline 的 `rate_limits` 机制在智谱后端下拿不到数据，monitor 接口是目前唯一配额来源

## 数据来源

`{ANTHROPIC_BASE_URL origin}/api/monitor/usage/quota/limit`（国内端点；`api.z.ai` 国际端点为 `/api/monitor/usage/quota`，脚本自动回退）。该接口为智谱**非正式公开接口**（Web 控制台同源），结构变化时脚本降级展示原始响应，不会崩溃。

## 开发

```bash
cd plugins/glm
node test/test-core.js        # Node 内置 assert，零依赖
node test/test-statusline.js
```
