// ============================================================
// Hyper RB · Scripts · _shared.js
// Sanitização + utilitários comuns aos scripts.
// Carregado ANTES de qualquer script individual.
// ============================================================
(function () {
  "use strict";

  const REDACTED = "<redacted>";
  const REDACT_HEADERS = new Set([
    "authorization", "cookie", "set-cookie",
    "x-api-key", "x-supabase-auth", "apikey",
    "x-license-key", "x-auth-token", "x-access-token",
    "x-refresh-token", "x-session-token",
  ]);
  // JWT (header.payload.sig)
  const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g;
  // Lovable tokens
  const LOVABLE_TOKEN_RE = /\b(lv_|lovable_)[A-Za-z0-9_-]{16,}/g;
  const MAX_BODY = 64 * 1024;

  const BINARY_CT = /(image\/|audio\/|video\/|application\/(octet-stream|pdf|zip|x-protobuf|wasm))/i;

  function isBinaryContentType(headers) {
    if (!headers) return false;
    const ct = headers["content-type"] || headers["Content-Type"] || "";
    return BINARY_CT.test(String(ct));
  }

  function maskString(s) {
    if (typeof s !== "string") return s;
    return s.replace(JWT_RE, "<jwt>").replace(LOVABLE_TOKEN_RE, "<lovable-token>");
  }

  // ── Central PII scrubber ──────────────────────────────────────────
  // Remove / redact PII patterns before any log, display or AI egress.
  const _PII_RULES = [
    // JWT
    { re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g, tag: "<jwt>" },
    // Lovable / generic "lv_" / "lovable_" tokens
    { re: /\b(lv_|lovable_)[A-Za-z0-9_-]{16,}/g, tag: "<token>" },
    // Generic Bearer / API key patterns  (sk-, pk-, ghp_, xox*, AKIA…)
    { re: /\b(sk|pk|rk|ak|ghp|ghs|github_pat|xoxb|xoxp|AKIA)[_-]?[A-Za-z0-9_-]{16,}/g, tag: "<api-key>" },
    // Email addresses
    { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, tag: "<email>" },
    // Brazilian CPF  000.000.000-00
    { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, tag: "<cpf>" },
    // Credit card numbers (13-19 digits, optional separators)
    { re: /\b(?:\d[ -]?){13,19}\b/g, tag: (m) => {
        // Only tag if Luhn-like digit density
        const digits = m.replace(/\D/g, "");
        return digits.length >= 13 && digits.length <= 19 ? "<card>" : m;
      }
    },
    // Phone numbers  +55 11 9xxxx-xxxx (validate digit count to avoid false positives)
    { re: /(?:\+?[\d][\d\s\-().]{7,15}[\d])/g, tag: (m) => {
        const digits = m.replace(/\D/g, "");
        return digits.length >= 7 ? "<phone>" : m;
      }
    },
    // Generic long hex tokens (32+ hex chars, e.g. Supabase service-role key material)
    { re: /\b[0-9a-f]{32,}\b/gi, tag: "<hex-token>" },
    // IPv4 addresses
    { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, tag: "<ip>" },
  ];

  /**
   * scrubPII(text, opts?)
   * Applies all PII rules in order.  Returns the scrubbed string.
   * opts.rules → override full rule list
   * opts.skip  → Set of tag names to skip (e.g. new Set(["<ip>"]))
   */
  function scrubPII(text, opts) {
    if (!text || typeof text !== "string") return text;
    const rules = (opts && opts.rules) ? opts.rules : _PII_RULES;
    const skip = (opts && opts.skip) instanceof Set ? opts.skip : null;
    let out = text;
    for (const rule of rules) {
      const tag = rule.tag;
      if (skip && typeof tag === "string" && skip.has(tag)) continue;
      if (typeof tag === "string") {
        out = out.replace(rule.re, tag);
      } else if (typeof tag === "function") {
        out = out.replace(rule.re, tag);
      }
    }
    return out;
  }

  // ── Host allow/block lists ────────────────────────────────────────
  // Scripts can reference these to gate outbound / displayed hosts.
  const HOST_ALLOWLIST = [
    "lovable.dev", "lovable.app",
    "supabase.co", "supabase.com",
    "openai.com", "api.openai.com",
    "anthropic.com", "api.anthropic.com",
    "groq.com",
    "generativelanguage.googleapis.com",
  ];

  const HOST_BLOCKLIST = [
    // Common data-exfiltration targets seen in prompt-injection attacks
    "webhook.site", "requestbin.com", "canarytokens.com",
    "burpcollaborator.net", "interactsh.com", "oastify.com",
    "ngrok.io", "ngrok-free.app", "serveo.net",
    "pipedream.net", "hookbin.com",
  ];

  function isHostAllowed(host) {
    if (!host) return false;
    const h = String(host).toLowerCase();
    if (HOST_BLOCKLIST.some((b) => h === b || h.endsWith("." + b))) return false;
    return HOST_ALLOWLIST.some((a) => h === a || h.endsWith("." + a));
  }

  function isHostBlocked(host) {
    if (!host) return false;
    const h = String(host).toLowerCase();
    return HOST_BLOCKLIST.some((b) => h === b || h.endsWith("." + b));
  }

  function sanitizeHeaders(h) {
    const out = {};
    if (!h || typeof h !== "object") return out;
    for (const [k, v] of Object.entries(h)) {
      if (REDACT_HEADERS.has(String(k).toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = typeof v === "string" ? maskString(v) : v;
      }
    }
    return out;
  }

  function truncBody(body) {
    if (body == null) return body;
    const str = typeof body === "string" ? body : (() => {
      try { return JSON.stringify(body); } catch { return String(body); }
    })();
    const masked = maskString(str);
    if (masked.length <= MAX_BODY) return masked;
    return masked.slice(0, MAX_BODY) + `…(+${masked.length - MAX_BODY} bytes)`;
  }

  function parseUrl(u) {
    try {
      const url = new URL(u);
      const searchParams = {};
      url.searchParams.forEach((v, k) => { searchParams[k] = v; });
      return { host: url.host, pathname: url.pathname, searchParams };
    } catch {
      return { host: "", pathname: u || "", searchParams: {} };
    }
  }

  function sanitize(entry) {
    if (!entry || typeof entry !== "object") return null;
    const { host, pathname, searchParams } = parseUrl(entry.url || "");
    return {
      id: String(entry.id || entry.requestId || cryptoUuid()),
      ts: Number(entry.ts || entry.startTime || Date.now()),
      method: String(entry.method || "GET").toUpperCase(),
      url: maskString(String(entry.url || "")),
      host, pathname, searchParams,
      status: typeof entry.status === "number" ? entry.status : undefined,
      durationMs: typeof entry.timingMs === "number" ? entry.timingMs : undefined,
      reqHeaders: sanitizeHeaders(entry.requestHeaders || entry.reqHeaders || {}),
      resHeaders: sanitizeHeaders(entry.responseHeaders || entry.resHeaders || {}),
      reqBody: truncBody(entry.requestBody ?? entry.reqBody),
      resBody: truncBody(entry.responseBody ?? entry.resBody),
      isSSE: String(
        (entry.responseHeaders && (entry.responseHeaders["content-type"] || entry.responseHeaders["Content-Type"])) || ""
      ).toLowerCase().includes("text/event-stream"),
      initiator: entry.initiator || entry.kind || undefined,
    };
  }

  function sanitizeAll(entries) {
    if (!Array.isArray(entries)) return [];
    const out = [];
    for (const e of entries) {
      const s = sanitize(e);
      if (s) out.push(s);
    }
    return out;
  }

  function cryptoUuid() {
    try { return crypto.randomUUID(); }
    catch { return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  }

  function formatBytes(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function formatMs(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    if (n < 1000) return Math.round(n) + " ms";
    return (n / 1000).toFixed(2) + " s";
  }

  function downloadBlob(filename, mime, content) {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      requestAnimationFrame(() => { URL.revokeObjectURL(url); a.remove(); });
    } catch (e) {
      console.error("[Hyper RB scripts] downloadBlob falhou:", e);
    }
  }

  function mountDrawer(title) {
    let drawer = document.getElementById("hyper-rb-script-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "hyper-rb-script-drawer";
      drawer.className = "hyper-rb-drawer";
      drawer.innerHTML = `
        <div class="hyper-rb-drawer-head">
          <div class="hyper-rb-drawer-title"></div>
          <button class="hyper-rb-drawer-close" aria-label="Fechar">×</button>
        </div>
        <div class="hyper-rb-drawer-body"></div>
      `;
      document.body.appendChild(drawer);
      drawer.querySelector(".hyper-rb-drawer-close").addEventListener("click", () => {
        drawer.classList.remove("open");
      });
    }
    drawer.querySelector(".hyper-rb-drawer-title").textContent = title || "Script";
    const body = drawer.querySelector(".hyper-rb-drawer-body");
    body.innerHTML = "";
    drawer.classList.add("open");
    return body;
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function normalizePath(pathname) {
    if (!pathname || pathname === "/") return "/";
    return "/" + pathname.split("/").filter(Boolean).map((seg) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return "{id}";
      if (/^[0-9a-f]{16,}$/i.test(seg)) return "{id}";
      if (/^\d+$/.test(seg)) return "{id}";
      return seg;
    }).join("/");
  }

  function makeStorage(slug) {
    const ns = `ql_script_${slug}_`;
    return {
      async get(key) {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.get([ns + key], (res) => resolve(res?.[ns + key]));
          } catch { resolve(undefined); }
        });
      },
      async set(key, value) {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.set({ [ns + key]: value }, () => resolve());
          } catch { resolve(); }
        });
      },
    };
  }

  function safeInt(value, opts) {
    const { min, max, default: def = 0 } = opts || {};
    const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(n)) return def;
    let out = Math.trunc(n);
    if (typeof min === "number" && out < min) out = min;
    if (typeof max === "number" && out > max) out = max;
    return out;
  }

  async function sha256Hex(input) {
    const str = typeof input === "string" ? input : (() => {
      try { return JSON.stringify(input); } catch { return String(input); }
    })();
    try {
      const bytes = new TextEncoder().encode(str);
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16).padStart(8, "0");
    }
  }

  const REPLAY_BLOCKED_HEADERS = new Set([
    "authorization", "cookie", "set-cookie", "proxy-authorization",
    "host", "content-length", "transfer-encoding", "connection",
  ]);

  function cloneReplayHeaders(base, patch) {
    const out = {};
    for (const [k, v] of Object.entries(base || {})) {
      if (REPLAY_BLOCKED_HEADERS.has(String(k).toLowerCase())) continue;
      out[k] = v;
    }
    for (const [k, v] of Object.entries(patch || {})) {
      if (REPLAY_BLOCKED_HEADERS.has(String(k).toLowerCase())) continue;
      if (v == null || v === "") delete out[k];
      else out[k] = v;
    }
    return out;
  }

  function safeBodyStr(body) {
    if (body == null) return "";
    if (typeof body === "string") return body;
    try { return JSON.stringify(body); } catch { return String(body); }
  }

  async function runReplayVariants(ctx, variants, opts) {
    const o = opts || {};
    const sleepMs = safeInt(o.sleepMs, { min: 50, max: 5000, default: 150 });
    const cap = safeInt(o.cap, { min: 1, max: 10, default: 10 });
    const list = (variants || []).slice(0, cap);
    const results = [];
    const excerptSize = 512;

    for (let i = 0; i < list.length; i++) {
      if (o.abortSignal && o.abortSignal.aborted) break;
      const v = list[i] || {};
      const url = v.url || o.baseUrl;
      const method = String(v.method || o.baseMethod || "GET").toUpperCase();
      if (!url) {
        results.push({ label: v.label || `#${i + 1}`, status: 0, ms: 0, bodyHash: "", bodyExcerpt: "", ok: false, error: "url ausente" });
        continue;
      }
      const headers = cloneReplayHeaders({}, v.headers || {});
      const body = v.body != null ? safeBodyStr(v.body) : null;
      let reply;
      try {
        reply = await ctx.proxyFetch(url, { method, headers, body });
      } catch (e) {
        results.push({ label: v.label || `#${i + 1}`, status: 0, ms: 0, bodyHash: "", bodyExcerpt: "", ok: false, error: String((e && e.message) || e) });
        if (i < list.length - 1) await new Promise((r) => setTimeout(r, sleepMs));
        continue;
      }
      const bodyStr = String(reply.body || "");
      const bodyHash = await sha256Hex(bodyStr.slice(0, excerptSize));
      results.push({
        label: v.label || `#${i + 1}`,
        status: Number(reply.status || 0),
        ms: Number(reply.durationMs || 0),
        bodyHash: bodyHash.slice(0, 16),
        bodyExcerpt: bodyStr.slice(0, excerptSize),
        ok: Boolean(reply.ok),
        error: reply.error || "",
      });
      if (typeof o.onProgress === "function") {
        try { o.onProgress(i + 1, list.length); } catch {}
      }
      if (i < list.length - 1) await new Promise((r) => setTimeout(r, sleepMs));
    }
    return results;
  }

  const _SSE_TYPE_RE = /(tool_call|message_delta|done|error|message_start|message_stop|content_block_(start|delta|stop))/i;

  function parseSSE(text) {
    if (!text || typeof text !== "string") return [];
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const blocks = normalized.split(/\n\n+/);
    const events = [];
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const ev = { id: undefined, event: undefined, retry: undefined, data: "" };
      const dataLines = [];
      for (const line of trimmed.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const idx = line.indexOf(":");
        const field = idx === -1 ? line : line.slice(0, idx);
        let value = idx === -1 ? "" : line.slice(idx + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        switch (field) {
          case "id":    ev.id = value; break;
          case "event": ev.event = value; break;
          case "retry": ev.retry = Number(value) || undefined; break;
          case "data":  dataLines.push(value); break;
          default: break;
        }
      }
      ev.data = dataLines.join("\n");
      let type = ev.event || "message";
      if (!ev.event) {
        const m = ev.data.match(_SSE_TYPE_RE);
        if (m) type = m[1].toLowerCase();
        else if (/^\s*\[DONE\]\s*$/i.test(ev.data)) type = "done";
      }
      ev.type = type;
      let parsed = null;
      const dt = ev.data.trim();
      if (dt && (dt.startsWith("{") || dt.startsWith("["))) {
        try { parsed = JSON.parse(dt); } catch { parsed = null; }
      }
      ev.parsed = parsed;
      ev.raw = block;
      events.push(ev);
    }
    return events;
  }


  /**
   * throttle(fn, wait) — max one call per `wait` ms; leading edge fires immediately.
   */
  function throttle(fn, wait) {
    let last = 0, timer;
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer);
        last = now;
        fn.apply(this, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, remaining);
      }
    };
  }

  /**
   * copyToClipboard(text) — wraps Clipboard API with document.execCommand fallback.
   * Returns a Promise<boolean>.
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(String(text ?? ""));
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = String(text ?? "");
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch { return false; }
    }
  }

  /**
   * groupBy(arr, keyFn) — returns Map<key, item[]>.
   */
  function groupBy(arr, keyFn) {
    const map = new Map();
    for (const item of (arr || [])) {
      const k = keyFn(item);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  }

  /**
   * renderKV(obj, opts?) — returns HTML string of a key-value table.
   * opts.redactKeys: Set of lowercase header names to redact.
   */
  function renderKV(obj, opts) {
    if (!obj || typeof obj !== "object") return "<em>vazio</em>";
    const redact = (opts && opts.redactKeys instanceof Set) ? opts.redactKeys : REDACT_HEADERS;
    const rows = Object.entries(obj).map(([k, v]) => {
      const display = redact.has(String(k).toLowerCase()) ? "&lt;redacted&gt;" : escapeHtml(String(v ?? ""));
      return `<div class="kv-row"><span class="kv-key">${escapeHtml(k)}</span><span>${display}</span></div>`;
    });
    return `<div class="kv">${rows.join("")}</div>`;
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /**
   * maskBodyForAI(body, maxLen=500)
   * Uses full scrubPII + truncates to maxLen.
   */
  function maskBodyForAI(body, maxLen) {
    if (maxLen === undefined) maxLen = 500;
    if (body == null) return body;
    const str = typeof body === "string" ? body : (() => {
      try { return JSON.stringify(body); } catch { return String(body); }
    })();
    const sanitized = scrubPII(str);
    if (sanitized.length <= maxLen) return sanitized;
    return sanitized.slice(0, maxLen) + `…(+${sanitized.length - maxLen} chars)`;
  }


  /**
   * loadWsFrames() — stub seguro para ws-correlator.
   * A implementação real via chrome.storage está no background.
   * Tenta ler do storage local; retorna [] se indisponível.
   */
  async function loadWsFrames() {
    try {
      return await new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage) return resolve([]);
        chrome.storage.local.get(['hyper_rb_ws_frames'], (res) => {
          resolve(Array.isArray(res && res.hyper_rb_ws_frames) ? res.hyper_rb_ws_frames : []);
        });
      });
    } catch {
      return [];
    }
  }

  // ── NEW W1: parseBody ─────────────────────────────────────────────
  /**
   * parseBody(body, contentType?) — multi-format request/response body parser.
   *
   * Returns: { type, data, raw, params? }
   *   type: "json" | "form" | "multipart" | "text" | "empty" | "binary"
   *   data: parsed value (object for json/form, null for others)
   *   raw:  string representation
   *   params: URLSearchParams entries array [{name,value}] for type==="form"
   *
   * Pure — no side effects, safe to call from any script.
   */
  function parseBody(body, contentType) {
    if (body == null || body === "") return { type: "empty", data: null, raw: "" };

    const raw = typeof body === "string" ? body : (() => {
      try { return JSON.stringify(body); } catch { return String(body); }
    })();

    const ct = String(contentType || "").toLowerCase().split(";")[0].trim();

    // Binary guard
    if (BINARY_CT.test(ct)) {
      return { type: "binary", data: null, raw };
    }

    // application/x-www-form-urlencoded
    if (ct === "application/x-www-form-urlencoded") {
      try {
        const usp = new URLSearchParams(raw);
        const data = {};
        const params = [];
        usp.forEach((v, k) => { data[k] = v; params.push({ name: k, value: v }); });
        return { type: "form", data, params, raw };
      } catch {
        return { type: "text", data: raw, raw };
      }
    }

    // multipart/form-data — can't fully parse without boundary, return hint
    if (ct.startsWith("multipart/")) {
      return { type: "multipart", data: null, raw };
    }

    // application/json or no content-type → try JSON
    if (ct === "application/json" || ct === "") {
      try {
        const trimmed = raw.trimStart();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const data = JSON.parse(raw);
          return { type: "json", data, raw };
        }
      } catch { /* fall through */ }
    }

    // Opportunistic JSON (e.g. content-type missing but body is JSON)
    if (ct !== "text/plain") {
      const trimmed = raw.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const data = JSON.parse(raw);
          return { type: "json", data, raw };
        } catch { /* fall through */ }
      }
    }

    // Fallback: plain text
    return { type: "text", data: raw, raw };
  }

  // ── NEW W1: makeLRU ───────────────────────────────────────────────
  /**
   * makeLRU(maxSize) — creates a simple Least-Recently-Used cache.
   *
   * API: { get(key), set(key, val), has(key), delete(key), clear(), size }
   *
   * Uses Map insertion-order eviction (standard LRU trick).
   * Thread-safe for single-threaded JS environments.
   */
  function makeLRU(maxSize) {
    const max = Math.max(1, safeInt(maxSize, { min: 1, max: 100000, default: 256 }));
    const cache = new Map();
    return {
      get(key) {
        if (!cache.has(key)) return undefined;
        // Refresh insertion order (LRU promote)
        const val = cache.get(key);
        cache.delete(key);
        cache.set(key, val);
        return val;
      },
      set(key, val) {
        if (cache.has(key)) cache.delete(key); // re-insert at tail
        cache.set(key, val);
        if (cache.size > max) {
          // Evict oldest (first inserted = head of Map iterator)
          cache.delete(cache.keys().next().value);
        }
        return this;
      },
      has(key) { return cache.has(key); },
      delete(key) { return cache.delete(key); },
      clear() { cache.clear(); },
      get size() { return cache.size; },
      /** peek(key) — read without promoting to MRU */
      peek(key) { return cache.get(key); },
      /** keys() — returns iterator from oldest to newest */
      keys() { return cache.keys(); },
    };
  }

  window.HYPER_RB_SHARED = {
    sanitize, sanitizeAll, sanitizeHeaders, truncBody,
    formatBytes, formatMs, downloadBlob, mountDrawer,
    escapeHtml, makeStorage, cryptoUuid, normalizePath,
    safeInt, sha256Hex, runReplayVariants,
    REPLAY_BLOCKED_HEADERS,
    parseSSE,
    BINARY_CT, isBinaryContentType,
    debounce, maskBodyForAI,
    // Security additions
    scrubPII, maskString, isHostAllowed, isHostBlocked,
    HOST_ALLOWLIST, HOST_BLOCKLIST,
    // Wave 2 utilities
    throttle, copyToClipboard, groupBy, renderKV,
    safeBodyStr, cloneReplayHeaders, loadWsFrames,
    // Wave 1 (Agent H) — new helpers
    parseBody,   // multi-format body parser: json/form/multipart/text/binary/empty
    makeLRU,     // LRU cache factory: makeLRU(maxSize) → {get,set,has,delete,clear,peek,keys,size}
  };
})();
