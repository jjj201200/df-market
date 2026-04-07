"use strict";
const fs = require("fs");
const readline = require("readline");
const os = require("os");
const path = require("path");

/**
 * Find the JSONL file path for a given sessionId under ~/.claude/projects/
 * @param {string} sessionId
 * @returns {string|null}
 */
function findJSONLPath(sessionId) {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(projectsDir)) return null;

  for (const proj of fs.readdirSync(projectsDir)) {
    const projPath = path.join(projectsDir, proj);
    if (!fs.statSync(projPath).isDirectory()) continue;

    // Direct file
    const direct = path.join(projPath, sessionId + ".jsonl");
    if (fs.existsSync(direct)) return direct;

    // subagents subdirectory
    const sub = path.join(projPath, "subagents");
    if (fs.existsSync(sub)) {
      for (const f of fs.readdirSync(sub)) {
        if (f === sessionId + ".jsonl") return path.join(sub, f);
      }
    }
  }
  return null;
}

/**
 * List all sessions (scans all JSONL files under ~/.claude/projects/)
 * @returns {Array<{sessionId, slug, gitBranch, projectDir, filePath, mtime}>}
 */
function listSessions() {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(projectsDir)) return [];

  const sessions = new Map();

  function scanDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      let stat;
      try {
        stat = fs.statSync(fp);
      } catch {
        continue;
      }
      if (stat.isDirectory() && f === "subagents") {
        scanDir(fp);
      } else if (f.endsWith(".jsonl")) {
        const sessionId = f.replace(".jsonl", "");
        if (!sessions.has(sessionId)) {
          // Read first line for slug and other metadata
          const meta = readFirstLineMeta(fp);
          sessions.set(sessionId, {
            sessionId,
            slug: meta.slug || sessionId,
            customTitle: meta.customTitle || "",
            gitBranch: meta.gitBranch || "",
            projectDir: path.basename(dir),
            filePath: fp,
            mtime: stat.mtime.toISOString(),
          });
        }
      }
    }
  }

  for (const proj of fs.readdirSync(projectsDir)) {
    const projPath = path.join(projectsDir, proj);
    try {
      if (fs.statSync(projPath).isDirectory()) scanDir(projPath);
    } catch {}
  }

  return Array.from(sessions.values()).sort((a, b) =>
    b.mtime.localeCompare(a.mtime),
  );
}

function readFirstLineMeta(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    let slug = "";
    let gitBranch = "";
    let customTitle = "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (!slug && obj.slug) slug = obj.slug;
        if (!gitBranch && obj.gitBranch) gitBranch = obj.gitBranch;
        if (obj.type === "custom-title" && obj.customTitle) {
          customTitle = obj.customTitle;
        }
      } catch {}
    }
    return { slug, gitBranch, customTitle };
  } catch {
    return {};
  }
}

/**
 * Parse a JSONL file and return structured session data
 * @param {string} filePath
 * @returns {Promise<SessionData>}
 */
