import { dims, COLORS } from "./state.js";

export function fmt(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n || 0);
}

export function fmtF(n) {
  return (n || 0).toLocaleString();
}

export function escHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getSegs(d) {
  const s = [];
  if (dims.input && d.input)
    s.push({ key: "input", val: d.input, col: COLORS.input });
  if (dims.output && d.output)
    s.push({ key: "output", val: d.output, col: COLORS.output });
  if (dims.cacheR && d.cacheR)
    s.push({ key: "cacheR", val: d.cacheR, col: COLORS.cacheR });
  if (dims.cacheC && d.cacheC)
    s.push({ key: "cacheC", val: d.cacheC, col: COLORS.cacheC });
  return s;
}

export function setupCanvas(canvas, w, h, dpr) {
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

export function parseDur(s) {
  if (!s) return 0;
  return parseInt(s.replace(/,/g, "")) || 0;
}

export function parseSize(s) {
  if (!s || s === "—") return 0;
  const m = s.match(/([\d.]+)\s*(KB|B)?/i);
  if (!m) return 0;
  return m[2] && m[2].toUpperCase() === "KB"
    ? parseFloat(m[1]) * 1024
    : parseFloat(m[1]);
}

export function fmtDur(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms + "ms";
}

export function fmtBytes(b) {
  return b >= 1024 ? (b / 1024).toFixed(1) + " KB" : b.toFixed(0) + " B";
}
