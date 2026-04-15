import type {TurnItem} from '../../types/state';

export interface McpMethodStats {
  calls: number;
  errors: number;
  totalMs: number;
  avgMs: number;
  errorRate: number;
}

export interface McpServerStats {
  calls: number;
  errors: number;
  totalMs: number;
  avgMs: number;
  errorRate: number;
  methods: Record<string, McpMethodStats>;
}

export interface McpTurnUsage {
  turnId: number;
  calls: {server: string; method: string; durMs: number; isErr: boolean}[];
}

export interface McpMetrics {
  totalMcpCalls: number;
  totalMcpErrors: number;
  mcpPct: number;
  avgMcpDurationMs: number;
  byServer: Record<string, McpServerStats>;
  totalCalls: number;
  turnUsage: McpTurnUsage[];
}

function parseDurToMs(dur: string): number {
  const m = dur.match(/([\d.]+)\s*ms/);
  return m ? parseFloat(m[1]!) : 0;
}

export function computeMcpMetrics(turns: TurnItem[]): McpMetrics {
  let totalMcpCalls = 0;
  let totalMcpErrors = 0;
  let totalMcpDurationMs = 0;
  const byServer: Record<string, McpServerStats> = {};
  let totalCalls = 0;
  const turnUsage: McpTurnUsage[] = [];

  for (const t of turns) {
    const turnCalls: McpTurnUsage['calls'] = [];
    for (const tool of t.tools) {
      totalCalls++;
      if (tool.cls !== 'mcp' || !tool.mcp) continue;
      totalMcpCalls++;
      if (tool.isErr) totalMcpErrors++;

      const server = tool.mcp.server || 'unknown';
      const method = tool.mcp.method || 'unknown';
      if (!byServer[server]) {
        byServer[server] = {calls: 0, errors: 0, totalMs: 0, avgMs: 0, errorRate: 0, methods: {}};
      }
      byServer[server]!.calls++;
      if (tool.isErr) byServer[server]!.errors++;

      if (!byServer[server]!.methods[method]) {
        byServer[server]!.methods[method] = {calls: 0, errors: 0, totalMs: 0, avgMs: 0, errorRate: 0};
      }
      byServer[server]!.methods[method]!.calls++;
      if (tool.isErr) byServer[server]!.methods[method]!.errors++;

      const ms = parseDurToMs(tool.dur);
      if (ms > 0) {
        byServer[server]!.totalMs += ms;
        totalMcpDurationMs += ms;
        byServer[server]!.methods[method]!.totalMs += ms;
      }

      turnCalls.push({server, method, durMs: ms, isErr: tool.isErr});
    }
    if (turnCalls.length > 0) {
      turnUsage.push({turnId: t.id, calls: turnCalls});
    }
  }

  for (const s of Object.values(byServer)) {
    s.avgMs = s.calls > 0 ? s.totalMs / s.calls : 0;
    s.errorRate = s.calls > 0 ? s.errors / s.calls : 0;
    for (const m of Object.values(s.methods)) {
      m.avgMs = m.calls > 0 ? m.totalMs / m.calls : 0;
      m.errorRate = m.calls > 0 ? m.errors / m.calls : 0;
    }
  }

  return {
    totalMcpCalls,
    totalMcpErrors,
    mcpPct: totalCalls > 0 ? totalMcpCalls / totalCalls : 0,
    avgMcpDurationMs: totalMcpCalls > 0 ? totalMcpDurationMs / totalMcpCalls : 0,
    byServer,
    totalCalls,
    turnUsage,
  };
}
