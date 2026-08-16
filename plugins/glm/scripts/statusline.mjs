#!/usr/bin/env node
// Claude Code statusline 包装：智谱后端显示 GLM 用量，非智谱后端透传原 statusline。
// 由 ~/.claude/glm/statusline.mjs（stub）转发至此；stdin 为 Claude Code 传入的 session JSON。
// 永远输出一行——任何失败都降级，绝不让状态栏空白。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

import {buildEndpoints, fetchQuota, parseQuotaResponse} from './lib/core.mjs';
import {
  CACHE_TTL_MS,
  isGlmBackend,
  parseStatuslineInput,
  readCache,
  renderBasicLine,
  renderGlmLine,
  resolveClaudeDir,
  writeCache,
} from './lib/statusline-core.mjs';

const GLM_DIR = path.join(resolveClaudeDir(), 'glm');
const CACHE_PATH = path.join(GLM_DIR, 'cache.json');
const BACKUP_PATH = path.join(GLM_DIR, 'statusline-backup.json');
const FETCH_TIMEOUT_MS = 2500; // statusline 同步渲染，预算紧

function readStdin() {
  return new Promise((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (text += chunk));
    process.stdin.on('end', () => resolve(text));
    process.stdin.on('error', () => resolve(text));
  });
}

/** 执行原 statusline 命令并透传；失败/超时/空输出返回 null（由调用方兜底） */
function runCommand(command, inputText, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let out = '';
    const child = spawn(command, {shell: true, timeout: timeoutMs});
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {}); // 原命令的 stderr 不进状态栏
    child.on('error', () => finish(null));
    child.on('close', () => finish(out.trim() ? out : null));
    child.stdin.on('error', () => {}); // 原命令不读 stdin 时忽略 EPIPE
    child.stdin.write(inputText);
    child.stdin.end();
  });
}

async function glmMode(input) {
  const now = Date.now();
  const cache = readCache(CACHE_PATH, fs);
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    console.log(renderGlmLine(cache.windows, {...input, now}));
    return;
  }
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  try {
    if (!token) throw new Error('ANTHROPIC_AUTH_TOKEN not set');
    const endpoints = buildEndpoints(process.env.ANTHROPIC_BASE_URL);
    const json = await fetchQuota(fetch, endpoints.urls, token, {timeoutMs: FETCH_TIMEOUT_MS});
    const parsed = parseQuotaResponse(json);
    writeCache(CACHE_PATH, {windows: parsed.windows, level: parsed.level, fetchedAt: Date.now()}, fs);
    console.log(renderGlmLine(parsed.windows, {...input, now: Date.now()}));
  } catch {
    // 拉新失败：有过期缓存则原值 + stale 标记，否则 ?%
    console.log(renderGlmLine(cache ? cache.windows : null, {...input, stale: Boolean(cache), now: Date.now()}));
  }
}

async function passthroughMode(inputText, input) {
  let backup = null;
  try {
    backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  } catch {
    // 无备份文件
  }
  const command = backup && typeof backup.command === 'string' ? backup.command : null;
  if (command) {
    const out = await runCommand(command, inputText, 3000);
    if (out !== null) {
      process.stdout.write(out);
      return;
    }
  }
  console.log(renderBasicLine(input));
}

const inputText = await readStdin();
const input = parseStatuslineInput(inputText);
if (isGlmBackend(process.env.ANTHROPIC_BASE_URL)) {
  await glmMode(input);
} else {
  await passthroughMode(inputText, input);
}
