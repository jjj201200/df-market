import type {McpInfo, ToolInputArg, TokenCounts} from './api';

export type DataItem = TurnItem | CompactItem | CommandItem;

export interface TurnItem {
  type: 'turn';
  id: number;
  time: string;
  timestamp: string;
  user: string;
  assistant: string;
  model: string;
  input: number;
  output: number;
  cacheR: number;
  cacheC: number;
  isSidechain: boolean;
  thinking: string | null;
  tools: ToolItem[];
}

export interface ToolItem {
  cls: string;
  name: string;
  params: string;
  status: 'ok' | 'err';
  dur: string;
  retSize: string;
  retLines: string;
  input: ToolInputArg[];
  output: string;
  isErr: boolean;
  mcp: McpInfo | null;
}

export interface CompactItem {
  type: 'compact';
  trigger: string;
  preTokens: number;
  time: string;
  timestamp: string;
}

export interface CommandItem {
  type: 'command';
  kind: 'slash' | 'bash';
  command: string;
  message: string;
  output: string;
  isError: boolean;
  time: string;
  timestamp: string;
}

export interface SubagentStats {
  agentId: string;
  agentType: string;
  description: string;
  totalTurns: number;
  totalTokens: TokenCounts;
  toolCounts: Record<string, number>;
  turns: SubagentTurnItem[];
}

export interface SubagentTurnItem {
  id: number;
  time: string;
  timestamp: string;
  userText: string;
  assistantText: string;
  model: string;
  tools: ToolItem[];
}

export interface BarRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dims {
  input: boolean;
  output: boolean;
  cacheR: boolean;
  cacheC: boolean;
}

/** Token type CSS custom property names (for Canvas, resolve via getComputedStyle) */
export const COLOR_VARS = {
  input: '--token-input',
  output: '--token-output',
  cacheR: '--token-cache-read',
  cacheC: '--token-cache-write',
} as const;

/** Token type color constants as CSS var() references (for inline styles / legend) */
export const COLORS = {
  input: 'var(--token-input)',
  output: 'var(--token-output)',
  cacheR: 'var(--token-cache-read)',
  cacheC: 'var(--token-cache-write)',
} as const;
