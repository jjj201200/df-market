import {useRef, useCallback, useMemo} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import {scrollToTurnIndex} from './MainChart';
import {lockBrushDriving, deferScrollToTurn} from '../../hooks/useScrollSync';
import styles from './BrushOverlay.module.scss';

const ZOOM_FACTOR = 0.05; // 5% zoom per wheel tick
const WHEEL_THROTTLE_MS = 80; // Throttle to prevent inertial scroll bursts

export default function BrushOverlay() {
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);
  const setBrush = useChartStore((s) => s.setBrush);
  const viewLoIdx = useChartStore((s) => s.viewLoIdx);
  const viewHiIdx = useChartStore((s) => s.viewHiIdx);
  const turns = useSessionStore((s) => s.turns);

  const overlayRef = useRef<HTMLDivElement>(null);
  const lastWheelTime = useRef<number>(0);

  // Zoom towards mouse position (like map zoom, throttled)
  // When already at min span, pans towards mouse instead
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Throttle: ignore events too close together (inertial scrolling)
      const now = Date.now();
      if (now - lastWheelTime.current < WHEEL_THROTTLE_MS) return;
      lastWheelTime.current = now;

      lockBrushDriving();

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width; // 0-1 position under mouse

      const span = brushR - brushL;
      const minSpan = 0.02; // Minimum 2% of total range
      const maxSpan = 1; // Maximum 100%

      // Determine zoom direction: negative deltaY = zoom in (scroll up), positive = zoom out
      const zoomIn = e.deltaY < 0;
      const factor = zoomIn ? 1 - ZOOM_FACTOR : 1 + ZOOM_FACTOR;

      let newSpan = span * factor;
      newSpan = Math.max(minSpan, Math.min(maxSpan, newSpan));

      let newL: number;
      let newR: number;

      if (span <= minSpan * 1.01 && zoomIn) {
        // Already at minimum span: pan towards mouse position gradually
        const panStep = 0.02; // 2% per tick, slower pan
        const halfSpan = minSpan / 2;
        const center = (brushL + brushR) / 2;

        // Calculate target center (clamped to valid range)
        let targetCenter = mouseX;
        if (targetCenter < halfSpan) targetCenter = halfSpan;
        else if (targetCenter > 1 - halfSpan) targetCenter = 1 - halfSpan;

        // Move one step towards target
        const diff = targetCenter - center;
        let newCenter = center + Math.sign(diff) * Math.min(Math.abs(diff), panStep);

        newL = newCenter - halfSpan;
        newR = newCenter + halfSpan;
      } else {
        // Normal zoom towards mouse position
        // The point under mouse should stay at the same relative position
        const ratio = newSpan / span;
        newL = mouseX - (mouseX - brushL) * ratio;
        newR = newL + newSpan;

        // Clamp to valid range
        if (newL < 0) {
          newR -= newL;
          newL = 0;
        }
        if (newR > 1) {
          newL -= newR - 1;
          newR = 1;
        }
      }

      setBrush(newL, newR);

      // Defer scroll until wheel stops — prevents dialog jitter during zoom
      const finalL = newL;
      const N = turns.length;
      if (N > 0) {
        deferScrollToTurn(() => scrollToTurnIndex(turns, Math.round(finalL * (N - 1))));
      }
    },
    [brushL, brushR, setBrush, turns],
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, type: 'L' | 'R' | 'M') => {
      e.preventDefault();
      e.stopPropagation();
      lockBrushDriving();
      if (styles.dragging) overlayRef.current?.classList.add(styles.dragging);

      const startX = e.clientX;
      const startL = brushL;
      const startR = brushR;
      const N = turns.length;

      const getOverlayWidth = (): number => {
        const parent = overlayRef.current?.parentElement;
        if (!parent) return 400;
        // BrushChart canvas sibling width
        const canvas = parent.querySelector('canvas');
        return canvas ? canvas.clientWidth : parent.clientWidth - 2;
      };

      const onMove = (ev: MouseEvent) => {
        lockBrushDriving();
        const W = getOverlayWidth();
        const dx = (ev.clientX - startX) / W;
        const minS = 1 / Math.max(N, 1);

        if (type === 'L') {
          const newL = Math.max(0, Math.min(startL + dx, startR - minS));
          setBrush(newL, startR);
        } else if (type === 'R') {
          const newR = Math.min(1, Math.max(startR + dx, startL + minS));
          setBrush(startL, newR);
        } else {
          const sp = startR - startL;
          const newL = Math.max(0, Math.min(startL + dx, 1 - sp));
          setBrush(newL, newL + sp);
        }

        // Defer scroll until drag stops to prevent jitter
        const currentL = useChartStore.getState().brushL;
        deferScrollToTurn(() => scrollToTurnIndex(turns, Math.round(currentL * (N - 1))));
      };

      const onUp = () => {
        if (styles.dragging) overlayRef.current?.classList.remove(styles.dragging);
        // Scroll immediately on mouse up
        const currentL = useChartStore.getState().brushL;
        scrollToTurnIndex(turns, Math.round(currentL * (N - 1)));
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [brushL, brushR, setBrush, turns],
  );

  // Compute pixel positions. The overlay width matches the brush canvas.
  // We use percentage-based positioning so it works without knowing the exact width.
  const lPct = brushL * 100;
  const rPct = brushR * 100;
  const selWidth = rPct - lPct;

  // Viewport indicator: map visible turn indices to brush-chart percentage
  const N = turns.length;
  const viewLPct = N > 1 ? (viewLoIdx / (N - 1)) * 100 : 0;
  const viewRPct = N > 1 ? (viewHiIdx / (N - 1)) * 100 : 100;
  const viewWidth = viewRPct - viewLPct;
  const showViewport = viewLoIdx >= 0 && viewHiIdx >= 0 && N > 0;

  // Label for visible turns
  const viewLabel = useMemo(() => {
    if (!showViewport) return '';
    const first = turns[viewLoIdx];
    const last = turns[viewHiIdx];
    if (!first || !last) return '';
    if (first.id === last.id) return `#${first.id}`;
    return `#${first.id}–#${last.id}`;
  }, [showViewport, turns, viewLoIdx, viewHiIdx]);

  return (
    <div ref={overlayRef} className={styles.brushOverlay} style={{width: '100%'}} onWheel={handleWheel}>
      {/* Viewport indicator (visible turns) */}
      {showViewport && (
        <div className={styles.viewportIndicator} style={{left: `${viewLPct}%`, width: `${Math.max(viewWidth, 0.5)}%`}}>
          {viewLabel && <span className={styles.viewportLabel}>{viewLabel}</span>}
        </div>
      )}
      {/* Selection highlight */}
      <div className={styles.brushSelection} style={{left: `${lPct}%`, width: `${selWidth}%`}} />
      {/* Left handle */}
      <div className={styles.brushHandle} style={{left: `${lPct}%`}} onMouseDown={(e) => startDrag(e, 'L')} />
      {/* Right handle */}
      <div className={styles.brushHandle} style={{left: `${rPct}%`}} onMouseDown={(e) => startDrag(e, 'R')} />
      {/* Move area */}
      <div
        className={styles.brushMoveArea}
        style={{left: `${lPct}%`, width: `${selWidth}%`}}
        onMouseDown={(e) => startDrag(e, 'M')}
      />
    </div>
  );
}
