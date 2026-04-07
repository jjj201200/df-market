import { TURNS, N, brushL, brushR, hoveredId, DPR, dims } from "./state.js";
import { fmt, getSegs, setupCanvas } from "./utils.js";

let barRects = [];

export function getBarRects() {
  return barRects;
}

export function drawMainChart() {
  if (N === 0) return;
  const canvas = document.getElementById("mainChart");
  const W = canvas.parentElement.clientWidth - 2;
  const H = 120;
  const ctx = setupCanvas(canvas, W, H, DPR);

  const lo = Math.round(brushL * (N - 1));
  const hi = Math.round(brushR * (N - 1));
  const vis = TURNS.slice(lo, hi + 1);
  const M = vis.length;

  const PL = 36, PR = 8, PT = 12, PB = 20;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  let maxT = 0;
  vis.forEach((d) => {
    const t =
      (dims.input ? d.input : 0) +
      (dims.output ? d.output : 0) +
      (dims.cacheR ? d.cacheR : 0) +
      (dims.cacheC ? d.cacheC : 0);
    if (t > maxT) maxT = t;
  });
  if (!maxT) maxT = 1;

  // Grid + y-axis labels
  ctx.strokeStyle = "#21262d";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = PT + plotH - (i / 3) * plotH;
    ctx.beginPath();
    ctx.moveTo(PL, y);
    ctx.lineTo(W - PR, y);
    ctx.stroke();
    ctx.fillStyle = "#484f58";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(fmt((maxT * i) / 3), PL - 3, y + 3);
  }

  barRects = [];
  const barW = Math.min(28, (plotW / M) * 0.65);
  const gap = plotW / M;

  vis.forEach((d, i) => {
    const cx = PL + gap * (i + 0.5);
    const segs = getSegs(d);
    const total = segs.reduce((s, x) => s + x.val, 0);
    const barH = (total / maxT) * plotH;
    const isHov = hoveredId === d.id;

    if (isHov) {
      ctx.save();
      ctx.shadowColor = "rgba(88,166,255,0.9)";
      ctx.shadowBlur = 5;
    }

    const bW = isHov ? barW + 2 : barW;

    let y = PT + plotH;
    segs.forEach((seg) => {
      const sh = (seg.val / total) * barH;
      ctx.fillStyle = isHov
        ? seg.col + "ff"
        : seg.col + (dims.input ? "cc" : "66");
      ctx.fillRect(cx - bW / 2, y - sh, bW, sh);
      y -= sh;
    });

    if (isHov) ctx.restore();

    barRects.push({
      id: d.id,
      x: cx - barW / 2,
      y: PT + plotH - barH,
      w: barW,
      h: barH,
    });
  });

  // ── Time axis ──
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
  let timeFmt = "HH:MM";
  if (firstTs && lastTs) {
    const spanMs = new Date(lastTs) - new Date(firstTs);
    if (spanMs < 60000) timeFmt = "HH:MM:SS";
    else if (spanMs > 86400000) timeFmt = "MM-DD HH:MM";
  }

  function fmtTs(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    if (timeFmt === "HH:MM:SS") return `${hh}:${mm}:${ss}`;
    if (timeFmt === "MM-DD HH:MM") return `${mo}-${dd} ${hh}:${mm}`;
    return `${hh}:${mm}`;
  }

  ctx.fillStyle = "#484f58";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 0.5;

  for (let i = 0; i < M; i += step) {
    const d = vis[i];
    const cx = PL + gap * (i + 0.5);
    ctx.beginPath();
    ctx.moveTo(cx, PT + plotH);
    ctx.lineTo(cx, PT + plotH + 3);
    ctx.stroke();
    ctx.fillText(fmtTs(d.timestamp), cx, H - 3);
  }

  const lastCx = PL + gap * (M - 0.5);
  const prevTickCx = PL + gap * (Math.floor((M - 1) / step) * step + 0.5);
  if (lastCx - prevTickCx > 40) {
    ctx.fillText(fmtTs(vis[M - 1]?.timestamp), lastCx, H - 3);
  }

  // Update summary
  let tIn = 0, tOut = 0, tCR = 0, tCC = 0;
  vis.forEach((d) => {
    tIn += d.input;
    tOut += d.output;
    tCR += d.cacheR;
    tCC += d.cacheC;
  });
  document.getElementById("tot-in").textContent = fmt(tIn);
  document.getElementById("tot-out").textContent = fmt(tOut);
  document.getElementById("tot-cr").textContent = fmt(tCR);
  document.getElementById("tot-cc").textContent = fmt(tCC);
  document.getElementById("tot-turns").textContent = vis.length;
  document.getElementById("rangeLabel").textContent =
    `Request #${vis[0].id} – #${vis[vis.length - 1].id}`;
}

export function drawBrushChart() {
  if (N === 0) return;
  const canvas = document.getElementById("brushChart");
  const W = canvas.parentElement.clientWidth - 2;
  const H = 32;
  const ctx = setupCanvas(canvas, W, H, DPR);

  let maxT = 0;
  TURNS.forEach((d) => {
    const t = d.input + d.output + d.cacheR + d.cacheC;
    if (t > maxT) maxT = t;
  });
  const barW = Math.max(2, (W / N) * 0.6);
  const gap = W / N;
  TURNS.forEach((d, i) => {
    const cx = gap * (i + 0.5);
    const segs = getSegs(d);
    const total = segs.reduce((s, x) => s + x.val, 0);
    const bH = (total / maxT) * (H - 2);
    let y = H;
    segs.forEach((seg) => {
      const sh = (seg.val / total) * bH;
      ctx.fillStyle = seg.col + "77";
      ctx.fillRect(cx - barW / 2, y - sh, barW, sh);
      y -= sh;
    });
  });
  updateBrushOverlay(W);
}

export function updateBrushOverlay(W) {
  if (!W) {
    const c = document.getElementById("brushChart");
    W = c.parentElement.clientWidth - 2;
  }
  const ov = document.getElementById("brushOverlay");
  ov.style.width = W + "px";
  ov.style.left = "0";
  const lx = brushL * W;
  const rx = brushR * W;
  document.getElementById("brushSel").style.cssText =
    `left:${lx}px;width:${rx - lx}px`;
  document.getElementById("handleL").style.left = lx + "px";
  document.getElementById("handleR").style.left = rx + "px";
  document.getElementById("brushMove").style.cssText =
    `left:${lx}px;width:${rx - lx}px`;
}
