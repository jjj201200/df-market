import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import {
  MANAGED_ENV_KEYS,
  HOOK_REQUIRE_TOKEN,
  hookPathForPlugin,
  hookRequireArg,
} from '../backend/dist/audit-keys.js';

test('MANAGED_ENV_KEYS lists exactly 3 keys in documented order', () => {
  assert.deepEqual(MANAGED_ENV_KEYS, [
    'NODE_OPTIONS',
    'TOKEN_REPORTER_AUDIT_OUT',
    'TOKEN_REPORTER_AUDIT_ACTIVE',
  ]);
});

test('HOOK_REQUIRE_TOKEN is a marker substring used to detect our --require', () => {
  assert.equal(typeof HOOK_REQUIRE_TOKEN, 'string');
  assert.ok(HOOK_REQUIRE_TOKEN.length > 0);
  assert.ok(HOOK_REQUIRE_TOKEN.includes('fetch-hook.cjs'));
});

test('hookPathForPlugin joins runtime/fetch-hook.cjs', () => {
  const p = hookPathForPlugin('/x/plugins/token-reporter');
  assert.equal(p, path.join('/x/plugins/token-reporter', 'runtime', 'fetch-hook.cjs'));
});

test('hookRequireArg produces --require=<abs path> containing the marker', () => {
  const arg = hookRequireArg('/x/plugins/token-reporter');
  assert.match(arg, /^--require=\/x\/plugins\/token-reporter\/runtime\/fetch-hook\.cjs$/);
  assert.ok(arg.includes(HOOK_REQUIRE_TOKEN));
});
