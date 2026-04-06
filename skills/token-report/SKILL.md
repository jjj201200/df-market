---
name: token-report
description: Start token-reporter server and show the access URL
argument-hint: [start|stop|status]
---

检查 token-reporter 服务器状态，如未运行则启动，并输出访问地址。

运行以下命令：

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js" && \
  node -e "
    const fs = require('fs'), os = require('os'), path = require('path');
    const d = path.join(os.homedir(), '.claude', 'token-reporter');
    const c = JSON.parse(fs.readFileSync(path.join(d, 'config.json'), 'utf8'));
    console.log('Token Reporter: http://localhost:' + c.port);
  "
```
