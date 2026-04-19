import fs from 'fs';
import path from 'path';

export interface CompositionSources {
  system_prompt: number;
  tools_schema: number;
  messages_user: number;
  messages_assistant: number;
  messages_tool_use: number;
  messages_tool_result: number;
  messages_thinking: number;
}

export interface CompositionPoint {
  turnId: number;
  capturedAt: string;
  requestId: string | null;
  total: number;
  sources: CompositionSources;
}

interface CaptureFile {
  id: string;
  capturedAt: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyBytes: number;
  body: string | null;
}

function charsToTokens(n: number): number { return Math.round(n / 4); }
function lenStr(v: unknown): number {
  if (typeof v === 'string') return v.length;
  if (v == null) return 0;
  return JSON.stringify(v).length;
}

function splitMessages(messages: unknown[]): Omit<CompositionSources, 'system_prompt' | 'tools_schema'> {
  const out = {
    messages_user: 0,
    messages_assistant: 0,
    messages_tool_use: 0,
    messages_tool_result: 0,
    messages_thinking: 0,
  };
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as { role?: string; content?: unknown };
    const role = msg.role;
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        const b = block as { type?: string; text?: string; content?: unknown; thinking?: string };
        if (b.type === 'text') {
          if (role === 'user') out.messages_user += lenStr(b.text);
          else if (role === 'assistant') out.messages_assistant += lenStr(b.text);
        } else if (b.type === 'tool_use') {
          out.messages_tool_use += lenStr(b);
        } else if (b.type === 'tool_result') {
          out.messages_tool_result += lenStr(b.content);
        } else if (b.type === 'thinking') {
          out.messages_thinking += lenStr(b.thinking);
        }
      }
    } else if (typeof content === 'string') {
      if (role === 'user') out.messages_user += content.length;
      else if (role === 'assistant') out.messages_assistant += content.length;
    }
  }
  return out;
}

function bodyToSources(body: unknown): CompositionSources {
  const b = (body ?? {}) as { system?: unknown; tools?: unknown[]; messages?: unknown[] };
  const msg = splitMessages(Array.isArray(b.messages) ? b.messages : []);
  return {
    system_prompt: charsToTokens(lenStr(b.system)),
    tools_schema: charsToTokens(lenStr(b.tools)),
    messages_user: charsToTokens(msg.messages_user),
    messages_assistant: charsToTokens(msg.messages_assistant),
    messages_tool_use: charsToTokens(msg.messages_tool_use),
    messages_tool_result: charsToTokens(msg.messages_tool_result),
    messages_thinking: charsToTokens(msg.messages_thinking),
  };
}

export async function parseCaptures(outDir: string): Promise<Record<string, CompositionPoint[]>> {
  if (!fs.existsSync(outDir)) return {};
  const entries = fs.readdirSync(outDir).filter((f) => f.endsWith('.req.json'));
  const bySession: Record<string, Array<CompositionPoint & { _ts: number }>> = {};
  for (const f of entries) {
    try {
      const raw = fs.readFileSync(path.join(outDir, f), 'utf8');
      const cap = JSON.parse(raw) as CaptureFile;
      if (!cap.body) continue;
      const sessionId = cap.headers?.['x-claude-code-session-id'];
      if (!sessionId) continue;
      let body: unknown;
      try { body = JSON.parse(cap.body); } catch { continue; }
      const sources = bodyToSources(body);
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      const ts = Date.parse(cap.capturedAt);
      const arr = bySession[sessionId] || (bySession[sessionId] = []);
      arr.push({
        turnId: 0,
        capturedAt: cap.capturedAt,
        requestId: cap.headers?.['x-client-request-id'] || null,
        total,
        sources,
        _ts: Number.isNaN(ts) ? 0 : ts,
      });
    } catch {
      // ignore individual file errors
    }
  }
  const out: Record<string, CompositionPoint[]> = {};
  for (const [sid, points] of Object.entries(bySession)) {
    points.sort((a, b) => a._ts - b._ts);
    out[sid] = points.map((p, i) => {
      const { _ts, ...rest } = p;
      return { ...rest, turnId: i + 1 };
    });
  }
  return out;
}
