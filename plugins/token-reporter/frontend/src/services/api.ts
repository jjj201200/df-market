import type {SessionListItem, SessionResponse, LimitsData} from '../types/api';

/** Fetch all available sessions */
export async function getSessions(): Promise<SessionListItem[]> {
  const res = await fetch('/api/sessions');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Fetch a single session's full data */
export async function getSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch('/api/sessions/' + sessionId);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Fetch limits data for a session */
export async function getLimits(sessionId: string): Promise<LimitsData | null> {
  try {
    const res = await fetch('/api/limits?sessionId=' + sessionId);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
