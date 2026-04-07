import { DATA, TURNS, setN, setBrush } from "./state.js";
import { drawMainChart, drawBrushChart } from "./chart.js";
import { updateConvList } from "./renderer.js";
import { initMainChartInteraction } from "./interactions.js";

let _suppressScrollObserver = false;
let _suppressScrollTimer = null;

function adaptSession(session) {
  if (!session || !session.turns) return [];

  // Adapt turns
  const items = session.turns.map((t) => ({
    type: "turn",
    id: t.id,
    time: t.time,
    timestamp: t.timestamp,
    user: t.userText || "",
    assistant: t.assistantText || "",
    model: t.model || "",
    input: t.input || 0,
    output: t.output || 0,
    cacheR: t.cacheR || 0,
    cacheC: t.cacheC || 0,
    isSidechain: t.isSidechain || false,
    thinking: t.thinking || null,
    tools: (t.tools || []).map((tool) => ({
      cls: tool.cls,
      name: tool.name,
      params: tool.params,
      status: tool.status,
      dur: tool.dur,
      retSize: tool.retSize,
      retLines: tool.retLines,
      input: tool.inputArgs || [],
      output: tool.retContent || "",
      isErr: tool.isErr,
    })),
  }));

  // Adapt system events (commands, compact boundaries)
  if (session.systemEvents) {
    for (const ev of session.systemEvents) {
      if (ev.type === "command") {
        items.push({
          type: "command",
          command: ev.command,
          message: ev.message || "",
          output: ev.output || "",
          time: ev.time,
          timestamp: ev.timestamp,
        });
      } else if (ev.type === "compact") {
        items.push({
          type: "compact",
          trigger: ev.trigger,
          preTokens: ev.preTokens,
          time: ev.time,
          timestamp: ev.timestamp,
        });
      }
    }
  }

  // Sort all items by timestamp so they interleave correctly
  items.sort((a, b) => {
    const ta = a.timestamp || "";
    const tb = b.timestamp || "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  return items;
}

export function setLoadStatus(text) {
  const el = document.getElementById("loadStatus");
  const txt = document.getElementById("loadStatusText");
  if (!el) return;
  if (text) {
    el.style.display = "flex";
    txt.textContent = text;
  } else {
    el.style.display = "none";
  }
}

function showConvError(msg) {
  const list = document.getElementById("convList");
  list.innerHTML = `<div class="load-error"><div class="err-title">Load failed</div>${msg}</div>`;
}

function showConvSkeleton() {
  const rows = Array.from(
    { length: 6 },
    (_, i) => `
    <div class="sk-row">
      <div class="skeleton sk-badge"></div>
      <div class="skeleton sk-line ${i % 3 === 0 ? "s" : i % 3 === 1 ? "m" : ""}"></div>
    </div>`
  ).join("");
  document.getElementById("convList").innerHTML =
    `<div class="init-state">${rows}</div>`;
}

export async function loadSessions() {
  setLoadStatus("Loading session list…");
  showConvSkeleton();
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    populateSessionSelector(list);
    if (list.length > 0) {
      await loadSession(list[0].sessionId);
    } else {
      setLoadStatus(null);
      showConvError(
        "No session records found.<br>Start a conversation with Claude Code first."
      );
    }
  } catch (e) {
    setLoadStatus(null);
    showConvError(
      `Unable to connect to the token-reporter server.<br><code>${e.message}</code>`
    );
    console.error("Failed to load sessions", e);
  }
}

function populateSessionSelector(list) {
  const sel = document.querySelector(".session-select");
  if (!sel) return;
  const select = document.createElement("select");
  select.className = "session-select";
  select.style.cssText =
    "background:#161b22;border:1px solid #21262d;border-radius:5px;padding:5px 12px;color:#58a6ff;font-size:11px;cursor:pointer;font-family:inherit;";
  list.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.sessionId;
    const time = `${s.mtime.slice(0, 10)} ${s.mtime.slice(11, 16)}`;
    const title = s.customTitle || s.slug || s.sessionId;
    const shortId = s.sessionId.slice(0, 8);
    opt.textContent = `${time} · ${title} (${shortId})`;
    select.appendChild(opt);
  });
  select.onchange = () => loadSession(select.value);
  sel.replaceWith(select);
}

export async function loadSession(sessionId, { preserveScroll = false } = {}) {
  if (!preserveScroll) {
    setLoadStatus("Parsing session data…");
    showConvSkeleton();
  }
  try {
    const res = await fetch("/api/sessions/" + sessionId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const session = await res.json();
    const savedScrollY = preserveScroll ? window.scrollY : 0;

    DATA.length = 0;
    DATA.push(...adaptSession(session));
    TURNS.length = 0;
    TURNS.push(
      ...DATA.flatMap((d) => {
        if (d.type === "turn") return [d];
        if (d.type === "branch") return d.turns || [];
        return [];
      })
    );
    setN(TURNS.length);

    if (!preserveScroll) {
      // Start brush at the right end (newest turns visible first)
      const initSpan = TURNS.length > 0 ? Math.min(0.25, 20 / TURNS.length) : 1;
      setBrush(Math.max(0, 1 - initSpan), 1);
    }

    const _placeholder = document.getElementById("chartLoadingPlaceholder");
    const _chartScroll = document.getElementById("mainChartScroll");
    if (_placeholder) _placeholder.style.display = "none";
    if (_chartScroll) _chartScroll.style.display = "";

    setLoadStatus(null);
    drawBrushChart();
    drawMainChart();
    updateConvList(DATA, TURNS, { preserveState: preserveScroll });

    if (!preserveScroll && TURNS.length > 0) {
      // Scroll to the newest turn (matches brush starting at right end)
      const lastTurn = TURNS[TURNS.length - 1];
      const el = document.getElementById("turn-" + lastTurn.id);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "instant", block: "start" });
        });
      }
    }

    if (preserveScroll && savedScrollY > 0) {
      _suppressScrollObserver = true;
      clearTimeout(_suppressScrollTimer);
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollY, behavior: "instant" });
        _suppressScrollTimer = setTimeout(() => {
          _suppressScrollObserver = false;
        }, 300);
      });
    }
  } catch (e) {
    if (!preserveScroll) {
      setLoadStatus(null);
      showConvError(
        `Failed to load session data.<br><code>${e.message}</code>`
      );
    }
    console.error("Failed to load session", e);
  }
}

export function connectSSE() {
  const es = new EventSource("/events");
  es.onmessage = async (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "update" || msg.type === "tool_use") {
        const sel = document.querySelector("select.session-select");
        if (sel) await loadSession(sel.value, { preserveScroll: true });
      }
    } catch {}
  };
  es.onerror = () => setTimeout(connectSSE, 3000);
}

export function init() {
  setLoadStatus("Loading session list…");
  showConvSkeleton();
  connectSSE();
  initMainChartInteraction();
  loadSessions();
}
