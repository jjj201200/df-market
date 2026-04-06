---
name: token-reporter:start
description: Start the token-reporter server
---

启动 token-reporter 服务器（如已运行则跳过），并输出访问地址。

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js" && \
  node -e "
    const fs = require('fs'), os = require('os'), path = require('path');
    const d = process.env.TOKEN_REPORTER_DATA_DIR || path.join(os.homedir(), '.claude', 'token-reporter');
    try {
      const c = JSON.parse(fs.readFileSync(path.join(d, 'config.json'), 'utf8'));
      console.log('Token Reporter running at http://localhost:' + c.port);
    } catch { console.log('Token Reporter started.'); }
  "
```
