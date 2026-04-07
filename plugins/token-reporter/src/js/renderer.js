import { dims, setHovered, LIMITS } from "./state.js";
import { escHtml, fmtF, fmtDur, fmtBytes, parseDur, parseSize, fmt } from "./utils.js";
import { drawMainChart } from "./chart.js";
import { initScrollSync } from "./interactions.js";

/**
 * Format reset time from timestamp to relative time
 */
function fmtResetTime(timestamp) {
  if (!timestamp) return "";
  const now = Date.now() / 1000;
  const diff = timestamp - now;
  if (diff <= 0) return "即将重置";
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}天${hours % 24}小时后重置`;
  }
  return `${hours}小时${mins}分钟后重置`;
}

/**
 * Format reset time from timestamp to absolute datetime (local timezone)
 */
function fmtResetTimeAbsolute(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  const secs = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/**
 * Render three-column limits display
 */
export function renderLimits(sessionId) {
  const limits = LIMITS.get(sessionId);
  if (!limits) return "";

  const ctx = limits.contextWindow || limits.context_window || {};
  const rate = limits.rateLimits || limits.rate_limits || {};
  const fiveHour = rate?.five_hour || {};
  const sevenDay = rate?.seven_day || {};

  // Helper to build progress bar
  const buildBar = (pct) => {
    const width = Math.min(100, Math.max(0, pct || 0));
    const color = width > 90 ? "#f85149" : width > 70 ? "#d29922" : "#3fb950";
    return `<div class="limit-bar"><div class="limit-fill" style="width:${width}%;background:${color}"></div></div>`;
  };

  const ctxPct = ctx.used_percentage || 0;
  const fivePct = fiveHour.used_percentage || 0;
  const sevenPct = sevenDay.used_percentage || 0;

  // Calculate actual usage in context window
  const currentUsage = ctx.current_usage || {};
  const ctxUsed = (currentUsage.input_tokens || 0) + (currentUsage.output_tokens || 0) +
                  (currentUsage.cache_read_input_tokens || 0) + (currentUsage.cache_creation_input_tokens || 0);

  // Build detail text: use actual size if available, otherwise calculate from percentage
  let ctxDetail = "";
  if (ctx.context_window_size) {
    ctxDetail = `${fmt(ctxUsed)}/${fmt(ctx.context_window_size)}`;
  } else if (ctxPct > 0) {
    const estimatedSize = Math.round(ctxUsed / (ctxPct / 100));
    ctxDetail = `${fmt(ctxUsed)}/${fmt(estimatedSize)}`;
  }

  // Build 5h and 7d items only if rateLimits exists and has resets_at
  const hasRateLimits = limits.rateLimits || limits.rate_limits;
  const fiveHourResetsAt = fiveHour.resets_at;
  const sevenDayResetsAt = sevenDay.resets_at;

  const fiveHourItem = hasRateLimits && fiveHourResetsAt ? `
    <div class="limit-item-compact">
      <span class="limit-label">5h</span>
      ${buildBar(fivePct)}
      <span class="limit-pct">${Math.round(fivePct)}%</span>
      <span class="limit-detail">${fmtResetTimeAbsolute(fiveHourResetsAt)}</span>
    </div>
  ` : "";

  const sevenDayItem = hasRateLimits && sevenDayResetsAt ? `
    <div class="limit-item-compact">
      <span class="limit-label">7d</span>
      ${buildBar(sevenPct)}
      <span class="limit-pct">${Math.round(sevenPct)}%</span>
      <span class="limit-detail">${fmtResetTimeAbsolute(sevenDayResetsAt)}</span>
    </div>
  ` : "";

  // Compact single-row display
  return `
    <div class="limits-row-compact">
      <div class="limit-item-compact">
        <span class="limit-label">Ctx</span>
        ${buildBar(ctxPct)}
        <span class="limit-pct">${Math.round(ctxPct)}%</span>
        ${ctxDetail ? `<span class="limit-detail">${ctxDetail}</span>` : ""}
      </div>
      ${fiveHourItem}
      ${sevenDayItem}
    </div>
  `;
}

export function buildTokHtml(d) {
  return [
    dims.input && d.input
      ? `<span class="tok in"><span class="tl">in </span><span class="tv">${fmtF(d.input)}</span></span>`
      : "",
    dims.output && d.output
      ? `<span class="tok out"><span class="tl">out </span><span class="tv">${fmtF(d.output)}</span></span>`
      : "",
    dims.cacheR && d.cacheR
      ? `<span class="tok cr"><span class="tl">cr </span><span class="tv">${fmtF(d.cacheR)}</span></span>`
      : "",
    dims.cacheC && d.cacheC
      ? `<span class="tok cc"><span class="tl">cc </span><span class="tv">${fmtF(d.cacheC)}</span></span>`
      : "",
  ]
    .filter(Boolean)
    .join("");
}

export function toggleTcGroup(listId, toggleId) {
  const list = document.getElementById(listId);
  const tog = document.getElementById(toggleId);
  const hidden = list.classList.toggle("hidden");
  tog.classList.toggle("open", !hidden);
}

export function toggleTcDetail(detailId, row) {
  const wrap = document.getElementById(detailId);
  const open = wrap.classList.toggle("open");
  const arrow = row.querySelector(".arrow");
  if (arrow) arrow.style.transform = open ? "rotate(90deg)" : "rotate(0)";
}

export function toggleThink(id, header) {
  const body = document.getElementById(id);
  const open = body.classList.toggle("open");
  header.querySelector(".thinking-toggle").textContent = open
    ? "▼ Collapse"
    : "▶ Expand";
}

export function toggleExp(textId, btnId) {
  const el = document.getElementById(textId);
  const btn = document.getElementById(btnId);
  const folded = el.classList.toggle("clamped");
  btn.textContent = folded ? "▼ Expand all" : "▲ Collapse";
}

export function toggleCmdOutput(id, toggle) {
  const el = document.getElementById(id);
  const open = el.classList.toggle("open");
  toggle.textContent = open ? "▼ output" : "▶ output";
}

export function renderSubagentSummary(subagents) {
  if (!subagents || Object.keys(subagents).length === 0) return null;

  const wrap = document.createElement("div");
  wrap.className = "subagent-summary";

  const header = document.createElement("div");
  header.className = "subagent-header";
  header.innerHTML = `<span class="subagent-title">Subagents</span>`;
  wrap.appendChild(header);

  const list = document.createElement("div");
  list.className = "subagent-list";

  for (const [agentId, stats] of Object.entries(subagents)) {
    const cardId = `sa-card-${agentId}`;
    const turnsId = `sa-turns-${agentId}`;

    const card = document.createElement("div");
    card.className = `subagent-card sa-${stats.agentType.toLowerCase()}`;
    card.id = cardId;

    const tokHtml = [
      stats.totalTokens.input ? `<span class="tok in"><span class="tl">in </span><span class="tv">${fmtF(stats.totalTokens.input)}</span></span>` : "",
      stats.totalTokens.output ? `<span class="tok out"><span class="tl">out </span><span class="tv">${fmtF(stats.totalTokens.output)}</span></span>` : "",
      stats.totalTokens.cacheR ? `<span class="tok cr"><span class="tl">cr </span><span class="tv">${fmtF(stats.totalTokens.cacheR)}</span></span>` : "",
      stats.totalTokens.cacheC ? `<span class="tok cc"><span class="tl">cc </span><span class="tv">${fmtF(stats.totalTokens.cacheC)}</span></span>` : "",
    ].filter(Boolean).join("");

    // Build tool counts pills
    const toolCounts = stats.toolCounts || {};
    const toolPillsHtml = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cls, count]) => `<span class="tool-pill tp-${cls}">${cls.toUpperCase()}×${count}</span>`)
      .join("");

    // Check if subagent has turns to display
    const hasTurns = stats.turns && stats.turns.length > 0;
    const expandHtml = hasTurns ? `
      <div class="sa-expand-row" onclick="toggleSubagentTurns('${turnsId}', '${cardId}')">
        <span class="arrow" id="${cardId}-arrow">▶</span>
        <span>View ${stats.totalTurns} turns</span>
      </div>
    ` : "";

    card.innerHTML = `
      <div class="sa-card-header">
        <div class="sa-card-left">
          <span class="sa-type">${escHtml(stats.agentType)}</span>
          <span class="sa-id">${agentId.slice(0, 8)}</span>
          <span class="sa-turns">${stats.totalTurns} turn${stats.totalTurns === 1 ? "" : "s"}</span>
          ${toolPillsHtml ? `<span class="sa-tools">${toolPillsHtml}</span>` : ""}
        </div>
        <div class="sa-card-right">
          <div class="sa-tokens">${tokHtml}</div>
        </div>
      </div>
      ${stats.description ? `<div class="sa-desc">${escHtml(stats.description)}</div>` : ""}
      ${expandHtml}
    `;

    // Add turns container if there are turns
    if (hasTurns) {
      const turnsContainer = document.createElement("div");
      turnsContainer.className = "sa-turns-container hidden";
      turnsContainer.id = turnsId;

      // Render each turn
      stats.turns.forEach((turn) => {
        const turnEl = renderSubagentTurn(turn);
        turnsContainer.appendChild(turnEl);
      });

      card.appendChild(turnsContainer);
    }

    list.appendChild(card);
  }

  wrap.appendChild(list);
  return wrap;
}

export function renderSubagentTurn(turn) {
  const wrap = document.createElement("div");
  wrap.className = "sa-turn";

  const tokHtml = [
    turn.input ? `<span class="tok in"><span class="tl">in </span><span class="tv">${fmtF(turn.input)}</span></span>` : "",
    turn.output ? `<span class="tok out"><span class="tl">out </span><span class="tv">${fmtF(turn.output)}</span></span>` : "",
    turn.cacheR ? `<span class="tok cr"><span class="tl">cr </span><span class="tv">${fmtF(turn.cacheR)}</span></span>` : "",
    turn.cacheC ? `<span class="tok cc"><span class="tl">cc </span><span class="tv">${fmtF(turn.cacheC)}</span></span>` : "",
  ].filter(Boolean).join("");

  const userText = turn.userText || "";
  const assistantText = turn.assistantText || "";
  const hasUser = userText.trim().length > 0;
  const hasAssistant = assistantText.trim().length > 0;

  // Generate unique IDs for this turn
  const userId = `sa-u-${turn.id}-${Date.now()}`;
  const assistantId = `sa-a-${turn.id}-${Date.now()}`;

  // Map tool name to CSS class (same logic as parser.js)
  function getToolCls(name) {
    const n = (name || "").toLowerCase();
    if (n === "bash") return "bash";
    if (n === "read") return "read";
    if (n === "edit") return "edit";
    if (n === "write") return "write";
    if (n === "grep" || n === "toolsearch") return "grep";
    if (n === "glob") return "glob";
    if (n === "web" || n === "web_search" || n === "web_fetch") return "web";
    if (n === "agent") return "agent";
    if (n.startsWith("mcp__")) return "mcp";
    return "other";
  }

  // Build tool summary for header - show actual tool names with colors
  let toolSummaryHtml = "";
  if (turn.tools && turn.tools.length > 0) {
    const toolCounts = {};
    turn.tools.forEach(t => {
      const key = t.name;
      if (!toolCounts[key]) {
        toolCounts[key] = { count: 0, cls: getToolCls(t.name) };
      }
      toolCounts[key].count++;
    });
    const toolPills = Object.entries(toolCounts)
      .map(([name, info]) => `<span class="sa-tool-pill tp-${info.cls}">${name}${info.count > 1 ? "×" + info.count : ""}</span>`)
      .join("");

    toolSummaryHtml = `<div class="sa-turn-tools-summary">${toolPills}</div>`;
  }

  // Build user section with scrollable container and copy button
  let userHtml = "";
  if (hasUser) {
    userHtml = `
      <div class="sa-turn-user">
        <div class="sa-scrollable-content" id="${userId}">${escHtml(userText)}</div>
        <button class="sa-copy-btn" onclick="copySaText('${userId}', this)" title="Copy">Copy</button>
      </div>`;
  }

  // Build assistant section with scrollable container and copy button
  let assistantHtml = "";
  if (hasAssistant) {
    assistantHtml = `
      <div class="sa-turn-assistant">
        <div class="sa-scrollable-content" id="${assistantId}">${escHtml(assistantText)}</div>
        <button class="sa-copy-btn" onclick="copySaText('${assistantId}', this)" title="Copy">Copy</button>
      </div>`;
  }

  wrap.innerHTML = `
    <div class="sa-turn-body">
      <div class="sa-turn-header">
        <span class="sa-turn-num">Turn ${turn.id}</span>
        ${toolSummaryHtml}
        <span class="sa-turn-time">${turn.time}</span>
        <div class="sa-turn-tokens">${tokHtml}</div>
      </div>
      ${userHtml}
      ${assistantHtml}
    </div>
    ${turn.tools && turn.tools.length > 0 ? renderSubagentToolGroup(turn.tools) : ""}
  `;

  return wrap;
}

window.copySaText = async function(elementId, btn) {
  const el = document.getElementById(elementId);
  if (!el) return;

  try {
    await navigator.clipboard.writeText(el.textContent);
    const original = btn.textContent;
    btn.textContent = "copied";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1500);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function renderSubagentToolGroup(tools) {
  const total = tools.length;
  const errCount = tools.filter((t) => t.isErr).length;

  const toolsHtml = tools.map((t, i) => `
    <div class="sa-tool-item ${t.cls}">
      <span class="sa-tool-name">${t.name}</span>
      <span class="sa-tool-params">${escHtml(t.params)}</span>
      <span class="sa-tool-meta">
        <span class="sa-tool-dur">${t.dur}</span>
        <span class="sa-tool-size">${t.retSize}</span>
        <span class="sa-tool-st ${t.status}">${t.status.toUpperCase()}</span>
      </span>
    </div>
  `).join("");

  return `
    <div class="sa-tools-group">
      ${errCount ? `<div class="sa-tools-header"><span class="sa-tools-err">${errCount} ERR</span></div>` : ""}
      <div class="sa-tools-list">
        ${toolsHtml}
      </div>
    </div>
  `;
}

window.toggleSubagentTurns = function(turnsId, cardId) {
  const turnsEl = document.getElementById(turnsId);
  const arrowEl = document.getElementById(`${cardId}-arrow`);
  if (!turnsEl || !arrowEl) return;

  const isHidden = turnsEl.classList.toggle("hidden");
  arrowEl.style.transform = isHidden ? "rotate(0deg)" : "rotate(90deg)";
};

export function renderTurn(d, sessionId, subagents = {}) {
  const wrap = document.createElement("div");
  wrap.id = "turn-" + d.id;
  wrap.setAttribute("data-turn-id", d.id);

  const addHover = (el) => {
    el.addEventListener("mouseenter", () => {
      setHovered(d.id);
      drawMainChart();
      document
        .querySelectorAll(`.conv-turn[data-turn-id="${d.id}"]`)
        .forEach((x) => x.classList.add("bar-hover"));
    });
    el.addEventListener("mouseleave", () => {
      setHovered(null);
      drawMainChart();
      document
        .querySelectorAll(".conv-turn")
        .forEach((x) => x.classList.remove("bar-hover"));
    });
  };

  const tokHtml = buildTokHtml(d);
  const scBadge = d.sidechain
    ? `<span class="sidechain-badge">SIDECHAIN</span>`
    : "";
  const agentBadge = d.agentId
    ? `<span class="agent-badge" title="Agent: ${d.agentId}">AGENT</span>`
    : "";
  const hasUser = (d.user || "").trim().length > 0;

  // ── USER row ──
  if (hasUser) {
    const userDiv = document.createElement("div");
    userDiv.className = "msg-user conv-turn";
    userDiv.setAttribute("data-turn-id", d.id);
    if (d.sidechain) userDiv.style.borderColor = "#f8514933";

    const uLines =
      Math.ceil((d.user || "").length / 60) +
      (d.user || "").split("\n").length;
    const needFoldU = uLines > 7;
    userDiv.innerHTML = `
    <div class="msg-user-header">
      <span class="role-badge user">USER</span>
      ${scBadge}
      ${agentBadge}
      <span class="msg-time">${d.time}</span>
      <div class="msg-tokens">${tokHtml}</div>
    </div>
    <div class="msg-body">
      <div class="msg-text${needFoldU ? " clamped" : ""}" id="ut-${d.id}">${escHtml(d.user)}</div>
      ${needFoldU ? `<span class="expand-btn" id="ueb-${d.id}" onclick="toggleExp('ut-${d.id}','ueb-${d.id}')">▼ Expand all</span>` : ""}
    </div>`;
    addHover(userDiv);
    wrap.appendChild(userDiv);
  }

  // ── ASSISTANT row ──
  const aDiv = document.createElement("div");
  aDiv.className =
    (hasUser ? "msg-assistant" : "msg-asst-led") + " conv-turn";
  aDiv.setAttribute("data-turn-id", d.id);

  const aLines =
    Math.ceil((d.assistant || "").length / 60) +
    (d.assistant || "").split("\n").length;
  const needFoldA = aLines > 6;
  const aHeaderTok = hasUser
    ? ""
    : `<div class="msg-tokens" style="margin-left:auto">${tokHtml}</div>`;
  aDiv.innerHTML = `
    <div class="msg-assistant-header">
      <span class="role-badge asst">ASSISTANT</span>
      ${!hasUser ? scBadge : ""}
      ${!hasUser ? agentBadge : ""}
      <span class="msg-time">${d.time}</span>
      ${d.model ? `<span class="model-tag">${d.model}</span>` || '' : ''}
      ${aHeaderTok}
    </div>`;

  // Thinking block
  if (d.thinking) {
    const tid = `th-${d.id}`;
    const thBlock = document.createElement("div");
    thBlock.className = "thinking-block";
    thBlock.innerHTML = `
      <div class="thinking-header" onclick="toggleThink('${tid}',this)">
        <span class="thinking-icon">🧠</span>
        <span>Internal reasoning</span>
        <span style="font-size: 12px;color:var(--faint);margin-left:4px;">${Math.ceil(d.thinking.length / 4)} tokens (est.)</span>
        <span class="thinking-toggle">▶ Expand</span>
      </div>
      <div class="thinking-body" id="${tid}">${escHtml(d.thinking)}</div>`;
    aDiv.appendChild(thBlock);
  }

  // Assistant text
  const aBody = document.createElement("div");
  aBody.className = "msg-body";
  aBody.innerHTML = `
    <div class="msg-text${needFoldA ? " clamped" : ""}" id="at-${d.id}">${escHtml(d.assistant)}</div>
    ${needFoldA ? `<span class="expand-btn" id="aeb-${d.id}" onclick="toggleExp('at-${d.id}','aeb-${d.id}')">▼ Expand all</span>` : ""}`;
  aDiv.appendChild(aBody);
  addHover(aDiv);

  wrap.appendChild(aDiv);
  if (d.tools && d.tools.length > 0) {
    wrap.appendChild(renderToolGroup(d, subagents));
  }
  return wrap;
}

export function renderToolGroup(d, subagents = {}) {
  const tools = d.tools;
  const tcId = `tc-${d.id}`;
  const listId = `tcl-${d.id}`;

  const total = tools.length;
  const errCount = tools.filter((t) => t.isErr).length;
  const okCount = total - errCount;
  const totalMs = tools.reduce((s, t) => s + parseDur(t.dur), 0);
  const totalBytes = tools.reduce((s, t) => s + parseSize(t.retSize), 0);
  const slowest = tools.reduce((a, b) =>
    parseDur(a.dur) >= parseDur(b.dur) ? a : b
  );
  const biggest = tools
    .filter((t) => parseSize(t.retSize) > 0)
    .reduce(
      (a, b) => (parseSize(a.retSize) >= parseSize(b.retSize) ? a : b),
      tools[0]
    );

  const counts = {};
  tools.forEach((t) => {
    counts[t.cls] = (counts[t.cls] || 0) + 1;
  });
  const pillsHtml = Object.entries(counts)
    .map(
      ([cls, n]) =>
        `<span class="tool-pill tp-${cls}">${cls.toUpperCase()}×${n}</span>`
    )
    .join("");

  const grp = document.createElement("div");
  grp.className = "tc-group";
  grp.innerHTML = `
    <div class="tc-toggle" id="${tcId}" onclick="toggleTcGroup('${listId}','${tcId}')">
      <span class="arrow">▶</span>
      <span class="tc-badge">${total} tool call${total === 1 ? "" : "s"}</span>
      <span class="tc-summary">
        <span class="tool-pills">${pillsHtml}</span>
        <span class="tc-sum-sep">·</span>
        <span class="tc-sum-time">${fmtDur(totalMs)}</span>
        <span class="tc-sum-sep">·</span>
        <span class="tc-sum-size">${fmtBytes(totalBytes)}</span>
        ${errCount ? `<span class="tc-sum-sep">·</span><span class="tc-sum-err">${errCount} ERR</span>` : ""}
      </span>
    </div>`;

  const list = document.createElement("div");
  list.className = "tc-list hidden";
  list.id = listId;

  const statsPanel = document.createElement("div");
  statsPanel.className = "tc-stats-panel";
  statsPanel.innerHTML = `
    <div class="ts-item"><div class="ts-label">Total</div><div class="ts-val">${total}</div></div>
    <div class="ts-item"><div class="ts-label">OK</div><div class="ts-val ok">${okCount}</div></div>
    <div class="ts-item"><div class="ts-label">Err</div><div class="ts-val ${errCount ? "err" : "ok"}">${errCount}</div></div>
    <div class="ts-item"><div class="ts-label">Duration</div><div class="ts-val time">${fmtDur(totalMs)}</div></div>
    <div class="ts-item"><div class="ts-label">Slowest</div><div class="ts-val time">${slowest.name} ${slowest.dur}</div></div>
    <div class="ts-item"><div class="ts-label">Total ret.</div><div class="ts-val size">${fmtBytes(totalBytes)}</div></div>
    <div class="ts-item"><div class="ts-label">Largest</div><div class="ts-val size">${biggest.name} ${biggest.retSize}</div></div>`;
  list.appendChild(statsPanel);

  tools.forEach((t, i) => {
    const detailId = `tcd-${d.id}-${i}`;
    const paramsHtml = (t.input || [])
      .map(
        (p) =>
          `<div class="tc-param-row"><span class="tc-pk">${p.k}</span><span class="tc-pv ${p.vc || ""}">${escHtml(p.v)}</span></div>`
      )
      .join("");

    // Find matching subagent for Agent tools
    let subagentInfoHtml = "";
    if (t.name === "Agent" && Object.keys(subagents).length > 0) {
      const descInput = t.input?.find(p => p.k === "description");
      if (descInput) {
        const matchingSubagent = Object.values(subagents).find(sa =>
          sa.description === descInput.v
        );
        if (matchingSubagent) {
          const tok = matchingSubagent.totalTokens;
          const tokHtml = [
            tok.input ? `<span class="tok in"><span class="tl">in </span><span class="tv">${fmtF(tok.input)}</span></span>` : "",
            tok.output ? `<span class="tok out"><span class="tl">out </span><span class="tv">${fmtF(tok.output)}</span></span>` : "",
            tok.cacheR ? `<span class="tok cr"><span class="tl">cr </span><span class="tv">${fmtF(tok.cacheR)}</span></span>` : "",
            tok.cacheC ? `<span class="tok cc"><span class="tl">cc </span><span class="tv">${fmtF(tok.cacheC)}</span></span>` : "",
          ].filter(Boolean).join("");

          subagentInfoHtml = `
            <div class="tc-subagent-info">
              <span class="tc-sa-label">Subagent completed:</span>
              <span class="tc-sa-turns">${matchingSubagent.totalTurns} turns</span>
              <div class="tc-sa-tokens">${tokHtml}</div>
            </div>`;
        }
      }
    }

    // Build MCP info display
    let mcpInfoHtml = "";
    if (t.mcp) {
      mcpInfoHtml = `
        <div class="tc-mcp-info">
          <span class="tc-mcp-server">${escHtml(t.mcp.server)}</span>
          <span class="tc-mcp-sep">→</span>
          <span class="tc-mcp-method">${escHtml(t.mcp.method)}</span>
        </div>`;
    }

    const card = document.createElement("div");
    card.className = `tc-card ${t.cls}`;
    card.innerHTML = `
      <div class="tc-head">
        <div class="tc-band"></div>
        <div class="tc-head-inner">
          <span class="tc-name">${t.name}</span>
          ${mcpInfoHtml}
          <span class="tc-params-summary">${escHtml(t.params)}</span>
          <div class="tc-meta">
            <span class="tc-dur">${t.dur}</span>
            <span class="tc-size">${t.retSize}</span>
            <span class="tc-st ${t.status}">${t.status.toUpperCase()}</span>
          </div>
        </div>
      </div>
      ${subagentInfoHtml}
      <div class="tc-expand-row" onclick="toggleTcDetail('${detailId}',this)">
        <span class="arrow" style="font-size: 12px;transition:transform .15s;display:inline-block">▶</span>
        <span>Expand params &amp; output</span>
        ${t.retLines && t.retLines !== "—" ? `<span style="margin-left:auto;color:var(--faint)">${t.retLines}</span>` : ""}
      </div>
      <div class="tc-detail-wrap" id="${detailId}">
        <div class="tc-detail-body">
          ${paramsHtml ? `<div class="tc-section-label">INPUT</div>${paramsHtml}` : ""}
          <div class="tc-result-block">
            <div class="tc-result-meta">
              <span>OUTPUT</span>
              <span class="rm-bytes">${t.retSize}</span>
              ${t.retLines && t.retLines !== "—" ? `<span class="rm-lines">${t.retLines}</span>` : ""}
            </div>
            <div class="tc-result-preview${t.isErr ? " is-err" : ""}">${escHtml(t.output || "(no output)")}</div>
          </div>
        </div>
      </div>`;
    list.appendChild(card);
  });

  grp.appendChild(list);
  return grp;
}

export function renderCompact(item) {
  const div = document.createElement("div");
  div.className = "event-compact";
  div.innerHTML = `
    <span class="ev-label">COMPACT</span>
    <span class="ev-detail">Context window compressed</span>
    <span class="ev-meta">${item.time} · ${item.trigger || "auto"} · ${fmt(item.preTokens || item.removedTokens || 0)} tokens before</span>`;
  return div;
}

export function renderCommand(item) {
  const div = document.createElement("div");
  div.className = "event-command";
  const hasOutput = (item.output || "").trim().length > 0;
  const outputId = `cmd-out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  div.innerHTML = `
    <span class="ev-cmd-icon">⌘</span>
    <span class="ev-cmd-name">${escHtml(item.command)}</span>
    ${item.message && item.message !== item.command.replace(/^\//, "") ? `<span class="ev-cmd-msg">${escHtml(item.message)}</span>` : ""}
    <span class="ev-cmd-time">${item.time}</span>
    ${hasOutput ? `<span class="ev-cmd-toggle" onclick="toggleCmdOutput('${outputId}',this)">▶ output</span>` : ""}
    ${hasOutput ? `<div class="ev-cmd-output" id="${outputId}">${escHtml(item.output)}</div>` : ""}`;
  return div;
}

