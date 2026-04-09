/** Format large numbers: 1000+ -> "1.0k" */
export function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  if (!n) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Format with locale string */
export function fmtF(n: number): string {
  return (n || 0).toLocaleString();
}

/** Parse duration string like "123ms" or "1.2s" to milliseconds */
export function parseDur(s: string): number {
  if (!s || s === '—') return 0;
  const m = s.match(/([\d.]+)\s*(ms|s)/i);
  if (!m) return parseInt(s.replace(/,/g, '')) || 0;
  const val = parseFloat(m[1]!);
  return m[2]!.toLowerCase() === 's' ? val * 1000 : val;
}

/** Parse size string like "1.2 KB" to bytes */
export function parseSize(s: string): number {
  if (!s || s === '—') return 0;
  const m = s.match(/([\d.]+)\s*(KB|B)?/i);
  if (!m) return 0;
  return m[2] && m[2].toUpperCase() === 'KB' ? parseFloat(m[1]!) * 1024 : parseFloat(m[1]!);
}

/** Format milliseconds: hours, minutes, seconds, or ms */
export function fmtDur(ms: number): string {
  if (ms >= 3_600_000) return (ms / 3_600_000).toFixed(1) + 'h';
  if (ms >= 60_000) return (ms / 60_000).toFixed(1) + 'm';
  if (ms >= 1_000) return (ms / 1_000).toFixed(1) + 's';
  return Math.round(ms) + 'ms';
}

/** Format USD: <$0.01 shows 4 decimals, else 2 */
export function fmtUsd(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

/** Format token count: M/K/raw */
export function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

/** Format a 0-1 ratio as percentage string */
export function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** Format bytes: >=1024 -> "1.2 KB", else "123 B" */
export function fmtBytes(b: number): string {
  return b >= 1024 ? (b / 1024).toFixed(1) + ' KB' : b.toFixed(0) + ' B';
}

/** Format reset time from unix timestamp to absolute datetime (local timezone) */
export function fmtResetTimeAbsolute(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  const secs = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/** Format reset time without year: MM-DD HH:MM */
export function fmtResetTimeShort(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${mins}`;
}
