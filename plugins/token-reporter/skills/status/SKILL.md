---
name: status
description: Show the current status of the token-reporter server
---

Show current status of the token-reporter server.

```bash
node -e "
  const fs = require('fs'), os = require('os'), path = require('path');

  const R = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const CYAN = '\x1b[36m';
  const DIM = '\x1b[2m';

  const d = process.env.TOKEN_REPORTER_DATA_DIR || path.join(os.homedir(), '.claude', 'token-reporter');
  const pidPath = path.join(d, 'server.pid');
  const configPath = path.join(d, 'config.json');

  let config = { port: 3737, autoStart: true };
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}

  let running = false;
  let pid = null;
  try {
    pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim());
    process.kill(pid, 0);
    running = true;
  } catch {}

  let sessions = 0;
  try {
    sessions = fs.readdirSync(path.join(d, 'sessions')).filter(f => f.endsWith('.jsonl')).length;
  } catch {}

  const statusText = running
    ? GREEN + BOLD + '● running' + R
    : RED + '○ stopped' + R;
  const autoStartText = config.autoStart !== false
    ? GREEN + 'enabled' + R
    : YELLOW + 'disabled' + R;

  console.log('');
  console.log(BOLD + CYAN + '  Token Reporter' + R);
  console.log(DIM + '  ───────────────────────────────' + R);
  console.log('  Status     ' + statusText);
  if (running) console.log('  URL        ' + CYAN + 'http://localhost:' + config.port + R);
  if (running && pid) console.log('  PID        ' + DIM + pid + R);
  console.log('  Port       ' + config.port);
  console.log('  Auto-start ' + autoStartText);
  console.log('  Sessions   ' + sessions);
  console.log('  Data dir   ' + DIM + d + R);
  console.log(DIM + '  ───────────────────────────────' + R);
  console.log('  ' + BOLD + 'Commands' + R);
  console.log(DIM + '  ───────────────────────────────' + R);
  console.log('  ' + CYAN + '/token-reporter:start' + R + '           Start server');
  console.log('  ' + CYAN + '/token-reporter:stop' + R + '            Stop server');
  console.log('  ' + CYAN + '/token-reporter:status' + R + '          Show status');
  console.log('  ' + CYAN + '/token-reporter:auto-launch-on' + R + '  Enable auto-launch');
  console.log('  ' + CYAN + '/token-reporter:auto-launch-off' + R + ' Disable auto-launch');
  console.log('');
"
```
