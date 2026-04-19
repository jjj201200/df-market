// token-reporter fetch-hook
// Preloaded by Node via NODE_OPTIONS=--require=<this>. Patches globalThis.fetch
// and require('undici').fetch to capture Anthropic Messages API request bodies
// before TLS. Original fetch return is untouched — zero behavior change on host.
//
// Writes to process.env.TOKEN_REPORTER_AUDIT_OUT:
//   <pid>-<ts>-<seq>.req.json
//   <pid>-<ts>-<seq>.resp.json
//   .heartbeat
//   .errors.log (append)
// All exceptions are swallowed. The host process must never observe a throw from this file.

'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const OUT_DIR = process.env.TOKEN_REPORTER_AUDIT_OUT;
if (!OUT_DIR) {
  // Hook not armed — do nothing. Important: do not throw.
  module.exports = {};
  return;
}

const PID = process.pid;
const MATCH = /^https?:\/\/api\.anthropic\.com(?::\d+)?(?:\/|$)/;
const EXTRA_MATCH_RAW = process.env.TOKEN_REPORTER_HOOK_EXTRA_MATCH;
let EXTRA_MATCH = null;
try { EXTRA_MATCH = EXTRA_MATCH_RAW ? new RegExp(EXTRA_MATCH_RAW) : null; } catch { EXTRA_MATCH = null; }
function shouldCapture(url) {
  if (typeof url !== 'string') return false;
  if (MATCH.test(url)) return true;
  if (EXTRA_MATCH && EXTRA_MATCH.test(url)) return true;
  return false;
}

const HEADER_ALLOWLIST = new Set([
  'x-claude-code-session-id',
  'anthropic-version',
  'anthropic-beta',
  'x-client-request-id',
  'content-type',
  'user-agent',
]);
let seq = 0;

function safeMkdir() {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(OUT_DIR, 0o700); } catch {}
  } catch {}
}
safeMkdir();

function safeAppend(name, data) {
  try { fs.appendFileSync(path.join(OUT_DIR, name), data); } catch {}
}
function safeWrite(name, data) {
  try { fs.writeFileSync(path.join(OUT_DIR, name), data); }
  catch (e) { safeAppend('.errors.log', `${new Date().toISOString()} write ${name}: ${e && e.message}\n`); }
}
function heartbeat() {
  try {
    fs.writeFileSync(path.join(OUT_DIR, '.heartbeat'), JSON.stringify({
      pid: PID,
      at: new Date().toISOString(),
    }));
  } catch {}
}
heartbeat();

function filterHeaders(h) {
  const out = {};
  try {
    if (!h) return out;
    if (typeof h.forEach === 'function') {
      h.forEach((v, k) => {
        const key = String(k).toLowerCase();
        if (HEADER_ALLOWLIST.has(key)) out[key] = v;
      });
    } else if (typeof h === 'object') {
      for (const k of Object.keys(h)) {
        if (HEADER_ALLOWLIST.has(k.toLowerCase())) out[k.toLowerCase()] = h[k];
      }
    }
  } catch {}
  return out;
}

async function readBodyToString(rawBody) {
  if (rawBody == null) return { body: null, bytes: 0 };
  if (typeof rawBody === 'string') return { body: rawBody, bytes: Buffer.byteLength(rawBody, 'utf8') };
  if (Buffer.isBuffer(rawBody)) return { body: rawBody.toString('utf8'), bytes: rawBody.length };
  if (rawBody instanceof Uint8Array) return { body: Buffer.from(rawBody).toString('utf8'), bytes: rawBody.byteLength };
  if (rawBody && typeof rawBody.getReader === 'function') return { body: null, bytes: -1, note: 'stream-unreadable' };
  if (typeof rawBody === 'object' && typeof rawBody.pipe === 'function') return { body: null, bytes: -1, note: 'stream-unreadable' };
  try { const s = JSON.stringify(rawBody); return { body: s, bytes: Buffer.byteLength(s, 'utf8') }; } catch {}
  return { body: null, bytes: -1, note: 'unknown-body-type' };
}

function wrapFetch(originalFetch, label) {
  return async function patchedFetch(input, init) {
    let writeReq = null;
    let reqId = null;
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (shouldCapture(url)) {
        reqId = `${PID}-${Date.now()}-${++seq}`;
        const method = (init && init.method) || (input && input.method) || 'GET';
        const body = init && init.body;
        const { body: bodyStr, bytes, note } = await readBodyToString(body);
        const headers = filterHeaders((init && init.headers) || (input && input.headers));
        writeReq = {
          id: reqId,
          capturedAt: new Date().toISOString(),
          url, method, headers,
          bodyBytes: bytes,
          bodyNote: note || null,
          body: bodyStr,
        };
      }
    } catch (e) {
      safeAppend('.errors.log', `${new Date().toISOString()} ${label} pre-fetch: ${e && e.message}\n`);
    }

    let result;
    try {
      result = await originalFetch.apply(this, arguments);
    } catch (e) {
      if (writeReq) {
        safeWrite(`${reqId}.req.json`, JSON.stringify(writeReq, null, 2));
        safeAppend('.errors.log', `${new Date().toISOString()} ${label} fetch-threw ${reqId}: ${e && e.message}\n`);
      }
      throw e;
    }

    if (writeReq) {
      safeWrite(`${reqId}.req.json`, JSON.stringify(writeReq, null, 2));
      heartbeat();
      try {
        const cloned = typeof result.clone === 'function' ? result.clone() : null;
        if (cloned) {
          const text = await cloned.text();
          safeWrite(`${reqId}.resp.json`, JSON.stringify({
            id: reqId,
            capturedAt: new Date().toISOString(),
            status: cloned.status,
            headers: filterHeaders(cloned.headers),
            body: text,
            bodyBytes: Buffer.byteLength(text, 'utf8'),
          }, null, 2));
        }
      } catch (e) {
        safeAppend('.errors.log', `${new Date().toISOString()} ${label} resp-clone ${reqId}: ${e && e.message}\n`);
      }
    }

    return result;
  };
}

if (typeof globalThis.fetch === 'function') {
  try { globalThis.fetch = wrapFetch(globalThis.fetch, 'globalThis'); }
  catch (e) { safeAppend('.errors.log', `patch globalThis.fetch: ${e && e.message}\n`); }
}

try {
  const origLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const m = origLoad.apply(this, arguments);
    try {
      if (request === 'undici' && m && typeof m.fetch === 'function' && !m.__tokenReporterPatched) {
        m.fetch = wrapFetch(m.fetch, 'undici');
        m.__tokenReporterPatched = true;
      }
    } catch (e) { safeAppend('.errors.log', `patch undici: ${e && e.message}\n`); }
    return m;
  };
} catch (e) { safeAppend('.errors.log', `install Module._load: ${e && e.message}\n`); }

module.exports = {};
