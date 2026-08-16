#!/usr/bin/env node
// PostToolUse hook：活跃会话中定期校准 GLM 用量缓存。
// statusline 渲染路径纯读缓存（零网络），本 hook 负责让缓存保持新鲜：
// 距上次拉取超过 REFRESH_INTERVAL_MS 才调 monitor 接口（纯查询、零 token/积分消耗）。
// 任何失败都静默退出——hook 绝不干扰会话。

import fs from 'node:fs';
import path from 'node:path';

import {buildEndpoints, fetchQuota, parseQuotaResponse} from '../scripts/lib/core.mjs';
import {REFRESH_INTERVAL_MS, isGlmBackend, readCache, resolveClaudeDir, writeCache} from '../scripts/lib/statusline-core.mjs';

const token = process.env.ANTHROPIC_AUTH_TOKEN;
const baseUrl = process.env.ANTHROPIC_BASE_URL;

if (!token || !isGlmBackend(baseUrl)) {
  process.exit(0); // 非智谱场景：statusline 走透传，无需缓存
}

const cachePath = path.join(resolveClaudeDir(), 'glm', 'cache.json');
const cache = readCache(cachePath, fs);
if (cache && Date.now() - cache.fetchedAt < REFRESH_INTERVAL_MS) {
  process.exit(0); // 缓存新鲜，跳过
}

try {
  const endpoints = buildEndpoints(baseUrl);
  const json = await fetchQuota(fetch, endpoints.urls, token, {timeoutMs: 2500});
  const parsed = parseQuotaResponse(json);
  writeCache(cachePath, {windows: parsed.windows, level: parsed.level, fetchedAt: Date.now()}, fs);
} catch {
  // 静默失败：沿用旧缓存，statusline 照常渲染
}
