import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import {
  MANAGED_ENV_KEYS,
  HOOK_REQUIRE_TOKEN,
  SHELL_RC_MARKER,
  hookPathForPlugin,
  hookRequireArg,
} from '../backend/dist/audit-keys.js';

test('MANAGED_ENV_KEYS lists only the 2 env keys the hook reads at runtime', () => {
  // NODE_OPTIONS is intentionally absent — injected via alias, not env.
  assert.deepEqual(MANAGED_ENV_KEYS, [
    'TOKEN_REPORTER_AUDIT_OUT',
    'TOKEN_REPORTER_AUDIT_ACTIVE',
  ]);
});

test('SHELL_RC_MARKER is non-empty and distinctive', () => {
  assert.equal(typeof SHELL_RC_MARKER, 'string');
  assert.ok(SHELL_RC_MARKER.startsWith('#'));
  assert.ok(SHELL_RC_MARKER.includes('token-reporter-audit'));
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
