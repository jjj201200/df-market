import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import { parseCaptures } from '../backend/dist/captures-parser.js';

const FIX = path.join(import.meta.dirname, 'fixtures', 'captures');

test('simple fixture: 3 points under sess-simple, no tool/thinking/tool_result', async () => {
  const groups = await parseCaptures(path.join(FIX, 'simple'));
  assert.ok(groups['sess-simple'], `sess-simple missing; got keys: ${Object.keys(groups).join(',')}`);
  assert.equal(groups['sess-simple'].length, 3);
  for (const p of groups['sess-simple']) {
    assert.equal(p.sources.messages_tool_use, 0);
    assert.equal(p.sources.messages_tool_result, 0);
    assert.equal(p.sources.messages_thinking, 0);
    assert.ok(p.sources.system_prompt > 0);
  }
  // turnId should be 1, 2, 3 in chronological order
  assert.deepEqual(groups['sess-simple'].map((p) => p.turnId), [1, 2, 3]);
});

test('with-tool fixture: non-zero tools_schema, tool_use, tool_result', async () => {
  const groups = await parseCaptures(path.join(FIX, 'with-tool'));
  const sess = groups['sess-with-tool'];
  assert.ok(sess && sess.length === 1);
  const p = sess[0];
  assert.ok(p.sources.tools_schema > 0, 'tools_schema > 0');
  assert.ok(p.sources.messages_tool_use > 0, 'messages_tool_use > 0');
  assert.ok(p.sources.messages_tool_result > 0, 'messages_tool_result > 0');
});

test('with-thinking fixture: non-zero messages_thinking', async () => {
  const groups = await parseCaptures(path.join(FIX, 'with-thinking'));
  const sess = groups['sess-with-thinking'];
  assert.ok(sess && sess.length === 1);
  assert.ok(sess[0].sources.messages_thinking > 0);
});

test('total equals sum of 7 sources within rounding', async () => {
  const groups = await parseCaptures(path.join(FIX, 'with-tool'));
  const sess = groups['sess-with-tool'];
  for (const p of sess) {
    const sum = Object.values(p.sources).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(p.total - sum) <= 1, `total ${p.total} != sum ${sum}`);
  }
});

test('missing dir returns {}', async () => {
  const groups = await parseCaptures('/nonexistent-path-xyz');
  assert.deepEqual(groups, {});
});

test('ignores files without session header', async () => {
  // _gen.cjs is under the captures root — it has no session header, and isn't .req.json
  // so the parser must not crash on it
  const groups = await parseCaptures(path.join(FIX, 'simple'));
  // only our 3 .req.json files should contribute to sess-simple
  assert.equal(groups['sess-simple'].length, 3);
});
