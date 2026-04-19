// Fixture generator for test/fixtures/captures/.
// Run: node test/fixtures/captures/_gen.cjs
// Writes 3 req.json files per session into simple/, with-tool/, with-thinking/.

const fs = require('fs');
const path = require('path');

function writeCapture(dir, filename, sessionId, body, tsOffsetMs = 0) {
  const capturedAt = new Date(1780000000000 + tsOffsetMs).toISOString();
  const bodyStr = JSON.stringify(body);
  const cap = {
    id: filename.replace('.req.json', ''),
    capturedAt,
    url: 'https://api.anthropic.com/v1/messages?beta=true',
    method: 'POST',
    headers: {
      'x-claude-code-session-id': sessionId,
      'content-type': 'application/json',
    },
    bodyBytes: Buffer.byteLength(bodyStr, 'utf8'),
    bodyNote: null,
    body: bodyStr,
  };
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(cap, null, 2));
}

// ────────────────────────────────────────────────────────────
// SIMPLE — 3 turns, text only
const SIMPLE_DIR = path.join(__dirname, 'simple');
const SIMPLE_SYSTEM = 'You are helpful.'.repeat(20);
for (let i = 0; i < 3; i++) {
  const messages = [];
  for (let j = 0; j <= i; j++) {
    messages.push({ role: 'user', content: [{ type: 'text', text: 'hello '.repeat(10 + j * 5) }] });
    if (j < i) messages.push({ role: 'assistant', content: [{ type: 'text', text: 'hi '.repeat(5 + j * 3) }] });
  }
  writeCapture(SIMPLE_DIR, `111-${1700000000000 + i}-${i + 1}.req.json`, 'sess-simple', {
    model: 'claude-haiku-4-5',
    system: SIMPLE_SYSTEM,
    tools: [],
    messages,
  }, i * 1000);
}

// ────────────────────────────────────────────────────────────
// WITH-TOOL — 1 turn with tools schema + tool_use + tool_result
const TOOL_DIR = path.join(__dirname, 'with-tool');
writeCapture(TOOL_DIR, '222-1700000010000-1.req.json', 'sess-with-tool', {
  model: 'claude-haiku-4-5',
  system: 'You are a coding assistant.'.repeat(10),
  tools: [
    {
      name: 'Bash',
      description: 'Run a shell command in the current working directory.',
      input_schema: {
        type: 'object',
        properties: { command: { type: 'string' }, cwd: { type: 'string' } },
        required: ['command'],
      },
    },
    {
      name: 'Read',
      description: 'Read a file from disk.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' }, lines: { type: 'number' } },
        required: ['path'],
      },
    },
  ],
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'List files in cwd' }] },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Running ls.' },
        { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls -la' } },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: 'total 64\ndrwxr-xr-x  12 user  staff  384 Apr 19 10:00 .\ndrwxr-xr-x   8 user  staff  256 Apr 19 10:00 ..\n-rw-r--r--   1 user  staff  123 Apr 19 10:00 file.txt\n',
        },
      ],
    },
  ],
});

// ────────────────────────────────────────────────────────────
// WITH-THINKING — 1 turn containing an assistant thinking block
const THINK_DIR = path.join(__dirname, 'with-thinking');
writeCapture(THINK_DIR, '333-1700000020000-1.req.json', 'sess-with-thinking', {
  model: 'claude-haiku-4-5',
  system: 'Reason step by step.',
  tools: [],
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'What is 17 * 23?' }] },
    {
      role: 'assistant',
      content: [
        {
          type: 'thinking',
          thinking: 'Let me break this down: 17 * 23 = 17*20 + 17*3 = 340 + 51 = 391.'.repeat(5),
        },
        { type: 'text', text: '391' },
      ],
    },
  ],
});

console.log('fixtures written');
