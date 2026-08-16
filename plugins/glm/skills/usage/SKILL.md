---
name: usage
description: 查询 GLM Coding Plan 用量（5 小时窗口 + 7 天限额面板）
allowed-tools: Bash(node:*)
disable-model-invocation: true
---

# GLM 用量查询

执行以下命令（恰好一次，无论成败）：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/usage.mjs"
```

## 输出要求（严格遵守）

- 脚本 stdout 已是格式化完成的最终面板：将其**逐字原样**呈现给用户
- 不要总结、翻译、改写、省略或重新排版任何一行；不要把面板转成表格或列表
- 退出码非 0 时，原样展示 stderr 的错误信息并停止，不要猜测原因
- **不要读取、打印或传递 ANTHROPIC_AUTH_TOKEN 的值**——脚本自行从环境变量读取
