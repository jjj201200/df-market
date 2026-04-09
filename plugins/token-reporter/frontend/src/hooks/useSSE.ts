import {useEffect, useRef} from 'react';
import {useSessionStore} from '../stores/sessionStore';
import {useLimitsStore} from '../stores/limitsStore';

const MAX_RECONNECT_ATTEMPTS = 5;
const MAX_RECONNECT_DELAY = 30000;
const ERROR_THROTTLE = 1000;

/** SSE connection hook with exponential backoff reconnection */
export function useSSE() {
  const refreshCurrentSession = useSessionStore((s) => s.refreshCurrentSession);
  const setLimits = useLimitsStore((s) => s.setLimits);
  const fetchSessionsQuietly = useSessionStore((s) => s.fetchSessionsQuietly);
  const addNewSessionId = useSessionStore((s) => s.addNewSessionId);
  const connRef = useRef<EventSource | null>(null);
  const attemptsRef = useRef(0);
  const delayRef = useRef(3000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const explicitCloseRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const lastErrorTimeRef = useRef(0);

  useEffect(() => {
    function connect() {
      if (isReconnectingRef.current) return;
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log('SSE: Max reconnection attempts reached, stopping retries');
        return;
      }

      // Clean up existing
      if (connRef.current) {
        explicitCloseRef.current = true;
        try {
          connRef.current.close();
        } catch {
          /* ignore */
        }
        connRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      isReconnectingRef.current = true;

      try {
        explicitCloseRef.current = false;
        const es = new EventSource('/events');
        connRef.current = es;

        es.onopen = () => {
          attemptsRef.current = 0;
          delayRef.current = 3000;
          isReconnectingRef.current = false;
        };

        es.onmessage = async (e) => {
          try {
            const msg = JSON.parse(e.data) as {
              type: string;
              sessionId?: string;
              payload?: Record<string, unknown>;
            };
            if (msg.type === 'update' || msg.type === 'tool_use') {
              await refreshCurrentSession();
            } else if (msg.type === 'limits_update' && msg.sessionId && msg.payload) {
              setLimits(msg.sessionId, msg.payload as Parameters<typeof setLimits>[1]);
            } else if (msg.type === 'new_session') {
              await fetchSessionsQuietly();
              if (msg.sessionId) {
                addNewSessionId(msg.sessionId);
              }
            }
          } catch {
            /* ignore parse errors */
          }
        };

        es.onerror = () => {
          const now = Date.now();
          if (now - lastErrorTimeRef.current < ERROR_THROTTLE) return;
          lastErrorTimeRef.current = now;

          if (explicitCloseRef.current) {
            isReconnectingRef.current = false;
            return;
          }

          if (connRef.current) {
            try {
              connRef.current.close();
            } catch {
              /* ignore */
            }
            connRef.current = null;
          }

          attemptsRef.current++;

          if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const jitter = Math.random() * 1000;
            delayRef.current = Math.min(delayRef.current * 1.5 + jitter, MAX_RECONNECT_DELAY);
            timerRef.current = setTimeout(() => {
              isReconnectingRef.current = false;
              connect();
            }, delayRef.current);
          } else {
            isReconnectingRef.current = false;
          }
        };
      } catch {
        attemptsRef.current++;
        if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          timerRef.current = setTimeout(() => {
            isReconnectingRef.current = false;
            connect();
          }, delayRef.current);
        } else {
          isReconnectingRef.current = false;
        }
      }
    }

    connect();

    return () => {
      explicitCloseRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (connRef.current) {
        try {
          connRef.current.close();
        } catch {
          /* ignore */
        }
        connRef.current = null;
      }
    };
  }, [refreshCurrentSession, setLimits, fetchSessionsQuietly, addNewSessionId]);
}
