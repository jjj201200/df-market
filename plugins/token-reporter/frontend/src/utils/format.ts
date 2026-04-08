/** Format large numbers: 1000+ -> "1.0k" */
export function fmt(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0);
}

/** Format with locale string */
export function fmtF(n: number): string {
  return (n || 0).toLocaleString();
}

/** Parse duration string like "123ms" to number */
export function parseDur(s: string): number {
  if (!s) return 0;
  return parseInt(s.replace(/,/g, '')) || 0;
}

/** Parse size string like "1.2 KB" to bytes */
export function parseSize(s: string): number {
  if (!s || s === '—') return 0;
  const m = s.match(/([\d.]+)\s*(KB|B)?/i);
  if (!m) return 0;
  return m[2] && m[2].toUpperCase() === 'KB' ? parseFloat(m[1]!) * 1024 : parseFloat(m[1]!);
}

/** Format milliseconds: >=1000 -> "1.2s", else "123ms" */
export function fmtDur(ms: number): string {
  return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
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
