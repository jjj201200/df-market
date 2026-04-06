---
name: auto-launch-on
description: Enable auto-launch of token-reporter on session start
---

Set `autoStart` to `true` so token-reporter starts automatically the next time Claude Code launches.

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
