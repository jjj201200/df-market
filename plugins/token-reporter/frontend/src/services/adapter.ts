import type {SessionResponse, ApiTool, ApiTurn} from '../types/api';
import type {DataItem, TurnItem, ToolItem, SubagentStats} from '../types/state';

interface AdaptedSession {
  items: DataItem[];
  subagents: Record<string, SubagentStats>;
}

function adaptTool(tool: ApiTool): ToolItem {
  return {
    cls: tool.cls,
    name: tool.name,
    params: tool.params,
    status: tool.status,
    dur: tool.dur,
    retSize: tool.retSize,
    retLines: tool.retLines,
    input: tool.inputArgs || [],
    output: tool.retContent || '',
    isErr: tool.isErr,
    mcp: tool.mcp || null,
  };
}

/** Transform API session response to internal data model */
export function adaptSession(session: SessionResponse | null): AdaptedSession {
  if (!session?.turns) return {items: [], subagents: {}};

  const items: DataItem[] = session.turns.map((t) => ({
    type: 'turn' as const,
    id: t.id,
    time: t.time,
    timestamp: t.timestamp,
    user: t.userText || '',
    assistant: t.assistantText || '',
    model: t.model || '',
    input: t.input || 0,
    output: t.output || 0,
    cacheR: t.cacheR || 0,
    cacheC: t.cacheC || 0,
    isSidechain: t.isSidechain || false,
    thinking: t.thinking || null,
    tools: (t.tools || []).map(adaptTool),
  }));

  if (session.systemEvents) {
    for (const ev of session.systemEvents) {
      if (ev.type === 'command') {
        items.push({
          type: 'command' as const,
          command: ev.command || '',
          message: ev.message || '',
          output: ev.output || '',
          time: ev.time,
          timestamp: ev.timestamp,
        });
      } else if (ev.type === 'compact') {
        items.push({
          type: 'compact' as const,
          trigger: ev.trigger || 'auto',
          preTokens: ev.preTokens || 0,
          time: ev.time,
          timestamp: ev.timestamp,
        });
      }
    }
  }

  // Sort all items by timestamp for correct interleaving
  items.sort((a, b) => {
    const ta = a.timestamp || '';
    const tb = b.timestamp || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  // Adapt subagent data with consistent field names
  const subagents: Record<string, SubagentStats> = {};
  for (const [agentId, sa] of Object.entries(session.subagents || {})) {
    subagents[agentId] = {
      ...sa,
      turns: (sa.turns || []).map((t: ApiTurn) => ({
        id: t.id,
        time: t.time,
        timestamp: t.timestamp,
        userText: t.userText || '',
        assistantText: t.assistantText || '',
        model: t.model || '',
        tools: (t.tools || []).map(adaptTool),
      })),
    };
  }

  return {items, subagents};
}

/** Extract only turn-type items from data array */
export function extractTurns(data: DataItem[]): TurnItem[] {
  return data.filter((d): d is TurnItem => d.type === 'turn');
}
