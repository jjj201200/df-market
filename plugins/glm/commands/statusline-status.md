---
description: 查看状态栏接管状态：是否已接管、当前命令、备份内容
allowed-tools: Bash(node:*)
---

# 查看 StatusBar 接管状态

执行以下命令（恰好一次）：

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/glm-statusline-status"
```

## 输出要求（严格遵守）

- 将 stdout **逐字原样**呈现给用户，不要总结或改写
- 退出码非 0 时原样展示 stderr 并停止，不要猜测原因
