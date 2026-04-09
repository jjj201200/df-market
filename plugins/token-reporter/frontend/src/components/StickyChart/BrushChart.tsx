import {useRef, useEffect, useCallback} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import {DPR, getSegs, setupCanvas} from '../../utils/canvas';
import {scrollToTurnIndex} from './MainChart';
import {lockBrushDriving, deferScrollToTurn} from '../../hooks/useScrollSync';
import {pixelToBrushPct, brushToFirstIdx, brushToLastIdx} from '../../utils/brushCoords';
import styles from './BrushChart.module.scss';
const BAR_H = 32;
const CONV_LINE_GAP = 4;  // gap between bars and conversation lines
const CONV_LINE_H = 4;    // height of conversation line area
const BRUSH_H = BAR_H + CONV_LINE_GAP + CONV_LINE_H;
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
  const mutedColorRef = useRef<string>('#888');

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
      let y = BAR_H;
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

    // Draw conversation segment lines at bottom
    const lineY = BAR_H + CONV_LINE_GAP + CONV_LINE_H / 2;
    const lineColor = mutedColorRef.current;
    const {viewLoPct, viewHiPct} = useChartStore.getState();
    const Nm1 = Math.max(N - 1, 1);
    // Convert viewport pct to continuous index (fractional), using midpoint between turns as boundary
    const viewLoF = viewLoPct * Nm1;
    const viewHiF = viewHiPct * Nm1;

    ctx.lineCap = 'round';

    let convStart = 0;
    for (let i = 1; i <= N; i++) {
      const isNewConv = i < N && (turns[i]!.user || '').trim().length > 0;
      if (isNewConv || i === N) {
        const convEnd = i - 1;
        const x1 = gap * (convStart + 0.5) - barW / 2;
        const x2 = gap * (convEnd + 0.5) + barW / 2;

        // Highlight if viewport overlaps this conversation range
        // Use midpoints between turns as boundaries: turn i occupies [i-0.5, i+0.5]
        const rangeLoF = convStart - 0.5;
        const rangeHiF = convEnd + 0.5;
        const overlaps = rangeHiF > viewLoF && rangeLoF < viewHiF;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = overlaps ? 0.8 : 0.25;

        ctx.beginPath();
        ctx.moveTo(x1, lineY);
        ctx.lineTo(x2, lineY);
        ctx.stroke();
        convStart = i;
      }
    }
    ctx.globalAlpha = 1;
  }, [turns, hoveredId]);

  // Animate bar heights when data or dims change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;

    const N = turns.length;
    const rootStyle = getComputedStyle(document.documentElement);
    accentColorRef.current = rootStyle.getPropertyValue('--accent').trim() || '#3b82f6';
    mutedColorRef.current = rootStyle.getPropertyValue('--fg-muted').trim() || '#888';

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
      const height = total > 0 ? (total / maxT) * (BAR_H - 2) : 0;
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

  // Redraw when viewport range changes (without causing component re-render)
  useEffect(() => {
    let prevLo = useChartStore.getState().viewLoIdx;
    let prevHi = useChartStore.getState().viewHiIdx;
    return useChartStore.subscribe((s) => {
      if (s.viewLoIdx !== prevLo || s.viewHiIdx !== prevHi) {
        prevLo = s.viewLoIdx;
        prevHi = s.viewHiIdx;
        drawBars();
      }
    });
  }, [drawBars]);

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
      scrollToTurnIndex(turns, brushToFirstIdx(newL, N));
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
      const N = turns.length;
      if (N > 0) {
        deferScrollToTurn(() => {
          const {brushL: bL, brushR: bR, viewLoPct: vL, viewHiPct: vR} = useChartStore.getState();
          if (vL < bL) {
            scrollToTurnIndex(turns, brushToFirstIdx(bL, N));
          } else if (vR > bR) {
            scrollToTurnIndex(turns, brushToLastIdx(bR, N), 'bottom');
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
