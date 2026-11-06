/* eslint-disable no-undef */
/**
 * Hyper RB · AI client (background) — Groq direct.
 * Sanitiza a request e chama Groq via edge function /ai.
 * Mantém cache LRU (32) + rate limit local (20/min).
 *
 * NUNCA expor: Authorization, Cookie, set-cookie, x-api-key,
 * license_key, lovable_token, tokens em query string.
 *
 * Expõe: self.HyperRBAI = {
 *   explainRequest, suggestRecipe, analyzeTraffic,
 *   suggestMutations, diagnoseFailedReplay, classifyAction,
 *   classifyBatch, sanitizeEntry, clearCache, cancelAll
 * }
 *
 * Wave 2 additions:
 *  - Retry com backoff exponencial (3 tentativas, 250ms→2s)
 *  - Timeout por request via AbortController (15s default)
 *  - Tratamento robusto de 429 (Retry-After) e 5xx
 *  - Cache de respostas idênticas (chave sha256 do payload)
 *  - cancelAll() — aborta todas as requests em voo
 *
 * Wave 3 fixes + improvements (Agent I):
 *  - FIX: status 402 (Payment Required / quota) com mensagem específica e sem retry
 *  - IMPROVEMENT: REQUEST_TIMEOUT_MS configurável por call via opts.timeoutMs
 *  - IMPROVEMENT: analyzeTraffic agora cacheia resultados
 *  - IMPROVEMENT: classifyBatch retorna resultados parciais mesmo em caso de erro
 */
