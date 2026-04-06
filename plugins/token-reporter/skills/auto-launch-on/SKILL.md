---
name: auto-launch-on
description: Enable auto-launch of token-reporter on session start
---

将 `autoStart` 设为 `true`，下次 Claude Code 启动时自动运行 token-reporter。

```bash
node -e "
  const fs = require('fs'), os = require('os'), path = require('path');
  const d = process.env.TOKEN_REPORTER_DATA_DIR || path.join(os.homedir(), '.claude', 'token-reporter');
  const p = path.join(d, 'config.json');
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  c.autoStart = true;
  fs.writeFileSync(p, JSON.stringify(c, null, 2));
  console.log('Auto-launch enabled. Token Reporter will start automatically on next session.');
"
```
