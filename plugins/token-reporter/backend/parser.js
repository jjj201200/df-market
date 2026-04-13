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
 * Load subagent meta file for a given session and agentId
 * @param {string} sessionDir - Directory containing the session JSONL file
 * @param {string} agentId
 * @returns {{agentType: string, description: string} | null}
 */
function loadSubagentMeta(sessionDir, agentId) {
  const metaPath = path.join(sessionDir, "subagents", `agent-${agentId}.meta.json`);
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, "utf8"));
    }
  } catch {}
  return null;
}

/**
 * Parse a subagent JSONL file and return full session data
 * @param {string} filePath
 * @returns {Promise<{totalTurns: number, totalTokens: Object, toolCounts: Object, turns: Array}>}
 */
async function parseSubagentFile(filePath) {
  // Reuse parseSession logic for subagent files
  const sessionData = await parseSession(filePath);
  if (!sessionData) {
    return { totalTurns: 0, totalTokens: { input: 0, output: 0, cacheR: 0, cacheC: 0 }, toolCounts: {}, turns: [] };
  }

  // Calculate tool counts from turns
  const toolCounts = {};
  for (const turn of sessionData.turns) {
    for (const tool of turn.tools || []) {
      toolCounts[tool.cls] = (toolCounts[tool.cls] || 0) + 1;
    }
  }

  // Calculate total tokens
  const totalTokens = sessionData.turns.reduce(
    (acc, t) => ({
      input: acc.input + (t.input || 0),
      output: acc.output + (t.output || 0),
      cacheR: acc.cacheR + (t.cacheR || 0),
      cacheC: acc.cacheC + (t.cacheC || 0),
    }),
    { input: 0, output: 0, cacheR: 0, cacheC: 0 }
  );

  return {
    totalTurns: sessionData.turns.length,
    totalTokens,
    toolCounts,
    turns: sessionData.turns,
  };
}

/**
 * Collect subagent statistics from subagents directory
 * @param {string} sessionDir - Directory containing the session JSONL file
 * @returns {Promise<Object>} subagent stats map
 */
async function collectSubagentStats(sessionDir) {
  const subagentsDir = path.join(sessionDir, "subagents");
  if (!fs.existsSync(subagentsDir)) {
    return {};
  }

  const subagents = new Map();

  const files = fs.readdirSync(subagentsDir);
  for (const f of files) {
    if (!f.startsWith("agent-") || !f.endsWith(".jsonl")) continue;

    // Extract agentId from filename: agent-{agentId}.jsonl
    const agentId = f.replace(/^agent-/, "").replace(/\.jsonl$/, "");
    if (!agentId) continue;

    const meta = loadSubagentMeta(sessionDir, agentId);
    const stats = await parseSubagentFile(path.join(subagentsDir, f));

    subagents.set(agentId, {
      agentId,
      agentType: meta?.agentType || "Unknown",
      description: meta?.description || "",
      totalTurns: stats.totalTurns,
      totalTokens: stats.totalTokens,
      toolCounts: stats.toolCounts || {},
      turns: stats.turns || [],
    });
  }

  return Object.fromEntries(subagents);
}

/**
 * Try to parse a slash command wrapper from a user message string content.
 * Newer Claude Code versions record slash commands as type:"user" records
 * whose content is a string like:
 *   "<command-message>release-plugin</command-message>\n<command-name>/release-plugin</command-name>"
 * Returns { command, message } or null if not a slash command wrapper.
 * @param {unknown} content
 * @returns {{command: string, message: string} | null}
 */
function parseSlashCommandContent(content) {
  if (typeof content !== "string") return null;
  const cmdMatch = content.match(/<command-name>([^<]+)<\/command-name>/);
  if (!cmdMatch) return null;
  const msgMatch = content.match(
    /<command-message>([^<]*)<\/command-message>/,
  );
  return {
    command: cmdMatch[1].trim(),
    message: (msgMatch?.[1] || "").trim(),
  };
}

/**
 * Extract <local-command-stdout>...</local-command-stdout> body from a string.
 * Returns the inner text or null if not matched. The stdout may be emitted
 * either as a system/local_command record (old format) or as a type:"user"
 * record with string content (Claude Code 2.1+).
 * @param {unknown} content
 * @returns {string | null}
 */
function parseLocalCommandStdout(content) {
  if (typeof content !== "string") return null;
  const m = content.match(
    /<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/,
  );
  return m ? m[1] : null;
}

/**
 * Detect a <local-command-caveat>...</local-command-caveat> wrapper. These
 * meta-messages accompany slash command execution and should not be shown as
 * user text in the conversation.
 * @param {unknown} content
 * @returns {boolean}
 */
function isLocalCommandCaveat(content) {
  return (
    typeof content === "string" && /<local-command-caveat>/.test(content)
  );
}

/**
 * Parse a <bash-input>...</bash-input> wrapper. This is how shell commands
 * typed with the `! ` prefix are recorded as type:"user" string content.
 * Returns the bash command text or null.
 * @param {unknown} content
 * @returns {string | null}
 */
