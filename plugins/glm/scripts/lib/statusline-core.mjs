// glm 插件 statusline 核心逻辑：输入解析 / 单行渲染 / 缓存 / 后端判定 / 配置目录解析。
// 与 core.mjs 同样坚持纯函数 + 依赖注入，供 scripts/statusline.mjs 与 test/ 复用。

import os from 'node:os';
import path from 'node:path';

export const CACHE_TTL_MS = 5 * 60 * 1000;

/** hook 校准间隔：活跃会话中每分钟至多拉一次（纯查询接口，零 token 消耗） */
export const REFRESH_INTERVAL_MS = 60 * 1000;

/**
 * 解析当前 Claude Code 的配置目录：zclaude 场景通过 CLAUDE_CONFIG_DIR 使用独立
 * 配置目录（settings.json / plugins 均在其中）；未设置时为官方默认 ~/.claude。
 * glm 的所有落盘（备份 / 缓存 / stub / settings 改写）都跟随此目录，
 * 确保只影响当前场景、绝不触碰另一套配置。
 */
export function resolveClaudeDir(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

/** 智谱后端判定：statusline 由 Claude Code spawn，继承其 env（含 ANTHROPIC_BASE_URL） */
export function isGlmBackend(baseUrl) {
  if (!baseUrl) return false;
  try {
    const host = new URL(baseUrl).hostname;
    return /(^|\.)bigmodel\.cn$|(^|\.)z\.ai$/.test(host);
  } catch {
    return false;
  }
}

/** 安全解析 statusline stdin JSON → {model, cwd, ctxPct}（均可能为 null） */
export function parseStatuslineInput(text) {
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    return {model: null, cwd: null, ctxPct: null};
  }
  const model = json?.model?.display_name ?? null;
  const cwd = json?.workspace?.current_dir ?? json?.cwd ?? null;
  const ctxPct = Number(json?.context_window?.used_percentage);
  return {model, cwd, ctxPct: Number.isFinite(ctxPct) ? ctxPct : null};
}

/** 路径缩写为 ~ 相对形式 */
export function shortenPath(dir, home = process.env.HOME) {
  if (!dir) return null;
  if (home && (dir === home || dir.startsWith(home + '/'))) {
    return '~' + dir.slice(home.length);
  }
  return dir;
}

const GREEN = '\x1b[01;32m';
const BLUE = '\x1b[01;34m';
const RESET = '\x1b[00m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[01;33m';
const RED = '\x1b[01;31m';

/** 限额百分比着色（与原 statusline-command.sh 一致）：≥80 红、≥60 黄、其余暗灰 */
export function colorFor(pct) {
  if (pct >= 80) return RED;
  if (pct >= 60) return YELLOW;
  return DIM;
}

/** 重置时刻：同日 HH:MM，跨日 MM-DD HH:MM（与原 fmt_reset 一致）；无效返回 null */
export function formatResetAt(tsMs, now = Date.now()) {
  if (!Number.isFinite(tsMs)) return null;
  const d = new Date(tsMs);
  const pad = (n) => String(n).padStart(2, '0');
  const sameDay = d.toDateString() === new Date(now).toDateString();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

function limitLabel(unit, number) {
  if (unit === 3) return `${number}h`;
  if (unit === 6) return '7d';
  return `u${unit}`;
}

/**
 * 智谱模式单行渲染——完全对齐原 statusline-command.sh 的格式：
 * user@host:dir [model] ctx:NN% 5h:NN% 7d:NN%(≥90% 追加 (HH:MM) 重置时刻)。
 * windows: parseQuotaResponse 产物（null/缺窗口 → 跳过对应段，与官方「字段缺失即跳过」一致）。
 */
export function renderGlmLine(windows, {user, host, cwd, model, ctxPct, now = Date.now()} = {}) {
  let out = '';
  const dir = shortenPath(cwd);
  if (user && host && dir) {
    out += `${GREEN}${user}@${host}${RESET}:${BLUE}${dir}${RESET}`;
  } else if (dir) {
    out += `${BLUE}${dir}${RESET}`;
  }
  if (model) out += ` ${DIM}[${model}]${RESET}`;
  if (ctxPct !== null && ctxPct !== undefined) out += ` ${DIM}ctx:${Math.round(ctxPct)}%${RESET}`;
  for (const w of windows ?? []) {
    const label = limitLabel(w.unit, w.number);
    const pct = Math.round(w.percentage);
    out += ` ${colorFor(pct)}${label}:${pct}%${RESET}`;
    if (pct >= 90) {
      const at = formatResetAt(w.nextResetTimeMs, now);
      if (at) out += `${DIM}(${at})${RESET}`;
    }
  }
  return out || 'glm statusline';
}

/** 兜底基础行（非智谱且无原配置时），保证状态栏永不空白 */
export function renderBasicLine({user, host, cwd, model} = {}) {
  return renderGlmLine(null, {user, host, cwd, model});
}

/** 读缓存：文件不存在/损坏返回 null；过期数据照常返回（由调用方标记 stale） */
export function readCache(cachePath, fs) {
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.windows)) return null;
    return data; // {windows, level, fetchedAt}
  } catch {
    return null;
  }
}

/** 原子写缓存（tmp + rename），失败静默（缓存写失败不该影响状态栏） */
export function writeCache(cachePath, data, fs) {
  try {
    const tmp = `${cachePath}.${process.pid}.tmp`;
    fs.mkdirSync(pathDir(cachePath), {recursive: true});
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, cachePath);
    return true;
  } catch {
    return false;
  }
}

function pathDir(p) {
  const i = p.lastIndexOf('/');
  return i > 0 ? p.slice(0, i) : '.';
}
