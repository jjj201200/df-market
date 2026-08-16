// glm 插件 statusline 核心逻辑：输入解析 / 单行渲染 / 缓存 / 后端判定。
// 与 core.mjs 同样坚持纯函数 + 依赖注入，供 scripts/statusline.mjs 与 test/ 复用。

export const CACHE_TTL_MS = 5 * 60 * 1000;

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

/** 紧凑倒计时：<1h → 52m；<1d → 3h24m；≥1d → 5d4h */
export function remainingShort(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60}m`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** 百分比着色档位：<60 绿、60-79 黄、≥80 红；着色范围含 % 号 */
export function colorFor(pct) {
  if (pct >= 80) return RED;
  if (pct >= 60) return YELLOW;
  return GREEN;
}

function pctText(pct, {unknown = '?%', stale = false} = {}) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return unknown;
  const mark = stale ? '?' : '';
  return `${colorFor(pct)}${Math.round(pct)}%${mark}${RESET}`;
}

function shortTag(unit, number) {
  if (unit === 3) return `${number}h`;
  if (unit === 6) return '7d';
  return `u${unit}`;
}

/**
 * 智谱模式单行渲染。
 * windows: parseQuotaResponse 产物（可能为 null → 全 ?%）；
 * opts.stale: 数据来自过期缓存；opts.model/cwd/ctxPct: stdin 提取值。
 */
export function renderGlmLine(windows, {model, cwd, ctxPct, stale = false, now = Date.now()} = {}) {
  const parts = [];
  const w5 = windows?.find((w) => w.unit === 3);
  const w7 = windows?.find((w) => w.unit === 6);
  const rest = w5 && remainingShort(w5.nextResetTimeMs - now);
  parts.push(`⏱ ${shortTag(w5?.unit ?? 3, w5?.number ?? 5)} ${pctText(w5?.percentage ?? null, {stale})}${rest ? ` (${rest})` : ''}`);
  parts.push(`${shortTag(w7?.unit ?? 6, w7?.number ?? 1)} ${pctText(w7?.percentage ?? null, {stale})}`);
  if (ctxPct !== null && ctxPct !== undefined) parts.push(`ctx ${pctText(ctxPct)}`);
  if (model) parts.push(model);
  const dir = shortenPath(cwd);
  if (dir) parts.push(dir);
  return parts.join(' │ ');
}

/** 兜底基础行（非智谱且无原配置时），保证状态栏永不空白 */
export function renderBasicLine({model, cwd} = {}) {
  const parts = [];
  if (model) parts.push(model);
  const dir = shortenPath(cwd);
  if (dir) parts.push(dir);
  return parts.join(' │ ') || 'glm statusline';
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
