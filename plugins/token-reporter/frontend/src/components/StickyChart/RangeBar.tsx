import {useRef, useEffect, useCallback, useState} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore, MAX_CHART_TURNS} from '../../stores/sessionStore';
import {DPR, getSegs, setupCanvas} from '../../utils/canvas';
import {scrollToChartTurn} from '../../utils/scroll';
import {lockBrushDriving} from '../../hooks/useScrollSync';
import styles from './RangeBar.module.scss';

const BAR_H = 20;
const MIN_WINDOW_TURNS = 20;

/**
 * Full-range overview bar (shown when the session exceeds
 * FULL_RANGE_THRESHOLD). The selection defines the chart window: dragging it
 * re-slices chartTurns, which the main chart, brush bar and scroll sync all
 * follow. The thin marker shows the viewport's true position across the FULL
 * session, including turns outside the window.
 */
export default function RangeBar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [barW, setBarW] = useState(0);

  const turns = useSessionStore((s) => s.turns);
  const chartWindow = useSessionStore((s) => s.chartWindow);
  const setChartWindow = useSessionStore((s) => s.setChartWindow);
  const dims = useChartStore((s) => s.dims);
  const resizeTick = useChartStore((s) => s.resizeTick);
  const viewFullLo = useChartStore((s) => s.viewFullLo);
  const viewFullHi = useChartStore((s) => s.viewFullHi);

  const N = turns.length;

  // Track the bar's pixel width to decide bar-vs-arrow rendering
  // (!!chartWindow: the .rangeBar div only exists when windowed — remeasure
  // when it first appears, not just on mount/resize)
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const measure = () => setBarW(el.clientWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [resizeTick, !!chartWindow]);

  // Mini overview: one segmented bar per turn over the FULL range
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || N === 0) return;

    const W = canvas.parentElement?.clientWidth ?? 400;
    const ctx = setupCanvas(canvas, W, BAR_H, DPR);
    const barW = Math.max(1, (W / N) * 0.6);
    const gap = W / N;

    let maxT = 0;
    for (const d of turns) {
      const t =
        (dims.input ? d.input : 0) +
        (dims.output ? d.output : 0) +
        (dims.cacheR ? d.cacheR : 0) +
        (dims.cacheC ? d.cacheC : 0);
      if (t > maxT) maxT = t;
    }
    if (!maxT) maxT = 1;

    for (let i = 0; i < N; i++) {
      const d = turns[i]!;
      const segs = getSegs(d, dims);
      const total = segs.reduce((s, x) => s + x.val, 0);
      if (total <= 0) continue;
      const h = (total / maxT) * (BAR_H - 2);
      let y = BAR_H;
      const cx = gap * (i + 0.5);
      for (const seg of segs) {
        const sh = (seg.val / total) * h;
        ctx.fillStyle = seg.col + '66';
        ctx.fillRect(cx - barW / 2, y - sh, barW, sh);
        y -= sh;
      }
    }
  }, [turns, dims, resizeTick]);

  const pctToTurn = useCallback(
    (pct: number) => Math.max(0, Math.min(N, Math.round(pct * N))),
    [N],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!chartWindow) return;
      e.preventDefault();
      lockBrushDriving();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const W = rect.width || 1;
      const startPct = (e.clientX - rect.left) / W;
      const startTurn = pctToTurn(startPct);

      // Snapshot of the window at press time. All drag math derives from THIS
      // plus the current pointer — never from an accumulated local copy, which
      // double-applies the shift and makes the window fly off.
      const orig = {start: chartWindow.start, end: chartWindow.end};
      const HANDLE_PX = 8;

      // Pick the drag mode by where the press landed
      const lPx = (orig.start / N) * W;
      const rPx = (orig.end / N) * W;
      const mode: 'L' | 'R' | 'M' | 'new' =
        Math.abs(e.clientX - rect.left - lPx) <= HANDLE_PX
          ? 'L'
          : Math.abs(e.clientX - rect.left - rPx) <= HANDLE_PX
            ? 'R'
            : startTurn >= orig.start && startTurn < orig.end
              ? 'M'
              : 'new';

      // Last value pushed to the store (dedup; the store also clamps)
      let lastStart = orig.start;
      let lastEnd = orig.end;
      // Whether the pointer actually moved (a bare click takes a different path in onUp)
      let moved = false;
      // Last pointer x seen during the drag (net direction at mouseup)
      let lastX = e.clientX;

      const apply = (sRaw: number, enRaw: number) => {
        let s = Math.round(sRaw);
        let en = Math.round(enRaw);
        // Clamp with a minimum width, honoring the mode's fixed anchor:
        // L keeps the right edge, R keeps the left edge, M/new clamp either way
        if (en - s < MIN_WINDOW_TURNS) {
          if (mode === 'L') s = en - MIN_WINDOW_TURNS;
          else if (mode === 'R' || mode === 'M') en = s + MIN_WINDOW_TURNS;
          else if (en > orig.end) s = en - MIN_WINDOW_TURNS;
          else en = s + MIN_WINDOW_TURNS;
        }
        // Upper bound: the window can never exceed MAX_CHART_TURNS — the
        // chart-space perf cap the windowing feature exists to enforce.
        // L keeps the right edge (pull the left edge in); the rest keep the
        // left edge. ('new' pre-caps by drag direction in onMove.)
        if (en - s > MAX_CHART_TURNS) {
          if (mode === 'L') s = en - MAX_CHART_TURNS;
          else en = s + MAX_CHART_TURNS;
        }
        // Boundary clamp that PRESERVES width: hitting either edge slides the
        // window flush against it instead of squashing it into a narrow sliver
        const w = en - s;
        if (s < 0) {
          s = 0;
          en = w;
        } else if (en > N) {
          en = N;
          s = N - w;
        }
        s = Math.max(0, Math.min(s, N - MIN_WINDOW_TURNS));
        en = Math.max(s + MIN_WINDOW_TURNS, Math.min(en, N));
        if (s !== lastStart || en !== lastEnd) {
          lastStart = s;
          lastEnd = en;
          setChartWindow(s, en);
        }
      };

      const onMove = (ev: MouseEvent) => {
        lockBrushDriving();
        // Click jitter guard: a 1-2px wiggle on mouse-down must NOT count as
        // a drag — it would apply(startTurn, startTurn), clamp to the 20-turn
        // minimum, and collapse the window to a narrow sliver. Same 3px
        // threshold as MainChart's drag.
        if (Math.abs(ev.clientX - e.clientX) < 3) return;
        moved = true;
        lastX = ev.clientX;
        const turn = pctToTurn((ev.clientX - rect.left) / W);
        if (mode === 'L') {
          apply(Math.min(turn, orig.end - MIN_WINDOW_TURNS), orig.end);
        } else if (mode === 'R') {
          apply(orig.start, Math.max(turn, orig.start + MIN_WINDOW_TURNS));
        } else if (mode === 'M') {
          const shift = turn - startTurn;
          apply(orig.start + shift, orig.end + shift);
        } else {
          const a = startTurn;
          let lo = Math.min(a, turn);
          let hi = Math.max(a, turn);
          if (hi - lo > MAX_CHART_TURNS) {
            // Cap the new selection at MAX_CHART_TURNS, anchored at the press
            // point: dragging right stops 750 past the press, dragging left
            // starts 750 before it
            if (turn >= a) hi = lo + MAX_CHART_TURNS;
            else lo = hi - MAX_CHART_TURNS;
          }
          apply(lo, hi);
        }
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);

        // Bare click (no drag) — jump directly to the click point:
        if (!moved) {
          if (mode === 'new') {
            // Clicked outside the window: translate the window (keeping its
            // width) so the click lands at its center, then fall through to
            // the standard realign below.
            const w = orig.end - orig.start;
            const s = Math.max(0, Math.min(startTurn - Math.floor(w / 2), N - w));
            setChartWindow(s, s + w);
          } else if (mode === 'M') {
            // Clicked inside the window: window stays, viewport jumps to the
            // clicked turn (scrollToTurnById syncs the brush itself).
            const chartIdx = startTurn - orig.start;
            if (chartIdx >= 0) scrollToChartTurn(chartIdx);
            return;
          } else {
            // Handle click without drag: no-op
            return;
          }
        }

        // Reset the brush (skipped during the drag to avoid restart-flashing
        // the 250ms bar animation every frame), then align the viewport.
        const {chartTurns, chartWindow: win, turns: allTurns} = useSessionStore.getState();
        // Wall-pin adaptation: when the window is flush against an edge and
        // the pointer kept dragging OUTWARD, the window couldn't follow — the
        // viewport's relative position moved toward the OPPOSITE side, so pin
        // brush + viewport there (right wall + rightward drag → left end).
        const pinnedAtRightWall = !!win && win.end >= allTurns.length && lastX - e.clientX > 0;
        if (pinnedAtRightWall) {
          useChartStore.getState().initBrushForTurnCount(chartTurns.length, undefined, 'left');
          scrollToChartTurn(0, 'top');
          return;
        }
        // Default: brush at the window's right end and the LAST turn aligned
        // BOTTOM (viewport stays inside the window; the range-bar marker never
        // crosses the selection's right edge).
        useChartStore.getState().initBrushForTurnCount(chartTurns.length);
        scrollToChartTurn(chartTurns.length - 1, 'bottom');
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [chartWindow, N, setChartWindow, pctToTurn],
  );

  if (!chartWindow) return null;

  const lPct = (chartWindow.start / N) * 100;
  const rPct = (chartWindow.end / N) * 100;
  const showMarker = viewFullLo >= 0 && viewFullHi >= 0;
  // TRUE width, no percent floor: a 0.5% floor is wider than a narrow
  // viewport's real span, so padding it (either direction) paints the marker
  // past the selection boundary on that side.
  const mLPct = (viewFullLo / Math.max(N, 1)) * 100;
  const mW = ((viewFullHi - viewFullLo) / Math.max(N, 1)) * 100;
  // When the true span collapses below a legible bar (a couple of turns),
  // switch to an upward-pointing arrow at the viewport CENTER — position
  // matters more than width there, and an arrow can't be misread as a range.
  const asPoint = barW > 0 && ((mW / 100) * barW) < 6;
  const mCPct = mLPct + mW / 2;

  return (
    <div className={styles.rangeBar} ref={overlayRef} onMouseDown={handleMouseDown}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {showMarker &&
        (asPoint ? (
          <div className={styles.viewportPoint} style={{left: `${mCPct}%`}}>
            ↑
          </div>
        ) : (
          <div className={styles.viewportMarker} style={{left: `${mLPct}%`, width: `${mW}%`}} />
        ))}
      <div className={styles.selection} style={{left: `${lPct}%`, width: `${Math.max(rPct - lPct, 0.5)}%`}} />
      <div className={styles.handleL} style={{left: `${lPct}%`}} />
      <div className={styles.handleR} style={{left: `${rPct}%`}} />
    </div>
  );
}
