'use strict';
const fs = require('fs');
const readline = require('readline');
const os = require('os');
const path = require('path');

/**
 * 在 ~/.claude/projects/ 下查找指定 sessionId 对应的 JSONL 文件路径
 * @param {string} sessionId
 * @returns {string|null}
 */
function findJSONLPath(sessionId) {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  for (const proj of fs.readdirSync(projectsDir)) {
    const projPath = path.join(projectsDir, proj);
    if (!fs.statSync(projPath).isDirectory()) continue;

    // 直接文件
    const direct = path.join(projPath, sessionId + '.jsonl');
    if (fs.existsSync(direct)) return direct;

    // subagents 子目录
    const sub = path.join(projPath, 'subagents');
    if (fs.existsSync(sub)) {
      for (const f of fs.readdirSync(sub)) {
        if (f === sessionId + '.jsonl') return path.join(sub, f);
      }
    }
  }
  return null;
}

/**
 * 列出所有会话（遍历 ~/.claude/projects/ 下所有 JSONL）
 * @returns {Array<{sessionId, slug, gitBranch, projectDir, filePath, mtime}>}
 */
function listSessions() {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const sessions = new Map();

  function scanDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      let stat;
      try { stat = fs.statSync(fp); } catch { continue; }
      if (stat.isDirectory() && f === 'subagents') {
        scanDir(fp);
      } else if (f.endsWith('.jsonl')) {
        const sessionId = f.replace('.jsonl', '');
        if (!sessions.has(sessionId)) {
          // 读第一行获取 slug 等元数据
          const meta = readFirstLineMeta(fp);
          sessions.set(sessionId, {
            sessionId,
            slug: meta.slug || sessionId,
            gitBranch: meta.gitBranch || '',
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

  return Array.from(sessions.values()).sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function readFirstLineMeta(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const firstLine = content.split('\n').find(l => l.trim());
    if (!firstLine) return {};
    const obj = JSON.parse(firstLine);
    return { slug: obj.slug, gitBranch: obj.gitBranch };
  } catch { return {}; }
}

/**
 * 解析 JSONL 文件，返回结构化 session 数据
 * @param {string} filePath
 * @returns {Promise<SessionData>}
 */
async function parseSession(filePath) {
  const lines = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) {
      try { lines.push(JSON.parse(line)); } catch {}
    }
  }

  if (!lines.length) return null;

  const meta = lines[0];
  const sessionId = meta.sessionId || '';
  const slug = meta.slug || sessionId;
  const gitBranch = meta.gitBranch || '';

  // 按 uuid 建立索引
  const byUuid = new Map();
  for (const l of lines) byUuid.set(l.uuid, l);

  // 收集 tool_result：key = toolUseId, value = { content, isError, userRecord }
  const toolResults = new Map();
  for (const rec of lines) {
    if (rec.type !== 'user') continue;
    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c.type === 'tool_result') {
        toolResults.set(c.tool_use_id, {
          content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content ?? ''),
          isError: !!c.is_error,
          userRecord: rec,
        });
      }
    }
  }

  // 只处理 assistant 消息（包含实际用量）
  const turns = [];
  let turnIndex = 0;

  for (const rec of lines) {
    if (rec.type !== 'assistant') continue;
    const msg = rec.message;
    if (!msg) continue;

    const usage = msg.usage || {};
    const content = Array.isArray(msg.content) ? msg.content : [];

    // 提取 thinking
    const thinkingBlock = content.find(c => c.type === 'thinking');
    const thinking = thinkingBlock?.thinking || null;

    // 提取文字输出
    const textBlocks = content.filter(c => c.type === 'text').map(c => c.text || '').join('\n').trim();

    // 提取工具调用
    const toolUseBlocks = content.filter(c => c.type === 'tool_use');
    const tools = toolUseBlocks.map(tu => {
      const result = toolResults.get(tu.id);
      const retContent = result?.content || '';
      const retLines = retContent.split('\n').length;
      const retSize = Buffer.byteLength(retContent, 'utf8');

      // 计算耗时
      let dur = null;
      if (result?.userRecord?.timestamp && rec.timestamp) {
        const ms = new Date(result.userRecord.timestamp) - new Date(rec.timestamp);
        dur = ms > 0 ? ms : null;
      }

      // 工具分类
      const cls = toolNameToCls(tu.name);

      // 关键参数提取
      const inputArgs = buildInputArgs(tu.name, tu.input || {});

      // 参数摘要（单行）
      const params = buildParamsSummary(tu.name, tu.input || {});

      return {
        name: tu.name,
        cls,
        params,
        inputArgs,
        status: result?.isError ? 'err' : 'ok',
        isErr: result?.isError || false,
        startTime: rec.timestamp,
        endTime: result?.userRecord?.timestamp || null,
        dur: dur !== null ? dur + 'ms' : '—',
        retContent,
        retSize: retSize >= 1024 ? (retSize / 1024).toFixed(1) + ' KB' : retSize + ' B',
        retLines: retLines > 1 ? retLines + ' lines' : '1 line',
      };
    });

    // 找对应的 user 消息（parentUuid 指向 assistant，或 assistant 的 parentUuid 指向 user）
    const parentRec = byUuid.get(rec.parentUuid);
    let userText = '';
    if (parentRec?.type === 'user') {
      const userContent = parentRec.message?.content;
      if (Array.isArray(userContent)) {
        userText = userContent.filter(c => c.type === 'text').map(c => c.text || '').join('\n').trim();
      } else if (typeof userContent === 'string') {
        userText = userContent;
      }
    }

    turns.push({
      id: ++turnIndex,
      type: 'turn',
      time: rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString('zh-CN', { hour12: false }) : '',
      timestamp: rec.timestamp,
      userText,
      assistantText: textBlocks,
      model: msg.model || '',
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

  return { sessionId, slug, gitBranch, turns };
}

/** 工具名 → CSS 分类名 */
function toolNameToCls(name) {
  const n = (name || '').toLowerCase();
  if (n === 'bash') return 'bash';
  if (n === 'read') return 'read';
  if (n === 'edit') return 'edit';
  if (n === 'write') return 'write';
  if (n === 'grep') return 'grep';
  if (n === 'glob') return 'glob';
  if (n.includes('web') || n.includes('fetch') || n.includes('search')) return 'web';
  if (n === 'agent') return 'agent';
  return 'other';
}

/** 从工具 input 对象提取 key-value 展示数组 */
function buildInputArgs(toolName, input) {
  const entries = [];
  for (const [k, v] of Object.entries(input)) {
    let vc = 'str';
    if (k === 'command') vc = 'cmd';
    else if (k === 'file_path' || k === 'uri' || k === 'path') vc = 'path';
    else if (typeof v === 'number') vc = 'num';
    else if (typeof v === 'boolean') vc = 'bool';
    const display = typeof v === 'string' ? v : JSON.stringify(v);
    // 截断超长内容
    entries.push({ k, v: display.length > 300 ? display.slice(0, 300) + '...' : display, vc });
  }
  return entries;
}

/** 构建单行参数摘要 */
function buildParamsSummary(toolName, input) {
  const n = (toolName || '').toLowerCase();
  if (n === 'bash') return input.command || '';
  if (n === 'read') {
    let s = input.file_path || '';
    if (input.offset || input.limit) s += ` · L${input.offset||1}-${(input.offset||1)+(input.limit||2000)-1}`;
    return s;
  }
  if (n === 'edit' || n === 'write') return input.file_path || '';
  if (n === 'grep') return `pattern: "${input.pattern || ''}"${input.glob ? ' · ' + input.glob : ''}`;
  if (n === 'glob') return input.pattern || '';
  // 默认：取第一个字符串值
  const first = Object.values(input).find(v => typeof v === 'string');
  return first || JSON.stringify(input).slice(0, 80);
}

module.exports = { parseSession, listSessions, findJSONLPath };
