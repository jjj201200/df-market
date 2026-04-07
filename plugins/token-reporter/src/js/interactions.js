import * as state from "./state.js";
import { TURNS, N, brushL, brushR, dims, setBrush, setHovered } from "./state.js";
import { drawMainChart, drawBrushChart, updateBrushOverlay, getBarRects } from "./chart.js";

// ── Scroll ↔ Brush sync state ──
let _suppressScrollObserver = false;
let _suppressScrollTimer = null;
let _scrollListenerRegistered = false;

export function scrollToTurnIndex(idx) {
  const t = TURNS[Math.max(0, Math.min(idx, TURNS.length - 1))];
  if (!t) return;
  const el = document.getElementById("turn-" + t.id);
  if (!el) return;
  const stickyH = document.getElementById("stickyChart")?.offsetHeight || 0;
  const top = el.getBoundingClientRect().top + window.scrollY - stickyH - 8;
  _suppressScrollObserver = true;
  clearTimeout(_suppressScrollTimer);
  const onScroll = () => {
    clearTimeout(_suppressScrollTimer);
    _suppressScrollTimer = setTimeout(() => {
      _suppressScrollObserver = false;
      window.removeEventListener("scroll", onScroll, { passive: true });
    }, 120);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  _suppressScrollTimer = setTimeout(() => {
    _suppressScrollObserver = false;
    window.removeEventListener("scroll", onScroll, { passive: true });
  }, 2000);
  window.scrollTo({ top, behavior: "smooth" });
}

function moveBrushCenter(centerRatio) {
  const span = brushR - brushL;
  let newL = centerRatio - span / 2;
  newL = Math.max(0, Math.min(newL, 1 - span));
  setBrush(newL, newL + span);
}

function getVisibleTurnRange() {
  const stickyH = document.getElementById("stickyChart")?.offsetHeight || 0;
  const viewTop = window.scrollY + stickyH;
  const viewBottom = window.scrollY + window.innerHeight;
  let loIdx = -1, hiIdx = -1;
  for (let i = 0; i < TURNS.length; i++) {
    const el = document.getElementById("turn-" + TURNS[i].id);
    if (!el) continue;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (bottom > viewTop && top < viewBottom) {
      if (loIdx < 0) loIdx = i;
      hiIdx = i;
    }
  }
  return { loIdx, hiIdx };
}

function onPageScroll() {
  if (_suppressScrollObserver) return;
  if (N === 0) return;
  const { loIdx, hiIdx } = getVisibleTurnRange();
  if (loIdx < 0) return;
  const centerRatio = (loIdx + hiIdx) / 2 / Math.max(N - 1, 1);
  moveBrushCenter(centerRatio);
  updateBrushOverlay();
  drawBrushChart();
  drawMainChart();
}

export function initScrollSync() {
  if (_scrollListenerRegistered) return;
  _scrollListenerRegistered = true;
  window.addEventListener("scroll", onPageScroll, { passive: true });
}

// ── Brush drag ──
let drag = null, dragX = 0, dragL = 0, dragR = 0;

export function startDrag(e, type) {
  e.preventDefault();
  e.stopPropagation();
  drag = type;
  dragX = e.clientX;
  dragL = brushL;
  dragR = brushR;
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDrag);
}

function onDrag(e) {
  if (!drag) return;
  const W = document.getElementById("brushChart").parentElement.clientWidth - 2;
  const dx = (e.clientX - dragX) / W;
  const minS = 1 / Math.max(N, 1);
  if (drag === "L")
    setBrush(Math.max(0, Math.min(dragL + dx, brushR - minS)), brushR);
  else if (drag === "R")
    setBrush(brushL, Math.min(1, Math.max(dragR + dx, brushL + minS)));
  else {
    const sp = dragR - dragL;
    const newL = Math.max(0, Math.min(dragL + dx, 1 - sp));
    setBrush(newL, newL + sp);
  }
  updateBrushOverlay(W);
  drawMainChart();
  scrollToTurnIndex(Math.round(brushL * (N - 1)));
}

function stopDrag() {
  drag = null;
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", stopDrag);
}

export function initBrushDrag() {
  // startDrag is exposed globally via main.js for the inline onmousedown handlers
}

// ── Main chart drag-pan ──
let mainDrag = false, mainDragX = 0, mainDragL = 0, mainDragR = 0;
let mainDragMoved = false;

export function getMainDragMoved() { return mainDragMoved; }

function onMainDrag(e) {
  if (!mainDrag) return;
  const dx = e.clientX - mainDragX;
  if (Math.abs(dx) > 3) mainDragMoved = true;
  if (!mainDragMoved) return;
  const W = document.getElementById("mainChart").clientWidth;
  const span = mainDragR - mainDragL;
  const offset = -(dx / W) * span;
  const newL = Math.max(0, Math.min(mainDragL + offset, 1 - span));
  setBrush(newL, newL + span);
  updateBrushOverlay();
  drawMainChart();
  scrollToTurnIndex(Math.round(brushL * (N - 1)));
}

function stopMainDrag() {
  mainDrag = false;
  document.getElementById("mainChart").classList.remove("dragging");
  window.removeEventListener("mousemove", onMainDrag);
  window.removeEventListener("mouseup", stopMainDrag);
}

// ── Main chart hover + click ──
export function initMainChartInteraction() {
  const mainChart = document.getElementById("mainChart");

  mainChart.addEventListener("mousedown", (e) => {
    mainDrag = true;
    mainDragMoved = false;
    mainDragX = e.clientX;
    mainDragL = brushL;
    mainDragR = brushR;
    mainChart.classList.add("dragging");
    window.addEventListener("mousemove", onMainDrag);
    window.addEventListener("mouseup", stopMainDrag);
  });

  mainChart.addEventListener("click", (e) => {
    if (mainDragMoved) return;
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const br of getBarRects()) {
      if (mx >= br.x && mx <= br.x + br.w && my >= br.y && my <= br.y + br.h) {
        const idx = TURNS.findIndex((t) => t.id === br.id);
        scrollToTurnIndex(idx);
        break;
      }
    }
  });

  mainChart.addEventListener("mousemove", (e) => {
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let found = null;
    for (const br of getBarRects()) {
      if (mx >= br.x && mx <= br.x + br.w && my >= br.y && my <= br.y + br.h) {
        found = br.id;
        break;
      }
    }
    if (found !== state.hoveredId) {
      setHovered(found);
      mainChart.style.cursor = found ? "pointer" : "default";
      drawMainChart();
      document.querySelectorAll(".conv-turn").forEach((el) => {
        el.classList.toggle("bar-hover", el.dataset.turnId == found);
      });
    }
  });

  mainChart.addEventListener("mouseleave", () => {
    setHovered(null);
    drawMainChart();
    document.querySelectorAll(".conv-turn").forEach((el) =>
      el.classList.remove("bar-hover")
    );
  });

  // Brush chart click
  document.getElementById("brushChart").addEventListener("click", (e) => {
    if (N === 0) return;
    const rect = e.target.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    moveBrushCenter(ratio);
    updateBrushOverlay();
    drawBrushChart();
    drawMainChart();
    scrollToTurnIndex(Math.round(brushL * (N - 1)));
  });
}

// ── Dimension toggle ──
export function toggleDim(key, el) {
  dims[key] = !dims[key];
  el.classList.toggle("off", !dims[key]);
  drawMainChart();
  drawBrushChart();
}
