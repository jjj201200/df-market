---
name: statusline-on
description: 接管状态栏：备份原 statusLine 配置，智谱后端显示 5h/7d 用量（幂等，可重复执行）
allowed-tools: Bash(node:*)
disable-model-invocation: true
---

# 接管 StatusBar

执行以下命令（恰好一次）：

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/glm-statusline-on"
```

## 输出要求（严格遵守）

- 将 stdout **逐字原样**呈现给用户，不要总结或改写
- 退出码非 0 时原样展示 stderr 并停止，不要猜测原因
- 提示用户：如需还原可执行 /glm:statusline-off
