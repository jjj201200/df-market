// F-spike: NODE_OPTIONS=--require=<this file> preload hook.
// Monkey-patches globalThis.fetch to capture Anthropic API request bodies
// before they hit the TLS layer. Writes each capture to /tmp/f-spike/captures/.

const fs = require('fs');
const path = require('path');

const OUT_DIR = process.env.F_SPIKE_OUT_DIR || '/tmp/f-spike/captures';
fs.mkdirSync(OUT_DIR, { recursive: true });

const MATCH = /api\.anthropic\.com/;
let seq = 0;

function safeWrite(name, payload) {
  try {
    fs.writeFileSync(path.join(OUT_DIR, name), payload);
  } catch (e) {
    // Best-effort — never block host process
    try { fs.appendFileSync(path.join(OUT_DIR, '_errors.log'), String(e) + '\n'); } catch {}
  }
}

function now() { return Date.now(); }

function hookFetch(originalFetch) {
  return async function patchedFetch(input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (MATCH.test(url)) {
        const id = `${now()}-${++seq}`;
        const method = (init && init.method) || (input && input.method) || 'GET';
        let bodySnap = null;
        let bodyLen = null;
        const rawBody = init && init.body;
        if (typeof rawBody === 'string') {
          bodySnap = rawBody;
          bodyLen = Buffer.byteLength(rawBody, 'utf8');
        } else if (rawBody && typeof rawBody === 'object' && typeof rawBody.toString === 'function' && rawBody.constructor && rawBody.constructor.name === 'String') {
          bodySnap = String(rawBody);
          bodyLen = Buffer.byteLength(bodySnap, 'utf8');
        } else if (rawBody instanceof Uint8Array) {
          bodySnap = Buffer.from(rawBody).toString('utf8');
          bodyLen = rawBody.byteLength;
        } else if (rawBody && typeof rawBody.getReader === 'function') {
          bodySnap = '<stream>'; // ReadableStream — need different tap
          bodyLen = -1;
        } else if (rawBody != null) {
          try { bodySnap = JSON.stringify(rawBody); } catch { bodySnap = String(rawBody); }
          bodyLen = Buffer.byteLength(bodySnap, 'utf8');
        }
        const headers = {};
        try {
          const h = (init && init.headers) || (input && input.headers);
          if (h && typeof h.forEach === 'function') h.forEach((v, k) => { headers[k] = v; });
          else if (h && typeof h === 'object') Object.assign(headers, h);
        } catch {}
        safeWrite(`${id}-request.json`, JSON.stringify({
          capturedAt: new Date().toISOString(),
          url, method, headers,
          bodyBytes: bodyLen,
          bodyHeadChars: bodySnap ? bodySnap.length : 0,
          body: bodySnap,
        }, null, 2));
      }
    } catch (e) {
      try { fs.appendFileSync(path.join(OUT_DIR, '_errors.log'), 'fetch-wrap: ' + String(e) + '\n'); } catch {}
    }
    return originalFetch.apply(this, arguments);
  };
}

// Install on globalThis
if (typeof globalThis.fetch === 'function') {
  globalThis.fetch = hookFetch(globalThis.fetch);
  try { fs.appendFileSync(path.join(OUT_DIR, '_status.log'), `${new Date().toISOString()} patched globalThis.fetch pid=${process.pid}\n`); } catch {}
} else {
  try { fs.appendFileSync(path.join(OUT_DIR, '_status.log'), `${new Date().toISOString()} fetch not present at preload pid=${process.pid}\n`); } catch {}
}

// Also defensively intercept undici if the SDK imports it after preload
try {
  const Module = require('module');
  const origResolve = Module._resolveFilename;
  const origLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    const m = origLoad.apply(this, arguments);
    if (request === 'undici' && m && typeof m.fetch === 'function') {
      m.fetch = hookFetch(m.fetch);
      try { fs.appendFileSync(path.join(OUT_DIR, '_status.log'), `${new Date().toISOString()} patched undici.fetch\n`); } catch {}
    }
    return m;
  };
} catch {}
