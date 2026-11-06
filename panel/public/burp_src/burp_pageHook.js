(() => {
      if (window.__BURP_LOVABLE_PAGE__) return;
      // C-A-02 FIX: skip injection in cross-origin iframes or sandboxed frames
      try { if (window !== window.top && (location.origin === 'null' || location.origin !== window.top?.location?.origin)) return; } catch { return; }
      window.__BURP_LOVABLE_PAGE__ = true;

      const MAX_BODY_CHARS = 25000;
      const XHR_META = new WeakMap();
      // Stop polling after captured OR after MAX_POLL_ATTEMPTS ticks with token+pid
      const MAX_POLL_ATTEMPTS = 15;
      let _pollInterval = null;
      let _pollAttempts = 0;
      let _capturedToken = false;
      let _capturedPid = false;

      function clamp(value) {
        if (value === undefined || value === null) return null;
        const text = typeof value === "string" ? value : JSON.stringify(value);
        return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}\n/* truncated */` : text;
      }

      function serializeHeaders(headers) {
        if (!headers) return {};
        try {
          if (headers instanceof Headers) return Object.fromEntries(headers.entries());
          if (Array.isArray(headers)) return Object.fromEntries(headers);
          return { ...headers };
        } catch {
          return {};
        }
      }

      function detectProjectId(url) {
        const match = String(url || location.href).match(/\/projects\/([0-9a-fA-F-]{36})/i);
        return match ? match[1] : null;
      }

      function getWorkspaceId() {
        try {
          const fromStorage = localStorage.getItem("lovable_workspace_id");
          if (fromStorage) return fromStorage;
        } catch {}
        const match = location.href.match(/[?&]workspace=([a-zA-Z0-9-]+)/);
        return match ? match[1] : null;
      }

      function getBearerToken() {
        try {
          for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
              const parsed = JSON.parse(localStorage.getItem(key));
              if (parsed?.access_token) return parsed.access_token;
            }
          }
        } catch {}
        return null;
      }

      /**
       * Cookies são sensíveis. Nunca enviamos valores ao background.
       * Apenas a contagem + nomes (sem values).
       */
      function getCookieSnapshot() {
        try {
          const raw = document.cookie || "";
          if (!raw) return null;
          const names = raw.split(";").map((c) => c.split("=")[0].trim()).filter(Boolean);
          if (!names.length) return null;
          return `${names.length} cookie(s): ${names.slice(0, 8).join(", ")}${names.length > 8 ? `, +${names.length - 8}` : ""}`;
        } catch {
          return null;
        }
      }

      // Use location.origin to avoid postMessage leaking to cross-origin frames.
      const _targetOrigin = (function () {
        try { return location.origin || "*"; } catch { return "*"; }
      })();

      function post(type, payload) {
        window.postMessage({ source: "BURP_LOVABLE_PAGE", type, payload }, _targetOrigin);
      }

      function captureAuth(extra) {
        const bearerToken = extra?.bearerToken || getBearerToken();
        const projectId = extra?.projectId || detectProjectId(extra?.url);
        if (bearerToken) _capturedToken = true;
        if (projectId) _capturedPid = true;
        post("AUTH_SNAPSHOT", {
          bearerToken,
          projectId,
          workspaceId: getWorkspaceId(),
          cookies: getCookieSnapshot(),
          source: "page-hook",
        });
      }

      function inferKind(headers, body) {
        const headerMap = serializeHeaders(headers);
        const contentType = String(headerMap["content-type"] || headerMap["Content-Type"] || "").toLowerCase();
        const bodyText = typeof body === "string" ? body : JSON.stringify(body || "");
        if (contentType.includes("graphql") || /(query|mutation)/.test(bodyText)) return "graphql";
        if (contentType.includes("json") || bodyText.startsWith("{")) return "fetch";
        return "xhr";
      }

      function buildRequestBase(method, url, headers, body) {
        const headerMap = serializeHeaders(headers);
        const authHeader = headerMap.Authorization || headerMap.authorization;
        const bearerToken = authHeader && String(authHeader).startsWith("Bearer ") ? String(authHeader).slice(7).trim() : null;
        return {
          id: crypto.randomUUID(),
          method: method || "GET",
          url: String(url || location.href),
          requestHeaders: headerMap,
          requestBody: clamp(body),
          kind: inferKind(headerMap, body),
          source: "page",
          startedAt: new Date().toISOString(),
          projectId: detectProjectId(url),
          bearerToken,
        };
      }

      // FIX Bug #2/3: serialize any body type to a readable string BEFORE consume.
      // For FormData / URLSearchParams we use toString() / spread, not JSON.stringify.
      async function serializeBody(body) {
        if (body == null) return null;
        if (typeof body === "string") return body;
        if (body instanceof URLSearchParams) return body.toString();
        if (body instanceof FormData) {
          const parts = [];
          for (const [k, v] of body.entries()) {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(typeof v === "string" ? v : "[File]")}`);
          }
          return parts.join("&");
        }
        if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
          return `[binary ${body.byteLength ?? body.buffer?.byteLength ?? 0}b]`;
        }
        if (body instanceof Blob) return `[blob ${body.size}b type=${body.type}]`;
        try { return String(body); } catch { return null; }
      }

      const originalFetch = window.fetch.bind(window);
      window.fetch = async function patchedFetch(input, init) {
        const request = input instanceof Request ? input : null;
        const url = request ? request.url : String(input);
        const method = request ? request.method : (init?.method || "GET");
        const headers = request ? request.headers : init?.headers;
        // Clone the Request early, before originalFetch can consume the ReadableStream.
        let body = null;
        if (init?.body != null) {
          body = await serializeBody(init.body);
        } else if (request && !request.bodyUsed) {
          try {
            // Clone before the native fetch consumes the stream
            const cloned = request.clone();
            body = await cloned.text();
          } catch { body = null; }
        }
        // ─────────────────────────────────────────────────────────────
        // HyperRB · Lovable /chat message rewriter
        // Reescreve `message` quando intent ∈ REWRITE_INTENTS.
        // Configurável em runtime via window.__HYPER_RB_REWRITE__.
        // ─────────────────────────────────────────────────────────────
        try {
          if (!window.__HYPER_RB_REWRITE__) {
            window.__HYPER_RB_REWRITE__ = {
              enabled: true,
              message: "Oi",
              intents: ["security_fix_v2"],
            };
          }
          const cfg = window.__HYPER_RB_REWRITE__;
          const isChatPost =
            cfg?.enabled &&
            String(method).toUpperCase() === "POST" &&
            /\/projects\/[^/]+\/chat(\?|$)/i.test(url);
          if (isChatPost && typeof body === "string" && body.length) {
            try {
              const parsed = JSON.parse(body);
              const intents = new Set(cfg.intents || ["security_fix_v2"]);
              if (parsed && intents.has(parsed.intent)) {
                const newMsg = typeof cfg.message === "function" ? cfg.message(parsed) : cfg.message;
                const original = parsed.message;
                parsed.message = newMsg;
                const newBody = JSON.stringify(parsed);
                console.log("[HyperRB] /chat rewrite", { intent: parsed.intent, from: original, to: newMsg });
                if (request) {
                  // Rebuild Request preservando headers/credentials/etc.
                  input = new Request(request, { body: newBody });
                } else {
                  init = { ...(init || {}), body: newBody };
                }
                body = newBody;
              }
            } catch { /* body não-JSON, ignora */ }
          }
        } catch (e) {
          console.warn("[HyperRB] rewriter falhou:", e);
        }
        const requestBase = buildRequestBase(method, url, headers, body);
        const started = performance.now();

        try {
          const response = await originalFetch(input, init);
          const clone = response.clone();
          let responseBody = "";
          try { responseBody = await clone.text(); } catch {}
          captureAuth({ bearerToken: requestBase.bearerToken, projectId: requestBase.projectId, url: requestBase.url });
          post("REQUEST_COMPLETED", {
            ...requestBase,
            status: response.status,
            statusText: response.statusText,
            responseHeaders: serializeHeaders(response.headers),
            responseBody: clamp(responseBody),
            responseJson: (() => { try { return JSON.parse(responseBody); } catch { return null; } })(),
            responseSize: responseBody.length,
            timingMs: Math.round(performance.now() - started),
          });
          return response;
        } catch (error) {
          post("REQUEST_FAILED", {
            ...requestBase,
            error: error?.message || String(error),
            timingMs: Math.round(performance.now() - started),
          });
          throw error;
        }
      };

      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
        XHR_META.set(this, { method, url, headers: {}, started: 0, body: null });
        return originalOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name, value) {
        const meta = XHR_META.get(this) || { headers: {} };
        meta.headers[name] = value;
        XHR_META.set(this, meta);
        return originalSetRequestHeader.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function patchedSend(body) {
        const meta = XHR_META.get(this) || {};
        meta.started = performance.now();
        meta.body = body;
        XHR_META.set(this, meta);

        this.addEventListener("loadend", () => {
          const requestBase = buildRequestBase(meta.method, meta.url, meta.headers || {}, meta.body);
          captureAuth({ bearerToken: requestBase.bearerToken, projectId: requestBase.projectId, url: requestBase.url });
          post("REQUEST_COMPLETED", {
            ...requestBase,
            kind: inferKind(meta.headers || {}, meta.body),
            status: this.status,
            statusText: this.statusText,
            responseHeaders: {},
            responseBody: clamp(this.responseText || this.response),
            responseJson: (() => { try { return JSON.parse(this.responseText); } catch { return null; } })(),
            responseSize: String(this.responseText || this.response || "").length,
            timingMs: Math.round(performance.now() - meta.started),
          });
        }, { once: true });

        return originalSend.apply(this, arguments);
      };

      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== "BURP_LOVABLE_CONTENT") return;
        if (event.data.type === "REQUEST_AUTH_SNAPSHOT") {
          captureAuth();
        }
      });

      // ------------------------------------------------------------
      // WebSocket interception (transparent monkey-patch).
      // v4.4.5 — send/recv pause/drop/rewrite + JSON path rewrite.
      // ------------------------------------------------------------
      const wsConns = new Map(); // connId → { ws, originalSend, url }
      const AUTO_CONTENT_RULE_ID = "hyper-rb-content-intercept";
      const AUTO_CONTENT_RULE = Object.freeze({
        id: AUTO_CONTENT_RULE_ID,
        label: "Auto: Lovable trajectory content → oi",
        direction: "recv",
        mode: "rewrite",
        urlRegex: "^wss://api\\.lovable\\.dev/projects/971dffb5-f1af-4b30-b50d-a3da7170a5ce/ws/trajectory(?:\\?.*)?$",
        payloadRegex: "\\\"content\\\"\\s*:",
        rewritePath: "data.event.content",
        rewriteTo: "oi",
        enabled: true,
      });
      let wsRules = [AUTO_CONTENT_RULE]; // [{ id, direction, urlRegex?, payloadRegex?, mode, rewritePath?, rewriteTo? }]
      const wsPauses = new Map(); // pauseId → resolver
      const syntheticWsEvents = new WeakSet();

      function normalizeWsRules(rules) {
        const incoming = Array.isArray(rules) ? rules.filter(Boolean) : [];
        const withoutAuto = incoming.filter((r) => r.id !== AUTO_CONTENT_RULE_ID);
        const configuredAuto = incoming.find((r) => r.id === AUTO_CONTENT_RULE_ID) || {};
        return [{
          ...configuredAuto,
          ...AUTO_CONTENT_RULE,
          urlRegex: configuredAuto.urlRegex || AUTO_CONTENT_RULE.urlRegex,
          payloadRegex: configuredAuto.payloadRegex || AUTO_CONTENT_RULE.payloadRegex,
          rewriteTo: AUTO_CONTENT_RULE.rewriteTo,
          enabled: configuredAuto.enabled !== false,
        }, ...withoutAuto];
      }

      function safeWsPayload(data) {
        try {
          if (typeof data === "string") return data;
          if (data instanceof ArrayBuffer) return `[binary ${data.byteLength}b]`;
          if (ArrayBuffer.isView(data)) return `[binary ${data.byteLength || data.buffer?.byteLength || 0}b]`;
          if (data instanceof Blob) return `[blob ${data.size}b type=${data.type || "application/octet-stream"}]`;
          return String(data);
        } catch {
          return "[unserializable websocket frame]";
        }
      }

      function matchRule(direction, url, payloadStr) {
        for (const r of normalizeWsRules(wsRules)) {
          if (!r || r.enabled === false) continue;
          if (r.direction && r.direction !== "any" && r.direction !== direction) continue;
          if (r.urlRegex) { try { if (!new RegExp(r.urlRegex).test(url)) continue; } catch { continue; } }
          if (r.payloadRegex) { try { if (!new RegExp(r.payloadRegex).test(payloadStr)) continue; } catch { continue; } }
          return r;
        }
        return null;
      }

      function parseJsonPath(path) {
        const clean = String(path || "").trim();
        if (!clean) return [];
        const parts = clean.replace(/\[(\d+)\]/g, ".$1").split(".").map((x) => x.trim()).filter(Boolean);
        return parts.every((p) => /^[A-Za-z0-9_$-]+$/.test(p) && !["__proto__", "prototype", "constructor"].includes(p)) ? parts : [];
      }

      function setJsonPath(target, path, value) {
        const parts = parseJsonPath(path);
        if (!parts.length || !target || typeof target !== "object") return false;
        let cursor = target;
        for (let i = 0; i < parts.length - 1; i += 1) {
          const key = parts[i];
          if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
          cursor = cursor[key];
        }
        cursor[parts[parts.length - 1]] = value;
        return true;
      }

      function rewriteWsData(rule, originalData) {
        if (!rule || rule.mode !== "rewrite") return originalData;
        const replacement = rule.rewriteTo != null ? String(rule.rewriteTo) : "";
        if (rule.rewritePath && typeof originalData === "string") {
          try {
            const parsed = JSON.parse(originalData);
            if (setJsonPath(parsed, rule.rewritePath, replacement)) return JSON.stringify(parsed);
          } catch {}
        }
        return typeof originalData === "string" ? replacement : originalData;
      }

      function dispatchWebSocketMessage(ws, data, originalEvent) {
        const ev = new MessageEvent("message", {
          data,
          origin: originalEvent?.origin || "",
          lastEventId: originalEvent?.lastEventId || "",
          source: originalEvent?.source || null,
          ports: originalEvent?.ports || [],
        });
        syntheticWsEvents.add(ev);
        ws.dispatchEvent(ev);
      }

      function awaitPauseDecision(pauseId, originalData) {
        return new Promise((resolve) => {
          wsPauses.set(pauseId, resolve);
          // 30s safety net — never block the app indefinitely.
          setTimeout(() => {
            if (wsPauses.has(pauseId)) {
              wsPauses.delete(pauseId);
              resolve({ action: "send", data: originalData });
            }
          }, 30_000);
        });
      }

      try {
        const OriginalWebSocket = window.WebSocket;
        if (OriginalWebSocket && !OriginalWebSocket.__hyperRbPatched) {
          const PatchedWebSocket = function(url, protocols) {
            if (!(this instanceof PatchedWebSocket)) throw new TypeError("Failed to construct 'WebSocket': Please use the 'new' operator.");
            const ws = protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);
            const connId = crypto.randomUUID();
            const startedAt = new Date().toISOString();
            const startedPerf = performance.now();
            let frameCount = 0;
            const urlStr = String(url);

            post("REQUEST_COMPLETED", {
              id: connId,
              method: "WS",
              url: urlStr,
              kind: "ws",
              source: "websocket",
              startedAt,
              status: 101,
              statusText: "Switching Protocols",
              requestHeaders: { Upgrade: "websocket", Protocol: Array.isArray(protocols) ? protocols.join(",") : (protocols || "") },
              requestBody: null,
              responseHeaders: {},
              responseBody: "// WebSocket conectado — frames aparecem como WS_FRAME",
              responseSize: 0,
              timingMs: 0,
              wsState: "open",
            });

            const originalWsSend = ws.send.bind(ws);
            wsConns.set(connId, { ws, originalSend: originalWsSend, url: urlStr, dispatchSynthetic: dispatchSyntheticMessage });

            function emitFrame(direction, data, extra) {
              frameCount += 1;
              post("WS_FRAME", {
                connId, direction, url: urlStr,
                payload: clamp(safeWsPayload(data)),
                timestamp: new Date().toISOString(), frameIndex: frameCount,
                ...(extra || {}),
              });
            }

            function dispatchSyntheticMessage(data, originalEvent) {
              dispatchWebSocketMessage(ws, data, originalEvent);
            }

            ws.send = function(data) {
              const payloadStr = safeWsPayload(data);
              const rule = matchRule("send", urlStr, payloadStr);
              // Fast path: no rule → send through, log normally.
              if (!rule) {
                try { emitFrame("send", data); } catch {}
                return originalWsSend(data);
              }
              if (rule.mode === "drop") {
                try { emitFrame("send", data, { dropped: true, ruleId: rule.id }); } catch {}
                return; // never reaches the wire
              }
              if (rule.mode === "rewrite") {
                const newData = rewriteWsData(rule, data);
                try { emitFrame("send", newData, { edited: newData !== data, ruleId: rule.id, rewritePath: rule.rewritePath || null }); } catch {}
                return originalWsSend(newData);
              }
              if (rule.mode === "pause") {
                const pauseId = crypto.randomUUID();
                try { post("WS_PAUSED", { pauseId, connId, direction: "send", url: urlStr, payload: clamp(payloadStr), ruleId: rule.id }); } catch {}
                awaitPauseDecision(pauseId, data).then((res) => {
                  if (res.action === "drop") {
                    try { emitFrame("send", data, { dropped: true, paused: true }); } catch {}
                    return;
                  }
                  const finalData = res.data != null ? res.data : data;
                  try { emitFrame("send", finalData, { edited: finalData !== data, paused: true }); } catch {}
                  try { originalWsSend(finalData); } catch (e) { console.warn("[Hyper RB] WS resume send falhou:", e); }
                });
                return; // returns immediately; actual send happens after resume
              }
              try { emitFrame("send", data); } catch {}
              return originalWsSend(data);
            };

            ws.addEventListener("message", (ev) => {
              try {
                if (syntheticWsEvents.has(ev)) return;
                const data = ev.data;
                const payloadStr = safeWsPayload(data);
                const rule = matchRule("recv", urlStr, payloadStr);
                if (!rule) {
                  emitFrame("recv", data);
                  return;
                }
                ev.stopImmediatePropagation();
                if (rule.mode === "drop") {
                  emitFrame("recv", data, { dropped: true, ruleId: rule.id });
                  return;
                }
                if (rule.mode === "rewrite") {
                  const newData = rewriteWsData(rule, data);
                  emitFrame("recv", newData, { edited: newData !== data, ruleId: rule.id, rewritePath: rule.rewritePath || null });
                  dispatchSyntheticMessage(newData, ev);
                  return;
                }
                if (rule.mode === "pause") {
                  const pauseId = crypto.randomUUID();
                  post("WS_PAUSED", { pauseId, connId, direction: "recv", url: urlStr, payload: clamp(payloadStr), ruleId: rule.id });
                  awaitPauseDecision(pauseId, data).then((res) => {
                    if (res.action === "drop") {
                      try { emitFrame("recv", data, { dropped: true, paused: true }); } catch {}
                      return;
                    }
                    const finalData = res.data != null ? res.data : data;
                    try { emitFrame("recv", finalData, { edited: finalData !== data, paused: true }); } catch {}
                    try { dispatchSyntheticMessage(finalData, ev); } catch (e) { console.warn("[Hyper RB] WS resume recv falhou:", e); }
                  });
                }
              } catch (e) {
                console.warn("[Hyper RB] WS recv intercept falhou", e);
              }
            });

            ws.addEventListener("close", (ev) => {
              wsConns.delete(connId);
              post("WS_FRAME", {
                connId, direction: "close", url: urlStr,
                payload: `close code=${ev.code} reason=${ev.reason || "—"}`,
                timestamp: new Date().toISOString(), frameIndex: frameCount + 1,
                durationMs: Math.round(performance.now() - startedPerf),
              });
            });

            ws.addEventListener("error", () => {
              post("WS_FRAME", {
                connId, direction: "error", url: urlStr,
                payload: "WebSocket error", timestamp: new Date().toISOString(), frameIndex: frameCount + 1,
              });
            });

            return ws;
          };
          PatchedWebSocket.prototype = OriginalWebSocket.prototype;
          Object.defineProperty(PatchedWebSocket, "name", { value: "WebSocket", configurable: true });
          Object.defineProperty(PatchedWebSocket, "__hyperRbPatched", { value: true, configurable: true });
          PatchedWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
          PatchedWebSocket.OPEN = OriginalWebSocket.OPEN;
          PatchedWebSocket.CLOSING = OriginalWebSocket.CLOSING;
          PatchedWebSocket.CLOSED = OriginalWebSocket.CLOSED;
          window.WebSocket = PatchedWebSocket;
        }
      } catch (err) {
        console.warn("[Hyper RB] WebSocket hook falhou", err);
      }

      // ------------------------------------------------------------
      // Control channel: content → pageHook (rules, resume, inject)
      // ------------------------------------------------------------
      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        const d = event.data;
        if (!d || d.source !== "BURP_LOVABLE_CONTENT") return;
        if (d.type === "WS_RULES_UPDATE") {
          wsRules = normalizeWsRules(d.payload?.rules);
          return;
        }
        if (d.type === "WS_RESUME") {
          const { pauseId, action, data } = d.payload || {};
          const resolver = wsPauses.get(pauseId);
          if (resolver) { wsPauses.delete(pauseId); resolver({ action: action || "send", data }); }
          return;
        }
        if (d.type === "WS_INJECT") {
          const { connId, direction, data } = d.payload || {};
          const conn = wsConns.get(connId);
          if (!conn) {
            try { post("WS_INJECT_RESULT", { connId, ok: false, error: "connection not found" }); } catch {}
            return;
          }
          try {
            if (direction === "send") {
              conn.originalSend(data);
            } else if (direction === "recv") {
              if (typeof conn.dispatchSynthetic === "function") conn.dispatchSynthetic(data, null);
              else conn.ws.dispatchEvent(new MessageEvent("message", { data }));
            } else {
              throw new Error("invalid direction");
            }
            post("WS_FRAME", {
              connId, direction, url: conn.url,
              payload: clamp(typeof data === "string" ? data : String(data)),
              timestamp: new Date().toISOString(), frameIndex: -1, synthetic: true,
            });
            post("WS_INJECT_RESULT", { connId, ok: true });
          } catch (e) {
            post("WS_INJECT_RESULT", { connId, ok: false, error: e?.message || String(e) });
          }
        }
      });

      post("HOOK_READY", { href: location.href, title: document.title, timestamp: Date.now() });
      captureAuth();

      // Interval polling with leak protection: cleared on pagehide,
      // and stops automatically after MAX_POLL_ATTEMPTS once both token+pid captured.
      _pollInterval = setInterval(() => {
        _pollAttempts += 1;
        captureAuth();
        // Stop immediately once both token and projectId are known,
        // or after MAX_POLL_ATTEMPTS as a hard cap.
        if (_capturedToken && _capturedPid) {
          clearInterval(_pollInterval);
          _pollInterval = null;
        } else if (_pollAttempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(_pollInterval);
          _pollInterval = null;
        }
      }, 2000);

      window.addEventListener("pagehide", () => {
        if (_pollInterval !== null) {
          clearInterval(_pollInterval);
          _pollInterval = null;
        }
      }, { once: true });
    })();
