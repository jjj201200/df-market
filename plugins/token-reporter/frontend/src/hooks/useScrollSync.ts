import {useEffect} from 'react';
import {useChartStore} from '../stores/chartStore';
import {useSessionStore, dataIdxToChartTurnIdx, dataIdxToTurnNo} from '../stores/sessionStore';
import {getConversationVirtualizer} from '../utils/virtualList';

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
 * Used for initial brush sizing. Reads the virtualizer's measurement cache —
 * no DOM queries (rows outside the viewport are not mounted).
 */
function estimateViewportTurnCount(): number {
  const {chartTurns, data} = useSessionStore.getState();
  if (chartTurns.length === 0) return 20;

  const virt = getConversationVirtualizer();
  const container = getScrollContainer();
  if (!virt) return 20;

  const ms = virt.measurementsCache;
  // Sample the LAST rows — the initial viewport sits at the newest turns
  let totalHeight = 0;
  let counted = 0;
  for (let i = ms.length - 1; i >= 0 && counted < 10; i--) {
    if (data[i]?.type === 'turn') {
      totalHeight += ms[i]!.size;
      counted++;
    }
  }
  if (counted === 0) return 20;

  const avgHeight = Math.max(totalHeight / counted, 50);
  const viewportHeight = container.clientHeight;
  // Account for sticky header (approximately 200px)
  const availableHeight = viewportHeight - 200;

  return Math.max(5, Math.floor(availableHeight / avgHeight));
}

/**
 * Bidirectional scroll <-> brush sync.
 * When the user scrolls the page, the brush position updates to reflect visible turns.
 */
/**
 * Compute which turn indices are visible in the viewport (not occluded by sticky
 * header), in chartTurns coordinate space. Reads the virtualizer's measurement
 * cache — one arithmetic pass over rendered-range rows, zero DOM layout queries.
 */
export function updateViewRange() {
  const {chartTurns} = useSessionStore.getState();
  const N = chartTurns.length;
  if (N === 0) return {loIdx: -1, hiIdx: -1, loPct: 0, hiPct: 1};

  const virt = getConversationVirtualizer();
  const container = getScrollContainer();
  if (!virt) return {loIdx: -1, hiIdx: -1, loPct: 0, hiPct: 1};

  const margin = virt.options.scrollMargin;
  // Viewport in list coordinates (px from top of data[0])
  const viewTop = container.scrollTop + stickyHeight() - margin;
  const viewBottom = container.scrollTop + container.clientHeight - margin;

  const ms = virt.measurementsCache;
  const M = ms.length;
  if (M === 0) return {loIdx: -1, hiIdx: -1, loPct: 0, hiPct: 1};

  // Restrict the scan to the virtualizer's rendered range (covers the viewport)
  const range = virt.range ?? {startIndex: 0, endIndex: M - 1};
  const from = Math.max(0, range.startIndex);
  const to = Math.min(M - 1, range.endIndex);

  const Nm1 = Math.max(N - 1, 1);
  let loIdx = -1;
  let hiIdx = -1;
  let loPct = 0;
  let hiPct = 1;
  // Full-range coordinates (independent of the chart window) for the range bar
  let sawTurn = false;
  let fullLo = -1;
  let fullHi = -1;
  const totalTurns = useSessionStore.getState().turns.length;

  for (let i = from; i <= to; i++) {
    const m = ms[i]!;
    const top = m.start - margin;
    const bottom = top + m.size;
    if (bottom <= viewTop) continue;
    if (top >= viewBottom) break;
    const turnNo = dataIdxToTurnNo(i);
    if (turnNo == null) continue; // compact/command rows
    const h = m.size || 1;
    const hiddenAbove = Math.max(0, viewTop - top);
    const hiddenBelow = Math.max(0, bottom - viewBottom);
    if (!sawTurn) {
      sawTurn = true;
      // Sub-index precision, kept FLOAT (turn i spans [i-0.5, i+0.5] — the
      // last turn's right edge is N-0.5, never N). Rounding here promoted
      // the half-step and pushed the marker past the selection's right edge.
      fullLo = Math.max(0, turnNo - 0.5 + hiddenAbove / h);
    }
    fullHi = Math.min(totalTurns - 0.5, Math.max(fullLo, turnNo + 0.5 - hiddenBelow / h));
    const chartIdx = dataIdxToChartTurnIdx(i);
    if (chartIdx == null) continue; // turns outside the chart window
    if (loIdx < 0) {
      loIdx = chartIdx;
      // Sub-index precision: how much of this turn is hidden above the viewport
      // Offset by -0.5 so the indicator starts at the bar's left edge
      loPct = (chartIdx - 0.5 + hiddenAbove / h) / Nm1;
    }
    hiIdx = chartIdx;
    // Sub-index precision: how much of this turn is hidden below the viewport
    // Offset by +0.5 so the indicator ends at the bar's right edge
    hiPct = (chartIdx + 0.5 - hiddenBelow / h) / Nm1;
  }

  if (loIdx >= 0) {
    const {
      viewLoIdx: prevLo,
      viewHiIdx: prevHi,
      viewLoPct: prevLoPct,
      viewHiPct: prevHiPct,
      viewFullLo: prevFullLo,
      viewFullHi: prevFullHi,
      setViewRange,
    } = useChartStore.getState();
    if (
      loIdx !== prevLo ||
      hiIdx !== prevHi ||
      Math.abs(loPct - prevLoPct) > 0.001 ||
      Math.abs(hiPct - prevHiPct) > 0.001 ||
      // The window-relative values may be identical while the full-range
      // position changed (different window origin) — the range bar's marker
      // tracks fullLo/fullHi, so dedup on them too or it freezes.
      Math.abs(fullLo - prevFullLo) > 0.001 ||
      Math.abs(fullHi - prevFullHi) > 0.001
    ) {
      setViewRange(loIdx, hiIdx, loPct, hiPct, fullLo, fullHi);
    }
  } else if (sawTurn) {
    // Viewport is on turns outside the chart window — window-relative range is
    // stale, but the range bar still tracks the true full-range position
    const {viewFullLo: prevFullLo, viewFullHi: prevFullHi, setViewRange} = useChartStore.getState();
    if (fullLo !== prevFullLo || fullHi !== prevFullHi) {
      setViewRange(-1, -1, 0, 1, fullLo, fullHi);
    }
  }

  return {loIdx, hiIdx, loPct, hiPct};
}