export function renderBranch(item, inRangeIds) {
  const wrap = document.createElement("div");
  const header = document.createElement("div");
  header.className = "branch-header";
  header.innerHTML = `
    <span class="branch-tag"><span class="dot"></span>${item.label}</span>
    <span class="branch-dim-label">${item.time} · ${escHtml(item.description)}</span>`;
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "branch-body";
  (item.turns || [])
    .filter((t) => inRangeIds.has(t.id))
    .forEach((t) => {
      body.appendChild(renderTurn(t));
    });
  wrap.appendChild(body);
  return wrap;
}

/**
 * Collect the UI expand/collapse state of all interactive elements so it can
 * be restored after a DOM rebuild (SSE refresh).
 */
function saveExpandState() {
  const state = { tcGroups: {}, tcDetails: {}, thinking: {}, textExpand: {} };
  // Tool-call group open/collapsed
  document.querySelectorAll(".tc-toggle").forEach((el) => {
    if (el.id) state.tcGroups[el.id] = el.classList.contains("open");
  });
  // Individual tool-card detail open
  document.querySelectorAll(".tc-detail-wrap").forEach((el) => {
    if (el.id) state.tcDetails[el.id] = el.classList.contains("open");
  });
  // Thinking blocks
  document.querySelectorAll(".thinking-body").forEach((el) => {
    if (el.id) state.thinking[el.id] = el.classList.contains("open");
  });
  // Expanded (un-clamped) text blocks
  document.querySelectorAll(".msg-text").forEach((el) => {
    if (el.id) state.textExpand[el.id] = !el.classList.contains("clamped");
  });
  return state;
}

