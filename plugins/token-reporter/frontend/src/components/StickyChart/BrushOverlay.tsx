import {useRef, useCallback, useMemo, useEffect, useState} from 'react';
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
  const viewLoPct = useChartStore((s) => s.viewLoPct);
  const viewHiPct = useChartStore((s) => s.viewHiPct);
  const turns = useSessionStore((s) => s.turns);

  const overlayRef = useRef<HTMLDivElement>(null);
  const lastWheelTime = useRef<number>(0);
  const [overlayWidth, setOverlayWidth] = useState<number>(0);

  // Measure overlay width to match BrushChart canvas exactly
  useEffect(() => {
    const measure = () => {
      const parent = overlayRef.current?.parentElement;
      if (!parent) return;
      const canvas = parent.querySelector('canvas');
      const width = canvas ? canvas.clientWidth : parent.clientWidth;
      setOverlayWidth(width);
    };
    measure();
    window.addEventListener('resize', measure);
    // Also measure after a short delay to ensure canvas is rendered
    const timer = setTimeout(measure, 50);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, []);

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
      const {viewLoIdx: vLo, viewHiIdx: vHi} = useChartStore.getState();
      const Nm1 = Math.max(turns.length - 1, 1);
      const viewSpan = vLo >= 0 && vHi >= 0 ? (vHi - vLo) / Nm1 : 1 / Nm1;
      const minSpan = Math.max(viewSpan, 1 / Nm1);
      const maxSpan = 1;

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

      // Defer scroll until wheel stops — only scroll if viewport is outside new brush range
      const capturedL = newL;
      const capturedR = newR;
      const N = turns.length;
      if (N > 0) {
        deferScrollToTurn(() => {
          const {viewLoIdx, viewHiIdx} = useChartStore.getState();
          const Nm1 = Math.max(N - 1, 1);
          const vL = viewLoIdx / Nm1;
          const vR = viewHiIdx / Nm1;
          if (vL < capturedL) {
            scrollToTurnIndex(turns, Math.round(capturedL * Nm1));
          } else if (vR > capturedR) {
            scrollToTurnIndex(turns, Math.round(capturedR * Nm1), 'bottom');
          }
        });
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
        return overlayWidth > 0 ? overlayWidth : 400;
      };

      const onMove = (ev: MouseEvent) => {
        lockBrushDriving();
        const W = getOverlayWidth();
        const dx = (ev.clientX - startX) / W;
        const {viewLoIdx: vLo, viewHiIdx: vHi} = useChartStore.getState();
        const Nm1 = Math.max(N - 1, 1);
        const viewSpan = vLo >= 0 && vHi >= 0 ? (vHi - vLo) / Nm1 : 1 / Nm1;
        const minS = Math.max(viewSpan, 1 / Nm1);

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

        // Defer scroll until drag stops — if viewport partially outside brush
        deferScrollToTurn(() => {
          const {brushL: bL, brushR: bR, viewLoIdx, viewHiIdx} = useChartStore.getState();
          const Nm1 = Math.max(N - 1, 1);
          const vL = viewLoIdx / Nm1;
          const vR = viewHiIdx / Nm1;
          if (vR > bR) {
            // Viewport right edge beyond brush right — align viewport bottom to brush right edge
            scrollToTurnIndex(turns, Math.round(bR * Nm1), 'bottom');
          } else if (vL < bL) {
            // Viewport left edge before brush left — align viewport top to brush left edge
            scrollToTurnIndex(turns, Math.round(bL * Nm1));
          }
        });
      };

      const onUp = () => {
        if (styles.dragging) overlayRef.current?.classList.remove(styles.dragging);
        const {brushL: bL, brushR: bR, viewLoIdx, viewHiIdx} = useChartStore.getState();
        const Nm1 = Math.max(N - 1, 1);
        const vL = viewLoIdx / Nm1;
        const vR = viewHiIdx / Nm1;
        if (vR > bR) {
          scrollToTurnIndex(turns, Math.round(bR * Nm1), 'bottom');
        } else if (vL < bL) {
          scrollToTurnIndex(turns, Math.round(bL * Nm1));
        }
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

  // Viewport indicator: use precise percentage from scroll sync
  const viewLPct = viewLoPct * 100;
  const viewRPct = viewHiPct * 100;
  const viewWidth = viewRPct - viewLPct;
  const showViewport = viewLoIdx >= 0 && viewHiIdx >= 0 && turns.length > 0;

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
    <div ref={overlayRef} className={styles.brushOverlay} style={{width: overlayWidth > 0 ? overlayWidth : '100%'}} onWheel={handleWheel}>
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