function stickyHeight(): number {
  return document.getElementById('stickyChart')?.offsetHeight ?? 0;
}

let _brushInitialized = false;

export function useScrollSync(splitView?: boolean) {
  useEffect(() => {
    const container = getScrollContainer();

    // Initialize brush width based on actual viewport size after DOM is ready
    // Only runs once across the entire app lifecycle (not on splitView toggles)
    const initBrushFromViewport = () => {
      if (_brushInitialized) return;
      const {chartTurns} = useSessionStore.getState();
      if (chartTurns.length > 0) {
        const viewportTurnCount = estimateViewportTurnCount();
        // Only re-initialize if the calculated count differs significantly from default
        if (Math.abs(viewportTurnCount - 20) > 3) {
          useChartStore.getState().initBrushForTurnCount(chartTurns.length, viewportTurnCount);
        }
        _brushInitialized = true;
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

      const turns = useSessionStore.getState().chartTurns;
      const N = turns.length;
      if (N === 0 || loIdx < 0) return;

      const Nm1 = Math.max(N - 1, 1);
      const half = 0.5 / Nm1;
      // Use inter-bar gap boundaries to match brush snap positions
      const viewL = loIdx / Nm1 - half;
      const viewR = hiIdx / Nm1 + half;
      const {brushL, brushR, setBrush} = useChartStore.getState();
      const span = brushR - brushL;

      // Only push brush when viewport exceeds brush boundaries
      const viewSpan = viewR - viewL;
      if (viewSpan > span) {
        // Viewport is larger than brush — expand brush to cover viewport
        setBrush(viewL, viewR);
      } else if (viewR > brushR) {
        // Viewport overflows right — push brush right
        setBrush(viewR - span, viewR);
      } else if (viewL < brushL) {
        // Viewport overflows left — push brush left
        setBrush(viewL, viewL + span);
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
