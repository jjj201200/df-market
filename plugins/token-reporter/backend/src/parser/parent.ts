import type { JSONLRecord } from './types.js';

export function findParentUser(rec: JSONLRecord, byUuid: Map<string, JSONLRecord>): JSONLRecord | null {
  let cur = byUuid.get(rec.parentUuid || '');
  while (cur) {
    if (cur.type === 'user') return cur;
    cur = byUuid.get(cur.parentUuid || '');
  }
  return null;
}
