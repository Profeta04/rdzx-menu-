(() => {
      if (window.__BURP_LOVABLE_PAGE__) return;
      window.__BURP_LOVABLE_PAGE__ = true;

      const MAX_BODY_CHARS = 25000;
      const XHR_META = new WeakMap();

      function clamp(value) {
        if (value === undefined || value === null) return null;
        const text = typeof value === "string" ? value : JSON.stringify(value);
        return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}
/* truncated */` : text;
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

      function getCookieSnapshot() {
        try {
          return document.cookie || null;
        } catch {
          return null;
        }
      }

      function post(type, payload) {
        window.postMessage({ source: "BURP_LOVABLE_PAGE", type, payload }, "*");
      }

      function captureAuth(extra) {
        post("AUTH_SNAPSHOT", {
          bearerToken: extra?.bearerToken || getBearerToken(),
          projectId: extra?.projectId || detectProjectId(extra?.url),
          workspaceId: getWorkspaceId(),
          cookies: getCookieSnapshot(),
          source: "page-hook",
        });
      }

      function inferKind(headers, body) {
        const headerMap = serializeHeaders(headers);
        const contentType = String(headerMap["content-type"] || headerMap["Content-Type"] || "").toLowerCase();
        const bodyText = typeof body === "string" ? body : JSON.stringify(body || "");
        if (contentType.includes("graphql") || /(query|mutation)/.test(bodyText)) return "graphql";
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

      const originalFetch = window.fetch.bind(window);
      window.fetch = async function patchedFetch(input, init) {
        const request = input instanceof Request ? input : null;
        const url = request ? request.url : String(input);
        const method = request ? request.method : (init?.method || "GET");
        const headers = request ? request.headers : init?.headers;
        const body = init?.body;
        const requestBase = buildRequestBase(method, url, headers, body);
        const started = performance.now();

        try {
          const response = await originalFetch(input, init);
          const clone = response.clone();
          let responseBody = "";
          try {
            responseBody = await clone.text();
          } catch {}
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
        XHR_META.set(this, {
          method,
          url,
          headers: {},
          started: 0,
          body: null,
        });
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

      post("HOOK_READY", { href: location.href, title: document.title, timestamp: Date.now() });
      captureAuth();
      setInterval(() => captureAuth(), 2000);
    })();
