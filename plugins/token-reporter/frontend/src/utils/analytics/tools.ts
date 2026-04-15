import type {TurnItem, ToolItem} from '../../types/state';

export interface RedundantGroup {
  cls: string;
  keyParam: string;
  count: number;
  turnIds: number[];
}

export interface ToolEfficiency {
  totalCalls: number;
  totalErrors: number;
  errorRate: number;
  errorsByClass: Record<string, {total: number; errors: number; rate: number}>;
  redundantGroups: RedundantGroup[];
  largeCalls: {turnId: number; toolName: string; retSize: string; retBytes: number}[];
  mcpTurnPct: number;
}

function parseSize(s: string): number {
  const m = s.match(/([\d.]+)\s*(KB|B|MB)/i);
  if (!m) return 0;
  const val = parseFloat(m[1]!);
  const unit = m[2]!.toUpperCase();
  if (unit === 'KB') return val * 1024;
  if (unit === 'MB') return val * 1024 * 1024;
  return val;
}

function toolKeyParam(tool: ToolItem): string {
  const args = tool.input;
  if (tool.cls === 'read' || tool.cls === 'edit' || tool.cls === 'write') {
    const fp = args.find((a) => a.k === 'file_path');
    return fp ? fp.v : '';
  }
  if (tool.cls === 'grep') {
    const pat = args.find((a) => a.k === 'pattern');
    const gl = args.find((a) => a.k === 'glob');
    return `${pat?.v ?? ''}|${gl?.v ?? ''}`;
  }
  if (tool.cls === 'glob') {
    const pat = args.find((a) => a.k === 'pattern');
    return pat?.v ?? '';
  }
  if (tool.cls === 'bash') {
    const cmd = args.find((a) => a.k === 'command');
    return cmd?.v ?? '';
  }
  return '';
}

export function computeToolEfficiency(turns: TurnItem[]): ToolEfficiency {
  let totalCalls = 0;
  let totalErrors = 0;
  const errorsByClass: Record<string, {total: number; errors: number; rate: number}> = {};
  const keyMap = new Map<string, {cls: string; keyParam: string; turnIds: number[]; outputs: string[]}>();
  const largeCalls: ToolEfficiency['largeCalls'] = [];
  let mcpTurns = 0;

  for (const t of turns) {
    let hasMcp = false;
    for (const tool of t.tools) {
      totalCalls++;
      if (tool.isErr) totalErrors++;

      if (!errorsByClass[tool.cls]) errorsByClass[tool.cls] = {total: 0, errors: 0, rate: 0};
      errorsByClass[tool.cls]!.total++;
      if (tool.isErr) errorsByClass[tool.cls]!.errors++;

      const kp = toolKeyParam(tool);
      if (kp) {
        const mapKey = `${tool.cls}::${kp}`;
        if (!keyMap.has(mapKey)) keyMap.set(mapKey, {cls: tool.cls, keyParam: kp, turnIds: [], outputs: []});
        const entry = keyMap.get(mapKey)!;
        entry.turnIds.push(t.id);
        entry.outputs.push(tool.output.slice(0, 200));
      }

      const bytes = parseSize(tool.retSize);
      if (bytes > 50 * 1024) {
        largeCalls.push({turnId: t.id, toolName: tool.name, retSize: tool.retSize, retBytes: bytes});
      }

      if (tool.cls === 'mcp') hasMcp = true;
    }
    if (hasMcp) mcpTurns++;
  }

  for (const v of Object.values(errorsByClass)) {
    v.rate = v.total > 0 ? v.errors / v.total : 0;
  }

  const redundantGroups: RedundantGroup[] = [];
  for (const entry of keyMap.values()) {
    if (entry.turnIds.length <= 1) continue;
    const first = entry.outputs[0];
    const allSame = entry.outputs.every((o) => o === first);
    if (allSame) {
      redundantGroups.push({
        cls: entry.cls,
        keyParam: entry.keyParam,
        count: entry.turnIds.length,
        turnIds: entry.turnIds,
      });
    }
  }
  redundantGroups.sort((a, b) => b.count - a.count);

  return {
    totalCalls,
    totalErrors,
    errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
    errorsByClass,
    redundantGroups,
    largeCalls: largeCalls.sort((a, b) => b.retBytes - a.retBytes).slice(0, 20),
    mcpTurnPct: turns.length > 0 ? mcpTurns / turns.length : 0,
  };
}
