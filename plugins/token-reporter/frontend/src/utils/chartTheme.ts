/** Recharts theme utilities - resolves CSS variables for SVG charts */

let _root: CSSStyleDeclaration | null = null;
function root(): CSSStyleDeclaration {
  if (!_root) _root = getComputedStyle(document.documentElement);
  return _root;
}

export function cssVar(name: string): string {
  return root().getPropertyValue(name).trim();
}

/** Common Recharts props for dark theme consistency */
export const CHART_MARGIN = {top: 8, right: 8, bottom: 4, left: 0};

export function tooltipStyle(): Record<string, string> {
  return {
    backgroundColor: cssVar('--bg-surface-overlay') || '#1c1c1e',
    border: `1px solid ${cssVar('--border-default') || '#333'}`,
    borderRadius: '6px',
    color: cssVar('--fg-default') || '#e0e0e0',
    fontSize: '12px',
    padding: '6px 10px',
  };
}

/** Tooltip label style (the header text inside tooltip) */
export function tooltipLabelStyle(): Record<string, string> {
  return {color: cssVar('--fg-muted') || '#999', fontSize: '11px', fontWeight: '600'};
}

/** Tooltip item style (the value lines inside tooltip) */
export function tooltipItemStyle(): Record<string, string> {
  return {color: cssVar('--fg-default') || '#e0e0e0', fontSize: '12px'};
}

/** Cursor style for bar/area hover highlight */
export function cursorStyle(): Record<string, string | number> {
  return {fill: cssVar('--brush-selection') || 'rgba(88, 166, 255, 0.08)', stroke: 'none'};
}

export function gridStroke(): string {
  return cssVar('--chart-grid') || '#333';
}

export function axisTickStyle(): Record<string, string> {
  return {fill: cssVar('--fg-subtle') || '#666', fontSize: '11px'};
}

/** Token type colors resolved from CSS vars */
export function tokenColors() {
  return {
    input: cssVar('--token-input') || '#58a6ff',
    output: cssVar('--token-output') || '#3fb950',
    cacheRead: cssVar('--token-cache-read') || '#d29922',
    cacheCreation: cssVar('--token-cache-write') || '#a371f7',
  };
}

/** Model colors for multi-model charts */
export const MODEL_COLORS = ['#a371f7', '#58a6ff', '#3fb950', '#d29922', '#f0883e', '#f85149'];

/** Tool class colors resolved from CSS vars */
export function toolColors() {
  return {
    bash: cssVar('--tool-bash') || '#d29922',
    read: cssVar('--tool-read') || '#39d0d8',
    edit: cssVar('--tool-edit') || '#f0883e',
    write: cssVar('--tool-write') || '#db6d28',
    grep: cssVar('--tool-grep') || '#2ea043',
    glob: cssVar('--tool-glob') || '#39d0d8',
    web: cssVar('--tool-web') || '#58a6ff',
    agent: cssVar('--tool-agent') || '#a371f7',
    mcp: cssVar('--tool-mcp') || '#8b5cf6',
    toolsearch: cssVar('--tool-toolsearch') || '#8b5cf6',
    other: cssVar('--tool-other') || '#666',
  };
}
