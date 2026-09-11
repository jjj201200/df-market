/**
 * Tests for bin/lib/proc.js — token-reporter process identification.
 *
 * Regression guard: isTokenReporterProcess used to match on the command NAME
 * only (`ps -o comm=`), which returns just "node" for any Node process, so any
 * node process holding the port was mistaken for token-reporter (making the
 * "already running" short-circuit fire and the port-increment fallback dead).
 */
import assert from 'assert';
import { spawn } from 'child_process';
import { isTokenReporterProcess, getProcessArgs } from '../bin/lib/proc.js';

const KEEPALIVE = 'setInterval(() => {}, 60000)';

function spawnNode(extraArgs = []) {
  const child = spawn(process.execPath, ['-e', KEEPALIVE, ...extraArgs], {
    stdio: 'ignore',
  });
  // Give ps a moment to see the process
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('spawn timeout')), 5000);
    child.on('spawn', () => {
      clearTimeout(t);
      resolve(child);
    });
    child.on('error', reject);
  });
}

async function main() {
  let failed = 0;
  const children = [];

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${name}\n    ${e.message}`);
    }
  }

  await test('plain node process is NOT token-reporter', async () => {
    const child = await spawnNode();
    children.push(child);
    assert.strictEqual(
      isTokenReporterProcess(child.pid),
      false,
      `a bare \`node -e\` process (PID ${child.pid}) must not be identified as token-reporter`,
    );
  });

  await test('node with token-reporter server.js argv IS token-reporter', async () => {
    const child = await spawnNode(['/fake/token-reporter/backend/dist/server.js']);
    children.push(child);
    assert.strictEqual(
      isTokenReporterProcess(child.pid),
      true,
      `expected PID ${child.pid} to be identified as token-reporter`,
    );
  });

  await test('nonexistent pid is NOT token-reporter', async () => {
    assert.strictEqual(isTokenReporterProcess(999999999), false);
  });

  await test('getProcessArgs returns full command line including argv', async () => {
    const child = await spawnNode(['/fake/marker-arg-xyz']);
    children.push(child);
    const args = getProcessArgs(child.pid);
    assert.ok(args.includes('marker-arg-xyz'), `expected args to contain argv, got: ${args}`);
  });

  // Cleanup
  for (const child of children) {
    try {
      child.kill('SIGKILL');
    } catch {}
  }

  console.log(`\nResults: ${4 - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