async function parseSession(filePath) {
  const lines = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) {
      try {
        lines.push(JSON.parse(line));
      } catch {}
    }
  }

  if (!lines.length) return null;

  const meta = lines[0];
  const sessionId = meta.sessionId || "";
  const slug = meta.slug || sessionId;
  const gitBranch = meta.gitBranch || "";

  // Build index by uuid
  const byUuid = new Map();
  for (const l of lines) if (l.uuid) byUuid.set(l.uuid, l);

  // Collect tool_results: key = toolUseId, value = { content, isError, userRecord }
  const toolResults = new Map();
  for (const rec of lines) {
    if (rec.type !== "user") continue;
    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c.type === "tool_result") {
        toolResults.set(c.tool_use_id, {
          content:
            typeof c.content === "string"
              ? c.content
              : Array.isArray(c.content)
                ? c.content
                    .filter((b) => b.type === "text")
                    .map((b) => b.text || "")
                    .join("\n")
                : JSON.stringify(c.content ?? ""),
          isError: !!c.is_error,
          userRecord: rec,
        });
      }
    }
  }

  // Collect system events (commands, compact boundaries, etc.)
  const systemEvents = [];
  for (const rec of lines) {
    if (rec.type !== "system") continue;
    if (rec.subtype === "local_command") {
      // Parse command name and output from XML-like content
      const content = rec.content || "";
      const cmdMatch = content.match(/<command-name>([^<]+)<\/command-name>/);
      const msgMatch = content.match(/<command-message>([^<]*)<\/command-message>/);
      const stdoutMatch = content.match(
        /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/,
      );
      if (cmdMatch) {
        systemEvents.push({
          type: "command",
          command: cmdMatch[1],
          message: msgMatch?.[1] || "",
          timestamp: rec.timestamp,
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, {
                hour12: false,
              })
            : "",
        });
      } else if (stdoutMatch) {
        // Command output — attach to previous command event if timestamps match
        const prev = systemEvents[systemEvents.length - 1];
        if (prev && prev.type === "command") {
          prev.output = stdoutMatch[1];
        }
      }
    } else if (rec.subtype === "compact_boundary") {
      const meta = rec.compactMetadata || {};
      systemEvents.push({
        type: "compact",
        trigger: meta.trigger || "auto",
        preTokens: meta.preTokens || 0,
        timestamp: rec.timestamp,
        time: rec.timestamp
          ? new Date(rec.timestamp).toLocaleTimeString(undefined, {
              hour12: false,
            })
          : "",
      });
    }
  }

  // Process assistant messages (contain actual token usage)
  const turns = [];
  let turnIndex = 0;

  for (const rec of lines) {
    if (rec.type !== "assistant") continue;
    const msg = rec.message;
    if (!msg) continue;

    const usage = msg.usage || {};
    const content = Array.isArray(msg.content) ? msg.content : [];

    // Extract thinking block
    const thinkingBlock = content.find((c) => c.type === "thinking");
    const thinking = thinkingBlock?.thinking || null;

    // Extract text output
    const textBlocks = content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n")
      .trim();

    // Extract tool use blocks
    const toolUseBlocks = content.filter((c) => c.type === "tool_use");
    const tools = toolUseBlocks.map((tu) => {
      const result = toolResults.get(tu.id);
      const retContent = result?.content || "";
      const retLines = retContent.split("\n").length;
      const retSize = Buffer.byteLength(retContent, "utf8");

      // Calculate duration
      let dur = null;
      if (result?.userRecord?.timestamp && rec.timestamp) {
        const ms =
          new Date(result.userRecord.timestamp) - new Date(rec.timestamp);
        dur = ms > 0 ? ms : null;
      }

      // Tool classification
      const cls = toolNameToCls(tu.name);

      // Extract key input arguments
      const inputArgs = buildInputArgs(tu.name, tu.input || {});

      // Build single-line params summary
      const params = buildParamsSummary(tu.name, tu.input || {});

      return {
        name: tu.name,
        cls,
        params,
        inputArgs,
        status: result?.isError ? "err" : "ok",
        isErr: result?.isError || false,
        startTime: rec.timestamp,
        endTime: result?.userRecord?.timestamp || null,
        dur: dur !== null ? dur + "ms" : "—",
        retContent,
        retSize:
          retSize >= 1024
            ? (retSize / 1024).toFixed(1) + " KB"
            : retSize + " B",
        retLines: retLines > 1 ? retLines + " lines" : "1 line",
      };
    });

    // Find the corresponding user message by walking up the parentUuid chain.
    // Some records (e.g. "attachment") sit between the assistant and its user record.
    const parentRec = findParentUser(rec, byUuid);
    let userText = "";
    if (parentRec) {
      const userContent = parentRec.message?.content;
      if (Array.isArray(userContent)) {
        userText = userContent
          .filter((c) => c.type === "text")
          .map((c) => c.text || "")
          .join("\n")
          .trim();
      } else if (typeof userContent === "string") {
        userText = userContent;
      }
    }

    turns.push({
      id: ++turnIndex,
      type: "turn",
      time: rec.timestamp
        ? new Date(rec.timestamp).toLocaleTimeString(undefined, {
            hour12: false,
          })
        : "",
      timestamp: rec.timestamp,
      userText,
      assistantText: textBlocks,
      model: msg.model || "",
      isSidechain: !!rec.isSidechain,
      agentId: rec.agentId || null,
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
      cacheR: usage.cache_read_input_tokens || 0,
      cacheC: usage.cache_creation_input_tokens || 0,
      thinking,
      tools,
    });
  }

  return { sessionId, slug, gitBranch, turns, systemEvents };
}

/** Map tool name to CSS class */
function toolNameToCls(name) {
  const n = (name || "").toLowerCase();
  if (n === "bash") return "bash";
  if (n === "read") return "read";
  if (n === "edit") return "edit";
  if (n === "write") return "write";
  if (n === "grep") return "grep";
  if (n === "glob") return "glob";
  if (n.includes("web") || n.includes("fetch") || n.includes("search"))
    return "web";
  if (n === "agent") return "agent";
  return "other";
}

/** Extract key-value display entries from a tool's input object */
function buildInputArgs(toolName, input) {
  const entries = [];
  for (const [k, v] of Object.entries(input)) {
    let vc = "str";
    if (k === "command") vc = "cmd";
    else if (k === "file_path" || k === "uri" || k === "path") vc = "path";
    else if (typeof v === "number") vc = "num";
    else if (typeof v === "boolean") vc = "bool";
    const display = typeof v === "string" ? v : JSON.stringify(v);
    // Truncate overly long content
    entries.push({
      k,
      v: display.length > 300 ? display.slice(0, 300) + "..." : display,
      vc,
    });
  }
  return entries;
}

/** Build a single-line params summary string */
function buildParamsSummary(toolName, input) {
  const n = (toolName || "").toLowerCase();
  if (n === "bash") return input.command || "";
  if (n === "read") {
    let s = input.file_path || "";
    if (input.offset || input.limit)
      s += ` · L${input.offset || 1}-${(input.offset || 1) + (input.limit || 2000) - 1}`;
    return s;
  }
  if (n === "edit" || n === "write") return input.file_path || "";
  if (n === "grep")
    return `pattern: "${input.pattern || ""}"${input.glob ? " · " + input.glob : ""}`;
  if (n === "glob") return input.pattern || "";
  // Default: use the first string value
  const first = Object.values(input).find((v) => typeof v === "string");
  return first || JSON.stringify(input).slice(0, 80);
}

/**
 * Walk up the parentUuid chain to find the nearest ancestor with type === "user".
 * Needed because some record types (e.g. "attachment") can sit between an
 * assistant record and its actual user parent.
 */
function findParentUser(rec, byUuid) {
  let cur = byUuid.get(rec.parentUuid);
  while (cur) {
    if (cur.type === "user") return cur;
    cur = byUuid.get(cur.parentUuid);
  }
  return null;
}

module.exports = { parseSession, listSessions, findJSONLPath };
