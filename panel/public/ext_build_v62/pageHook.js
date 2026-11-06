(function () {
  // Debug logs silenciados para não expor tokens/capturas no console.
  const DEBUG = false;
  const dlog = DEBUG ? console.log.bind(console, "[HyperBuildHook]") : function () {};
  const dwarn = DEBUG ? console.warn.bind(console, "[HyperBuildHook]") : function () {};

  let capturedToken = null;
  let capturedProjectId = null;
  let capturedWorkspaceId = null;
  let capturedCastleToken = null;
  let capturedCastleTokenAt = 0;
  let capturedBrowserSessionId = null;
  let capturedClientGitSha = null;

  function getProjectFromPage() {
    try {
      // Matches both lovable.dev/projects/ID and lovable.app/projects/ID
      const m = window.location.pathname.match(/\/projects\/([0-9a-fA-F-]{36})/i) || 
                window.location.href.match(/\/projects\/([0-9a-fA-F-]{36})/i);
       return m ? m[1] : null;
     } catch { return null; }
   }

  function getWorkspaceFromPage() {
    try {
      // Matches lovable.dev/workspaces/ID
      const m = window.location.pathname.match(/\/workspaces\/([0-9a-fA-F-]{36})/i) || 
                window.location.href.match(/\/workspaces\/([0-9a-fA-F-]{36})/i);
      return m ? m[1] : null;
    } catch { return null; }
  }

  function extractProjectIdFromUrl(url) {
    try {
      const m = String(url).match(/\/projects\/([0-9a-fA-F-]{36})/i);
       return m ? m[1] : null;
     } catch { return null; }
   }

  function extractWorkspaceIdFromUrl(url) {
    try {
      const m = String(url).match(/\/workspaces\/([0-9a-fA-F-]{36})/i);
      return m ? m[1] : null;
    } catch { return null; }
  }

  function sniffHeaderValue(headers, headerName) {
    try {
      if (!headers) return null;
      if (headers instanceof Headers) {
        return headers.get(headerName) || headers.get(headerName.toLowerCase()) || null;
      }
      if (Array.isArray(headers)) {
        const match = headers.find((entry) => Array.isArray(entry)
          ? String(entry[0]).toLowerCase() === String(headerName).toLowerCase()
          : String(entry?.name || entry?.key || "").toLowerCase() === String(headerName).toLowerCase());
        if (!match) return null;
        return Array.isArray(match) ? match[1] : (match.value || null);
      }
      if (typeof headers === "object") {
        return headers[headerName] || headers[headerName.toLowerCase()] || null;
      }
    } catch (_) {}
    return null;
  }

  function updateSessionMetadata(sessionId, clientGitSha) {
    let changed = false;
    if (typeof sessionId === "string" && sessionId.trim() && sessionId !== capturedBrowserSessionId) {
      capturedBrowserSessionId = sessionId.trim();
      changed = true;
    }
    if (typeof clientGitSha === "string" && clientGitSha.trim() && clientGitSha !== capturedClientGitSha) {
      capturedClientGitSha = clientGitSha.trim();
      changed = true;
    }
    return changed;
  }

  function notifyFound(token, projectId, workspaceId, force = false) {
    const newProject = projectId || getProjectFromPage();
    const newWorkspace = workspaceId || getWorkspaceFromPage();
    let normalizedToken = typeof token === "string" ? token.replace(/^Bearer\s+/i, "").trim() : null;
    
    // If we don't have a token yet, try to find it in localStorage (Supabase pattern)
    if (!normalizedToken) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.access_token) {
              normalizedToken = data.access_token;
              dlog("token source: localStorage");
              break;
            }
          }
        }
      } catch (e) {}
    }

    let changed = false;
    if (normalizedToken && normalizedToken !== capturedToken) { 
      capturedToken = normalizedToken; 
      changed = true; 
    }
    if (newProject && newProject !== capturedProjectId) { 
      capturedProjectId = newProject; 
      changed = true; 
    }
    if (newWorkspace && newWorkspace !== capturedWorkspaceId) { 
      capturedWorkspaceId = newWorkspace; 
      changed = true; 
    }

    if (!changed && !force) return;

    dlog("capture state updated", {
      token: capturedToken ? "present" : "missing",
      projectId: capturedProjectId ? "present" : "missing",
      workspaceId: capturedWorkspaceId ? "present" : "missing"
    });

    window.postMessage({ 
      type: "lovableTokenFound", 
      token: capturedToken, 
      projectId: capturedProjectId,
      workspaceId: capturedWorkspaceId,
      castleToken: capturedCastleToken,
      castleTokenAt: capturedCastleTokenAt,
      browserSessionId: capturedBrowserSessionId,
      clientGitSha: capturedClientGitSha
    }, "*");
  }

  // Try to capture castle_request_token from outgoing POST bodies.
  function sniffCastleFromBody(body) {
    try {
      if (!body) return;
      let text = null;
      if (typeof body === "string") text = body;
      else if (body instanceof FormData) return;
      else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return;
      else if (typeof body === "object") { try { text = JSON.stringify(body); } catch { return; } }
      if (!text || text.indexOf("castle_request_token") === -1) return;
      // Fast extract via regex (avoids parse cost on huge bodies)
      const m = text.match(/"castle_request_token"\s*:\s*"([^"]+)"/);
      if (m && m[1] && m[1] !== capturedCastleToken) {
        capturedCastleToken = m[1];
        capturedCastleTokenAt = Date.now();
        dlog("castle token captured");
        notifyFound(capturedToken, capturedProjectId, capturedWorkspaceId, true);
      }
    } catch (_) {}
  }

  // Try to generate a fresh Castle token via the SDK on the page (if loaded).
  async function generateFreshCastleToken() {
    try {
      // Common Castle SDK names
      const c = window._castle || window.castle || window.Castle || (typeof _castle !== "undefined" ? _castle : null);
      dlog("castle SDK probe", !!c);

      if (typeof c === "function") {
        const t = await c("createRequestToken");
        dlog("castle fn result", !!t);
        if (typeof t === "string" && t) return t;
      } else if (c && typeof c.createRequestToken === "function") {
        const t = await c.createRequestToken();
        dlog("castle method result", !!t);
        if (typeof t === "string" && t) return t;
      } else {
        dwarn("castle SDK missing createRequestToken");
      }
    } catch (e) { dwarn("castle SDK call failed"); }
    return null;
  }

  // Proactive Castle token capture loop.
  // Castle tokens expire in ~120s, so we refresh every 60s once SDK is available.
  async function refreshCastleProactively() {
    const fresh = await generateFreshCastleToken();
    if (fresh && fresh !== capturedCastleToken) {
      capturedCastleToken = fresh;
      capturedCastleTokenAt = Date.now();
      dlog("castle token refreshed");
      notifyFound(capturedToken, capturedProjectId, capturedWorkspaceId, true);
    }
  }

  // Poll for Castle SDK readiness every 1s; once found, switch to 60s refresh.
  let castleReady = false;
  const castleBootstrap = setInterval(async () => {
    const c = window.Castle || window._castle || window.castle;
    if (!c) return;
    if (castleReady) return;
    castleReady = true;
    clearInterval(castleBootstrap);
    dlog("castle SDK ready");
    await refreshCastleProactively();
    setInterval(refreshCastleProactively, 60_000);
  }, 1000);

  // Expose a manual debug helper on the page for quick testing in DevTools.
  try {
    window.__hyperBuildCastleDebug = async () => {
      const t = await generateFreshCastleToken();
      dlog("manual debug token", t ? "present" : "missing");
      return t;
    };
  } catch (_) {}

  // Handle requests from content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data) return;
    if (event.data.type === "lovableRequestToken") {
      notifyFound(capturedToken, getProjectFromPage() || capturedProjectId, getWorkspaceFromPage() || capturedWorkspaceId, true);
      return;
    }
    if (event.data.type === "lovableRequestCastleToken") {
      (async () => {
        const fresh = await generateFreshCastleToken();
        if (fresh) {
          capturedCastleToken = fresh;
          capturedCastleTokenAt = Date.now();
        }
        window.postMessage({
          type: "lovableCastleTokenResponse",
          token: capturedCastleToken,
          tokenAt: capturedCastleTokenAt,
          fresh: !!fresh
        }, "*");
        if (fresh) notifyFound(capturedToken, capturedProjectId, capturedWorkspaceId, true);
      })();
      return;
    }
    if (event.data.type === "lovableCreateProjectNative") {
      (async () => {
        const reqId = event.data.reqId;
        try {
          // Always generate a fresh castle token right before the request.
          const fresh = await generateFreshCastleToken();
          if (fresh) { capturedCastleToken = fresh; capturedCastleTokenAt = Date.now(); }
          if (!capturedCastleToken) throw new Error("Castle token indisponível. Recarregue a aba do lovable.dev.");

          let wsId = (event.data.workspaceId || capturedWorkspaceId || "").trim();
          // Resolve workspace via native fetch (uses session cookies + bearer).
          const authToken = capturedToken || event.data.bearer;
          if (!authToken) throw new Error("Bearer token do Lovable indisponível.");
          const baseHeaders = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken,
            "Accept": "application/json",
          };
          if (!wsId) {
            const wsResp = await fetch("https://api.lovable.dev/user/workspaces", {
              method: "GET", credentials: "include", headers: baseHeaders,
            });
            const wsJson = await wsResp.json().catch(() => null);
            wsId = Array.isArray(wsJson) ? wsJson[0]?.id : (wsJson?.id || wsJson?.workspaces?.[0]?.id);
            if (!wsId) throw new Error("Nenhum workspace encontrado.");
          }

          const createResp = await fetch(`https://api.lovable.dev/workspaces/${wsId}/projects`, {
            method: "POST",
            credentials: "include",
            headers: baseHeaders,
            body: JSON.stringify({
              name: event.data.name,
              castle_request_token: capturedCastleToken,
            }),
          });
          const text = await createResp.text();
          let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
          window.postMessage({
            type: "lovableCreateProjectNativeResponse",
            reqId,
            ok: createResp.ok,
            status: createResp.status,
            data,
          }, "*");
        } catch (err) {
          window.postMessage({
            type: "lovableCreateProjectNativeResponse",
            reqId,
            ok: false, status: 0,
            error: err?.message || String(err),
          }, "*");
        }
      })();
      return;
    }
  });

  // Intercept Fetch
  (function wrapFetch() {
    try {
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        try {
          let reqUrl = typeof args[0] === "string" ? args[0] : ((args[0] && args[0].url) || "");
          let opts = args[1] || {};
          let auth = null;

          // Sniff castle token from request body
          try {
            if (args[0] instanceof Request) {
              // Clone to read body without consuming
              try { args[0].clone().text().then(sniffCastleFromBody).catch(()=>{}); } catch(_) {}
            } else if (opts && opts.body) {
              sniffCastleFromBody(opts.body);
            }
          } catch (_) {}

          if (args[0] instanceof Request) {
            reqUrl = args[0].url || reqUrl;
            auth = (args[0].headers && typeof args[0].headers.get === "function") ? 
                   (args[0].headers.get("Authorization") || args[0].headers.get("authorization")) : null;
          }

          if (opts.headers) {
            if (opts.headers instanceof Headers) {
              auth = opts.headers.get("Authorization") || opts.headers.get("authorization");
            } else if (typeof opts.headers === "object") {
              auth = opts.headers.Authorization || opts.headers.authorization;
            }
          }

          const browserSessionId = (args[0] instanceof Request)
            ? sniffHeaderValue(args[0].headers, "X-Browser-Session-ID")
            : sniffHeaderValue(opts.headers, "X-Browser-Session-ID");
          const clientGitSha = (args[0] instanceof Request)
            ? sniffHeaderValue(args[0].headers, "X-Client-Git-SHA")
            : sniffHeaderValue(opts.headers, "X-Client-Git-SHA");
          const metaChanged = updateSessionMetadata(browserSessionId, clientGitSha);

          const pid = extractProjectIdFromUrl(reqUrl);
          const wid = extractWorkspaceIdFromUrl(reqUrl);

          if (auth && auth.toLowerCase().startsWith("bearer ")) {
            const rawToken = auth.substring(7).trim();
            notifyFound(rawToken, pid, wid, metaChanged);
          } else if (pid || wid || metaChanged) {
            notifyFound(null, pid, wid, metaChanged);
          }
        } catch (e) {}
        return originalFetch.apply(this, args);
      };
    } catch (e) { console.warn("[HyperBuildHook] fetch wrap error", e); }
  })();

  // Intercept XHR
  (function wrapXHR() {
    try {
      const origOpen = XMLHttpRequest.prototype.open;
      const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

      XMLHttpRequest.prototype.open = function (method, url) {
        this._lovable_url = url;
        return origOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        if (name && name.toLowerCase() === "authorization" && value && value.toLowerCase().startsWith("bearer ")) {
          const rawToken = value.substring(7).trim();
          notifyFound(rawToken, extractProjectIdFromUrl(this._lovable_url), extractWorkspaceIdFromUrl(this._lovable_url));
        }
        if (name && typeof value === "string") {
          const lower = name.toLowerCase();
          if (lower === "x-browser-session-id") {
            if (updateSessionMetadata(value, null)) {
              notifyFound(capturedToken, extractProjectIdFromUrl(this._lovable_url), extractWorkspaceIdFromUrl(this._lovable_url), true);
            }
          } else if (lower === "x-client-git-sha") {
            if (updateSessionMetadata(null, value)) {
              notifyFound(capturedToken, extractProjectIdFromUrl(this._lovable_url), extractWorkspaceIdFromUrl(this._lovable_url), true);
            }
          }
        }
        return origSetHeader.apply(this, arguments);
      };

      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function (body) {
        try { sniffCastleFromBody(body); } catch(_) {}
        return origSend.apply(this, arguments);
      };
    } catch (e) { console.warn("[HyperBuildHook] XHR wrap error", e); }
  })();

  // Periodically check URL and localStorage
  setInterval(() => {
    notifyFound(null, getProjectFromPage(), getWorkspaceFromPage());
  }, 2000);

  // Initial check
  setTimeout(() => notifyFound(null, getProjectFromPage(), getWorkspaceFromPage()), 500);

})();