const assert = require('assert');

function parseDuration(dur) {
  if (typeof dur !== 'string') return 0;
  const m = dur.match(/([\d.]+)\s*ms/);
  return m ? parseFloat(m[1]) : 0;
}

function computeMcpMetrics(turns) {
  let totalMcpCalls = 0;
  let totalMcpErrors = 0;
  let totalMcpDurationMs = 0;
  const byServer = {};
  let totalCalls = 0;

  for (const t of turns) {
    for (const tool of t.tools) {
      totalCalls++;
      if (tool.cls !== 'mcp' || !tool.mcp) continue;
      totalMcpCalls++;
      if (tool.isErr) totalMcpErrors++;

      const server = tool.mcp.server || 'unknown';
      if (!byServer[server]) {
        byServer[server] = { calls: 0, errors: 0, totalMs: 0, avgMs: 0, errorRate: 0 };
      }
      byServer[server].calls++;
      if (tool.isErr) byServer[server].errors++;

      const ms = parseDuration(tool.dur);
      if (ms > 0) {
        byServer[server].totalMs += ms;
        totalMcpDurationMs += ms;
      }
    }
  }

  for (const s of Object.values(byServer)) {
    s.avgMs = s.calls > 0 ? s.totalMs / s.calls : 0;
    s.errorRate = s.calls > 0 ? s.errors / s.calls : 0;
  }

  const mcpPct = totalCalls > 0 ? totalMcpCalls / totalCalls : 0;
  const avgMcpDurationMs = totalMcpCalls > 0 ? totalMcpDurationMs / totalMcpCalls : 0;

  return {
    totalMcpCalls,
    totalMcpErrors,
    mcpPct,
    avgMcpDurationMs,
    byServer,
    totalCalls,
  };
}

const turns = [
  {
    id: 1,
    model: 'claude-sonnet-4-6',
    input: 100,
    output: 50,
    cacheR: 0,
    cacheC: 0,
    tools: [
      { cls: 'mcp', name: 'mcp__server1__foo', isErr: false, dur: '1200ms', mcp: { server: 'server1', method: 'foo' } },
      { cls: 'mcp', name: 'mcp__server1__bar', isErr: false, dur: '800ms', mcp: { server: 'server1', method: 'bar' } },
      { cls: 'bash', name: 'bash', isErr: false, dur: '500ms', mcp: null },
    ],
  },
  {
    id: 2,
    model: 'claude-sonnet-4-6',
    input: 200,
    output: 100,
    cacheR: 0,
    cacheC: 0,
    tools: [
      { cls: 'mcp', name: 'mcp__server2__baz', isErr: true, dur: '3000ms', mcp: { server: 'server2', method: 'baz' } },
      { cls: 'read', name: 'read', isErr: false, dur: '200ms', mcp: null },
    ],
  },
];

const metrics = computeMcpMetrics(turns);
assert.strictEqual(metrics.totalMcpCalls, 3, 'totalMcpCalls should be 3');
assert.strictEqual(metrics.totalMcpErrors, 1, 'totalMcpErrors should be 1');
assert.strictEqual(metrics.totalCalls, 5, 'totalCalls should be 5');
assert.ok(Math.abs(metrics.mcpPct - 0.6) < 0.001, 'mcpPct should be 0.6');
assert.ok(Math.abs(metrics.avgMcpDurationMs - 1666.666) < 1, 'avgMcpDurationMs should be ~1666.67');
assert.strictEqual(metrics.byServer.server1.calls, 2, 'server1 calls should be 2');
assert.strictEqual(metrics.byServer.server2.calls, 1, 'server2 calls should be 1');
assert.strictEqual(metrics.byServer.server2.errors, 1, 'server2 errors should be 1');
assert.ok(Math.abs(metrics.byServer.server1.avgMs - 1000) < 0.1, 'server1 avgMs should be 1000');

// Empty turns
const emptyMetrics = computeMcpMetrics([]);
assert.strictEqual(emptyMetrics.totalMcpCalls, 0);
assert.strictEqual(emptyMetrics.mcpPct, 0);
assert.deepStrictEqual(emptyMetrics.byServer, {});

// No MCP tools
const noMcpTurns = [
  {
    id: 1,
    model: 'claude-sonnet-4-6',
    input: 100,
    output: 50,
    cacheR: 0,
    cacheC: 0,
    tools: [
      { cls: 'bash', name: 'bash', isErr: false, dur: '500ms', mcp: null },
      { cls: 'read', name: 'read', isErr: false, dur: '200ms', mcp: null },
    ],
  },
];
const noMcpMetrics = computeMcpMetrics(noMcpTurns);
assert.strictEqual(noMcpMetrics.totalMcpCalls, 0);
assert.strictEqual(noMcpMetrics.totalCalls, 2);
assert.strictEqual(noMcpMetrics.mcpPct, 0);

console.log('All MCP metrics tests passed!');
