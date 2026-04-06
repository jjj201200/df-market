---
name: auto-launch-off
description: Disable auto-launch of token-reporter on session start
---

Set `autoStart` to `false` to prevent token-reporter from starting automatically when Claude Code launches.

```bash
node -e "
  const fs = require('fs'), os = require('os'), path = require('path');
  const d = process.env.TOKEN_REPORTER_DATA_DIR || path.join(os.homedir(), '.claude', 'token-reporter');
  const p = path.join(d, 'config.json');
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  c.autoStart = false;
  fs.writeFileSync(p, JSON.stringify(c, null, 2));
  console.log('Auto-launch disabled. Token Reporter will not start automatically.');
"
```