(function (root) {
  "use strict";

  const MAX_CACHE = 32;
  const MAX_PAYLOAD_CHARS = 30_000;
  const MAX_BODY_CHARS_PER_FIELD = 4_000;
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 20;
  const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
  const MAX_RETRIES = 3;
  // Backoff: attempt 0→250ms, 1→1000ms, 2→2000ms (capped)
  const BACKOFF_MS = [250, 1000, 2000];

  const SENSITIVE_HEADER_PATTERNS = [
    /^authorization$/i, /^cookie$/i, /^set-cookie$/i,
    /^x-api-key$/i, /^apikey$/i, /^proxy-authorization$/i,
    /^x-license-key$/i,
  ];
  const SENSITIVE_BODY_KEYS = new Set([
    "license_key", "lovable_token", "bearer_token", "access_token",
    "refresh_token", "session_token", "password", "secret",
    "api_key", "apikey",
  ]);
  const SENSITIVE_QUERY_KEYS = [
    "token", "access_token", "refresh_token", "license_key", "apikey", "api_key",
  ];

  const cache = new Map();
  const recentCalls = [];
  // Track active AbortControllers for cancelAll()
  const _activeControllers = new Set();

  // ---------------------------------------------------------------------------
  // Sanitize helpers
  // ---------------------------------------------------------------------------
  function mask(v) {
    const s = String(v ?? "");
    if (!s) return "";
    if (s.length <= 8) return "***";
    return `${s.slice(0, 4)}***${s.slice(-4)}`;
  }
  function sanitizeHeaders(h) {
    if (!h || typeof h !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(h)) {
      const sens = SENSITIVE_HEADER_PATTERNS.some((re) => re.test(k));
      out[k] = sens ? mask(v) : String(v).slice(0, 500);
    }
    return out;
  }
  function sanitizeUrl(url) {
    if (!url || typeof url !== "string") return url || "";
    try {
      const u = new URL(url);
      for (const k of SENSITIVE_QUERY_KEYS) if (u.searchParams.has(k)) u.searchParams.set(k, "***");
      return u.toString();
    } catch { return url; }
  }
  function sanitizeBodyDeep(value, depth = 0) {
    if (depth > 6) return "[depth-limit]";
    if (value == null) return value;
    if (typeof value === "string") {
      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return mask(value);
      return value.length > MAX_BODY_CHARS_PER_FIELD
        ? value.slice(0, MAX_BODY_CHARS_PER_FIELD) + "…[truncated]" : value;
    }
    if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeBodyDeep(v, depth + 1));
    if (typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = SENSITIVE_BODY_KEYS.has(k.toLowerCase()) ? mask(v) : sanitizeBodyDeep(v, depth + 1);
      }
      return out;
    }
    return value;
  }
  function parseMaybeJson(v) {
    if (v == null) return null;
    if (typeof v === "object") return v;
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return v; }
  }
  function sanitizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    return {
      method: String(entry.method || "GET"),
      url: sanitizeUrl(entry.url),
      status: entry.status ?? 0,
      statusText: entry.statusText ?? "",
      timingMs: entry.timingMs ?? 0,
      requestHeaders: sanitizeHeaders(entry.requestHeaders),
      responseHeaders: sanitizeHeaders(entry.responseHeaders),
      requestBody: sanitizeBodyDeep(parseMaybeJson(entry.requestBody)),
      responseBody: sanitizeBodyDeep(parseMaybeJson(entry.responseBody)),
    };
  }

  // ---------------------------------------------------------------------------
  // Cache: LRU keyed by sha256 of canonical JSON payload string.
  // Falls back to a simple string key if SubtleCrypto unavailable.
  // ---------------------------------------------------------------------------
  async function sha256Hex(str) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback: djb2 hash (non-cryptographic, good enough for cache key)
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
      return (h >>> 0).toString(16);
    }
  }
  async function buildCacheKey(action, payload) {
    const canonical = action + "::" + JSON.stringify(payload);
    return await sha256Hex(canonical);
  }
  function putCache(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  }
  function getCache(key) {
    if (!cache.has(key)) return null;
    const v = cache.get(key);
    cache.delete(key); cache.set(key, v); // LRU bump
    return v;
  }
  function clearCache() { cache.clear(); recentCalls.length = 0; }

  // ---------------------------------------------------------------------------
  // Rate limit
  // ---------------------------------------------------------------------------
  function checkRateLimit() {
    const now = Date.now();
    while (recentCalls.length && now - recentCalls[0] > RATE_LIMIT_WINDOW_MS) recentCalls.shift();
    if (recentCalls.length >= RATE_LIMIT_MAX) return false;
    recentCalls.push(now);
    return true;
  }

  // ---------------------------------------------------------------------------
  // cancelAll() — abort every in-flight request
  // ---------------------------------------------------------------------------
  function cancelAll() {
    for (const ctrl of _activeControllers) {
      try { ctrl.abort("cancelAll"); } catch {}
    }
    _activeControllers.clear();
  }

  // ---------------------------------------------------------------------------
  // Last-known Supabase endpoint info
  // ---------------------------------------------------------------------------
  let _supabaseUrl = "";
  let _supabaseAnonKey = "";

  // ---------------------------------------------------------------------------
  // Core caller: retry + backoff + timeout + 402/429/5xx handling
  //
  // opts.timeoutMs — override per-call timeout (default: DEFAULT_REQUEST_TIMEOUT_MS)
  // ---------------------------------------------------------------------------
  async function callAiEdge(action, payload, opts = {}) {
    if (!checkRateLimit()) return { ok: false, error: "Rate limit local atingido (20/min). Aguarde." };
    if (opts.supabaseUrl) _supabaseUrl = opts.supabaseUrl;
    if (opts.supabaseAnonKey) _supabaseAnonKey = opts.supabaseAnonKey;
    if (!_supabaseUrl || !_supabaseAnonKey) {
      return { ok: false, error: "Edge /ai não configurado (faltam credenciais)." };
    }
    const userMsg = JSON.stringify(payload);
    if (userMsg.length > MAX_PAYLOAD_CHARS) return { ok: false, error: "Payload muito grande (limite 30KB)." };

    // IMPROVEMENT (Agent I — W3): configurable per-call timeout
    const timeoutMs = (typeof opts.timeoutMs === "number" && opts.timeoutMs > 0)
      ? opts.timeoutMs
      : DEFAULT_REQUEST_TIMEOUT_MS;

    const bodyStr = JSON.stringify({ action, request: payload });
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Delay before retry (not before the first attempt)
      if (attempt > 0) {
        const delay = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
        await new Promise((r) => setTimeout(r, delay));
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
      _activeControllers.add(ctrl);

      try {
        const res = await fetch(`${_supabaseUrl}/functions/v1/ai`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": _supabaseAnonKey,
            "Authorization": `Bearer ${_supabaseAnonKey}`,
          },
          body: bodyStr,
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        _activeControllers.delete(ctrl);

        // FIX (Agent I — W3): 402 Payment Required = quota/license issue.
        // Do NOT retry — this won't resolve with retries.
        if (res.status === 402) {
          return {
            ok: false,
            status: 402,
            error: "Cota ou licença insuficiente (402). Verifique seu plano ou chave de licença.",
          };
        }

        // 429: respect Retry-After if present
        if (res.status === 429) {
          const retryAfterSec = Number(res.headers.get("Retry-After") || "0");
          if (attempt < MAX_RETRIES) {
            const wait = retryAfterSec > 0 ? retryAfterSec * 1000 : BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
            await new Promise((r) => setTimeout(r, wait));
            lastError = { ok: false, status: 429, error: "Rate limit da API (429). Retentando…" };
            continue;
          }
          return { ok: false, status: 429, error: "Rate limit da API (429). Tente novamente mais tarde." };
        }

        // 5xx: retry
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          lastError = { ok: false, status: res.status, error: `Erro servidor (${res.status}). Retentando…` };
          continue;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, status: res.status, error: data?.message || data?.error || `HTTP ${res.status}` };
        }

        if (action === "convert_to_composer_recipe") {
          return { ok: true, recipe: data?.recipe, usage: data?.usage };
        }
        return { ok: true, content: String(data?.content || "").trim(), usage: data?.usage };

      } catch (e) {
        clearTimeout(timer);
        _activeControllers.delete(ctrl);

        // Aborted by cancelAll or timeout
        if (ctrl.signal.aborted) {
          const reason = ctrl.signal.reason;
          if (reason === "cancelAll") return { ok: false, error: "Request cancelada." };
          if (reason === "timeout") {
            lastError = { ok: false, error: `Timeout na request (${timeoutMs}ms).` };
            if (attempt < MAX_RETRIES) continue;
            return lastError;
          }
        }
        lastError = { ok: false, error: e?.message || String(e) };
        if (attempt < MAX_RETRIES) continue;
      }
    }
    return lastError || { ok: false, error: "Falha desconhecida após retentativas." };
  }

  // ---------------------------------------------------------------------------
  // Public API helpers (with async sha256 cache key)
  // ---------------------------------------------------------------------------
  async function explainRequest({ entry, supabaseUrl, supabaseAnonKey, timeoutMs }) {
    if (!entry) return { ok: false, error: "Nenhuma request selecionada." };
    const sanitized = sanitizeEntry(entry);
    const key = await buildCacheKey("explain_lovable_request", sanitized);
    const cached = getCache(key);
    if (cached) return { ok: true, content: cached, cached: true };
    const res = await callAiEdge("explain_lovable_request", sanitized, { supabaseUrl, supabaseAnonKey, timeoutMs });
    if (res.ok && res.content) putCache(key, res.content);
    return res;
  }

  async function suggestRecipe({ entry, supabaseUrl, supabaseAnonKey, timeoutMs }) {
    if (!entry) return { ok: false, error: "Nenhuma request selecionada." };
    const sanitized = sanitizeEntry(entry);
    const key = await buildCacheKey("convert_to_composer_recipe", sanitized);
    const cached = getCache(key);
    if (cached) return { ok: true, recipe: cached, cached: true };
    const res = await callAiEdge("convert_to_composer_recipe", sanitized, { supabaseUrl, supabaseAnonKey, timeoutMs });
    if (!res.ok) return res;
    const recipe = res.recipe;
    if (!recipe || typeof recipe !== "object") return { ok: false, error: "Recipe não retornado pela IA." };
    putCache(key, recipe);
    return { ok: true, recipe, usage: res.usage };
  }

  async function analyzeTraffic({ entries, metrics, limit = 50, supabaseUrl, supabaseAnonKey, timeoutMs }) {
    if (!Array.isArray(entries) || !entries.length) return { ok: false, error: "Sem requests para analisar." };
    const sliced = entries.slice(0, limit).map((e) => {
      const s = sanitizeEntry(e) || {};
      return {
        method: s.method, url: s.url, status: s.status, timingMs: s.timingMs,
        contentType: s.responseHeaders?.["content-type"] || s.responseHeaders?.["Content-Type"] || "",
      };
    });
    const byHost = {}, byStatus = {};
    let errorCount = 0, totalMs = 0, msSamples = 0;
    for (const e of entries) {
      try { const u = new URL(e.url); byHost[u.host] = (byHost[u.host] || 0) + 1; } catch {}
      const st = Number(e.status || 0);
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (st === 0 || st >= 400) errorCount++;
      if (typeof e.timingMs === "number") { totalMs += e.timingMs; msSamples++; }
    }
    const enriched = {
      total: entries.length, sampled: sliced.length,
      errorRate: entries.length ? +(errorCount / entries.length).toFixed(3) : 0,
      avgMs: msSamples ? Math.round(totalMs / msSamples) : 0,
      byHost, byStatus, metrics: metrics || null, entries: sliced,
    };

    // IMPROVEMENT (Agent I — W3): cache analyzeTraffic results just like other AI calls.
    const key = await buildCacheKey("analyze_network_traffic", enriched);
    const cached = getCache(key);
    if (cached) return { ok: true, content: cached, cached: true };
    const res = await callAiEdge("analyze_network_traffic", enriched, { supabaseUrl, supabaseAnonKey, timeoutMs });
    if (res.ok && res.content) putCache(key, res.content);
    return res;
  }

  async function suggestMutations({ entry, supabaseUrl, supabaseAnonKey, timeoutMs }) {
    if (!entry) return { ok: false, error: "Nenhuma request selecionada." };
    const sanitized = sanitizeEntry(entry);
    const key = await buildCacheKey("suggest_mutations", sanitized);
    const cached = getCache(key);
    if (cached) return { ok: true, content: cached, cached: true };
    const res = await callAiEdge("suggest_mutations", sanitized, { supabaseUrl, supabaseAnonKey, timeoutMs });
    if (res.ok && res.content) putCache(key, res.content);
    return res;
  }

  async function diagnoseFailedReplay({ entry, supabaseUrl, supabaseAnonKey, timeoutMs }) {
    if (!entry) return { ok: false, error: "Nenhuma request selecionada." };
    return callAiEdge("diagnose_failed_replay", sanitizeEntry(entry), { supabaseUrl, supabaseAnonKey, timeoutMs });
  }

  async function classifyAction({ entry, supabaseUrl, supabaseAnonKey, timeoutMs }) {
    if (!entry) return { ok: false, error: "Nenhuma request selecionada." };
    const sanitized = sanitizeEntry(entry);
    const key = await buildCacheKey("classify_action_ptbr", sanitized);
    const cached = getCache(key);
    if (cached) return { ok: true, content: cached, cached: true };
    const res = await callAiEdge("classify_action_ptbr", sanitized, { supabaseUrl, supabaseAnonKey, timeoutMs });
    if (res.ok && res.content) putCache(key, res.content);
    return res;
  }

  async function classifyBatch({ items, supabaseUrl, supabaseAnonKey, timeoutMs, continueOnError = true }) {
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, error: "Nenhum item para classificar." };
    }
    const normalized = items.slice(0, 25).map((item) => ({
      id: String(item?.id || ""),
      method: String(item?.method || "GET").toUpperCase(),
      url: sanitizeUrl(String(item?.url || "")),
      bodyExcerpt: typeof item?.bodyExcerpt === "string" ? item.bodyExcerpt.slice(0, 1000) : "",
    }));

    // IMPROVEMENT (Agent I — W3): return partial results even when some items fail.
    // continueOnError=true (default) collects errors per-item instead of bailing out.
    const CONCURRENCY = 5;
    const results = new Array(normalized.length);
    const errors = [];

    for (let start = 0; start < normalized.length; start += CONCURRENCY) {
      const batch = normalized.slice(start, start + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((item) => callAiEdge("classify_action_ptbr", item, { supabaseUrl, supabaseAnonKey, timeoutMs }))
      );
      for (let j = 0; j < settled.length; j++) {
        const s = settled[j];
        const globalIdx = start + j;
        if (s.status === "rejected" || !s.value?.ok) {
          const errMsg = s.status === "rejected" ? String(s.reason) : (s.value?.error || "Falha desconhecida");
          errors.push({ id: batch[j].id, error: errMsg });
          results[globalIdx] = { id: batch[j].id, categoria: null, error: errMsg };
          if (!continueOnError) break;
        } else {
          results[globalIdx] = {
            id: batch[j].id,
            categoria: String(s.value.content || "Não classificado").trim() || "Não classificado",
          };
        }
      }
      if (!continueOnError && errors.length > 0) break;
    }

    const validResults = results.filter(Boolean);
    const allFailed = validResults.length > 0 && validResults.every((r) => r.categoria === null);

    if (allFailed && errors.length > 0) {
      return { ok: false, error: errors[0].error, partialData: { items: validResults, errors } };
    }

    return {
      ok: true,
      data: { items: validResults.filter((r) => r.categoria !== null) },
      ...(errors.length > 0 ? { partialErrors: errors } : {}),
    };
  }

  root.HyperRBAI = {
    explainRequest, suggestRecipe, analyzeTraffic,
    suggestMutations, diagnoseFailedReplay, classifyAction, classifyBatch,
    sanitizeEntry, clearCache, cancelAll,
  };
})(typeof self !== "undefined" ? self : globalThis);
