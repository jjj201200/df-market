import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getComposition } from '../backend/dist/composition-service.js';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'comp-')); }

test('audit enabled + captures match session → live', async () => {
  const dir = tmp();
  const out = path.join(dir, 'captures');
  fs.mkdirSync(out);
  const src = path.join(import.meta.dirname, 'fixtures', 'captures', 'with-tool');
  const f = fs.readdirSync(src)[0];
  fs.copyFileSync(path.join(src, f), path.join(out, f));
  fs.writeFileSync(path.join(out, '.heartbeat'), JSON.stringify({ pid: 1, at: new Date().toISOString() }));
  const r = await getComposition('sess-with-tool', {
    outDir: out,
    auditEnabled: true,
    turnsFallback: async () => [],
  });
  assert.equal(r.source, 'live');
  assert.ok(r.points.length > 0);
  assert.equal(r.hookStale, undefined);
});

test('audit enabled + heartbeat stale → estimated + hookStale', async () => {
  const dir = tmp();
  const out = path.join(dir, 'captures');
  fs.mkdirSync(out);
  const hbPath = path.join(out, '.heartbeat');
  fs.writeFileSync(hbPath, JSON.stringify({ pid: 1, at: '2020-01-01T00:00:00.000Z' }));
  // Force ancient mtime (isHookStale uses mtime, not body timestamp)
  const old = new Date('2020-01-01T00:00:00.000Z');
  fs.utimesSync(hbPath, old, old);
  const r = await getComposition('any', {
    outDir: out,
    auditEnabled: true,
    turnsFallback: async () => [
      { turnId: 1, userText: 'hi', assistantText: 'hi', toolUseJson: '', toolResultText: '', thinkingText: '' },
    ],
  });
  assert.equal(r.source, 'estimated');
  assert.equal(r.hookStale, true);
});

test('audit disabled → estimated + unknownSources', async () => {
  const r = await getComposition('x', {
    outDir: '/nonexistent',
    auditEnabled: false,
    turnsFallback: async () => [
      { turnId: 1, userText: 'hello', assistantText: 'hi', toolUseJson: '', toolResultText: '', thinkingText: '' },
    ],
  });
  assert.equal(r.source, 'estimated');
  assert.deepEqual(r.unknownSources, ['system_prompt', 'tools_schema']);
  assert.equal(r.points[0].sources.system_prompt, 0);
  assert.ok(r.points[0].sources.messages_user > 0);
});

test('audit enabled + active hook but no captures for this session → estimated (no stale)', async () => {
  const dir = tmp();
  const out = path.join(dir, 'captures');
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, '.heartbeat'), JSON.stringify({ pid: 1, at: new Date().toISOString() }));
  const r = await getComposition('unknown-session', {
    outDir: out,
    auditEnabled: true,
    turnsFallback: async () => [
      { turnId: 1, userText: 'hi', assistantText: 'hi', toolUseJson: '', toolResultText: '', thinkingText: '' },
    ],
  });
  assert.equal(r.source, 'estimated');
  assert.equal(r.hookStale, undefined);
  assert.deepEqual(r.unknownSources, ['system_prompt', 'tools_schema']);
});
