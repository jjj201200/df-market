import {useEffect} from 'react';
import {useChartStore} from '../stores/chartStore';
import {useSessionStore} from '../stores/sessionStore';

/**
 * Directional lock: when brush-driven code triggers a scroll, this lock
 * blocks scroll→brush sync until the smooth scroll animation settles.
 * "Settle" = scrollY unchanged for 150ms.
 */
let _brushDriving = false;
let _settleTimer: ReturnType<typeof setTimeout> | null = null;
let _lastScrollY = -1;

function startSettleDetection() {
  if (_settleTimer) clearTimeout(_settleTimer);
  _settleTimer = setTimeout(() => {
    if (Math.abs(window.scrollY - _lastScrollY) < 2) {
      _brushDriving = false;
      _settleTimer = null;
    } else {
      _lastScrollY = window.scrollY;
      startSettleDetection();
    }
  }, 150);
}

/** Call this before any brush-driven scroll to block scroll→brush feedback */
export function lockBrushDriving() {
  _brushDriving = true;
  _lastScrollY = window.scrollY;
  startSettleDetection();
}

/**
 * Deferred scroll: during continuous brush wheel events, suppress all scrolling.
 * Only scroll once after the wheel stops (debounce).
 */
let _deferTimer: ReturnType<typeof setTimeout> | null = null;

export function deferScrollToTurn(fn: () => void, delayMs = 200) {
  if (_deferTimer) clearTimeout(_deferTimer);
  _deferTimer = setTimeout(() => {
    _deferTimer = null;
    fn();
  }, delayMs);
}

/**
 * Estimate how many turns can fit in the viewport based on average turn height.
 * Used for initial brush sizing.
 */
function estimateViewportTurnCount(): number {
  const turns = useSessionStore.getState().turns;
  if (turns.length === 0) return 20;

  // Sample a few turns to estimate average height
  const sampleSize = Math.min(5, turns.length);
  let totalHeight = 0;
  let counted = 0;

  for (let i = 0; i < sampleSize; i++) {
    const el = document.getElementById('turn-' + turns[i]!.id);
    if (el) {
      totalHeight += el.offsetHeight;
      counted++;
    }
  }

  if (counted === 0) return 20;

  const avgHeight = totalHeight / counted;
  const viewportHeight = window.innerHeight;
  // Account for sticky header (approximately 200px)
  const availableHeight = viewportHeight - 200;

  return Math.max(5, Math.floor(availableHeight / avgHeight));
}

/**
 * Bidirectional scroll <-> brush sync.
 * When the user scrolls the page, the brush position updates to reflect visible turns.
 */
/** Compute which turn indices are visible in the viewport (not occluded by sticky header) */
function updateViewRange() {
  const turns = useSessionStore.getState().turns;
  const N = turns.length;
  if (N === 0) return {loIdx: -1, hiIdx: -1, loPct: 0, hiPct: 1};

  const stickyEl = document.getElementById('stickyChart');
  const stickyH = stickyEl?.offsetHeight ?? 0;
  const viewTop = window.scrollY + stickyH;
  const viewBottom = window.scrollY + window.innerHeight;

  let loIdx = -1;
  let hiIdx = -1;
  let loPct = 0;
  let hiPct = 1;

  for (let i = 0; i < N; i++) {
    const el = document.getElementById('turn-' + turns[i]!.id);
    if (!el) continue;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (bottom > viewTop && top < viewBottom) {
      if (loIdx < 0) {
        loIdx = i;
        // Calculate percentage for first visible turn (same as brush calculation)
        loPct = i / Math.max(N - 1, 1);
      }
      hiIdx = i;
      // Calculate percentage for last visible turn (same as brush calculation)
      // brush uses index/(N-1), so viewport should use the same
      hiPct = i / Math.max(N - 1, 1);
    }
  }

  if (loIdx >= 0) {
    const {viewLoIdx: prevLo, viewHiIdx: prevHi, setViewRange} = useChartStore.getState();
    if (loIdx !== prevLo || hiIdx !== prevHi) {
      setViewRange(loIdx, hiIdx, loPct, hiPct);
    }
  }

  return {loIdx, hiIdx, loPct, hiPct};
}

export function useScrollSync() {
  useEffect(() => {
    // Initialize brush width based on actual viewport size after DOM is ready
    // Only runs once on mount when turns are loaded
    let initialized = false;
    const initBrushFromViewport = () => {
      if (initialized) return;
      const turns = useSessionStore.getState().turns;
      if (turns.length > 0) {
        const viewportTurnCount = estimateViewportTurnCount();
        // Only re-initialize if the calculated count differs significantly from default
        if (Math.abs(viewportTurnCount - 20) > 3) {
          useChartStore.getState().initBrushForTurnCount(turns.length, viewportTurnCount);
        }
        initialized = true;
      }
    };

    // Delay to ensure DOM is rendered
    const timer = setTimeout(initBrushFromViewport, 100);
    // Also try after a longer delay in case of slow rendering
    const timer2 = setTimeout(initBrushFromViewport, 500);

    function onScroll() {
      // Always update viewport range (even during brush-driven scroll)
      const {loIdx, hiIdx} = updateViewRange();

      // Skip brush sync when brush is driving scroll
      if (_brushDriving) return;

      const turns = useSessionStore.getState().turns;
      const N = turns.length;
      if (N === 0 || loIdx < 0) return;

      const Nm1 = Math.max(N - 1, 1);
      const viewL = loIdx / Nm1;
      const viewR = hiIdx / Nm1;
      const {brushL, brushR, setBrush} = useChartStore.getState();
      const span = brushR - brushL;

      // Only push brush when viewport exceeds brush boundaries
      let newL = brushL;
      if (viewR > brushR) {
        // Viewport overflows right — push brush right
        newL = Math.min(viewR - span, 1 - span);
      } else if (viewL < brushL) {
        // Viewport overflows left — push brush left
        newL = Math.max(viewL, 0);
      } else {
        return; // Viewport within brush range, no change
      }
      setBrush(newL, newL + span);
    }

    function onResize() {
      updateViewRange();
    }

    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onResize, {passive: true});
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);
}
