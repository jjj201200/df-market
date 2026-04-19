/** GET /api/sessions - session list item */
export interface SessionListItem {
  sessionId: string;
  slug: string;
  customTitle: string;
  gitBranch: string;
  mtime: string;
  filePath: string;
}

/** GET /api/sessions/:id - full session response from parser.js */
export interface ApiHookEvent {
  hookName: string;
  hookEvent: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  timestamp: string;
}

export interface SessionResponse {
  sessionId: string;
  slug: string;
  gitBranch: string;
  turns: ApiTurn[];
  systemEvents: ApiSystemEvent[];
  hooks: ApiHookEvent[];
  stopReasons: Record<string, number>;
  cacheTtl: {ephemeral1h: number; ephemeral5m: number};
  subagents: Record<string, ApiSubagentStats>;
}

export interface ApiTurn {
  id: number;
  type: 'turn';
  time: string;
  timestamp: string;
  userText: string;
  assistantText: string;
  model: string;
  isSidechain: boolean;
  agentId: string | null;
  input: number;
  output: number;
  cacheR: number;
  cacheC: number;
  thinking: string | null;
  tools: ApiTool[];
}

export interface ApiTool {
  name: string;
  cls: string;
  params: string;
  inputArgs: ToolInputArg[];
  status: 'ok' | 'err';
  isErr: boolean;
  startTime: string | null;
  endTime: string | null;
  dur: string;
  retContent: string;
  retSize: string;
  retLines: string;
  mcp: McpInfo | null;
}

export interface ToolInputArg {
  k: string;
  v: string;
  vc: string; // 'str' | 'cmd' | 'path' | 'num' | 'bool'
}

export interface McpInfo {
  server: string;
  method: string;
}

export interface ApiSystemEvent {
  type: 'command' | 'compact';
  kind?: 'slash' | 'bash';
  command?: string;
  message?: string;
  output?: string;
  isError?: boolean;
  trigger?: string;
  preTokens?: number;
  time: string;
  timestamp: string;
}

export interface ApiSubagentStats {
  agentId: string;
  agentType: string;
  description: string;
  totalTurns: number;
  totalTokens: TokenCounts;
  toolCounts: Record<string, number>;
  turns: ApiTurn[];
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheR: number;
  cacheC: number;
}

/** GET /api/limits - limits data (from status line integration) */
export interface LimitsData {
  timestamp?: number;
  contextWindow?: ContextWindowData;
  rateLimits?: RateLimitsData;
  model?: string;
  cost?: number;
}

export interface ContextWindowData {
  used_percentage: number;
  context_window_size?: number;
  current_usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export interface RateLimitsData {
  five_hour?: RateLimitEntry;
  seven_day?: RateLimitEntry;
}

export interface RateLimitEntry {
  used_percentage: number;
  resets_at?: number;
}

// ── Audit + Composition (F-path captures) ──────────────────────

export interface AuditStatus {
  auditEnabled: boolean;
  auditPromptedAt: string | null;
  hookHeartbeatAt: string | null;
  hookStale: boolean;
  settingsLocalKeys: Record<string, {present: boolean; value: string | null}>;
}

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

export interface CompositionResponse {
  source: 'live' | 'estimated';
  points: CompositionPoint[];
  unknownSources?: Array<keyof CompositionSources>;
  hookStale?: boolean;
}
