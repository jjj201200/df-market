/** Tool category → band/pill color (used in ToolCard bands, SubagentCard pills, SubagentToolGroup) */
export const TOOL_COLORS: Record<string, string> = {
  bash: '#e3b341',
  read: '#58a6ff',
  edit: '#f0883e',
  write: '#bc8cff',
  grep: '#3fb950',
  glob: '#8b949e',
  web: '#58a6ff',
  agent: '#d2a8ff',
  mcp: '#79c0ff',
  toolsearch: '#8b949e',
  other: '#484f58',
};

/** Tool category → text label color (used in ToolCard names) */
export const TOOL_NAME_COLORS: Record<string, string> = {
  bash: 'var(--yellow)',
  read: '#79c0ff',
  edit: 'var(--green)',
  write: 'var(--green)',
  grep: '#79c0ff',
  glob: '#79c0ff',
  web: 'var(--purple)',
  agent: 'var(--orange)',
  mcp: '#a78bfa',
  other: 'var(--muted)',
};
