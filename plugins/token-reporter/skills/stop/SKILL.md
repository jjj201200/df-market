---
name: stop
description: Stop the token-reporter server
---

Stop the token-reporter server and clean up PID/lock files.

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/session-end.js" && echo "Token Reporter stopped."
```
