import {useRef, useEffect, useCallback} from 'react';
import {useChartStore} from '../../stores/chartStore';
import {useSessionStore} from '../../stores/sessionStore';
import {fmt} from '../../utils/format';
import {DPR, getSegs, setupCanvas} from '../../utils/canvas';
import type {TurnItem, BarRect} from '../../types/state';
import {lockBrushDriving, deferScrollToTurn} from '../../hooks/useScrollSync';
import {brushToFirstIdx, brushToLastIdx} from '../../utils/brushCoords';
import {scrollToTurnIndex} from '../../utils/scroll';
import styles from './MainChart.module.scss';

const ANIM_DURATION = 250; // ms

interface BarState {
  height: number;
  segs: {key: string; ratio: number; col: string}[];
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const H = 120;
const PL = 36;
const PR = 8;
const PT = 12;
const PB = 20;

function fmtTs(ts: string | undefined, timeFmt: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (timeFmt === 'HH:MM:SS') return `${hh}:${mm}:${ss}`;
  if (timeFmt === 'MM-DD HH:MM') return `${mo}-${dd} ${hh}:${mm}`;
  return `${hh}:${mm}`;
}

export default function MainChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startL: 0,
    startR: 0,
  });

  const turns = useSessionStore((s) => s.turns);
  const brushL = useChartStore((s) => s.brushL);
  const brushR = useChartStore((s) => s.brushR);
  const hoveredId = useChartStore((s) => s.hoveredId);
  const dims = useChartStore((s) => s.dims);
  const setBrush = useChartStore((s) => s.setBrush);
  const setHovered = useChartStore((s) => s.setHovered);
  const setBarRects = useChartStore((s) => s.setBarRects);
  const resizeTick = useChartStore((s) => s.resizeTick);

  // Animation state persisted across renders
  const currentBars = useRef<BarState[]>([]);
  const animFrameRef = useRef<number>(0);
  // Ref for hoveredId to avoid re-creating drawBars on hover change
  const hoveredIdRef = useRef(hoveredId);
  hoveredIdRef.current = hoveredId;

  // Shared draw function: renders bars using currentBars heights
  const drawBars = useCallback(
    (maxT: number, vis: TurnItem[], M: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const hovered = hoveredIdRef.current;

      const parentW = canvas.parentElement?.clientWidth ?? 400;
      const W = parentW;
      const ctx = setupCanvas(canvas, W, H, DPR);

      const plotW = W - PL - PR;
      const plotH = H - PT - PB;

      // Grid + y-axis labels
      ctx.strokeStyle = getCSSVar('--chart-grid');
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 3; i++) {
        const y = PT + plotH - (i / 3) * plotH;
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(W - PR, y);
        ctx.stroke();
        ctx.fillStyle = getCSSVar('--chart-label');
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(fmt((maxT * i) / 3), PL - 3, y + 3);
      }

      // Draw bars
      const rects: BarRect[] = [];
      const barW = Math.min(28, (plotW / M) * 0.65);
      const gap = plotW / M;

      for (let i = 0; i < M; i++) {
        const d = vis[i]!;
        const bar = currentBars.current[i];
        if (!bar || bar.height <= 0) continue;

        const cx = PL + gap * (i + 0.5);
        const isHov = hovered === d.id;

        if (isHov) {
          ctx.save();
          ctx.shadowColor = getCSSVar('--chart-glow');
          ctx.shadowBlur = 5;
        }

        const bW = isHov ? barW + 2 : barW;
        let y = PT + plotH;

        for (const seg of bar.segs) {
          const sh = seg.ratio * bar.height;
          ctx.fillStyle = isHov ? seg.col + 'ff' : seg.col + 'cc';
          ctx.fillRect(cx - bW / 2, y - sh, bW, sh);
          y -= sh;
        }

        if (isHov) ctx.restore();

        rects.push({
          id: d.id,
          x: cx - barW / 2,
          y: PT + plotH - bar.height,
          w: barW,
          h: bar.height,
        });
      }

      // Time axis
      const targetTickPx = 100;
      const rawStep = Math.ceil(M / (plotW / targetTickPx));
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      let step = magnitude;
      for (const f of [1, 2, 5, 10]) {
        if (magnitude * f >= rawStep) {
          step = magnitude * f;
          break;
        }
      }
      if (step < 1) step = 1;

      const firstTs = vis[0]?.timestamp;
      const lastTs = vis[vis.length - 1]?.timestamp;
      let timeFmtStr = 'HH:MM';
      if (firstTs && lastTs) {
        const spanMs = new Date(lastTs).getTime() - new Date(firstTs).getTime();
        if (spanMs < 60000) timeFmtStr = 'HH:MM:SS';
        else if (spanMs > 86400000) timeFmtStr = 'MM-DD HH:MM';
      }

      ctx.fillStyle = getCSSVar('--chart-label');
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = getCSSVar('--chart-axis');
      ctx.lineWidth = 0.5;

      for (let i = 0; i < M; i += step) {
        const d = vis[i]!;
        const cx = PL + gap * (i + 0.5);
        ctx.beginPath();
        ctx.moveTo(cx, PT + plotH);
        ctx.lineTo(cx, PT + plotH + 3);
        ctx.stroke();
        ctx.fillText(fmtTs(d.timestamp, timeFmtStr), cx, H - 3);
      }

      const lastCx = PL + gap * (M - 0.5);
      const prevTickCx = PL + gap * (Math.floor((M - 1) / step) * step + 0.5);
      if (lastCx - prevTickCx > 40) {
        ctx.fillText(fmtTs(vis[M - 1]?.timestamp, timeFmtStr), lastCx, H - 3);
      }

      setBarRects(rects);
    },
    [setBarRects],
  );

  // Animate bar heights when data or brush changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;

    const N = turns.length;
    const lo = brushToFirstIdx(brushL, N);
    const hi = brushToLastIdx(brushR, N);
    const vis = turns.slice(lo, hi + 1);
    const M = vis.length;
    if (M === 0) return;

    const plotH = H - PT - PB;

    // Calculate max token sum for visible turns
    let maxT = 0;
    for (const d of vis) {
      const t =
        (dims.input ? d.input : 0) +
        (dims.output ? d.output : 0) +
        (dims.cacheR ? d.cacheR : 0) +
        (dims.cacheC ? d.cacheC : 0);
      if (t > maxT) maxT = t;
    }
    if (!maxT) maxT = 1;

    const targetBars: BarState[] = vis.map((d) => {
      const segs = getSegs(d, dims);
      const total = segs.reduce((s, x) => s + x.val, 0);
      const height = total > 0 ? (total / maxT) * plotH : 0;
      const segRatios = total > 0 ? segs.map((seg) => ({key: seg.key, ratio: seg.val / total, col: seg.col})) : [];
      return {height, segs: segRatios};
    });

    // Initialize if empty or length changed — no animation
    if (currentBars.current.length !== M) {
      currentBars.current = targetBars.map((b) => ({...b}));
      drawBars(maxT, vis, M);
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

      drawBars(maxT, vis, M);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [turns, brushL, brushR, dims, resizeTick, drawBars]);

  // Instant redraw on hover change — no animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || turns.length === 0) return;

    const N = turns.length;
    const lo = brushToFirstIdx(brushL, N);
    const hi = brushToLastIdx(brushR, N);
    const vis = turns.slice(lo, hi + 1);
    const M = vis.length;
    if (M === 0) return;

    let maxT = 0;
    for (const d of vis) {
      const t =
        (dims.input ? d.input : 0) +
        (dims.output ? d.output : 0) +
        (dims.cacheR ? d.cacheR : 0) +
        (dims.cacheC ? d.cacheC : 0);
      if (t > maxT) maxT = t;
    }
    if (!maxT) maxT = 1;

    drawBars(maxT, vis, M);
  }, [hoveredId, turns, brushL, brushR, dims, drawBars]);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startL: brushL,
        startR: brushR,
      };
      if (styles.dragging) canvasRef.current?.classList.add(styles.dragging);
      lockBrushDriving();

      const onMove = (ev: MouseEvent) => {
        const dr = dragRef.current;
        if (!dr.active) return;
        lockBrushDriving();
        const dx = ev.clientX - dr.startX;
        if (Math.abs(dx) > 3) dr.moved = true;
        if (!dr.moved) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = canvas.clientWidth;
        const span = dr.startR - dr.startL;
        const offset = -(dx / W) * span;
        const newL = Math.max(0, Math.min(dr.startL + offset, 1 - span));
        setBrush(newL, newL + span);
        const N = turns.length;
        deferScrollToTurn(() => {
          const {brushL: bL, brushR: bR, viewLoPct: vL, viewHiPct: vR} = useChartStore.getState();
          if (vL < bL) {
            scrollToTurnIndex(turns, brushToFirstIdx(bL, N));
          } else if (vR > bR) {
            scrollToTurnIndex(turns, brushToLastIdx(bR, N), 'bottom');
          }
        });
      };

      const onUp = () => {
        dragRef.current.active = false;
        if (styles.dragging) canvasRef.current?.classList.remove(styles.dragging);
        const N = turns.length;
        const {brushL: bL, brushR: bR, viewLoPct: vL, viewHiPct: vR} = useChartStore.getState();
        if (vL < bL) {
          scrollToTurnIndex(turns, brushToFirstIdx(bL, N));
        } else if (vR > bR) {
          scrollToTurnIndex(turns, brushToLastIdx(bR, N), 'bottom');
        }
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [brushL, brushR, setBrush, turns],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragRef.current.moved) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const barRects = useChartStore.getState().barRects;
      for (const br of barRects) {
        if (mx >= br.x && mx <= br.x + br.w && my >= br.y && my <= br.y + br.h) {
          const idx = turns.findIndex((t) => t.id === br.id);
          scrollToTurnIndex(turns, idx);
          break;
        }
      }
    },
    [turns],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragRef.current.active) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const barRects = useChartStore.getState().barRects;
      let found: number | null = null;
      for (const br of barRects) {
        if (mx >= br.x && mx <= br.x + br.w && my >= br.y && my <= br.y + br.h) {
          found = br.id;
          break;
        }
      }
      const current = useChartStore.getState().hoveredId;
      if (found !== current) {
        setHovered(found);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = found ? 'pointer' : 'grab';
        }
      }
    },
    [setHovered],
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
  }, [setHovered]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.mainChart}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
