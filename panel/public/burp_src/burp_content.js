(() => {
  if (window.__BURP_LOVABLE_CONTENT__) return;
  window.__BURP_LOVABLE_CONTENT__ = true;

  // ---------------------------------------------------------------------------
  // postMessage rate-limiter: max 60 messages / 5 s window per type.
  // Prevents a misbehaving or compromised page script from flooding the SW.
  // ---------------------------------------------------------------------------
  const _msgCounts = new Map(); // type → { count, windowStart }
  const RATE_WINDOW_MS = 5_000;
  const RATE_LIMITS = {
    HOOK_READY: 10,
    AUTH_SNAPSHOT: 20,
    REQUEST_COMPLETED: 600,
    REQUEST_FAILED: 200,
    WS_FRAME: 2000,
    WS_PAUSED: 200,
    WS_INJECT_RESULT: 200,
  };

  function isRateLimited(type) {
    const now = Date.now();
    if (!_msgCounts.has(type)) {
      _msgCounts.set(type, { count: 1, windowStart: now });
      return false;
    }
    const entry = _msgCounts.get(type);
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      entry.count = 1;
      entry.windowStart = now;
      return false;
    }
    entry.count++;
    const limit = RATE_LIMITS[type] || 60;
    if (entry.count > limit) {
      // Log once per window
      if (entry.count === limit + 1) {
        console.warn(`[Hyper RB] postMessage rate limit reached for type "${type}" — throttling.`);
      }
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Safe send to background SW
  // ---------------------------------------------------------------------------
  function send(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, payload }, () => void chrome.runtime?.lastError);
    } catch (error) {
      console.warn("[Hyper RB] sendMessage failed", error);
    }
  }

  // ---------------------------------------------------------------------------
  // Script injection
  // ---------------------------------------------------------------------------
  function injectHook() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("burp_pageHook.js");
      script.async = false;
      script.onload = () => script.remove();
      (document.documentElement || document.head || document.body).appendChild(script);
    } catch (error) {
      console.warn("[Hyper RB] failed to inject page hook", error);
    }
  }

  // ---------------------------------------------------------------------------
  // Forward page → background SW messages (with rate-limit + orphan guard)
  // ---------------------------------------------------------------------------
  const KNOWN_PAGE_TYPES = new Set([
    "HOOK_READY", "AUTH_SNAPSHOT", "REQUEST_COMPLETED", "REQUEST_FAILED",
    "WS_FRAME", "WS_PAUSED", "WS_INJECT_RESULT",
  ]);

  window.addEventListener("message", (event) => {
    // AF-E-A-01 FIX: log when source is not the expected window to aid iframe debugging
    if (event.source !== window) {
      console.debug("[Hyper RB] ignoring message from non-window source", event.origin || "(unknown origin)");
      return;
    }
    const data = event.data;
    if (!data || data.source !== "BURP_LOVABLE_PAGE") return;

    const type = data.type;

    // Orphan-message guard: ignore unknown types instead of silently dropping
    if (!KNOWN_PAGE_TYPES.has(type)) {
      console.debug(`[Hyper RB] ignoring unknown page message type: "${type}"`);
      return;
    }

    // Rate-limit check per message type
    if (isRateLimited(type)) return;

    if (type === "HOOK_READY") {
      send("BURP_HOOK_READY", data.payload || {});
      return;
    }
    if (type === "AUTH_SNAPSHOT") {
      send("BURP_CAPTURE_AUTH", data.payload || {});
      return;
    }
    if (type === "REQUEST_COMPLETED" || type === "REQUEST_FAILED") {
      send("BURP_NETWORK_EVENT", data.payload || {});
      return;
    }
    if (type === "WS_FRAME") {
      send("BURP_WS_FRAME", data.payload || {});
      return;
    }
    if (type === "WS_PAUSED") {
      send("BURP_WS_PAUSED", data.payload || {});
      return;
    }
    if (type === "WS_INJECT_RESULT") {
      send("BURP_WS_INJECT_RESULT", data.payload || {});
      return;
    }
  });

  // ---------------------------------------------------------------------------
  // Handle messages from background SW → page
  // ---------------------------------------------------------------------------
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "BURP_TOGGLE_FLOATING") {
        // Defense-in-depth: only the top-level frame owns the floating overlay.
        // Guard against sub-frame injection as a safety measure.
        if (window !== window.top) {
          sendResponse({ ok: false, reason: "subframe" });
          return true;
        }
        try { window.__BURP_RB_FLOATING__?.toggle(); } catch {}
        sendResponse({ ok: true });
        return true;
      }
      // SW requests a fresh auth snapshot after token TTL expiry
      if (msg?.type === "BURP_REQUEST_AUTH_REFRESH") {
        const origin = location.origin && location.origin !== "null" ? location.origin : "*";
        window.postMessage({ source: "BURP_LOVABLE_CONTENT", type: "REQUEST_AUTH_SNAPSHOT" }, origin);
        sendResponse({ ok: true });
        return true;
      }
      // SW → page relays for WS interceptor control channel
      if (msg?.type === "BURP_WS_RULES_UPDATE" || msg?.type === "BURP_WS_RESUME" || msg?.type === "BURP_WS_INJECT") {
        if (window !== window.top) { sendResponse({ ok: false, reason: "subframe" }); return true; }
        const origin = location.origin && location.origin !== "null" ? location.origin : "*";
        const map = {
          BURP_WS_RULES_UPDATE: "WS_RULES_UPDATE",
          BURP_WS_RESUME: "WS_RESUME",
          BURP_WS_INJECT: "WS_INJECT",
        };
        window.postMessage({ source: "BURP_LOVABLE_CONTENT", type: map[msg.type], payload: msg.payload || {} }, origin);
        sendResponse({ ok: true });
        return true;
      }
    });
  } catch {}

  // Only inject the page hook and run auth capture in the top-level document.
  // Iframes (including the extension's own floating overlay) must NOT patch fetch/XHR
  // or attempt to read localStorage, as that corrupts captured data and can crash
  // the overlay iframe when it tries to initialise its own UI.
  if (window === window.top) {
    injectHook();
    send("BURP_HOOK_READY", { href: location.href, title: document.title });
  }

  // F7 FIX: Trigger auth snapshot with two attempts — 500 ms and 2000 ms.
  // The first attempt catches pages that are fast to initialise. The second
  // provides a retry for pages where localStorage (Supabase token) is only
  // populated after the app's own auth flow completes. The pageHook also polls
  // independently (every 2 s, up to 15×), so this is purely belt-and-suspenders
  // for the content → pageHook request path.
  if (window === window.top) {
    const _sendAuthRequest = () => {
      const origin = location.origin && location.origin !== "null" ? location.origin : "*";
      window.postMessage({ source: "BURP_LOVABLE_CONTENT", type: "REQUEST_AUTH_SNAPSHOT" }, origin);
    };
    setTimeout(_sendAuthRequest, 500);
    setTimeout(_sendAuthRequest, 2000);
  }
})();
