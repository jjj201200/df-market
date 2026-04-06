---
name: token-reporter:stop
description: Stop the token-reporter server
---

停止 token-reporter 服务器并清理 PID/lock 文件。

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/session-end.js" && echo "Token Reporter stopped."
```
