// glm 插件核心逻辑：端点构建 / 接口请求 / 响应解析 / 面板渲染。
// 全部为纯函数或参数化依赖注入（fetchImpl），不直接触碰网络与环境变量，
// 供 scripts/usage.mjs、scripts/statusline.mjs 与 test/ 复用。

export class UsageError extends Error {
  /** kind: config | auth | notfound | http | network | parse */
  constructor(message, {kind = 'unknown', raw} = {}) {
    super(message);
    this.name = 'UsageError';
    this.kind = kind;
    this.raw = raw;
  }
}

/** 由 ANTHROPIC_BASE_URL 推导 monitor API 端点与管理页链接 */
export function buildEndpoints(baseUrl) {
  if (!baseUrl) {
    throw new UsageError(
      '未检测到 ANTHROPIC_BASE_URL 环境变量。本插件面向智谱 GLM Coding Plan，需要 Claude Code 通过智谱端点运行：\n' +
        '  export ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic\n' +
        '  或 export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic',
      {kind: 'config'},
    );
  }
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new UsageError(`ANTHROPIC_BASE_URL 不是合法 URL：${baseUrl}`, {kind: 'config'});
  }
  const host = url.hostname;
  if (!/(^|\.)bigmodel\.cn$|(^|\.)z\.ai$/.test(host)) {
    throw new UsageError(
      `ANTHROPIC_BASE_URL 域名（${host}）不是智谱官方端点。支持：open.bigmodel.cn / dev.bigmodel.cn / api.z.ai`,
      {kind: 'config'},
    );
  }
  const origin = url.origin;
  // 国内端点在 quota/limit，api.z.ai 国际端点在 quota——按序尝试，404 换下一个
  const urls = [`${origin}/api/monitor/usage/quota/limit`, `${origin}/api/monitor/usage/quota`];
  const manageUrl = /(^|\.)z\.ai$/.test(host) ? 'https://z.ai/subscribe' : 'https://open.bigmodel.cn/coding-plan';
  return {origin, urls, manageUrl, host};
}

/**
 * 依序请求端点列表。404 时回退下一个；401/403 直接抛（换端点无意义）；
 * 网络/超时/5xx 不回退（同 origin 两个端点大概率一起失败，串行等待加倍耗时）。
 */
export async function fetchQuota(fetchImpl, urls, token, {timeoutMs = 10000} = {}) {
  let lastError = null;
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        headers: {Authorization: token, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'},
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new UsageError(`API key 无效或无权限（HTTP ${res.status}）`, {kind: 'auth'});
      }
      if (res.status === 404) {
        lastError = new UsageError('用量端点均返回 404：当前端点可能不提供用量接口（中转站不支持）', {kind: 'notfound'});
        continue;
      }
      if (!res.ok) {
        throw new UsageError(`接口返回 HTTP ${res.status}，请稍后重试`, {kind: 'http'});
      }
      return await res.json();
    } catch (e) {
      if (e instanceof UsageError) {
        if (e.kind === 'notfound') continue;
        throw e;
      }
      lastError = new UsageError('接口暂时不可用（网络错误或超时），请稍后重试', {kind: 'network', cause: e});
      break; // 同 origin 端点大概率一起失败，串行重试只会加倍等待
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new UsageError('请求失败', {kind: 'unknown'});
}

/**
 * unit 语义为逆向工程结论（无官方文档）：
 * unit=3 → 小时窗口（number 个小时）；unit=6 → 周窗口。未知值兜底显示原始数值。
 */
export function windowLabel(unit, number) {
  if (unit === 3) return `${number} 小时窗口用量`;
  if (unit === 6) return number === 1 ? '7 天用量' : `${number} 周用量`;
  return `窗口（unit=${unit} × ${number}）用量`;
}

function unitOrder(unit) {
  return unit === 3 ? 0 : unit === 6 ? 1 : 9;
}

function clampPct(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** 原始响应 JSON → {level, windows[]}；结构异常抛 UsageError(kind: parse, raw) */
export function parseQuotaResponse(json) {
  const data = json && typeof json === 'object' ? json.data ?? json : null;
  const limits = data ? data.limits : null;
  if (!Array.isArray(limits) || limits.length === 0) {
    throw new UsageError('响应结构无法解析：缺少 limits 数组', {kind: 'parse', raw: json});
  }
  const windows = limits
    .map((l) => ({
      label: windowLabel(l.unit, l.number),
      unit: l.unit,
      number: l.number,
      used: l.currentValue ?? 0,
      total: l.usage ?? 0,
      remaining: l.remaining ?? null,
      percentage: clampPct(l.percentage),
      nextResetTimeMs: typeof l.nextResetTime === 'number' ? l.nextResetTime : NaN,
    }))
    .sort((a, b) => unitOrder(a.unit) - unitOrder(b.unit));
  return {level: data.level ?? null, windows};
}

/** 倒计时人性化：<1h → X 分；<1d → X 小时 Y 分；≥1d → X 天 Y 小时 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '重置时间未知';
  if (ms <= 0) return '即将重置';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} 分后`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h} 小时 ${m} 分后`;
  const d = Math.floor(h / 24);
  return `${d} 天 ${h % 24} 小时后`;
}

/** 重置时刻的本地日期时间：M月D日 HH:MM（跨年时带年份） */
export function formatResetTime(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear() !== new Date(now).getFullYear() ? `${d.getFullYear()}年` : '';
  return `${year}${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatNumber(n) {
  return Number(n ?? 0).toLocaleString('en-US');
}

/** 进度条（█ 填充 / ░ 空位），整行同字符不参与跨字宽对齐，渲染稳定 */
export function renderBar(percentage, width = 30) {
  const pct = clampPct(percentage);
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

const LEVELS = {lite: 'Lite', pro: 'Pro', max: 'Max'};

/**
 * 格式化面板（学官方 /usage：无框线、无 emoji——空行分区块，
 * 中文标签 + 定宽空格做键值列对齐；标签等宽，跨字体渲染相对对齐稳定）。
 */
export function renderPanel(parsed, {now = Date.now(), manageUrl} = {}) {
  const levelText = parsed.level ? ` · ${LEVELS[parsed.level] ?? parsed.level} 档` : '';
  const lines = [`GLM Coding Plan 用量${levelText}`];
  for (const win of parsed.windows) {
    lines.push('');
    lines.push(win.label);
    lines.push(`  ${renderBar(win.percentage)}  ${String(win.percentage).padStart(3)}%`);
    lines.push(`  已用  ${formatNumber(win.used)} / ${formatNumber(win.total)}`);
    const resetAt = formatResetTime(win.nextResetTimeMs, now);
    lines.push(`  重置  ${formatDuration(win.nextResetTimeMs - now)}${resetAt ? ` · ${resetAt}` : ''}`);
  }
  if (manageUrl) {
    lines.push('');
    lines.push(`管理套餐: ${manageUrl}`);
  }
  return lines.join('\n');
}
