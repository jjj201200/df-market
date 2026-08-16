# glm

GLM Coding Plan 工具箱。插件名 `glm` 是命名空间：后续 GLM 相关功能都以 `/glm:<name>` 挂在本插件下。

## /glm:usage —— 用量查询

调智谱官方 monitor 接口，输出官方 `/usage` 风格的中文限额面板（5 小时窗口 + 7 天用量）：

```
GLM Coding Plan 用量 · Pro 档

┌──────────────────────────────────────────┐
│ 5 小时窗口用量                           │
│ ──────────────────────────────────────── │
│ ██████████████████░░░░░░░░░░░░   61%     │
│ 已用 7,347 / 12,000 · 1 小时 54 分后重置 │
│                                          │
│ 7 天用量                                 │
│ ──────────────────────────────────────── │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░   12%     │
│ 已用 7,347 / 60,000 · 5 天 6 小时后重置  │
└──────────────────────────────────────────┘
管理套餐: https://open.bigmodel.cn/usercenter/proj-mgmt
```

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

## 数据来源

`{ANTHROPIC_BASE_URL origin}/api/monitor/usage/quota/limit`（国内端点；`api.z.ai` 国际端点为 `/api/monitor/usage/quota`，脚本自动回退）。该接口为智谱**非正式公开接口**（Web 控制台同源），结构变化时脚本降级展示原始响应，不会崩溃。

## 开发

```bash
cd plugins/glm
node test/test-core.js    # Node 内置 assert，零依赖
```
