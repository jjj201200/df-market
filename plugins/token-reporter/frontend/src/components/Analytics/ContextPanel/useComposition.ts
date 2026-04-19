import {useEffect, useState} from 'react';
import type {CompositionResponse} from '../../../types/api';
import {getComposition} from '../../../services/api';

/** Fetch composition for the active session, re-fetching when sessionId changes. */
export function useComposition(sessionId: string | null): CompositionResponse | null {
  const [data, setData] = useState<CompositionResponse | null>(null);
  useEffect(() => {
    if (!sessionId) {
      setData(null);
      return;
    }
    let cancelled = false;
    getComposition(sessionId)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [sessionId]);
  return data;
}
