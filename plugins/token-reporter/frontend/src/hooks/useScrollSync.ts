import {useEffect} from 'react';
import {useChartStore} from '../stores/chartStore';
import {useSessionStore} from '../stores/sessionStore';

/**
 * Global suppression flag.
 * Any code that programmatically changes brush or triggers scroll should call
 * suppressScrollSync() to prevent circular feedback.
 */
let _suppressed = false;
let _suppressTimer: ReturnType<typeof setTimeout> | null = null;

export function suppressScrollSync(durationMs = 500) {
  _suppressed = true;
  if (_suppressTimer) clearTimeout(_suppressTimer);
  _suppressTimer = setTimeout(() => {
    _suppressed = false;
  }, durationMs);
}

/**
 * Bidirectional scroll <-> brush sync.
 * When the user scrolls the page, the brush position updates to reflect visible turns.
 */
export function useScrollSync() {
  useEffect(() => {
    function onScroll() {
      if (_suppressed) return;

      const turns = useSessionStore.getState().turns;
      const N = turns.length;
      if (N === 0) return;

      const stickyEl = document.getElementById('stickyChart');
      const stickyH = stickyEl?.offsetHeight ?? 0;
      const viewTop = window.scrollY + stickyH;
      const viewBottom = window.scrollY + window.innerHeight;

      let loIdx = -1;
      let hiIdx = -1;

      for (let i = 0; i < N; i++) {
        const el = document.getElementById('turn-' + turns[i]!.id);
        if (!el) continue;
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (bottom > viewTop && top < viewBottom) {
          if (loIdx < 0) loIdx = i;
          hiIdx = i;
        }
      }

      if (loIdx < 0) return;

      const centerRatio = (loIdx + hiIdx) / 2 / Math.max(N - 1, 1);
      const {brushL, brushR, setBrush} = useChartStore.getState();
      const span = brushR - brushL;
      let newL = centerRatio - span / 2;
      newL = Math.max(0, Math.min(newL, 1 - span));
      setBrush(newL, newL + span);
    }

    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}
