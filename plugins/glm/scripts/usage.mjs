#!/usr/bin/env node
// /glm:usage 的 CLI 入口：读取环境变量 → 请求 monitor API → 渲染面板。
// token 仅从 process.env 读取：不进 argv、不打印、不落盘。

import {buildEndpoints, fetchQuota, parseQuotaResponse, renderPanel, UsageError} from './lib/core.mjs';

const token = process.env.ANTHROPIC_AUTH_TOKEN;
const baseUrl = process.env.ANTHROPIC_BASE_URL;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!token) {
  fail(
    '未检测到 ANTHROPIC_AUTH_TOKEN 环境变量。\n' +
      '请设置与 Claude Code 相同的环境变量后重试（脚本自行读取，请勿把 token 作为参数传入）：\n' +
      '  export ANTHROPIC_AUTH_TOKEN="你的智谱 API key"',
  );
}

try {
  const endpoints = buildEndpoints(baseUrl);
  const json = await fetchQuota(fetch, endpoints.urls, token);
  const parsed = parseQuotaResponse(json);
  console.log(renderPanel(parsed, {now: Date.now(), manageUrl: endpoints.manageUrl}));
} catch (e) {
  if (e instanceof UsageError && e.kind === 'parse' && e.raw !== undefined) {
    const raw = JSON.stringify(e.raw);
    console.error(`${e.message}。请到 https://github.com/jjj201200/df-market/issues 反馈。原始响应（截断）：`);
    console.error(raw.slice(0, 2000));
  } else {
    console.error(e instanceof UsageError ? e.message : `查询失败：${e.message}`);
  }
  process.exit(1);
}
