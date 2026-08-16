---
description: 还原状态栏：撤销 glm 接管，恢复原 statusLine 配置
allowed-tools: Bash(node:*)
---

# 还原 StatusBar

执行以下命令（恰好一次）：

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/glm-statusline-off"
```

## 输出要求（严格遵守）

- 将 stdout **逐字原样**呈现给用户，不要总结或改写
- 退出码非 0 时原样展示 stderr 并停止，不要猜测原因
