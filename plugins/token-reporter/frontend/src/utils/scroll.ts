import {getScrollContainer, lockBrushDriving, updateViewRange} from '../hooks/useScrollSync';
import {useChartStore} from '../stores/chartStore';
import {useSessionStore} from '../stores/sessionStore';
import {getConversationVirtualizer} from './virtualList';

/**
 * Scroll to a turn by its id. Works for rows that are not currently
 * rendered: the virtualizer's measurement cache holds estimated positions
 * for every row, and dynamic measurements correct the estimate once the
 * row mounts.
 */
export function scrollToTurnById(id: number, align: 'top' | 'bottom' = 'top') {
  const container = getScrollContainer();
  const stickyH = document.getElementById('stickyChart')?.offsetHeight || 0;
  const virt = getConversationVirtualizer();
  const {turns, turnDataIdx} = useSessionStore.getState();

  let target: number | null = null;

  if (virt && turnDataIdx.length > 0) {
    const turnNo = turns.findIndex((t) => t.id === id);
    const dataIdx = turnNo >= 0 ? turnDataIdx[turnNo] : undefined;
    const m = dataIdx != null ? virt.measurementsCache[dataIdx] : undefined;
    if (m) {
      target =
        align === 'bottom'
          ? m.start + m.size - container.clientHeight + 8
          : m.start - stickyH - 8;
    }
  }

  if (target == null) {
    // Virtualizer not ready — fall back to the DOM anchor (pre-virtual behavior)
    const el = document.getElementById('turn-' + id);
    if (!el) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    target =
      align === 'bottom'
        ? container.scrollTop + (elRect.bottom - containerRect.bottom) + 8
        : container.scrollTop + (elRect.top - containerRect.top) - stickyH - 8;
  }

  // Window clamp: the list renders the FULL session, but the chart window
  // (RangeBar selection) is what the charts track. A 'top' alignment near the
  // window's end lets the viewport spill onto turns AFTER the window, which
  // pushes the range-bar marker past the selection's right edge. Cap the
  // target so the viewport bottom never passes the window's last turn.
  if (virt) {
    const {chartWindow} = useSessionStore.getState();
    if (chartWindow) {
      const lastTurnNo = chartWindow.end - 1;
      const lastDataIdx =
        lastTurnNo >= 0 && lastTurnNo < turnDataIdx.length ? turnDataIdx[lastTurnNo] : undefined;
      const lm = lastDataIdx != null ? virt.measurementsCache[lastDataIdx] : undefined;
      if (lm) {
        const maxTarget = lm.start + lm.size - container.clientHeight + 8;
        target = Math.min(target, maxTarget);
      }
    }
  }

  lockBrushDriving();
  container.scrollTo({top: Math.max(0, target), behavior: 'auto'});

  // The target above may come from an ESTIMATED height for rows never
  // rendered (virtualized). Once the row mounts and is measured, the true
  // viewport range can differ — recompute after measurement settles, or the
  // indicator stays stuck on a wrong "outside the window" state.
  setTimeout(() => updateViewRange(), 100);
  setTimeout(() => updateViewRange(), 400);

  // Explicitly update view range and sync brush after programmatic scroll
  const {loIdx, hiIdx} = updateViewRange();
  const {chartTurns} = useSessionStore.getState();
  const N = chartTurns.length;
  if (N > 0 && loIdx >= 0) {
    const Nm1 = Math.max(N - 1, 1);
    const half = 0.5 / Nm1;
    const viewL = loIdx / Nm1 - half;
    const viewR = hiIdx / Nm1 + half;
    const {brushL, brushR, setBrush} = useChartStore.getState();
    const span = brushR - brushL;
    const viewSpan = viewR - viewL;
    if (viewSpan > span) {
      setBrush(viewL, viewR);
    } else if (viewR > brushR) {
      setBrush(viewR - span, viewR);
    } else if (viewL < brushL) {
      setBrush(viewL, viewL + span);
    }
  }
}

/** Scroll to a chartTurns[] index (the charts' coordinate space). */
export function scrollToChartTurn(chartIdx: number, align: 'top' | 'bottom' = 'top') {
  const t = useSessionStore.getState().chartTurns[chartIdx];
  if (t) scrollToTurnById(t.id, align);
}
