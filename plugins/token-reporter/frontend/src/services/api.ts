import type {SessionListItem, SessionResponse, LimitsData, AuditStatus, CompositionResponse} from '../types/api';

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

/** Fetch audit status (enabled flag, hook liveness, managed env keys snapshot) */
export async function getAuditStatus(): Promise<AuditStatus> {
  const res = await fetch('/api/audit/status');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Mark the audit opt-in prompt as seen (dismisses the banner) */
export async function ackAuditPrompt(): Promise<void> {
  await fetch('/api/audit/ack-prompt', {method: 'POST'});
}

/** Fetch the per-turn composition breakdown for a session */
export async function getComposition(sessionId: string): Promise<CompositionResponse> {
  const res = await fetch('/api/sessions/' + sessionId + '/composition');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
