// PUBLISHABLE anon key — safe to ship in the extension bundle (RLS-protected backend).
// Centralized here so it is never duplicated across files.
const SUPABASE_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmdyamF1cWphd3JzeWtuaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk1OTYsImV4cCI6MjA5MTIzNTU5Nn0.JdZeY39iGHcZ5P3p0DDXYVUvNJfMrKp_OraUC5EDyzU";
    const VALIDATE_ENDPOINT = `${SUPABASE_URL}/functions/v1/vx`;
     const BURP_ENDPOINT = `${SUPABASE_URL}/functions/v1/burp`;
    const MAX_NETWORK_ENTRIES = 300;
    const MAX_BODY_CHARS = 25000;
    const MAX_STARTUP_LOGS = 120;
    const BROADCAST_DEBOUNCE_MS = 200;
    const REPLAY_TIMEOUT_MS = 30000;
    const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie", "x-api-key", "apikey", "proxy-authorization"];

    const state = {
      bootedAt: new Date().toISOString(),
      deviceId: null,
      debug: false,
      auth: {
        bearerToken: null,
        projectId: null,
        workspaceId: null,
        cookies: null,
        source: null,
        lastUpdated: null,
      },
      license: {
        key: null,
        valid: false,
        sessionId: null,
        userName: null,
        expiresAt: null,
        status: null,
        onlineCount: 0,
      },
      diagnostics: {
        manifest: { status: "ready", detail: chrome.runtime.getManifest().version },
        serviceWorker: { status: "booting", detail: "Inicializando" },
        contentScript: { status: "waiting", detail: "Aguardando página Lovable" },
        pageHook: { status: "waiting", detail: "Hook ainda não respondeu" },
        auth: { status: "waiting", detail: "Aguardando captura" },
        permissions: { status: "ready", detail: "Permissões carregadas" },
      },
      startupLogs: [],
       network: [],
       isCapturing: true,
    };

    let persistTimer = null;
    let broadcastTimer = null;
    const pendingBroadcasts = new Map(); // type -> latest payload

    function log(level, module, message, meta) {
      const entry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        module,
        message,
        meta: meta || null,
      };
      state.startupLogs.unshift(entry);
      state.startupLogs = state.startupLogs.slice(0, MAX_STARTUP_LOGS);
      const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[consoleMethod](`[Burp Lovable][${module}] ${message}`, meta || "");
      schedulePersist();
      broadcast({ type: "BURP_LOG_UPDATED", payload: getPublicState() });
    }

    function schedulePersist() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        chrome.storage.local.set({
          burp_background_state: {
            bootedAt: state.bootedAt,
            deviceId: state.deviceId,
            debug: state.debug,
            auth: state.auth,
            license: state.license,
            diagnostics: state.diagnostics,
            startupLogs: state.startupLogs,
          }
        });
        // Volatile network buffer lives in session storage to reduce I/O and stay short-lived.
        try {
          if (chrome.storage.session) {
            chrome.storage.session.set({ burp_network: state.network });
          }
        } catch (_) {}
      }, 300);
    }

    function maskValue(value) {
      if (!value) return null;
      const stringValue = String(value);
      if (stringValue.length <= 10) return "••••";
      return `${stringValue.slice(0, 6)}••••${stringValue.slice(-4)}`;
    }

    function truncateText(value, limit = MAX_BODY_CHARS) {
      if (value === undefined || value === null) return null;
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return text.length > limit ? `${text.slice(0, limit)}
/* truncated */` : text;
    }

    function parseJsonSafely(value) {
      if (!value || typeof value !== "string") return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    function getSize(value) {
      if (value === undefined || value === null) return 0;
      try {
        return new Blob([typeof value === "string" ? value : JSON.stringify(value)]).size;
      } catch {
        return String(value).length;
      }
    }

    function sanitizeHeaders(headers) {
      if (!headers || typeof headers !== "object") return {};
      const sanitized = {};
      for (const [key, value] of Object.entries(headers)) {
        const normalized = key.toLowerCase();
        sanitized[key] = SENSITIVE_HEADERS.some((header) => normalized.includes(header)) ? maskValue(value) : String(value);
      }
      return sanitized;
    }

    function normalizeHeaders(headers) {
      if (!headers) return {};
      if (headers instanceof Headers) {
        return Object.fromEntries(headers.entries());
      }
      if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
      }
      return { ...headers };
    }

    function inferKind(url, headers, body) {
      const headerMap = normalizeHeaders(headers);
      const contentType = String(headerMap["content-type"] || headerMap["Content-Type"] || "").toLowerCase();
      const bodyText = typeof body === "string" ? body : JSON.stringify(body || "");
      if (contentType.includes("graphql") || /(query|mutation)/.test(bodyText)) return "graphql";
      if (contentType.includes("json") || contentType.includes("javascript") || bodyText.startsWith("{")) return "fetch";
      return "xhr";
    }

    function getStats() {
      return {
        entryCount: state.network.length,
        authCaptured: Boolean(state.auth.bearerToken),
        lastCaptureAt: state.auth.lastUpdated,
        licenseValid: Boolean(state.license.valid),
      };
    }

    function getPublicState() {
      return {
        bootedAt: state.bootedAt,
        debug: state.debug,
        diagnostics: state.diagnostics,
        startupLogs: state.startupLogs,
        network: state.network,
        stats: getStats(),
        auth: {
          hasBearerToken: Boolean(state.auth.bearerToken),
          bearerTokenPreview: maskValue(state.auth.bearerToken),
          projectId: state.auth.projectId,
          workspaceId: state.auth.workspaceId,
          cookiesPreview: maskValue(state.auth.cookies),
          source: state.auth.source,
          lastUpdated: state.auth.lastUpdated,
        },
        license: {
          valid: state.license.valid,
          keyPreview: maskValue(state.license.key),
          sessionId: state.license.sessionId,
          userName: state.license.userName,
          expiresAt: state.license.expiresAt,
          status: state.license.status,
          onlineCount: state.license.onlineCount,
        },
      };
    }

    function broadcastNow(message) {
      try {
        chrome.runtime.sendMessage(message, () => void chrome.runtime?.lastError);
      } catch {}
    }

    // Debounced broadcast: coalesce rapid updates of the same type into a single
    // delivery every BROADCAST_DEBOUNCE_MS to avoid saturating the SW on busy pages.
    function broadcast(message) {
      if (!message || typeof message !== "object") return;
      pendingBroadcasts.set(message.type, message);
      if (broadcastTimer) return;
      broadcastTimer = setTimeout(() => {
        const toSend = Array.from(pendingBroadcasts.values());
        pendingBroadcasts.clear();
        broadcastTimer = null;
        for (const msg of toSend) broadcastNow(msg);
      }, BROADCAST_DEBOUNCE_MS);
    }

    async function ensureDeviceId() {
      const data = await chrome.storage.local.get(["burp_device_id"]);
      if (data.burp_device_id) {
        state.deviceId = data.burp_device_id;
        return data.burp_device_id;
      }
      const deviceId = crypto.randomUUID();
      state.deviceId = deviceId;
      await chrome.storage.local.set({ burp_device_id: deviceId });
      return deviceId;
    }

    async function restoreState() {
      const data = await chrome.storage.local.get(["burp_background_state", "ql_license_key", "ql_license_valid", "ql_session_id", "ql_user_name", "ql_expires_at", "ql_license_status"]);
      if (data.burp_background_state) {
        const saved = data.burp_background_state;
        state.debug = Boolean(saved.debug);
        state.auth = { ...state.auth, ...(saved.auth || {}) };
        state.license = { ...state.license, ...(saved.license || {}) };
        state.diagnostics = { ...state.diagnostics, ...(saved.diagnostics || {}) };
        delete state.diagnostics.sidePanel;
        state.startupLogs = Array.isArray(saved.startupLogs) ? saved.startupLogs.slice(0, MAX_STARTUP_LOGS) : [];
        state.network = Array.isArray(saved.network) ? saved.network.slice(0, MAX_NETWORK_ENTRIES) : [];
      }
      // Prefer volatile session network if present (survives SW restarts within the browser session).
      try {
        if (chrome.storage.session) {
          const sess = await chrome.storage.session.get(["burp_network"]);
          if (Array.isArray(sess.burp_network) && sess.burp_network.length) {
            state.network = sess.burp_network.slice(0, MAX_NETWORK_ENTRIES);
          }
        }
      } catch (_) {}
      if (data.ql_license_key) {
        state.license.key = data.ql_license_key;
        state.license.valid = Boolean(data.ql_license_valid);
        state.license.sessionId = data.ql_session_id || null;
        state.license.userName = data.ql_user_name || null;
        state.license.expiresAt = data.ql_expires_at || null;
        state.license.status = data.ql_license_status || null;
      }
    }

    function storeNetworkEntry(entry) {
      state.network.unshift(entry);
      state.network = state.network.slice(0, MAX_NETWORK_ENTRIES);
      schedulePersist();
      broadcast({ type: "BURP_NETWORK_UPDATED", payload: getPublicState() });
    }

    function upsertAuth(payload) {
      const nextAuth = {
        ...state.auth,
        bearerToken: payload.bearerToken || state.auth.bearerToken,
        projectId: payload.projectId || state.auth.projectId,
        workspaceId: payload.workspaceId || state.auth.workspaceId,
        cookies: payload.cookies || state.auth.cookies,
        source: payload.source || payload.origin || state.auth.source || "page",
        lastUpdated: new Date().toISOString(),
      };
      state.auth = nextAuth;
      state.diagnostics.auth = {
        status: nextAuth.bearerToken ? "ready" : "warning",
        detail: nextAuth.bearerToken ? "Bearer token capturado" : "Sem token capturado",
      };
      state.diagnostics.pageHook = {
        status: "ready",
        detail: `Último sync em ${new Date().toLocaleTimeString("pt-BR")}`,
      };
      schedulePersist();
      broadcast({ type: "BURP_AUTH_UPDATED", payload: getPublicState() });
    }

    async function validateLicense(licenseKey, heartbeat) {
      await ensureDeviceId();
      const response = await fetch(VALIDATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: state.deviceId,
          session_id: heartbeat ? state.license.sessionId : null,
          heartbeat: Boolean(heartbeat),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || "Falha ao validar licença");
      }
      if (!result.valid) {
        state.license = {
          key: licenseKey,
          valid: false,
          sessionId: null,
          userName: null,
          expiresAt: null,
          status: result.reason || "invalid",
          onlineCount: 0,
        };
        state.diagnostics.auth = { status: "warning", detail: result.message || "Licença inválida" };
        await chrome.storage.local.set({
          ql_license_valid: false,
          ql_license_key: licenseKey,
          ql_session_id: null,
          ql_user_name: null,
          ql_expires_at: null,
          ql_license_status: result.reason || "invalid",
        });
        schedulePersist();
        return result;
      }
      state.license = {
        key: licenseKey,
        valid: true,
        sessionId: result.session_id || state.license.sessionId,
        userName: result.user_name || null,
        expiresAt: result.expires_at || null,
        status: result.status || "active",
        onlineCount: result.online_count || 0,
      };
      await chrome.storage.local.set({
        ql_license_valid: true,
        ql_license_key: licenseKey,
        ql_session_id: state.license.sessionId,
        ql_user_name: state.license.userName,
        ql_expires_at: state.license.expiresAt,
        ql_license_status: state.license.status,
      });
      schedulePersist();
      return result;
    }

     async function executeBurpRequest(payload) {
       if (!payload.url) throw new Error("URL obrigatória");
       if (!state.license.valid || !state.license.key) {
         throw new Error("Licença não validada.");
       }
       const requestHeaders = normalizeHeaders(payload.headers || {});

       // Configurable timeout to avoid hanging the sidepanel on stalled targets.
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), REPLAY_TIMEOUT_MS);
       let response;
       try {
         response = await fetch(BURP_ENDPOINT, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "apikey": SUPABASE_ANON_KEY,
             "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
             "x-license-key": state.license.key,
           },
           body: JSON.stringify({
             url: payload.url,
             method: payload.method || "GET",
             headers: requestHeaders,
             body: payload.body ?? null,
             device_id: state.deviceId,
             auth: {
               bearerToken: state.auth.bearerToken,
               cookies: state.auth.cookies,
               projectId: state.auth.projectId,
               workspaceId: state.auth.workspaceId,
             },
           }),
           signal: controller.signal,
         });
       } catch (err) {
         if (err && err.name === "AbortError") {
           throw new Error(`Timeout: requisição excedeu ${REPLAY_TIMEOUT_MS / 1000}s.`);
         }
         throw err;
       } finally {
         clearTimeout(timeoutId);
       }
       const result = await response.json().catch(() => ({}));
       if (!response.ok) {
         throw new Error(result?.error || `Falha HTTP ${response.status}`);
       }
 
       const entry = {
         id: result.requestId || crypto.randomUUID(),
         url: payload.url,
         method: payload.method || "GET",
         kind: inferKind(payload.url, requestHeaders, payload.body),
         source: "replay",
         status: result.status || 0,
         statusText: result.ok ? "OK" : "ERROR",
         requestHeaders: sanitizeHeaders(requestHeaders),
         requestBody: truncateText(payload.body),
         responseHeaders: sanitizeHeaders(result.headers || {}),
         responseBody: truncateText(result.body || ""),
         responseJson: result.json || parseJsonSafely(result.body),
         timingMs: result.timingMs || 0,
         responseSize: result.responseSize || getSize(result.body || ""),
         startedAt: new Date().toISOString(),
         auth: {
           hasBearerToken: Boolean(state.auth.bearerToken),
           tokenPreview: maskValue(state.auth.bearerToken),
           cookiesPreview: maskValue(state.auth.cookies),
           projectId: state.auth.projectId,
           workspaceId: state.auth.workspaceId,
         },
       };
       storeNetworkEntry(entry);
       return entry;
     }

    async function bootstrap() {
      await restoreState();
      await ensureDeviceId();
      state.diagnostics.serviceWorker = { status: "ready", detail: "Service worker ativo" };
      schedulePersist();
      broadcast({ type: "BURP_STATE_READY", payload: getPublicState() });
    }

    chrome.runtime.onInstalled.addListener(() => {
      log("info", "startup", "Burp Lovable instalado/inicializado.");
    });

    chrome.runtime.onStartup.addListener(() => {
      log("info", "startup", "Burp Lovable reiniciado pelo navegador.");
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        switch (message?.type) {
          case "BURP_GET_STATE": {
            sendResponse({ ok: true, state: getPublicState() });
            return;
          }
          case "BURP_SET_DEBUG": {
            state.debug = Boolean(message.payload?.enabled);
            schedulePersist();
            log("info", "ui", `Debug mode ${state.debug ? "ativado" : "desativado"}.`);
            sendResponse({ ok: true, state: getPublicState() });
            return;
          }
          case "BURP_HOOK_READY": {
            state.diagnostics.contentScript = { status: "ready", detail: sender?.tab?.url || "Content script ativo" };
            state.diagnostics.pageHook = { status: "ready", detail: message.payload?.href || "Hook injetado" };
            schedulePersist();
            sendResponse({ ok: true });
            return;
          }
          case "BURP_CAPTURE_AUTH": {
            upsertAuth(message.payload || {});
            sendResponse({ ok: true });
            return;
          }
          case "BURP_SET_CAPTURE": {
            state.isCapturing = Boolean(message.payload?.enabled);
            schedulePersist();
            sendResponse({ ok: true, isCapturing: state.isCapturing });
            return;
          }
           case "BURP_NETWORK_EVENT": {
             if (!state.isCapturing) {
               sendResponse({ ok: true, dropped: true });
               return;
             }
             state.diagnostics.contentScript = { status: "ready", detail: sender?.tab?.url || "Tráfego capturado" };
            const payload = message.payload || {};
            const entry = {
              id: payload.id || crypto.randomUUID(),
              url: payload.url || "",
              method: payload.method || "GET",
              kind: payload.kind || inferKind(payload.url || "", payload.requestHeaders || {}, payload.requestBody),
              source: payload.source || "page",
              status: payload.status || 0,
              statusText: payload.statusText || (payload.error ? "FAILED" : "PENDING"),
              requestHeaders: sanitizeHeaders(payload.requestHeaders || {}),
              requestBody: truncateText(payload.requestBody),
              responseHeaders: sanitizeHeaders(payload.responseHeaders || {}),
              responseBody: truncateText(payload.responseBody),
              responseJson: payload.responseJson || parseJsonSafely(payload.responseBody),
              timingMs: payload.timingMs || 0,
              responseSize: payload.responseSize || getSize(payload.responseBody || ""),
              startedAt: payload.startedAt || new Date().toISOString(),
              auth: {
                hasBearerToken: Boolean(state.auth.bearerToken),
                tokenPreview: maskValue(state.auth.bearerToken),
                cookiesPreview: maskValue(state.auth.cookies),
                projectId: state.auth.projectId,
                workspaceId: state.auth.workspaceId,
              },
              error: payload.error || null,
            };
            storeNetworkEntry(entry);
            sendResponse({ ok: true });
            return;
          }
          case "BURP_VALIDATE_LICENSE": {
            try {
              const result = await validateLicense(message.payload?.licenseKey, false);
              if (!result.valid) {
                sendResponse({ ok: false, error: result.message || "Licença inválida", state: getPublicState() });
                return;
              }
              log("info", "auth", "Licença validada com sucesso.", { user: result.user_name || null });
              sendResponse({ ok: true, result, state: getPublicState() });
            } catch (error) {
              log("error", "auth", "Falha ao validar licença.", { message: error.message });
              sendResponse({ ok: false, error: error.message, state: getPublicState() });
            }
            return;
          }
          case "BURP_HEARTBEAT": {
            try {
              if (!state.license.key) {
                sendResponse({ ok: false, error: "Sem licença ativa" });
                return;
              }
              const result = await validateLicense(state.license.key, true);
              sendResponse({ ok: true, result, state: getPublicState() });
            } catch (error) {
              sendResponse({ ok: false, error: error.message, state: getPublicState() });
            }
            return;
          }
          case "BURP_EXECUTE_REQUEST": {
            try {
              if (!state.license.valid) {
                throw new Error("Valide a licença antes de enviar requests.");
              }
              const result = await executeBurpRequest(message.payload || {});
              log("info", "replay", `Request replay executada: ${result.method} ${result.url}`);
              sendResponse({ ok: true, result, state: getPublicState() });
            } catch (error) {
              log("error", "replay", "Falha ao executar request replay.", { message: error.message });
              sendResponse({ ok: false, error: error.message, state: getPublicState() });
            }
            return;
          }
          case "BURP_CLEAR_NETWORK": {
            state.network = [];
            schedulePersist();
            sendResponse({ ok: true, state: getPublicState() });
            return;
          }
          default: {
            sendResponse({ ok: false, error: "Mensagem desconhecida" });
          }
        }
      })();
      return true;
    });

    bootstrap().catch((error) => {
      state.diagnostics.serviceWorker = { status: "error", detail: error.message };
      log("error", "startup", "Falha fatal ao iniciar o service worker.", { message: error.message });
    });
