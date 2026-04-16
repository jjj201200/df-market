import fs from 'fs';
import readline from 'readline';
import path from 'path';
import type { SessionData, JSONLRecord, Turn, SystemEvent, HookEvent } from './types.js';
import {
  parseSlashCommandContent,
  parseBashInputContent,
  parseBashOutputContent,
  parseLocalCommandStdout,
  isSlashCommandWrapperContent,
} from './content.js';
import { toolNameToCls, parseMcpToolName, buildInputArgs, buildParamsSummary } from './tools.js';
import { findParentUser } from './parent.js';
import { collectSubagentStats } from './subagent.js';

export async function parseSession(filePath: string): Promise<SessionData | null> {
  const lines: JSONLRecord[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) {
      try {
        lines.push(JSON.parse(line) as JSONLRecord);
      } catch {}
    }
  }

  if (!lines.length) return null;

  const meta = lines[0];
  const sessionId = meta.sessionId || '';
  const slug = meta.slug || sessionId;
  const gitBranch = meta.gitBranch || '';

  const byUuid = new Map<string, JSONLRecord>();
  for (const l of lines) if (l.uuid) byUuid.set(l.uuid, l);

  const toolResults = new Map<
    string,
    { content: string; isError: boolean; userRecord: JSONLRecord }
  >();
  for (const rec of lines) {
    if (rec.type !== 'user') continue;
    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c.type === 'tool_result' && c.tool_use_id) {
        let resultContent = '';
        if (typeof c.content === 'string') {
          resultContent = c.content;
        } else if (Array.isArray(c.content)) {
          resultContent = c.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text || '')
            .join('\n');
        } else {
          resultContent = JSON.stringify(c.content ?? '');
        }
        toolResults.set(c.tool_use_id, {
          content: resultContent,
          isError: !!c.is_error,
          userRecord: rec,
        });
      }
    }
  }

  const systemEvents: SystemEvent[] = [];
  let lastCommandEvent: (SystemEvent & { type: 'command' }) | null = null;

  for (const rec of lines) {
    if (rec.type === 'user' && !rec.isSidechain) {
      const content = rec.message?.content;
      const parsedCmd = parseSlashCommandContent(content);
      if (parsedCmd) {
        const ev: SystemEvent & { type: 'command' } = {
          type: 'command',
          kind: 'slash',
          command: parsedCmd.command,
          message: parsedCmd.message,
          output: '',
          isError: false,
          timestamp: rec.timestamp || '',
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, { hour12: false })
            : '',
        };
        systemEvents.push(ev);
        lastCommandEvent = ev;
        continue;
      }
      const bashInput = parseBashInputContent(content);
      if (bashInput !== null) {
        const ev: SystemEvent & { type: 'command' } = {
          type: 'command',
          kind: 'bash',
          command: bashInput,
          message: '',
          output: '',
          isError: false,
          timestamp: rec.timestamp || '',
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, { hour12: false })
            : '',
        };
        systemEvents.push(ev);
        lastCommandEvent = ev;
        continue;
      }
      const bashOutput = parseBashOutputContent(content);
      if (bashOutput) {
        if (lastCommandEvent && !lastCommandEvent.output) {
          const parts: string[] = [];
          if (bashOutput.stdout) parts.push(bashOutput.stdout);
          if (bashOutput.stderr) parts.push(bashOutput.stderr);
          lastCommandEvent.output = parts.join('\n').trim();
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
      continue;
    }

    if (rec.type === 'system' && rec.subtype === 'local_command') {
      const content = rec.content || '';
      const cmdMatch = content.match(/<command-name>([^<]+)<\/command-name>/);
      const msgMatch = content.match(/<command-message>([^<]*)<\/command-message>/);
      const stdoutBody = parseLocalCommandStdout(content);
      if (cmdMatch) {
        const ev: SystemEvent & { type: 'command' } = {
          type: 'command',
          kind: 'slash',
          command: cmdMatch[1] || '',
          message: msgMatch?.[1] || '',
          output: '',
          isError: false,
          timestamp: rec.timestamp || '',
          time: rec.timestamp
            ? new Date(rec.timestamp).toLocaleTimeString(undefined, { hour12: false })
            : '',
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

    if (rec.type === 'system' && rec.subtype === 'compact_boundary') {
      const compactMeta = rec.compactMetadata || {};
      systemEvents.push({
        type: 'compact',
        trigger: compactMeta.trigger || 'auto',
        preTokens: compactMeta.preTokens || 0,
        timestamp: rec.timestamp || '',
        time: rec.timestamp
          ? new Date(rec.timestamp).toLocaleTimeString(undefined, { hour12: false })
          : '',
      });
    }
  }

  const turns: Turn[] = [];
  let turnIndex = 0;

  for (const rec of lines) {
    if (rec.type !== 'assistant') continue;
    const msg = rec.message;
    if (!msg) continue;

    const usage = msg.usage || {};
    const content = Array.isArray(msg.content) ? msg.content : [];

    const thinkingBlock = content.find((c) => c.type === 'thinking');
    const thinking = thinkingBlock?.thinking || null;

    const textBlocks = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n')
      .trim();

    const toolUseBlocks = content.filter((c) => c.type === 'tool_use');
    const tools = toolUseBlocks.map((tu) => {
      const result = toolResults.get(tu.id || '');
      const retContent = result?.content || '';
      const retLines = retContent.split('\n').length;
      const retSize = Buffer.byteLength(retContent, 'utf8');

      let dur: number | null = null;
      if (result?.userRecord?.timestamp && rec.timestamp) {
        const ms = new Date(result.userRecord.timestamp).getTime() - new Date(rec.timestamp).getTime();
        dur = ms > 0 ? ms : null;
      }

      const cls = toolNameToCls(tu.name || '');
      const inputArgs = buildInputArgs(tu.name || '', (tu.input as Record<string, unknown>) || {});
      const params = buildParamsSummary(tu.name || '', (tu.input as Record<string, unknown>) || {});
      const mcpInfo = parseMcpToolName(tu.name || '');

      return {
        name: tu.name || '',
        cls,
        params,
        inputArgs,
        status: result?.isError ? ('err' as const) : ('ok' as const),
        isErr: result?.isError || false,
        startTime: rec.timestamp || '',
        endTime: result?.userRecord?.timestamp || null,
        dur: dur !== null ? dur + 'ms' : '—',
        retContent,
        retSize: retSize >= 1024 ? (retSize / 1024).toFixed(1) + ' KB' : retSize + ' B',
        retLines: retLines > 1 ? retLines + ' lines' : '1 line',
        mcp: mcpInfo,
      };
    });

    const parentRec = findParentUser(rec, byUuid);
    let userText = '';
    let agentId = rec.agentId || null;
    if (parentRec) {
      const userContent = parentRec.message?.content;
      if (Array.isArray(userContent)) {
        userText = userContent
          .filter((c) => c.type === 'text')
          .map((c) => c.text || '')
          .join('\n')
          .trim();
      } else if (typeof userContent === 'string') {
        if (isSlashCommandWrapperContent(userContent)) {
          userText = '';
        } else {
          userText = userContent;
        }
      }
      if (!agentId && parentRec.agentId) {
        agentId = parentRec.agentId;
      }
    }

    const directParent = byUuid.get(rec.parentUuid || '');
    const prevTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const shouldMerge =
      prevTurn &&
      prevTurn.userText === userText &&
      (directParent?.type === 'assistant' ||
        (directParent?.type === 'user' && parentRec && directParent.uuid === parentRec.uuid));

    if (shouldMerge) {
      prevTurn.tools.push(...tools);
      if (textBlocks && !prevTurn.assistantText) {
        prevTurn.assistantText = textBlocks;
      }
      prevTurn.input += usage.input_tokens || 0;
      prevTurn.output += usage.output_tokens || 0;
      prevTurn.cacheR += usage.cache_read_input_tokens || 0;
      prevTurn.cacheC += usage.cache_creation_input_tokens || 0;
      continue;
    }

    turns.push({
      id: ++turnIndex,
      type: 'turn',
      time: rec.timestamp
        ? new Date(rec.timestamp).toLocaleTimeString(undefined, { hour12: false })
        : '',
      timestamp: rec.timestamp || '',
      userText,
      assistantText: textBlocks,
      model: msg.model || '',
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

  const hooks: HookEvent[] = [];
  for (const rec of lines) {
    if (rec.type !== 'attachment') continue;
    const att = rec.attachment;
    if (!att || att.type !== 'hook_success') continue;
    hooks.push({
      hookName: att.hookName || '',
      hookEvent: att.hookEvent || '',
      durationMs: att.durationMs || 0,
      exitCode: att.exitCode ?? 0,
      stdout: typeof att.stdout === 'string' ? att.stdout : '',
      stderr: typeof att.stderr === 'string' ? att.stderr : '',
      timestamp: rec.timestamp || '',
    });
  }

  const stopReasons: Record<string, number> = {};
  const cacheTtl = { ephemeral1h: 0, ephemeral5m: 0 };
  for (const rec of lines) {
    if (rec.type !== 'assistant') continue;
    const msg = rec.message;
    if (!msg) continue;
    const sr = msg.usage?.stop_reason;
    if (sr) stopReasons[sr] = (stopReasons[sr] || 0) + 1;
    const cc = msg.usage?.cache_creation || {};
    if (cc.ephemeral_1h_input_tokens) cacheTtl.ephemeral1h += cc.ephemeral_1h_input_tokens;
    if (cc.ephemeral_5m_input_tokens) cacheTtl.ephemeral5m += cc.ephemeral_5m_input_tokens;
  }

  const baseDir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.jsonl');
  const sessionDir = path.join(baseDir, baseName);
  const subagents = await collectSubagentStats(sessionDir);

  return { sessionId, slug, gitBranch, turns, systemEvents, hooks, stopReasons, cacheTtl, subagents };
}
