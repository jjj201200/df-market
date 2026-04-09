import {useEffect} from 'react';
import {useChartStore} from '../stores/chartStore';
import {useSessionStore} from '../stores/sessionStore';

/** Get the scroll container (.splitMain) */
export function getScrollContainer(): HTMLElement {
  return document.getElementById('splitMain') ?? document.documentElement;
}

/**
 * Directional lock: when brush-driven code triggers a scroll, this lock
 * blocks scroll→brush sync until the smooth scroll animation settles.
 * "Settle" = scrollTop unchanged for 150ms.
 */
let _brushDriving = false;
let _settleTimer: ReturnType<typeof setTimeout> | null = null;
let _lastScrollY = -1;

function startSettleDetection() {
  if (_settleTimer) clearTimeout(_settleTimer);
  _settleTimer = setTimeout(() => {
    const container = getScrollContainer();
    if (Math.abs(container.scrollTop - _lastScrollY) < 2) {
      _brushDriving = false;
      _settleTimer = null;
    } else {
      _lastScrollY = container.scrollTop;
      startSettleDetection();
    }
  }, 150);
}

/** Call this before any brush-driven scroll to block scroll→brush feedback */
export function lockBrushDriving() {
  _brushDriving = true;
  const container = getScrollContainer();
  _lastScrollY = container.scrollTop;
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
  const container = getScrollContainer();
  const viewportHeight = container.clientHeight;
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

  const Nm1 = Math.max(N - 1, 1);
  const container = getScrollContainer();
  const containerRect = container.getBoundingClientRect();
  const stickyEl = document.getElementById('stickyChart');
  const stickyH = stickyEl?.offsetHeight ?? 0;
  const viewTop = containerRect.top + stickyH;
  const viewBottom = containerRect.bottom;

  let loIdx = -1;
  let hiIdx = -1;
  let loPct = 0;
  let hiPct = 1;

  for (let i = 0; i < N; i++) {
    const el = document.getElementById('turn-' + turns[i]!.id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const top = rect.top;
    const bottom = rect.bottom;
    if (bottom > viewTop && top < viewBottom) {
      if (loIdx < 0) {
        loIdx = i;
        // Sub-index precision: how much of this turn is hidden above the viewport
        const h = rect.height || 1;
        const hiddenAbove = Math.max(0, viewTop - top);
        loPct = (i + hiddenAbove / h) / Nm1;
      }
      hiIdx = i;
      // Sub-index precision: how much of this turn is hidden below the viewport
      const h = rect.height || 1;
      const hiddenBelow = Math.max(0, bottom - viewBottom);
      hiPct = (i - hiddenBelow / h) / Nm1;
    }
  }

  if (loIdx >= 0) {
    const {viewLoIdx: prevLo, viewHiIdx: prevHi, viewLoPct: prevLoPct, viewHiPct: prevHiPct, setViewRange} = useChartStore.getState();
    if (loIdx !== prevLo || hiIdx !== prevHi || Math.abs(loPct - prevLoPct) > 0.001 || Math.abs(hiPct - prevHiPct) > 0.001) {
      setViewRange(loIdx, hiIdx, loPct, hiPct);
    }
  }

  return {loIdx, hiIdx, loPct, hiPct};
}

export function useScrollSync(splitView?: boolean) {
  useEffect(() => {
    const container = getScrollContainer();

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

    // Compute initial viewport range after DOM settles
    const initTimer = setTimeout(() => updateViewRange(), 150);

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
      const viewSpan = viewR - viewL;
      if (viewSpan > span) {
        // Viewport is larger than brush — expand brush to cover viewport
        const newL = Math.max(0, viewL);
        const newR = Math.min(1, viewR);
        setBrush(newL, newR);
      } else if (viewR > brushR) {
        // Viewport overflows right — push brush right
        const newL = Math.min(viewR - span, 1 - span);
        setBrush(newL, newL + span);
      } else if (viewL < brushL) {
        // Viewport overflows left — push brush left
        const newL = Math.max(viewL, 0);
        setBrush(newL, newL + span);
      }
    }

    function onResize() {
      updateViewRange();
    }

    container.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onResize, {passive: true});
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      clearTimeout(initTimer);
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [splitView]);
}
