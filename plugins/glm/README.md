# glm

GLM Coding Plan 工具箱。插件名 `glm` 是命名空间：后续 GLM 相关功能都以 `/glm:<name>` 挂在本插件下。

## /glm:usage —— 用量查询

调智谱官方 monitor 接口，输出官方 `/usage` 风格的中文限额面板（5 小时窗口 + 7 天用量）：

```
GLM Coding Plan 用量 · Pro 档

5 小时窗口用量
  ████████████████████░░░░░░░░░░   68%
  已用  8,270 / 12,000
  重置  1 小时 25 分后重置

7 天用量
  ████░░░░░░░░░░░░░░░░░░░░░░░░░░   13%
  已用  8,270 / 60,000
  重置  5 天 6 小时后重置

管理套餐: https://open.bigmodel.cn/coding-plan
```

> 样式学官方 `/usage`：无框线、无 emoji——空行分区块 + 中文标签等宽键值列；█░ 进度条整行同种字符、不参与跨字宽对齐，跨终端字体渲染稳定。

## 前置条件

Claude Code 需通过智谱端点运行（与 GLM Coding Plan 相同的配置）：

```bash
export ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic   # 或 https://api.z.ai/api/anthropic
export ANTHROPIC_AUTH_TOKEN=<你的智谱 API key>
```

## key 安全

- token 仅在脚本内从 `process.env` 读取：不进 argv、不打印、不写日志、不落盘
- 脚本无任何携带 token 的命令行参数
- 所有错误输出只含变量名与指引，永不含值

## StatusBar 用量显示（glm-statusline-*）

官方 statusline 看不到 GLM 的 5 小时窗口 / 7 天限额（智谱后端不提供官方 `rate_limits` 字段）。本插件用包装脚本接管 statusline：

```bash
glm-statusline-on       # 备份原 statusLine 配置并接管（幂等）
glm-statusline-status   # 查看接管状态
glm-statusline-off      # 还原原 statusline 配置
```

接管后的行为（每次状态栏刷新动态判定）：

- **智谱后端**（`ANTHROPIC_BASE_URL` 指向 `bigmodel.cn` / `z.ai`）：

  ```
  ⏱ 5h 64% (1h46m) │ 7d 12% │ ctx 11% │ glm-5.3[1m] │ ~/df-market
  ```

  百分比按档位着色（<60% 绿、60-79% 黄、≥80% 红）；数据缓存 5 分钟，刷新不打接口；拉新失败沿用旧值并加 `?` 标记。
- **非智谱后端**：透传执行你原来的 statusline 命令（stdin/stdout 原样转发）——切回官方 API 时体验零变化。无原配置时输出模型名 + 目录的基础行，状态栏永不空白。

实现细节：`~/.claude/glm/statusline.mjs`（stub）在每次刷新时动态发现最新版插件缓存中的入口——插件升级换版本目录后**无需重新接管**。

## 数据来源

`{ANTHROPIC_BASE_URL origin}/api/monitor/usage/quota/limit`（国内端点；`api.z.ai` 国际端点为 `/api/monitor/usage/quota`，脚本自动回退）。该接口为智谱**非正式公开接口**（Web 控制台同源），结构变化时脚本降级展示原始响应，不会崩溃。

## 开发

```bash
cd plugins/glm
node test/test-core.js    # Node 内置 assert，零依赖
```
