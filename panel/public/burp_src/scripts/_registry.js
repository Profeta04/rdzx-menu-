// ============================================================
// Hyper RB · Scripts · _registry.js
// Singleton registry para os scripts do Hyper RB.
// Cada arquivo de script faz: window.HYPER_RB_SCRIPTS.push(SCRIPT)
// Esta lib expõe: list/get/run/getByTag/getByCategory/register + montagem de contexto canônico.
//
// Wave 2: dedup por slug, timeoutMs por script, getByTag(tag).
// Wave 3 (Agent I): lazy register() com validação, getByCategory(),
//          null-guard em makeCtx, clearTimeout no happy-path de runScript.
// ============================================================
(function () {
  "use strict";

  if (!window.HYPER_RB_SCRIPTS) window.HYPER_RB_SCRIPTS = [];

  // Required fields for a valid script definition
  const REQUIRED_FIELDS = ["slug", "name", "run"];

  /**
   * register(script) — Imperatively register a script with upfront validation.
   * Useful when scripts are loaded dynamically / lazy-loaded.
   * Throws if required fields are missing.
   */
  function register(script) {
    if (!script || typeof script !== "object") throw new Error("register(): script deve ser um objeto.");
    for (const f of REQUIRED_FIELDS) {
      if (!script[f]) throw new Error(`register(): campo obrigatório ausente: "${f}".`);
    }
    if (typeof script.run !== "function") throw new Error("register(): script.run deve ser uma função.");
    window.HYPER_RB_SCRIPTS.push(script);
  }

  function getScripts() {
    // dedup por slug (último registro vence), ordenado por id canônico
    const seen = new Map();
    for (const s of window.HYPER_RB_SCRIPTS) {
      if (s && s.slug) seen.set(s.slug, s);
    }
    return [...seen.values()].sort((a, b) => (a.id || 99) - (b.id || 99));
  }

  function getScript(idOrSlug) {
    return getScripts().find((s) => s.id === idOrSlug || s.slug === idOrSlug);
  }

  /**
   * getByTag(tag) — returns all scripts whose `tags` array contains `tag`.
   */
  function getByTag(tag) {
    return getScripts().filter((s) => Array.isArray(s.tags) && s.tags.includes(tag));
  }

  /**
   * getByCategory(category) — returns all scripts whose `category` field matches.
   * Case-insensitive. Scripts may also store category inside `tags` — this checks
   * the dedicated `category` field first, then falls back to tags lookup.
   */
  function getByCategory(category) {
    if (!category || typeof category !== "string") return [];
    const cat = category.toLowerCase();
    return getScripts().filter((s) => {
      if (typeof s.category === "string" && s.category.toLowerCase() === cat) return true;
      // Fallback: treat tag prefixed with "cat:" as a category tag
      if (Array.isArray(s.tags)) return s.tags.some((t) => String(t).toLowerCase() === `cat:${cat}`);
      return false;
    });
  }

  function makeCtx({ requests, licenseKey, callAI, proxyFetch, getRawRequest, slug }) {
    // BUG FIX (Agent I — W3): Guard against HYPER_RB_SHARED not being loaded yet.
    const S = window.HYPER_RB_SHARED;
    if (!S) throw new Error("HYPER_RB_SHARED não carregado — verifique a ordem dos scripts.");

    return {
      requests: Array.isArray(requests) ? requests : [],
      licenseKey: licenseKey || "",
      callAI: typeof callAI === "function" ? callAI : async () => ({ error: "ai_unavailable" }),
      proxyFetch: typeof proxyFetch === "function" ? proxyFetch : async () => ({ ok: false, error: "proxy_unavailable" }),
      getRawRequest: typeof getRawRequest === "function" ? getRawRequest : async () => ({ ok: false, error: "raw_unavailable" }),
      storage: S.makeStorage(slug),
      log(level, msg, meta) {
        const tag = `[Hyper RB · ${slug}]`;
        if (level === "error") console.error(tag, msg, meta || "");
        else if (level === "warn") console.warn(tag, msg, meta || "");
        else console.log(tag, msg, meta || "");
      },
    };
  }

  async function runScript(idOrSlug, { rawRequests, licenseKey, callAI, proxyFetch, getRawRequest } = {}) {
    const script = getScript(idOrSlug);
    if (!script) throw new Error(`Script não encontrado: ${idOrSlug}`);

    // makeCtx already checks for HYPER_RB_SHARED and throws a clear error.
    let ctx;
    try {
      const S = window.HYPER_RB_SHARED;
      if (!S) throw new Error("HYPER_RB_SHARED não carregado — verifique a ordem dos scripts.");
      const requests = S.sanitizeAll(rawRequests);
      ctx = makeCtx({ requests, licenseKey, callAI, proxyFetch, getRawRequest, slug: script.slug });
    } catch (initErr) {
      return { ok: false, error: (initErr && initErr.message) || String(initErr) };
    }

    // timeoutMs configurável por script (padrão: 30s)
    const TIMEOUT_MS = (typeof script.timeoutMs === "number" && script.timeoutMs > 0)
      ? script.timeoutMs
      : 30_000;

    const t0 = performance.now();

    // BUG FIX (Agent I — W3): Use AbortController + clearTimeout so the timer
    // is properly cleaned up after the script resolves — avoids timer leaks.
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Script "${script.slug}" excedeu o timeout de ${TIMEOUT_MS / 1000}s`)),
        TIMEOUT_MS
      );
    });

    try {
      const result = await Promise.race([script.run(ctx), timeoutPromise]);
      clearTimeout(timeoutId); // FIX: cancel timer on success
      const ms = Math.round(performance.now() - t0);
      ctx.log("info", `concluído em ${ms}ms`);
      return { ok: true, ms, ...(result || {}) };
    } catch (e) {
      clearTimeout(timeoutId); // FIX: cancel timer on error too
      ctx.log("error", "falha durante execução", e);
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }

  window.HYPER_RB_REGISTRY = { register, getScripts, getScript, getByTag, getByCategory, runScript };
})();
