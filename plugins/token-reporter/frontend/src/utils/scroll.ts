import type {TurnItem} from '../types/state';
import {getScrollContainer, lockBrushDriving, updateViewRange} from '../hooks/useScrollSync';
import {useChartStore} from '../stores/chartStore';

/** Scroll to a turn element by its global index in the turns array */
export function scrollToTurnIndex(turns: TurnItem[], idx: number, align: 'top' | 'bottom' = 'top') {
  const t = turns[Math.max(0, Math.min(idx, turns.length - 1))];
  if (!t) return;
  const el = document.getElementById('turn-' + t.id);
  if (!el) return;

  const container = getScrollContainer();
  const stickyEl = document.getElementById('stickyChart');
  const stickyH = stickyEl?.offsetHeight || 0;
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  let top: number;
  if (align === 'bottom') {
    top = container.scrollTop + (elRect.bottom - containerRect.bottom) + 8;
  } else {
    top = container.scrollTop + (elRect.top - containerRect.top) - stickyH - 8;
  }
  lockBrushDriving();
  container.scrollTo({top, behavior: 'auto'});

  // Explicitly update view range and sync brush after programmatic scroll
  const {loIdx, hiIdx} = updateViewRange();
  const N = turns.length;
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