function restoreExpandState(state) {
  // Tool-call groups
  for (const [id, open] of Object.entries(state.tcGroups)) {
    if (!open) continue;
    const tog = document.getElementById(id);
    if (!tog) continue;
    tog.classList.add("open");
    // The list id is derived from the toggle id: tc-X → tcl-X
    const listId = id.replace(/^tc-/, "tcl-");
    const list = document.getElementById(listId);
    if (list) list.classList.remove("hidden");
  }
  // Tool-card details
  for (const [id, open] of Object.entries(state.tcDetails)) {
    if (!open) continue;
    const wrap = document.getElementById(id);
    if (!wrap) continue;
    wrap.classList.add("open");
    // Rotate the arrow in the preceding expand-row
    const row = wrap.previousElementSibling;
    if (row) {
      const arrow = row.querySelector(".arrow");
      if (arrow) arrow.style.transform = "rotate(90deg)";
    }
  }
  // Thinking blocks
  for (const [id, open] of Object.entries(state.thinking)) {
    if (!open) continue;
    const body = document.getElementById(id);
    if (!body) continue;
    body.classList.add("open");
    const header = body.previousElementSibling;
    if (header) {
      const toggle = header.querySelector(".thinking-toggle");
      if (toggle) toggle.textContent = "▼ Collapse";
    }
  }
  // Text expansion
  for (const [id, expanded] of Object.entries(state.textExpand)) {
    if (!expanded) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.remove("clamped");
    // Update the companion expand button
    const btnId = id.replace(/^(ut|at)-/, (_, p) => (p === "ut" ? "ueb-" : "aeb-"));
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = "▲ Collapse";
  }
}

export function updateConvList(DATA, TURNS, sessionId, { preserveState = false } = {}) {
  const expandState = preserveState ? saveExpandState() : null;

  const allIds = new Set(TURNS.map((t) => t.id));
  const list = document.getElementById("convList");
  list.innerHTML = "";

  // Render subagent summary if available
  if (DATA.subagents && Object.keys(DATA.subagents).length > 0) {
    const saSummary = renderSubagentSummary(DATA.subagents);
    if (saSummary) {
      list.appendChild(saSummary);
    }
  }

  // Render in reverse order: newest turn at top
  const reversed = DATA /* [...DATA].reverse() */;
  const subagents = DATA.subagents || {};
  reversed.forEach((item) => {
    if (item.type === "turn") {
      list.appendChild(renderTurn(item, sessionId, subagents));
    } else if (item.type === "compact") {
      list.appendChild(renderCompact(item));
    } else if (item.type === "command") {
      list.appendChild(renderCommand(item));
    } else if (item.type === "branch") {
      list.appendChild(renderBranch(item, allIds));
    }
  });

  if (expandState) {
    restoreExpandState(expandState);
  }

  initScrollSync();
}
