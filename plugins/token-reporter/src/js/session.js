import { DATA, TURNS, LIMITS, setN, setBrush, setLimits } from "./state.js";
import { drawMainChart, drawBrushChart } from "./chart.js";
import { updateConvList, renderLimits } from "./renderer.js";
import { initMainChartInteraction } from "./interactions.js";

let _suppressScrollObserver = false;
let _suppressScrollTimer = null;

function adaptSession(session) {
  if (!session || !session.turns) return { items: [], subagents: {} };

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

  // Include subagent stats if available
  const subagents = session.subagents || {};

  return { items, subagents };
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
      // Try to load last selected session, fallback to most recent
      const lastSession = localStorage.getItem(LAST_SESSION_KEY);
      const sessionToLoad = lastSession && list.some((s) => s.sessionId === lastSession)
        ? lastSession
        : list[0].sessionId;
      await loadSession(sessionToLoad);
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

const LAST_SESSION_KEY = "token-reporter:last-session";

function populateSessionSelector(list) {
  const sel = document.querySelector(".session-select");
  if (!sel) return;

  // Create container for select + copy button
  const container = document.createElement("div");
  container.className = "session-select-container";

  const select = document.createElement("select");
  select.className = "session-select";

  list.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.sessionId;
    const time = `${s.mtime.slice(0, 10)} ${s.mtime.slice(11, 16)}`;
    const title = s.customTitle || s.slug || s.sessionId;
    const shortId = s.sessionId.slice(0, 8);
    opt.textContent = `${time} · ${title} (${shortId})`;
    select.appendChild(opt);
  });

  // Restore last selected session
  const lastSession = localStorage.getItem(LAST_SESSION_KEY);
  if (lastSession && Array.from(select.options).some((o) => o.value === lastSession)) {
    select.value = lastSession;
  }

  select.onchange = () => {
    localStorage.setItem(LAST_SESSION_KEY, select.value);
    loadSession(select.value);
  };

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "session-copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.title = "Copy session ID";
  copyBtn.onclick = async () => {
    const sessionId = select.value;
    try {
      await navigator.clipboard.writeText(sessionId);
      copyBtn.classList.add("copied");
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtn.textContent = "Copy";
      }, 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  container.appendChild(select);
  container.appendChild(copyBtn);
  sel.replaceWith(container);
}

export async function loadSession(sessionId, { preserveScroll = false } = {}) {
  if (!preserveScroll) {
    setLoadStatus("Parsing session data…");
    showConvSkeleton();
  }
  try {
    // Load session data and limits in parallel
    const [sessionRes, limitsRes] = await Promise.all([
      fetch("/api/sessions/" + sessionId),
      fetch("/api/limits?sessionId=" + sessionId),
    ]);
    if (!sessionRes.ok) throw new Error(`HTTP ${sessionRes.status}`);
    const session = await sessionRes.json();

    // Store limits data
    if (limitsRes.ok) {
      const limitsData = await limitsRes.json();
      setLimits(sessionId, limitsData);
    }

    const savedScrollY = preserveScroll ? window.scrollY : 0;

    const adapted = adaptSession(session);

    DATA.length = 0;
    DATA.push(...adapted.items);
    TURNS.length = 0;
    TURNS.push(
      ...DATA.flatMap((d) => {
        if (d.type === "turn") return [d];
        if (d.type === "branch") return d.turns || [];
        return [];
      })
    );
    setN(TURNS.length);

    // Store subagents for rendering
    DATA.subagents = adapted.subagents;

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
    updateConvList(DATA, TURNS, sessionId, { preserveState: preserveScroll });

    // Render limits display in sticky chart area
    const limitsDisplay = document.getElementById("limitsDisplay");
    if (limitsDisplay && LIMITS.has(sessionId)) {
      limitsDisplay.innerHTML = renderLimits(sessionId);
    } else if (limitsDisplay) {
      limitsDisplay.innerHTML = "";
    }

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

let _sseConn = null;
let _sseReconnectTimer = null;
let _sseReconnectAttempts = 0;
const MAX_SSE_RECONNECT_ATTEMPTS = 5;
const SSE_RECONNECT_DELAY = 3000;

export function connectSSE() {
  // Clean up existing connection
  if (_sseConn) {
    _sseConn.close();
    _sseConn = null;
  }
  if (_sseReconnectTimer) {
    clearTimeout(_sseReconnectTimer);
    _sseReconnectTimer = null;
  }

  // Stop retrying after max attempts
  if (_sseReconnectAttempts >= MAX_SSE_RECONNECT_ATTEMPTS) {
    console.log("SSE: Max reconnection attempts reached, stopping retries");
    return;
  }

  try {
    _sseConn = new EventSource("/events");

    _sseConn.onopen = () => {
      // Reset counter on successful connection
      _sseReconnectAttempts = 0;
    };

    _sseConn.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "update" || msg.type === "tool_use") {
          const sel = document.querySelector("select.session-select");
          if (sel) await loadSession(sel.value, { preserveScroll: true });
        } else if (msg.type === "limits_update" && msg.sessionId) {
          // Update limits cache and display
          setLimits(msg.sessionId, msg.payload);
          const sel = document.querySelector("select.session-select");
          if (sel && sel.value === msg.sessionId) {
            const limitsDisplay = document.getElementById("limitsDisplay");
            if (limitsDisplay) {
              limitsDisplay.innerHTML = renderLimits(msg.sessionId);
            }
          }
        }
      } catch {}
    };

    _sseConn.onerror = () => {
      _sseConn.close();
      _sseConn = null;
      _sseReconnectAttempts++;

      if (_sseReconnectAttempts < MAX_SSE_RECONNECT_ATTEMPTS) {
        _sseReconnectTimer = setTimeout(connectSSE, SSE_RECONNECT_DELAY);
      } else {
        console.log("SSE: Max reconnection attempts reached");
      }
    };
  } catch (e) {
    console.error("SSE: Failed to create connection", e);
    _sseReconnectAttempts++;
    if (_sseReconnectAttempts < MAX_SSE_RECONNECT_ATTEMPTS) {
      _sseReconnectTimer = setTimeout(connectSSE, SSE_RECONNECT_DELAY);
    }
  }
}

export function disconnectSSE() {
  if (_sseReconnectTimer) {
    clearTimeout(_sseReconnectTimer);
    _sseReconnectTimer = null;
  }
  if (_sseConn) {
    _sseConn.close();
    _sseConn = null;
  }
  _sseReconnectAttempts = 0;
}

export function init() {
  setLoadStatus("Loading session list…");
  showConvSkeleton();
  connectSSE();
  initMainChartInteraction();
  loadSessions();
}