function parseBashInputContent(content) {
  if (typeof content !== "string") return null;
  const m = content.match(/<bash-input>([\s\S]*?)<\/bash-input>/);
  return m ? m[1] : null;
}

/**
 * Parse a <bash-stdout>...</bash-stdout><bash-stderr>...</bash-stderr>
 * response wrapper (always emitted together, one of them may be empty).
 * Returns { stdout, stderr } or null if neither tag is present.
 * @param {unknown} content
 * @returns {{stdout: string, stderr: string} | null}
 */
function parseBashOutputContent(content) {
  if (typeof content !== "string") return null;
  const outMatch = content.match(/<bash-stdout>([\s\S]*?)<\/bash-stdout>/);
  const errMatch = content.match(/<bash-stderr>([\s\S]*?)<\/bash-stderr>/);
  if (!outMatch && !errMatch) return null;
  return {
    stdout: outMatch ? outMatch[1] : "",
    stderr: errMatch ? errMatch[1] : "",
  };
}

/**
 * True if a user message string content is some kind of slash command or
 * bash command wrapper — the command itself, its stdout, or a caveat
 * meta-message. Used to suppress the raw XML from appearing as user bubble
 * text in turns.
 * @param {unknown} content
 */
function isSlashCommandWrapperContent(content) {
  if (typeof content !== "string") return false;
  return (
    parseSlashCommandContent(content) !== null ||
    parseLocalCommandStdout(content) !== null ||
    isLocalCommandCaveat(content) ||
    parseBashInputContent(content) !== null ||
    parseBashOutputContent(content) !== null
  );
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

  // Collect system events (commands, compact boundaries, etc.).
  // Single ordered pass over all records so that slash command stdout can be
  // attached to the preceding command event regardless of whether it's
  // emitted as a type:"system" record (old) or a type:"user" string (new).
  const systemEvents = [];
  let lastCommandEvent = null;
  for (const rec of lines) {
    // --- type:"user" slash command / bash wrappers (Claude Code 2.1+) ---
    if (rec.type === "user" && !rec.isSidechain) {
      const content = rec.message?.content;
      const parsedCmd = parseSlashCommandContent(content);
      if (parsedCmd) {
        const ev = {
          type: "command",
          kind: "slash",
          command: parsedCmd.command,
          message: parsedCmd.message,
          output: "",
          isError: false,
          timestamp: rec.timestamp,
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, {
                hour12: false,
              })
            : "",
        };
        systemEvents.push(ev);
        lastCommandEvent = ev;
        continue;
      }
      const bashInput = parseBashInputContent(content);
      if (bashInput !== null) {
        const ev = {
          type: "command",
          kind: "bash",
          command: bashInput,
          message: "",
          output: "",
          isError: false,
          timestamp: rec.timestamp,
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, {
                hour12: false,
              })
            : "",
        };
        systemEvents.push(ev);
        lastCommandEvent = ev;
        continue;
      }
      const bashOutput = parseBashOutputContent(content);
      if (bashOutput) {
        if (lastCommandEvent && !lastCommandEvent.output) {
          // Combine stdout and stderr; mark as error if stderr has content.
          const parts = [];
          if (bashOutput.stdout) parts.push(bashOutput.stdout);
          if (bashOutput.stderr) parts.push(bashOutput.stderr);
          lastCommandEvent.output = parts.join("\n").trim();
          lastCommandEvent.isError = !!bashOutput.stderr.trim();
        }
        continue;
      }
      const stdoutBody = parseLocalCommandStdout(content);
      if (stdoutBody !== null) {
        if (lastCommandEvent && !lastCommandEvent.output) {
          lastCommandEvent.output = stdoutBody;
        }
        continue;
      }
      // <local-command-caveat> and other meta wrappers are silently skipped
      continue;
    }

    // --- type:"system" local_command (legacy format) ---
    if (rec.type === "system" && rec.subtype === "local_command") {
      const content = rec.content || "";
      const cmdMatch = content.match(/<command-name>([^<]+)<\/command-name>/);
      const msgMatch = content.match(
        /<command-message>([^<]*)<\/command-message>/,
      );
      const stdoutBody = parseLocalCommandStdout(content);
      if (cmdMatch) {
        const ev = {
          type: "command",
          kind: "slash",
          command: cmdMatch[1],
          message: msgMatch?.[1] || "",
          output: "",
          isError: false,
          timestamp: rec.timestamp,
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, {
                hour12: false,
              })
            : "",
        };
        systemEvents.push(ev);
        lastCommandEvent = ev;
      } else if (stdoutBody !== null) {
        if (lastCommandEvent && !lastCommandEvent.output) {
          lastCommandEvent.output = stdoutBody;
        }
      }
      continue;
    }

    // --- type:"system" compact_boundary ---
    if (rec.type === "system" && rec.subtype === "compact_boundary") {
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

      // Parse MCP tool info
      const mcpInfo = parseMcpToolName(tu.name);

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
        mcp: mcpInfo,
      };
    });

    // Find the corresponding user message by walking up the parentUuid chain.
    // Some records (e.g. "attachment") sit between the assistant and its user record.
    const parentRec = findParentUser(rec, byUuid);
    let userText = "";
    let agentId = rec.agentId || null;
    if (parentRec) {
      const userContent = parentRec.message?.content;
      if (Array.isArray(userContent)) {
        userText = userContent
          .filter((c) => c.type === "text")
          .map((c) => c.text || "")
          .join("\n")
          .trim();
      } else if (typeof userContent === "string") {
        // Slash command wrappers (the command itself, its stdout, or the
        // caveat meta-message) are surfaced as systemEvents above; skip them
        // here so the turn does not render a user bubble with raw XML tags.
        if (isSlashCommandWrapperContent(userContent)) {
          userText = "";
        } else {
          userText = userContent;
        }
      }
      // Get agentId from parent user record if not in assistant record
      if (!agentId && parentRec.agentId) {
        agentId = parentRec.agentId;
      }
    }

    // If this assistant's direct parent is another assistant (not a user),
    // it means this is part of the same conversation turn.
    // Merge it into the previous turn if they share the same user text.
    const directParent = byUuid.get(rec.parentUuid);
    const prevTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const shouldMerge = prevTurn && prevTurn.userText === userText &&
      (directParent?.type === "assistant" || (directParent?.type === "user" && parentRec && directParent.uuid === parentRec.uuid));

    if (shouldMerge) {
      // Merge tools
      prevTurn.tools.push(...tools);
      // If current has text but previous doesn't, use current's text
      if (textBlocks && !prevTurn.assistantText) {
        prevTurn.assistantText = textBlocks;
      }
      // Accumulate token usage
      prevTurn.input += usage.input_tokens || 0;
      prevTurn.output += usage.output_tokens || 0;
      prevTurn.cacheR += usage.cache_read_input_tokens || 0;
      prevTurn.cacheC += usage.cache_creation_input_tokens || 0;
      continue;
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
      agentId,
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
      cacheR: usage.cache_read_input_tokens || 0,
      cacheC: usage.cache_creation_input_tokens || 0,
      thinking,
      tools,
    });
  }

  // Collect hook events from attachments
  const hooks = [];
  for (const rec of lines) {
    if (rec.type !== "attachment") continue;
    const att = rec.attachment;
    if (!att || att.type !== "hook_success") continue;
    hooks.push({
      hookName: att.hookName || "",
      hookEvent: att.hookEvent || "",
      durationMs: att.durationMs || 0,
      exitCode: att.exitCode ?? 0,
      stdout: typeof att.stdout === "string" ? att.stdout : "",
      stderr: typeof att.stderr === "string" ? att.stderr : "",
      timestamp: rec.timestamp || "",
    });
  }

  // Collect stop_reason and cache TTL stats from assistant messages
  const stopReasons = {};
  const cacheTtl = { ephemeral1h: 0, ephemeral5m: 0 };
  for (const rec of lines) {
    if (rec.type !== "assistant") continue;
    const msg = rec.message;
    if (!msg) continue;
    const sr = msg.stop_reason;
    if (sr) stopReasons[sr] = (stopReasons[sr] || 0) + 1;
    const usage = msg.usage || {};
    const cc = usage.cache_creation || {};
    if (cc.ephemeral_1h_input_tokens) cacheTtl.ephemeral1h += cc.ephemeral_1h_input_tokens;
    if (cc.ephemeral_5m_input_tokens) cacheTtl.ephemeral5m += cc.ephemeral_5m_input_tokens;
  }

  // Collect subagent statistics
  // For main session file: /path/to/sessionId.jsonl -> sessionDir is /path/to/sessionId/
  // For subagent file: /path/to/sessionId/subagents/agent-id.jsonl -> sessionDir is /path/to/sessionId/
  const baseDir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".jsonl");
  const sessionDir = path.join(baseDir, baseName);
  const subagents = await collectSubagentStats(sessionDir);

  return { sessionId, slug, gitBranch, turns, systemEvents, hooks, stopReasons, cacheTtl, subagents };
}

/** Map tool name to CSS class */
function toolNameToCls(name) {
  const n = (name || "").toLowerCase();
  if (n === "bash") return "bash";
  if (n === "read") return "read";
  if (n === "edit") return "edit";
  if (n === "write") return "write";
  if (n === "toolsearch") return "toolsearch";
  if (n === "grep") return "grep";
  if (n === "glob") return "glob";
  if (n === "web" || n === "web_search" || n === "web_fetch") return "web";
  if (n === "agent") return "agent";
  if (n.startsWith("mcp__")) return "mcp";
  return "other";
}

/**
 * Parse MCP tool name to extract server and method
 * @param {string} name - Tool name like "mcp__server_name__method_name"
 * @returns {{server: string, method: string} | null}
 */
function parseMcpToolName(name) {
  if (!name || !name.startsWith("mcp__")) return null;
  const parts = name.split("__");
  if (parts.length < 3) return null;
  // mcp__{server}__{method}
  const server = parts[1];
  const method = parts.slice(2).join("__");
  return { server, method };
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
