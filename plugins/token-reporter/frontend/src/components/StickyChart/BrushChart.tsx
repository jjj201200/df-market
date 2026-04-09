import {useRef, useEffect, useCallback} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import {DPR, getSegs, setupCanvas} from '../../utils/canvas';
import {scrollToTurnIndex} from './MainChart';
import {lockBrushDriving, deferScrollToTurn} from '../../hooks/useScrollSync';
import {pixelToBrushPct} from '../../utils/brushCoords';
import styles from './BrushChart.module.scss';
const BRUSH_H = 32;
const ZOOM_FACTOR = 0.05;
const WHEEL_THROTTLE_MS = 80; // 节流间隔，防止惯性滚动触发过快
const ANIM_DURATION = 250; // ms

interface BarState {
  height: number;
  segs: {key: string; ratio: number; col: string}[];
}

export default function BrushChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWheelTime = useRef<number>(0);
  const turns = useSessionStore((s) => s.turns);
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);
  const dims = useChartStore((s) => s.dims);
  const setBrush = useChartStore((s) => s.setBrush);
  const resizeTick = useChartStore((s) => s.resizeTick);
  const hoveredId = useChartStore((s) => s.hoveredId);

  // Animation state persisted across renders
  const currentBars = useRef<BarState[]>([]);
  const animFrameRef = useRef<number>(0);
  const accentColorRef = useRef<string>('#3b82f6');

  // Shared draw function: renders bars using currentBars heights
  const drawBars = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;

    const N = turns.length;
    const parentW = canvas.parentElement?.clientWidth ?? 400;
    const W = parentW;
    const ctx = setupCanvas(canvas, W, BRUSH_H, DPR);
    const barW = Math.max(2, (W / N) * 0.6);
    const gap = W / N;
    const hIdx = hoveredId !== null ? turns.findIndex((turn) => turn.id === hoveredId) : -1;

    for (let i = 0; i < N; i++) {
      const bar = currentBars.current[i];
      if (!bar || bar.height <= 0) continue;

      const cx = gap * (i + 0.5);
      let y = BRUSH_H;
      const isHovered = i === hIdx;

      if (isHovered) {
        ctx.save();
        ctx.shadowColor = accentColorRef.current;
        ctx.shadowBlur = 8;
      }

      for (const seg of bar.segs) {
        const sh = seg.ratio * bar.height;
        ctx.fillStyle = isHovered ? seg.col + 'ff' : seg.col + '77';
        ctx.fillRect(cx - barW / 2, y - sh, barW, sh);
        y -= sh;
      }

      if (isHovered) {
        ctx.restore();
      }
    }
  }, [turns, hoveredId]);

  // Animate bar heights when data or dims change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;

    const N = turns.length;
    accentColorRef.current = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';

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

    const targetBars: BarState[] = turns.map((d) => {
      const segs = getSegs(d, dims);
      const total = segs.reduce((s, x) => s + x.val, 0);
      const height = total > 0 ? (total / maxT) * (BRUSH_H - 2) : 0;
      const segRatios = total > 0
        ? segs.map((seg) => ({key: seg.key, ratio: seg.val / total, col: seg.col}))
        : [];
      return {height, segs: segRatios};
    });

    // Initialize if empty or length changed — no animation
    if (currentBars.current.length !== N) {
      currentBars.current = targetBars.map((b) => ({...b}));
      drawBars();
      return;
    }

    const startBars = currentBars.current.map((b) => ({...b}));
    const startTime = performance.now();

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / ANIM_DURATION, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      currentBars.current = startBars.map((s, i) => {
        const target = targetBars[i]!;
        return {
          height: s.height + (target.height - s.height) * ease,
          segs: target.segs.length > 0 ? target.segs : s.segs,
        };
      });

      drawBars();

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [turns, dims, resizeTick, drawBars]);

  // Instant redraw on hover change — no animation
  useEffect(() => {
    drawBars();
  }, [hoveredId, drawBars]);

  // Click handler: center brush at click position
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const N = turns.length;
      if (N === 0) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const ratioRaw = (e.clientX - rect.left) / rect.width;
      const ratio = pixelToBrushPct(ratioRaw, N);
      const span = brushR - brushL;
      let newL = ratio - span / 2;
      newL = Math.max(0, Math.min(newL, 1 - span));
      setBrush(newL, newL + span);
      scrollToTurnIndex(turns, Math.round(newL * (N - 1)));
    },
    [turns, brushL, brushR, setBrush],
  );

  // Wheel handler: zoom towards mouse position (throttled)
  // When already at min span, pans towards mouse instead
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Throttle: ignore events too close together (inertial scrolling)
      const now = Date.now();
      if (now - lastWheelTime.current < WHEEL_THROTTLE_MS) return;
      lastWheelTime.current = now;

      lockBrushDriving();

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const mouseXRaw = (e.clientX - rect.left) / rect.width;
      const mouseX = pixelToBrushPct(mouseXRaw, turns.length);

      const span = brushR - brushL;
      const {viewLoIdx: vLo, viewHiIdx: vHi} = useChartStore.getState();
      const Nm1 = Math.max(turns.length - 1, 1);
      const viewSpan = vLo >= 0 && vHi >= 0 ? (vHi - vLo) / Nm1 : 1 / Nm1;
      const minSpan = Math.max(viewSpan, 1 / Nm1);
      const maxSpan = 1;

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
          const {viewLoPct: vL, viewHiPct: vR} = useChartStore.getState();
          const Nm1 = Math.max(N - 1, 1);
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

  return (
    <div ref={containerRef} className={styles.brushChartContainer} onWheel={handleWheel}>
      <canvas ref={canvasRef} className={styles.brushChart} onClick={handleClick} />
    </div>
  );
}
