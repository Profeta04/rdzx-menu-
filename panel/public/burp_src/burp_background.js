// =============================================================================
//  Hyper RB — Background Service Worker (MV3)
//  Fixes: SW keepalive alarm, classifyBatch creds, BURP_HEALTHCHECK,
//         BURP_GET_REQUEST, BURP_CLEAR_AUTH, auto-refresh on TTL,
//         O(1) dedup via Map, multi-project tracking, port-broadcast.
// =============================================================================
// AF-E-C-04: SUPABASE_URL é replicada em burp_sidepanel.js:14 — mantenha em
// sincronia. SW e sidepanel rodam em contextos isolados (importScripts vs
// classic <script>) e não podem compartilhar módulo ES sem refactor maior.
const SUPABASE_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmdyamF1cWphd3JzeWtuaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk1OTYsImV4cCI6MjA5MTIzNTU5Nn0.JdZeY39iGHcZ5P3p0DDXYVUvNJfMrKp_OraUC5EDyzU";

// Composer Sequence Mode — chains helpers
try { importScripts("burp_chains.js"); } catch (e) { console.error("[Hyper RB] Falha ao carregar burp_chains.js", e); }
// AI client (Fase 2)
try { importScripts("burp_ai_client.js"); } catch (e) { console.error("[Hyper RB] Falha ao carregar burp_ai_client.js", e); }

const BURP_ENDPOINT = `${SUPABASE_URL}/functions/v1/burp`;
const MAX_NETWORK_ENTRIES = 10000;
const MAX_WS_FRAMES_PER_CONN = 500;
const MAX_BODY_CHARS = 25000;
const MAX_STARTUP_LOGS = 120;
const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie", "x-api-key", "apikey", "proxy-authorization"];
const DENOISE_PATTERNS = [
  /\/auth\/v1\/token\?grant_type=refresh_token/i,
  /\/realtime\/v1\/websocket/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /sentry\.io/i,
  /\.posthog\.com/i,
];
// Dedup: URL+method → last timestamp (O(1) lookup, capped at 2000 entries)
const DEDUP_MAP = new Map();
const DEDUP_WINDOW_MS = 500;
const DEDUP_MAP_MAX = 2000;
const AUTH_TTL_MS = 30 * 60 * 1000; // 30 min

// -----------------------------------------------------------------
// MV3 keepalive: chrome.alarms fires every 25s, preventing the SW
// from being killed mid-operation. Alarm is recreated on each start.
// -----------------------------------------------------------------
const KEEPALIVE_ALARM = "burp_keepalive";
const KEEPALIVE_PERIOD_MIN = 0.4; // ~24s

function setupKeepaliveAlarm() {
  try {
    chrome.alarms.get(KEEPALIVE_ALARM, (existing) => {
      if (!existing) {
        chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MIN });
      }
    });
  } catch (e) {
    console.warn("[Hyper RB] keepalive alarm setup failed:", e);
  }
}

try {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEPALIVE_ALARM) {
      // Pinging storage keeps the SW alive and also handles periodic auth TTL check
      chrome.storage.local.get(["burp_device_id"], () => {
        void chrome.runtime?.lastError;
        checkAuthTtlAndRefresh();
        scheduleWsFramesPersist(); // Fix (a): periodic sync of hyper_rb_ws_frames
      });
    }
  });
} catch {}

// -----------------------------------------------------------------
// Connected ports (sidepanel/popup). Broadcast via ports is more
// reliable than runtime.sendMessage when sidepanel is open.
// -----------------------------------------------------------------
const connectedPorts = new Set();
try {
  chrome.runtime.onConnect.addListener((port) => {
    connectedPorts.add(port);
    port.onDisconnect.addListener(() => connectedPorts.delete(port));
  });
} catch {}

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
  // Multi-project tracking: projectId → { token, workspaceId, lastSeen }
  projects: {},
  license: {
    key: null,
    valid: false,
    sessionId: null,
    userName: null,
    expiresAt: null,
    status: null,
    onlineCount: 0,
  },
  hbLicense: null,
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

// -----------------------------------------------------------------
// Findings capture (Lovable Security tab — health_check findings)
// Populated by extractFindingsFromEntry() on every network event.
// Persisted to chrome.storage.local under "burp_finding_ids".
// Exposed via getPublicState().findings and BURP_GET_CREDENTIALS.
// -----------------------------------------------------------------
state.findings = {
  // Map<finding_id, { id, title, severity, projectId, source: "list"|"fix", capturedAt }>
  byId: {},
  // Last id used in a "Try to fix" POST (becomes {{FINDING_ID}} in presets).
  lastUsedId: null,
  lastUpdated: null,
};
const MAX_FINDINGS = 200;

// -----------------------------------------------------------------
// WS Interceptor (v4.4.5): rules + paused frames + inject results.
// Rules persistem em chrome.storage.local key `burp_ws_rules`.
// Pauses são in-memory only (TTL 30s no pageHook).
// -----------------------------------------------------------------
const MAX_WS_PAUSES = 50;
const MAX_WS_INJECT_LOG = 100;
state.wsInterceptor = {
  rules: [],                       // [{ id, direction, urlRegex?, payloadRegex?, mode, rewritePath?, rewriteTo?, label?, enabled? }]
  pauses: [],                      // [{ pauseId, connId, direction, url, payload, ruleId, ts, tabId }]
  injectLog: [],                   // [{ ts, connId, direction, ok, error? }]
};

async function persistWsRules() {
  try { await chrome.storage.local.set({ burp_ws_rules: state.wsInterceptor.rules }); } catch {}
}

function broadcastWsState() {
  broadcast({ type: "BURP_WS_STATE_UPDATED", payload: getWsPublicState() });
}

function getWsPublicState() {
  return {
    rules: state.wsInterceptor.rules.slice(),
    pauses: state.wsInterceptor.pauses.slice(0, MAX_WS_PAUSES),
    injectLog: state.wsInterceptor.injectLog.slice(0, MAX_WS_INJECT_LOG),
    connections: (Array.isArray(state.network) ? state.network : [])
      .filter((n) => n && n.kind === "ws")
      .slice(0, 50)
      .map((n) => ({
        id: n.id,
        url: n.url,
        statusText: n.statusText,
        frameCount: (n.wsFrames || []).length,
        frames: Array.isArray(n.wsFrames) ? n.wsFrames.slice(-25) : [],
      })),
  };
}

async function pushWsRulesToAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
    for (const t of tabs) {
      if (!t.id) continue;
      chrome.tabs.sendMessage(t.id, {
        type: "BURP_WS_RULES_UPDATE",
        payload: { rules: state.wsInterceptor.rules.filter((r) => r.enabled !== false) },
      }, () => void chrome.runtime?.lastError);
    }
  } catch (e) {
    console.warn("[Hyper RB] pushWsRulesToAllTabs falhou:", e);
  }
}

function extractFindingsFromEntry(entry) {
  if (!entry) return false;
  let changed = false;
  const url = String(entry.url || "");
  const projectId =
    (url.match(/\/projects\/([0-9a-fA-F-]{36})/) || [])[1] ||
    state.auth.projectId ||
    null;

  // 1) Active capture: POST body containing finding metadata.
  //    Real Lovable shapes observed:
  //      a) message_intent_metadata.health_check_finding_fix_metadata.finding_ids = [<uuid>, ...]
  //         (intent: HEALTH_CHECK_FINDING_FIX, source: "health_check_brief")
  //      b) legacy: message_intent_metadata.finding_fix_metadata.health_check_finding_id = <uuid>
  try {
    const reqText = entry.requestBody == null ? "" : String(entry.requestBody);
    if (
      reqText &&
      (reqText.indexOf("finding_fix_metadata") !== -1 ||
        reqText.indexOf("finding_ids") !== -1 ||
        reqText.indexOf("findingId") !== -1)
    ) {
      let parsed = null;
      try { parsed = JSON.parse(reqText); } catch {}
      const mim = parsed?.message_intent_metadata || parsed?.messageIntentMetadata || parsed || {};
      const metaFix =
        mim?.health_check_finding_fix_metadata ||
        mim?.healthCheckFindingFixMetadata ||
        mim?.finding_fix_metadata ||
        mim?.findingFixMetadata ||
        null;
      const ids = [];
      if (metaFix) {
        if (Array.isArray(metaFix.finding_ids)) ids.push(...metaFix.finding_ids);
        if (Array.isArray(metaFix.findingIds)) ids.push(...metaFix.findingIds);
        if (typeof metaFix.health_check_finding_id === "string") ids.push(metaFix.health_check_finding_id);
        if (typeof metaFix.healthCheckFindingId === "string") ids.push(metaFix.healthCheckFindingId);
        if (typeof metaFix.findingId === "string") ids.push(metaFix.findingId);
      }
      const title = metaFix?.title || null;
      const severity = metaFix?.severity || null;
      const summary = metaFix?.summary || null;
      for (const fid of ids) {
        if (!fid || typeof fid !== "string") continue;
        state.findings.byId[fid] = {
          id: fid,
          title: title || state.findings.byId[fid]?.title || null,
          severity: severity || state.findings.byId[fid]?.severity || null,
          summary: summary || state.findings.byId[fid]?.summary || null,
          projectId,
          source: "fix",
          capturedAt: new Date().toISOString(),
        };
        state.findings.lastUsedId = fid;
        changed = true;
      }
    }
  } catch {}

  // 2) Passive capture: response JSON containing findings list.
  try {
    const looksLikeFindingsUrl = /(health[-_]?check|findings|security)/i.test(url);
    const json = entry.responseJson;
    if (looksLikeFindingsUrl && json) {
      const candidates = Array.isArray(json)
        ? json
        : Array.isArray(json.findings)
          ? json.findings
          : Array.isArray(json.items)
            ? json.items
            : Array.isArray(json.data)
              ? json.data
              : [];
      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;
        const fid =
          item.findingId ||
          item.finding_id ||
          item.health_check_finding_id ||
          item.healthCheckFindingId ||
          item.id;
        if (!fid || typeof fid !== "string") continue;
        // accept anything that looks like a uuid
        if (!/^[0-9a-f-]{8,}$/i.test(fid)) continue;
        const prev = state.findings.byId[fid] || {};
        state.findings.byId[fid] = {
          id: fid,
          title: item.title || item.name || prev.title || null,
          severity: item.severity || item.level || prev.severity || null,
          summary: item.summary || item.description || prev.summary || null,
          projectId: item.project_id || projectId || prev.projectId || null,
          source: prev.source === "fix" ? "fix" : "list",
          capturedAt: prev.capturedAt || new Date().toISOString(),
        };
        changed = true;
      }
    }
  } catch {}

  if (changed) {
    // Cap size — drop oldest entries.
    const ids = Object.keys(state.findings.byId);
    if (ids.length > MAX_FINDINGS) {
      const sorted = ids
        .map((id) => [id, state.findings.byId[id].capturedAt || ""])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
      const drop = sorted.slice(0, ids.length - MAX_FINDINGS);
      for (const [id] of drop) delete state.findings.byId[id];
    }
    state.findings.lastUpdated = new Date().toISOString();
  }
  return changed;
}

let persistTimer = null;

// -----------------------------------------------------------------
// WS frames persistence: flattens wsFrames from all WS network
// entries into the flat array expected by ws-correlator's loadWsFrames()
// ( chrome.storage.local key: "hyper_rb_ws_frames" )
// -----------------------------------------------------------------
let wsFramesPersistTimer = null;
const MAX_WS_FRAMES_STORAGE = 2000; // cap to prevent quota issues

function scheduleWsFramesPersist() {
  if (wsFramesPersistTimer) clearTimeout(wsFramesPersistTimer);
  wsFramesPersistTimer = setTimeout(() => {
    const frames = [];
    for (const entry of state.network) {
      if (!Array.isArray(entry.wsFrames)) continue;
      for (const f of entry.wsFrames) {
        frames.push({
          ts: f.timestamp ? Date.parse(f.timestamp) : Date.now(),
          dir: f.direction === "send" ? "out" : "in",
          payload: f.payload || "",
          connId: entry.id,
          url: entry.url || "",
        });
      }
    }
    frames.sort((a, b) => a.ts - b.ts);
    const capped = frames.slice(-MAX_WS_FRAMES_STORAGE);
    try {
      chrome.storage.local.set({ hyper_rb_ws_frames: capped }, () => {
        if (chrome.runtime.lastError) {
          console.warn("[Hyper RB] hyper_rb_ws_frames persist falhou:", chrome.runtime.lastError.message);
        }
      });
    } catch (e) {
      console.warn("[Hyper RB] hyper_rb_ws_frames persist excepção:", e);
    }
  }, 400);
}


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
  console[consoleMethod](`[Hyper RB][${module}] ${message}`, meta || "");
  schedulePersist();
  broadcast({ type: "BURP_LOG_UPDATED", payload: getPublicState() });
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    // SECURITY: never persist bearerToken/cookies (unencrypted storage)
    const safeAuth = state.auth ? {
      projectId: state.auth.projectId || null,
      workspaceId: state.auth.workspaceId || null,
      source: state.auth.source || null,
      lastUpdated: state.auth.lastUpdated || null,
    } : null;
    // Safe projects (no tokens)
    const safeProjects = {};
    for (const [pid, pdata] of Object.entries(state.projects || {})) {
      safeProjects[pid] = { workspaceId: pdata.workspaceId || null, lastSeen: pdata.lastSeen || null };
    }
    const persistPayload = {
      burp_background_state: {
        bootedAt: state.bootedAt,
        deviceId: state.deviceId,
        debug: state.debug,
        auth: safeAuth,
        projects: safeProjects,
        license: state.license,
        diagnostics: state.diagnostics,
        startupLogs: state.startupLogs,
        network: state.network,
      }
    };
    try {
      chrome.storage.local.set(persistPayload, () => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || "";
          if (/QUOTA_BYTES|quota/i.test(msg)) {
            console.warn("[Hyper RB] persist: quota excedida — retentando sem network buffer.", msg);
            const slim = { ...persistPayload.burp_background_state, network: [] };
            try {
              chrome.storage.local.set({ burp_background_state: slim }, () => {
                if (chrome.runtime.lastError) {
                  console.warn("[Hyper RB] persist (fallback slim) falhou:", chrome.runtime.lastError.message);
                }
              });
            } catch (e2) {
              console.warn("[Hyper RB] persist (fallback slim) excepção:", e2);
            }
          } else {
            console.warn("[Hyper RB] persist falhou:", msg);
          }
        }
      });
    } catch (e) {
      console.warn("[Hyper RB] persist excepção:", e);
    }
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
  return text.length > limit ? `${text.slice(0, limit)}\n/* truncated */` : text;
}

function parseJsonSafely(value) {
  if (!value || typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
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
    sanitized[key] = SENSITIVE_HEADERS.some((h) => normalized.includes(h)) ? maskValue(value) : String(value);
  }
  return sanitized;
}

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function inferKind(url, headers, body) {
  const headerMap = normalizeHeaders(headers);
  const contentType = String(headerMap["content-type"] || headerMap["Content-Type"] || "").toLowerCase();
  const bodyText = typeof body === "string" ? body : JSON.stringify(body || "");
  if (contentType.includes("graphql") || /(query|mutation)/.test(bodyText)) return "graphql";
  if (contentType.includes("json") || contentType.includes("javascript") || bodyText.startsWith("{")) return "fetch";
  return "xhr";
}

function getStats() {
  return {
    entryCount: state.network.length,
    authCaptured: Boolean(state.auth.bearerToken),
    lastCaptureAt: state.auth.lastUpdated,
    licenseValid: Boolean(state.license.valid),
    projectCount: Object.keys(state.projects || {}).length,
  };
}

function stripBody(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const { requestBody, responseBody, ...meta } = entry;
  return meta;
}

function getPublicState() {
  const networkForUi = Array.isArray(state.network)
    ? state.network.slice(0, 500).map(stripBody)
    : [];
  return {
    bootedAt: state.bootedAt,
    debug: state.debug,
    diagnostics: state.diagnostics,
    startupLogs: state.startupLogs,
    network: networkForUi,
    stats: getStats(),
    projects: Object.fromEntries(
      Object.entries(state.projects || {}).map(([pid, p]) => [
        pid,
        { workspaceId: p.workspaceId, lastSeen: p.lastSeen, hasToken: Boolean(p.token) },
      ])
    ),
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
    hbLicense: {
      hasKey: Boolean(state.hbLicense),
      preview: maskValue(state.hbLicense),
    },
    findings: {
      count: Object.keys(state.findings?.byId || {}).length,
      lastUsedId: state.findings?.lastUsedId || null,
      lastUpdated: state.findings?.lastUpdated || null,
      items: Object.values(state.findings?.byId || {})
        .slice()
        .sort((a, b) => String(b.capturedAt || "").localeCompare(String(a.capturedAt || "")))
        .slice(0, 50),
    },
  };
}

/**
 * broadcast: sends to all connected ports first (reliable sidepanel comms),
 * then falls back to runtime.sendMessage for popup/standalone callers.
 */
function broadcast(message) {
  // Port-based broadcast (sidepanel keepalive connection)
  for (const port of connectedPorts) {
    try { port.postMessage(message); } catch {}
  }
  // Also send via sendMessage for one-shot callers
  try {
    chrome.runtime.sendMessage(message, () => void chrome.runtime?.lastError);
  } catch {}
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
  const data = await chrome.storage.local.get([
    "burp_background_state", "ql_license_key", "ql_license_valid",
    "ql_session_id", "ql_user_name", "ql_expires_at", "ql_license_status",
    "qlrb_hb_license", "burp_ws_rules",
  ]);
  if (data.burp_background_state) {
    const saved = data.burp_background_state;
    state.debug = Boolean(saved.debug);
    state.auth = { ...state.auth, ...(saved.auth || {}) };
    state.license = { ...state.license, ...(saved.license || {}) };
    state.diagnostics = { ...state.diagnostics, ...(saved.diagnostics || {}) };
    delete state.diagnostics.sidePanel;
    state.startupLogs = Array.isArray(saved.startupLogs) ? saved.startupLogs.slice(0, MAX_STARTUP_LOGS) : [];
    state.network = Array.isArray(saved.network) ? saved.network.slice(0, MAX_NETWORK_ENTRIES) : [];
    // Restore safe project metadata (no tokens)
    if (saved.projects && typeof saved.projects === "object") {
      for (const [pid, pdata] of Object.entries(saved.projects)) {
        state.projects[pid] = { workspaceId: pdata.workspaceId || null, lastSeen: pdata.lastSeen || null, token: null };
      }
    }
    // Rebuild dedup map from restored network
    for (const e of state.network) {
      const dk = `${e.method}::${e.url}`;
      DEDUP_MAP.set(dk, Date.parse(e.startedAt) || 0);
    }
  }
  if (data.ql_license_key) {
    state.license.key = data.ql_license_key;
    state.license.valid = Boolean(data.ql_license_valid);
    state.license.sessionId = data.ql_session_id || null;
    state.license.userName = data.ql_user_name || null;
    state.license.expiresAt = data.ql_expires_at || null;
    state.license.status = data.ql_license_status || null;
  }
  if (data.qlrb_hb_license) state.hbLicense = data.qlrb_hb_license;
  if (Array.isArray(data.burp_ws_rules)) {
    state.wsInterceptor.rules = data.burp_ws_rules.slice(0, 50);
  }
}

/**
 * upsertAuth: updates the active auth state and multi-project registry.
 * A null/undefined field never overwrites an existing value (preserves last-known).
 * Pass `force: true` in payload to explicitly clear a field.
 */
function upsertAuth(payload) {
  const nextAuth = {
    ...state.auth,
    bearerToken: payload.bearerToken != null ? payload.bearerToken : state.auth.bearerToken,
    projectId: payload.projectId != null ? payload.projectId : state.auth.projectId,
    workspaceId: payload.workspaceId != null ? payload.workspaceId : state.auth.workspaceId,
    cookies: payload.cookies != null ? payload.cookies : state.auth.cookies,
    source: payload.source || payload.origin || state.auth.source || "page",
    lastUpdated: new Date().toISOString(),
  };
  state.auth = nextAuth;

  // Multi-project: track per-project token when projectId is known
  if (nextAuth.projectId) {
    state.projects[nextAuth.projectId] = {
      workspaceId: nextAuth.workspaceId || (state.projects[nextAuth.projectId] || {}).workspaceId || null,
      token: nextAuth.bearerToken || (state.projects[nextAuth.projectId] || {}).token || null,
      lastSeen: new Date().toISOString(),
    };
  }

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

/**
 * checkAuthTtlAndRefresh: called periodically by the keepalive alarm.
 * If the token is expired, nulls it and asks all Lovable tabs to re-capture.
 */
function checkAuthTtlAndRefresh() {
  const lastUpdatedMs = state.auth.lastUpdated ? Date.parse(state.auth.lastUpdated) : 0;
  const expired = lastUpdatedMs && (Date.now() - lastUpdatedMs) > AUTH_TTL_MS;
  if (expired && state.auth.bearerToken) {
    state.auth.bearerToken = null;
    state.auth.cookies = null;
    state.diagnostics.auth = { status: "warning", detail: "Token expirado — aguardando recaptura" };
    broadcast({ type: "BURP_AUTH_UPDATED", payload: getPublicState() });
    // Ask all Lovable tabs to re-send their auth snapshot
    try {
      chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] }, (tabs) => {
        for (const tab of (tabs || [])) {
          try {
            chrome.tabs.sendMessage(tab.id, { type: "BURP_REQUEST_AUTH_REFRESH" }, () => void chrome.runtime?.lastError);
          } catch {}
        }
      });
    } catch {}
  }
}

function storeNetworkEntry(entry) {
  if (entry.source !== "replay") {
    if (DENOISE_PATTERNS.some((re) => re.test(entry.url || ""))) return;
    // O(1) dedup via Map
    const dk = `${entry.method}::${entry.url}`;
    const lastTs = DEDUP_MAP.get(dk) || 0;
    const nowTs = Date.parse(entry.startedAt) || Date.now();
    if (nowTs - lastTs < DEDUP_WINDOW_MS) return;
    DEDUP_MAP.set(dk, nowTs);
    // Prevent DEDUP_MAP from growing unbounded
    if (DEDUP_MAP.size > DEDUP_MAP_MAX) {
      const oldest = DEDUP_MAP.keys().next().value;
      DEDUP_MAP.delete(oldest);
    }
  }
  state.network.unshift(entry);
  state.network = state.network.slice(0, MAX_NETWORK_ENTRIES);
  // Findings scan (Lovable Security tab) — best-effort, never throws.
  try {
    if (extractFindingsFromEntry(entry)) {
      broadcast({ type: "BURP_FINDINGS_UPDATED", payload: getPublicState() });
    }
  } catch {}
  schedulePersist();
  broadcast({ type: "BURP_NETWORK_UPDATED", payload: getPublicState() });
}

/**
 * buildHar: HAR 1.2 export from captured history.
 */
function buildHar() {
  const manifest = chrome.runtime.getManifest();
  const headersToArr = (h) => Object.entries(h || {}).map(([name, value]) => ({ name, value: String(value) }));
  const entries = (state.network || []).slice().reverse().map((e) => {
    const startedAt = e.startedAt || new Date().toISOString();
    const requestBodyText = e.requestBody == null ? "" : (typeof e.requestBody === "string" ? e.requestBody : JSON.stringify(e.requestBody));
    const responseBodyText = e.responseBody == null ? "" : String(e.responseBody);
    const reqContentType = (e.requestHeaders && (e.requestHeaders["content-type"] || e.requestHeaders["Content-Type"])) || "application/octet-stream";
    const resContentType = (e.responseHeaders && (e.responseHeaders["content-type"] || e.responseHeaders["Content-Type"])) || "application/octet-stream";
    return {
      startedDateTime: startedAt,
      time: Number(e.timingMs || 0),
      request: {
        method: e.method || "GET",
        url: e.url || "",
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: headersToArr(e.requestHeaders),
        queryString: [],
        headersSize: -1,
        bodySize: requestBodyText.length,
        ...(requestBodyText ? { postData: { mimeType: String(reqContentType), text: requestBodyText } } : {}),
      },
      response: {
        status: Number(e.status || 0),
        statusText: e.statusText || "",
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: headersToArr(e.responseHeaders),
        content: {
          size: Number(e.responseSize || responseBodyText.length || 0),
          mimeType: String(resContentType),
          text: responseBodyText,
        },
        redirectURL: "",
        headersSize: -1,
        bodySize: responseBodyText.length,
      },
      cache: {},
      timings: { send: 0, wait: Number(e.timingMs || 0), receive: 0 },
      _hyperRb: { id: e.id, kind: e.kind, source: e.source, error: e.error || null },
    };
  });
  return {
    log: {
      version: "1.2",
      creator: { name: "Hyper RB", version: manifest.version || "0.0.0" },
      browser: { name: "Chrome", version: navigator.userAgent || "" },
      pages: [],
      entries,
    },
  };
}

async function executeBurpRequest(payload) {
  if (!payload.url) throw new Error("URL obrigatória");
  const licenseKey = state.license?.key || null;
  const requestHeaders = normalizeHeaders(payload.headers || {});
  const fetchHeaders = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (licenseKey) fetchHeaders["x-license-key"] = licenseKey;

  // Timeout: abort after 30s to prevent hung replays from blocking chains
  const _reqCtrl = new AbortController();
  const _reqTimer = setTimeout(() => _reqCtrl.abort("timeout"), 30_000);
  // Propagate optional external abort signal
  const _extSignal = (typeof payload._signal !== "undefined") ? payload._signal : null;
  const _onExtAbort = () => _reqCtrl.abort("external");
  if (_extSignal) _extSignal.addEventListener("abort", _onExtAbort, { once: true });

  let response;
  try {
    response = await fetch(BURP_ENDPOINT, {
      method: "POST",
      headers: fetchHeaders,
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
      signal: _reqCtrl.signal,
    });
  } catch (fetchErr) {
    clearTimeout(_reqTimer);
    if (_extSignal) _extSignal.removeEventListener("abort", _onExtAbort);
    if (_reqCtrl.signal.aborted) {
      const _reason = _reqCtrl.signal.reason;
      throw new Error(_reason === "timeout" ? "Timeout (30s) no replay da request." : "Request de replay cancelada externamente.");
    }
    throw fetchErr;
  } finally {
    clearTimeout(_reqTimer);
    if (_extSignal) _extSignal.removeEventListener("abort", _onExtAbort);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      result?.user_action ||
      result?.error_display ||
      result?.error ||
      `Falha HTTP ${response.status}`;
    throw new Error(msg);
  }

  if (result?.mappedError?.error_code === "AUTH_FAILED") {
    state.auth.bearerToken = null;
    log("warn", "auth", "Token Lovable invalidado pelo upstream (AUTH_FAILED).");
  }

  const entry = {
    id: result.requestId || crypto.randomUUID(),
    ts: Date.now(),
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
    mappedError: result.mappedError || null,
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

// -----------------------------------------------------------------
// Composer Sequence Mode — serial chain executor
// -----------------------------------------------------------------
async function executeBurpChain(chain, opts) {
  const Chains = self.HyperRBChains;
  if (!Chains) throw new Error("Módulo de chains não carregado.");
  const { valid, errors } = Chains.validateChain(chain);
  if (!valid) throw new Error(`Chain inválida: ${errors.join("; ")}`);

  const runId = (opts && opts.runId) || crypto.randomUUID();
  const startedAt = Date.now();
  const deadline = startedAt + Chains.HARD_LIMITS.GLOBAL_DEADLINE_MS;
  const stopOnError = chain.stopOnError !== false;

  const context = {
    vars: chain.vars ? { ...chain.vars } : {},
    ctx: {
      token: state.auth.bearerToken || "",
      projectId: state.auth.projectId || "",
      workspaceId: state.auth.workspaceId || "",
      licenseKey: state.license.key || "",
      deviceId: state.deviceId || "",
    },
  };

  const results = [];
  let totalBytes = 0;

  // Chain-level AbortController so callers (e.g. cancelAll) can abort all steps
  const _chainCtrl = new AbortController();
  const _chainAbortedByDeadline = () => _chainCtrl.abort("deadline");

  function emit(stage, stepIndex, payload) {
    broadcast({
      type: "BURP_CHAIN_PROGRESS",
      payload: { runId, stage, stepIndex, totalSteps: chain.steps.length, ...payload },
    });
  }

  emit("start", -1, { chainName: chain.name || "chain" });

  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    if (Date.now() > deadline || _chainCtrl.signal.aborted) {
      _chainCtrl.abort("deadline");
      emit("aborted", i, { reason: "Deadline global excedido (60s)." });
      break;
    }

    if (step.runIf) {
      const resolved = Chains.resolveTemplate(String(step.runIf), context, []);
      if (!resolved || resolved === "false" || resolved === "0") {
        const skipResult = { stepId: step.id, skipped: true, reason: "runIf=false" };
        results.push(skipResult);
        context[step.id] = { skipped: true };
        emit("step:skipped", i, { stepId: step.id });
        continue;
      }
    }

    const prepared = Chains.prepareStep(step, context);
    if (prepared.missing && prepared.missing.length) {
      const err = `Tokens não resolvidos: ${prepared.missing.join(", ")}`;
      const failResult = { stepId: step.id, ok: false, error: err };
      results.push(failResult);
      context[step.id] = { ok: false, error: err };
      emit("step:failed", i, { stepId: step.id, error: err });
      if (stopOnError) break;
      continue;
    }

    emit("step:start", i, { stepId: step.id, method: prepared.method, url: prepared.url });

    const stepT0 = Date.now();
    let attempt = 0;
    const maxAttempts = 1 + Math.max(0, Math.min(Chains.HARD_LIMITS.MAX_RETRY, Number(step.retry || 0)));
    let stepResult = null;
    let lastErr = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const replay = await executeBurpRequest({
          url: prepared.url,
          method: prepared.method,
          headers: prepared.headers,
          body: prepared.body,
          _signal: _chainCtrl.signal,
        });
        const extracted = Chains.extractFromResponse(step.extract, replay.responseJson);
        const ctxEntry = {
          status: replay.status,
          headers: replay.responseHeaders,
          body: replay.responseBody,
          json: replay.responseJson,
          extracted,
          ok: replay.status >= 200 && replay.status < 400,
        };
        context[step.id] = ctxEntry;
        totalBytes += Number(replay.responseSize || 0);
        stepResult = {
          stepId: step.id,
          attempt,
          ok: ctxEntry.ok,
          status: replay.status,
          timingMs: Date.now() - stepT0,
          requestId: replay.id,
          extracted,
          mappedError: replay.mappedError || null,
        };
        if (ctxEntry.ok) break;
        lastErr = `HTTP ${replay.status}`;
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt));
      } catch (err) {
        lastErr = err && err.message ? err.message : String(err);
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }

    if (!stepResult) {
      stepResult = { stepId: step.id, ok: false, attempt, timingMs: Date.now() - stepT0, error: lastErr || "Falha desconhecida" };
      context[step.id] = { ok: false, error: stepResult.error };
    }
    results.push(stepResult);
    emit(stepResult.ok ? "step:ok" : "step:failed", i, {
      stepId: step.id, status: stepResult.status, error: stepResult.error || null, ms: stepResult.timingMs,
    });

    if (totalBytes > Chains.HARD_LIMITS.MAX_TOTAL_BYTES) {
      emit("aborted", i, { reason: "Tamanho total da chain excedeu 5MB." });
      break;
    }
    if (!stepResult.ok && stopOnError) break;
  }

  const summary = {
    runId,
    chainName: chain.name || "chain",
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    stepCount: chain.steps.length,
    executed: results.length,
    okCount: results.filter((r) => r.ok).length,
    results,
  };
  emit("done", -1, { summary });
  return summary;
}

let __bootstrapPromise = null;
async function bootstrap() {
  // Re-entrancy guard (4.0.4): SW pode acordar 2x rápido (keepalive + msg)
  // e duplicar BURP_STATE_READY broadcasts antes do estado terminar de restaurar.
  if (__bootstrapPromise) return __bootstrapPromise;
  __bootstrapPromise = (async () => {
    await restoreState();
    await ensureDeviceId();
    setupKeepaliveAlarm();
    state.diagnostics.serviceWorker = { status: "ready", detail: `Service worker ativo (v${chrome.runtime.getManifest().version})` };
    schedulePersist();
    broadcast({ type: "BURP_STATE_READY", payload: getPublicState() });
    // Push restored WS rules to any already-open lovable.dev tab.
    pushWsRulesToAllTabs();
    log("info", "startup", `Hyper RB SW pronto. Network: ${state.network.length} entries, Projects: ${Object.keys(state.projects).length}`);
  })();
  return __bootstrapPromise;
}

// -----------------------------------------------------------------
// Lifecycle listeners
// -----------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  log("info", "startup", "Hyper RB instalado/atualizado.");
  setupKeepaliveAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  log("info", "startup", "Hyper RB reiniciado pelo navegador.");
  setupKeepaliveAlarm();
});

// -----------------------------------------------------------------
// Message handler
// -----------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {

      case "BURP_HEALTHCHECK": {
        sendResponse({
          ok: true,
          alive: true,
          bootedAt: state.bootedAt,
          version: chrome.runtime.getManifest().version,
          networkCount: state.network.length,
          hasToken: Boolean(state.auth.bearerToken),
          projectCount: Object.keys(state.projects).length,
          uptime: Math.round((Date.now() - Date.parse(state.bootedAt)) / 1000),
        });
        return;
      }

      case "BURP_GET_STATE": {
        // Fix (b): synchronous sendResponse inside async IIFE — safe because outer
        // listener returns `true` (line below), keeping the message channel open.
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
        // v4.4.1 FIX: a aba acabou de injetar o pageHook com wsRules=[].
        // Empurra imediatamente as regras ativas para esta aba específica,
        // senão o intercept fica silenciosamente desativado até o usuário
        // re-salvar as regras pelo sidepanel.
        try {
          const tabId = sender?.tab?.id;
          if (tabId != null && Array.isArray(state.wsInterceptor?.rules) && state.wsInterceptor.rules.length) {
            chrome.tabs.sendMessage(tabId, {
              type: "BURP_WS_RULES_UPDATE",
              payload: { rules: state.wsInterceptor.rules.filter((r) => r.enabled !== false) },
            }, () => void chrome.runtime?.lastError);
          }
        } catch {}
        sendResponse({ ok: true });
        return;
      }

      case "BURP_CAPTURE_AUTH": {
        // Security: only accept from this extension's content scripts
        if (!sender || sender.id !== chrome.runtime.id) {
          try { log("warn", "auth", "BURP_CAPTURE_AUTH bloqueado: sender inválido", { senderId: sender?.id }); } catch {}
          sendResponse({ ok: false, error: "forbidden" });
          return;
        }
        upsertAuth(message.payload || {});
        sendResponse({ ok: true });
        return;
      }

      case "BURP_CLEAR_AUTH": {
        if (!sender || sender.id !== chrome.runtime.id) {
          sendResponse({ ok: false, error: "forbidden" });
          return;
        }
        state.auth = { bearerToken: null, projectId: null, workspaceId: null, cookies: null, source: null, lastUpdated: null };
        state.diagnostics.auth = { status: "waiting", detail: "Auth limpa manualmente" };
        schedulePersist();
        broadcast({ type: "BURP_AUTH_UPDATED", payload: getPublicState() });
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
          ts: Date.parse(payload.startedAt || "") || Date.now(),
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

      case "BURP_VALIDATE_LICENSE":
      case "BURP_HEARTBEAT": {
        sendResponse({
          ok: true,
          result: {
            valid: true,
            skipped: true,
            reason: "hyper_rb_internal_tool",
            message: "Validação desativada (Hyper RB)",
          },
          state: getPublicState(),
        });
        return;
      }

      case "BURP_EXECUTE_REQUEST": {
        try {
          const result = await executeBurpRequest(message.payload || {});
          log("info", "replay", `Request replay: ${result.method} ${result.url}`);
          sendResponse({ ok: true, result, state: getPublicState() });
        } catch (error) {
          log("error", "replay", "Falha no replay.", { message: error.message });
          sendResponse({ ok: false, error: error.message, state: getPublicState() });
        }
        return;
      }

      case "BURP_EXECUTE_CHAIN": {
        try {
          const chain = message.payload?.chain;
          const summary = await executeBurpChain(chain, { runId: message.payload?.runId });
          log("info", "chain", `Chain: ${summary.chainName} (${summary.okCount}/${summary.executed} ok)`);
          sendResponse({ ok: true, summary, state: getPublicState() });
        } catch (error) {
          log("error", "chain", "Falha na chain.", { message: error.message });
          sendResponse({ ok: false, error: error.message, state: getPublicState() });
        }
        return;
      }

      case "BURP_GET_CHAIN_TEMPLATES": {
        try {
          const tpls = (self.HyperRBChains && self.HyperRBChains.BUILTIN_TEMPLATES) || [];
          sendResponse({ ok: true, templates: tpls });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_AI_EXPLAIN": {
        try {
          if (!self.HyperRBAI) { sendResponse({ ok: false, error: "AI client não carregado." }); return; }
          const entryId = message.payload?.entryId;
          // FIX Bug #1: also accept payload.entry / payload.request as fallback (same pattern as
          // BURP_AI_RECIPE / BURP_AI_MUTATE). composer-explain sends { request: req }, not { entryId }.
          let entry = entryId ? state.network.find((n) => n.id === entryId) : null;
          if (!entry) {
            const candidate = message.payload?.entry || message.payload?.request;
            if (candidate && typeof candidate === "object") entry = candidate;
          }
          if (!entry) { sendResponse({ ok: false, error: "Request não encontrada." }); return; }
          const res = await self.HyperRBAI.explainRequest({ entry, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
          if (res.ok) log("info", "ai", `Explicada (${entry.method} ${entry.url})${res.cached ? " [cache]" : ""}`);
          else log("warn", "ai", `Falha ao explicar: ${res.error}`);
          sendResponse(res);
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_AI_RECIPE": {
        try {
          if (!self.HyperRBAI) { sendResponse({ ok: false, error: "AI client não carregado." }); return; }
          const entryId = message.payload?.entryId;
          let entry = entryId ? state.network.find((n) => n.id === entryId) : null;
          if (!entry) {
            const candidate = message.payload?.entry || message.payload?.request;
            if (candidate && typeof candidate === "object") entry = candidate;
          }
          if (!entry) { sendResponse({ ok: false, error: "Request não encontrada." }); return; }
          const res = await self.HyperRBAI.suggestRecipe({ entry, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
          if (res.ok) log("info", "ai", `Recipe IA (${entry.method} ${entry.url})${res.cached ? " [cache]" : ""}`);
          else log("warn", "ai", `Falha recipe: ${res.error}`);
          sendResponse(res);
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_BUILD_CHAIN_FROM_ENTRIES": {
        try {
          const ids = Array.isArray(message.payload?.entryIds) ? message.payload.entryIds : [];
          if (!ids.length) { sendResponse({ ok: false, error: "Selecione ao menos 1 request." }); return; }
          if (ids.length > 10) { sendResponse({ ok: false, error: "Máximo 10 requests por chain." }); return; }
          const entries = ids.map((id) => state.network.find((n) => n.id === id)).filter(Boolean);
          if (entries.length !== ids.length) { sendResponse({ ok: false, error: "Algumas requests não foram encontradas." }); return; }
          const sanitizer = self.HyperRBAI?.sanitizeEntry;
          const chain = {
            name: `Chain importada (${entries.length} steps)`,
            vars: {},
            stopOnError: true,
            maxBudgetMs: 30000,
            steps: entries.map((e, idx) => {
              const s = sanitizer ? sanitizer(e) : e;
              const step = { id: `s${idx + 1}`, method: s.method, url: s.url, headers: s.requestHeaders || {} };
              if (s.requestBody != null && s.requestBody !== "") {
                step.bodySource = "json";
                step.body = s.requestBody;
              }
              return step;
            }),
          };
          sendResponse({ ok: true, chain });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_AI_ANALYZE": {
        try {
          if (!self.HyperRBAI?.analyzeTraffic) { sendResponse({ ok: false, error: "AI client não carregado." }); return; }
          const entries = Array.isArray(message.payload?.entries) && message.payload.entries.length
            ? message.payload.entries : state.network;
          const metrics = message.payload?.metrics || null;
          const res = await self.HyperRBAI.analyzeTraffic({ entries, metrics, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
          if (res.ok) log("info", "ai", `Analyzer: ${entries.length} entries`);
          else log("warn", "ai", `Analyzer falhou: ${res.error}`);
          sendResponse(res);
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_AI_MUTATE":
      case "BURP_AI_DIAGNOSE":
      case "BURP_AI_CLASSIFY": {
        try {
          if (!self.HyperRBAI) { sendResponse({ ok: false, error: "AI client não carregado." }); return; }
          // FIX: classifyBatch was missing supabaseUrl/supabaseAnonKey
          if (message.type === "BURP_AI_CLASSIFY" && Array.isArray(message.payload?.items) && message.payload.items.length) {
            const res = await self.HyperRBAI.classifyBatch({
              items: message.payload.items,
              supabaseUrl: SUPABASE_URL,
              supabaseAnonKey: SUPABASE_ANON_KEY,
            });
            log(res.ok ? "info" : "warn", "ai", `${message.type}: ${res.ok ? `batch(${message.payload.items.length})` : res.error}`);
            sendResponse(res);
            return;
          }
          const entryId = message.payload?.entryId;
          let entry = entryId ? state.network.find((n) => n.id === entryId) : null;
          if (!entry) {
            const candidate = message.payload?.entry || message.payload?.request;
            if (candidate && typeof candidate === "object") entry = candidate;
          }
          if (!entry) { sendResponse({ ok: false, error: "Request não encontrada." }); return; }
          const fn = message.type === "BURP_AI_MUTATE" ? self.HyperRBAI.suggestMutations
                   : message.type === "BURP_AI_DIAGNOSE" ? self.HyperRBAI.diagnoseFailedReplay
                   : self.HyperRBAI.classifyAction;
          const res = await fn({ entry, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
          log(res.ok ? "info" : "warn", "ai", `${message.type}: ${res.ok ? "ok" : res.error}`);
          sendResponse(res);
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_CLEAR_NETWORK": {
        state.network = [];
        DEDUP_MAP.clear();
        schedulePersist();
        sendResponse({ ok: true, state: getPublicState() });
        return;
      }

      case "BURP_EXPORT_HAR": {
        try {
          sendResponse({ ok: true, har: buildHar() });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_GET_CREDENTIALS": {
        if (!sender || sender.id !== chrome.runtime.id) {
          try { log("warn", "creds", "BURP_GET_CREDENTIALS bloqueado: sender inválido", { senderId: sender?.id }); } catch {}
          sendResponse({ ok: false, error: "forbidden" });
          return;
        }
        // TTL check: expired token gets nulled and triggers re-capture
        const lastUpdatedMs = state.auth.lastUpdated ? Date.parse(state.auth.lastUpdated) : 0;
        const tokenExpired = !lastUpdatedMs || (Date.now() - lastUpdatedMs) > AUTH_TTL_MS;
        if (tokenExpired && state.auth.bearerToken) {
          state.auth.bearerToken = null;
          state.auth.cookies = null;
          checkAuthTtlAndRefresh();
        }
        // Fallback: scan network for Authorization header
        let lovableToken = state.auth.bearerToken || null;
        let projectId = state.auth.projectId || null;
        let workspaceId = state.auth.workspaceId || null;
        if (!lovableToken || !projectId || !workspaceId) {
          try {
            const network = Array.isArray(state.network) ? state.network : [];
            for (let i = 0; i < network.length; i++) {
              const e = network[i];
              const host = (() => { try { return new URL(e.url || "").host; } catch { return ""; } })();
              if (!/(^|\.)lovable\.(dev|app)$/i.test(host)) continue;
              if (!lovableToken) {
                const hdrs = e.requestHeaders || {};
                for (const k of Object.keys(hdrs)) {
                  if (k.toLowerCase() !== "authorization") continue;
                  const v = String(hdrs[k] || "");
                  const m = v.match(/^Bearer\s+([A-Za-z0-9._-]{16,})$/i);
                  if (m) { lovableToken = m[1]; break; }
                }
              }
              if (!projectId) {
                const m = String(e.url || "").match(/\/projects\/([a-zA-Z0-9-]{8,})/);
                if (m) projectId = m[1];
              }
              if (!workspaceId) {
                const m = String(e.url || "").match(/\/workspaces\/([a-zA-Z0-9-]{8,})/);
                if (m) workspaceId = m[1];
              }
              if (lovableToken && projectId && workspaceId) break;
            }
          } catch (err) {
            log("warn", "creds", "Fallback scan falhou: " + (err?.message));
          }
        }
        // Also check multi-project registry for current project
        if (!lovableToken && projectId && state.projects[projectId]?.token) {
          lovableToken = state.projects[projectId].token;
        }
        sendResponse({
          ok: true,
          credentials: {
            license_key: state.license.key || null,
            device_id: state.deviceId || null,
            session_id: state.license.sessionId || null,
            lovable_token: lovableToken,
            project_id: projectId,
            workspace_id: workspaceId,
            hb_license: state.hbLicense || null,
            supabase_url: SUPABASE_URL,
            supabase_anon_key: SUPABASE_ANON_KEY,
            finding_id: state.findings?.lastUsedId
              || (Object.values(state.findings?.byId || {})[0]?.id)
              || null,
            finding_ids: (() => {
              const all = Object.values(state.findings?.byId || {})
                .map((f) => f && f.id)
                .filter((x) => typeof x === "string" && x.length > 0);
              return all.length ? all : (state.findings?.lastUsedId ? [state.findings.lastUsedId] : []);
            })(),
          },
        });
        return;
      }

      case "BURP_GET_REQUEST": {
        // Public (sanitized) entry lookup by id — for scripts that need full body
        // but not raw credentials. No sender restriction (sidepanel + scripts use this).
        try {
          const id = String(message.payload?.id || "");
          const entry = (state.network || []).find((e) => e.id === id);
          if (!entry) { sendResponse({ ok: false, error: "not_found" }); return; }
          // Strip out auth-level fields before returning
          const { auth: _a, ...safe } = entry;
          sendResponse({ ok: true, entry: safe });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }

      case "BURP_GET_RAW_REQUEST": {
        // Full entry with original headers — restricted to own extension
        if (!sender || sender.id !== chrome.runtime.id) {
          try { log("warn", "creds", "BURP_GET_RAW_REQUEST bloqueado: sender inválido", { senderId: sender?.id }); } catch {}
          sendResponse({ ok: false, error: "forbidden" });
          return;
        }
        try {
          const id = String(message.payload?.id || "");
          const entry = (state.network || []).find((e) => e.id === id);
          if (!entry) { sendResponse({ ok: false, error: "not_found" }); return; }
          sendResponse({
            ok: true,
            raw: {
              id: entry.id,
              url: entry.url,
              method: entry.method,
              requestHeaders: entry.requestHeaders || {},
              requestBody: entry.requestBody ?? null,
              responseHeaders: entry.responseHeaders || {},
              responseBody: entry.responseBody ?? null,
            },
          });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
        return;
      }


      case "BURP_GET_SCRIPT_NETWORK": {
        // Returns network entries WITH requestBody/responseBody (capped to 4 KB each) and
        // a numeric `ts` field so that _shared.sanitize() can pick it up correctly.
        // Used by the scripts tab to supply ctx.requests with real body data (Bug #2 fix).
        const SCRIPT_ENTRY_CAP = 200;
        const SCRIPT_BODY_CAP  = 4096;
        const capBody = (v) => {
          if (v == null) return null;
          const s = typeof v === "string" ? v : String(v);
          return s.length > SCRIPT_BODY_CAP ? s.slice(0, SCRIPT_BODY_CAP) + "…" : s;
        };
        const scriptEntries = (state.network || []).slice(0, SCRIPT_ENTRY_CAP).map((e) => {
          // eslint-disable-next-line no-unused-vars
          const { auth: _a, ...safe } = e;
          return {
            ...safe,
            requestBody:  capBody(e.requestBody),
            responseBody: capBody(e.responseBody),
            // Ensure numeric `ts` for _shared.sanitize() compatibility
            ts: e.ts || Date.parse(e.startedAt || "") || Date.now(),
          };
        });
        sendResponse({ ok: true, entries: scriptEntries });
        return;
      }

      case "BURP_SET_HB_LICENSE": {
        const value = String(message.payload?.license || "").trim();
        state.hbLicense = value || null;
        await chrome.storage.local.set({ qlrb_hb_license: state.hbLicense });
        schedulePersist();
        broadcast({ type: "BURP_AUTH_UPDATED", payload: getPublicState() });
        sendResponse({ ok: true, hbLicense: { hasKey: Boolean(state.hbLicense), preview: maskValue(state.hbLicense) } });
        return;
      }

      case "BURP_WS_FRAME": {
        if (!state.isCapturing) { sendResponse({ ok: true, dropped: true }); return; }
        const f = message.payload || {};
        let entry = state.network.find((n) => n.id === f.connId);
        if (!entry) {
          entry = {
            id: f.connId,
            url: f.url || "",
            method: "WS",
            kind: "ws",
            source: "websocket",
            status: 101,
            statusText: "Switching Protocols",
            requestHeaders: {},
            requestBody: null,
            responseHeaders: {},
            responseBody: "",
            wsFrames: [],
            startedAt: f.timestamp || new Date().toISOString(),
            timingMs: 0,
            responseSize: 0,
          };
          state.network.unshift(entry);
          // Cap to prevent unbounded growth (WS entries bypass storeNetworkEntry)
          if (state.network.length > MAX_NETWORK_ENTRIES) {
            state.network = state.network.slice(0, MAX_NETWORK_ENTRIES);
          }
        }
        entry.wsFrames = Array.isArray(entry.wsFrames) ? entry.wsFrames : [];
        if (entry.wsFrames.length < MAX_WS_FRAMES_PER_CONN) {
          entry.wsFrames.push({
            direction: f.direction,
            payload: f.payload,
            timestamp: f.timestamp,
            frameIndex: f.frameIndex,
            edited: Boolean(f.edited),
            dropped: Boolean(f.dropped),
            synthetic: Boolean(f.synthetic),
            ruleId: f.ruleId || null,
            rewritePath: f.rewritePath || null,
          });
        }
        if (f.direction === "close") {
          entry.statusText = "Closed";
          entry.timingMs = f.durationMs || entry.timingMs;
        }
        entry.responseSize = (entry.wsFrames || []).reduce((acc, x) => acc + (x.payload ? String(x.payload).length : 0), 0);
        schedulePersist();
        scheduleWsFramesPersist(); // Fix (a): keep hyper_rb_ws_frames in sync for ws-correlator
        broadcastWsState();
        broadcast({ type: "BURP_NETWORK_UPDATED", payload: getPublicState() });
        sendResponse({ ok: true });
        return;
      }

      case "BURP_GET_PROJECTS": {
        sendResponse({
          ok: true,
          projects: Object.fromEntries(
            Object.entries(state.projects).map(([pid, p]) => [
              pid,
              { workspaceId: p.workspaceId, lastSeen: p.lastSeen, hasToken: Boolean(p.token) },
            ])
          ),
        });
        return;
      }

      case "BURP_SWITCH_PROJECT": {
        const targetId = String(message.payload?.projectId || "");
        if (!targetId) { sendResponse({ ok: false, error: "projectId obrigatório" }); return; }
        const proj = state.projects[targetId];
        if (!proj) { sendResponse({ ok: false, error: "Projeto não encontrado" }); return; }
        state.auth.projectId = targetId;
        state.auth.workspaceId = proj.workspaceId || state.auth.workspaceId;
        if (proj.token) state.auth.bearerToken = proj.token;
        state.auth.lastUpdated = new Date().toISOString();
        schedulePersist();
        broadcast({ type: "BURP_AUTH_UPDATED", payload: getPublicState() });
        sendResponse({ ok: true, state: getPublicState() });
        return;
      }

      // ─── WS Interceptor (v4.4.5) ─────────────────────────────────
      case "BURP_WS_GET_STATE": {
        sendResponse({ ok: true, ws: getWsPublicState() });
        return;
      }

      case "BURP_WS_SET_RULES": {
        const incoming = Array.isArray(message.payload?.rules) ? message.payload.rules : [];
        // Sanitize: only accept known fields, cap regex length, cap count.
        const clean = incoming.slice(0, 50).map((r) => ({
          id: String(r.id || crypto.randomUUID()).slice(0, 64),
          label: String(r.label || "").slice(0, 80),
          direction: ["send", "recv", "any"].includes(r.direction) ? r.direction : "send",
          urlRegex: typeof r.urlRegex === "string" ? r.urlRegex.slice(0, 500) : "",
          payloadRegex: typeof r.payloadRegex === "string" ? r.payloadRegex.slice(0, 500) : "",
          mode: ["pause", "drop", "rewrite"].includes(r.mode) ? r.mode : "pause",
          rewritePath: typeof r.rewritePath === "string" ? r.rewritePath.slice(0, 200) : "",
          rewriteTo: typeof r.rewriteTo === "string" ? r.rewriteTo.slice(0, 25000) : "",
          enabled: r.enabled !== false,
        }));
        state.wsInterceptor.rules = clean;
        await persistWsRules();
        await pushWsRulesToAllTabs();
        broadcastWsState();
        sendResponse({ ok: true, ws: getWsPublicState() });
        return;
      }

      case "BURP_WS_PAUSED": {
        // From content script: a frame is on hold waiting for user decision.
        if (!sender || sender.id !== chrome.runtime.id) {
          sendResponse({ ok: false, error: "forbidden" });
          return;
        }
        const p = message.payload || {};
        if (!p.pauseId || !p.connId) { sendResponse({ ok: false, error: "invalid" }); return; }
        const entry = {
          pauseId: String(p.pauseId),
          connId: String(p.connId),
          direction: p.direction || "send",
          url: String(p.url || ""),
          payload: typeof p.payload === "string" ? p.payload.slice(0, 25000) : "",
          ruleId: p.ruleId || null,
          ts: Date.now(),
          tabId: sender.tab?.id || null,
        };
        state.wsInterceptor.pauses.unshift(entry);
        if (state.wsInterceptor.pauses.length > MAX_WS_PAUSES) {
          state.wsInterceptor.pauses.length = MAX_WS_PAUSES;
        }
        broadcastWsState();
        sendResponse({ ok: true });
        return;
      }

      case "BURP_WS_RESUME": {
        // From sidepanel: user decided what to do with a paused frame.
        const { pauseId, action, data } = message.payload || {};
        const idx = state.wsInterceptor.pauses.findIndex((p) => p.pauseId === pauseId);
        if (idx === -1) { sendResponse({ ok: false, error: "pause not found (already resumed or expired)" }); return; }
        const pause = state.wsInterceptor.pauses[idx];
        state.wsInterceptor.pauses.splice(idx, 1);
        if (pause.tabId != null) {
          chrome.tabs.sendMessage(pause.tabId, {
            type: "BURP_WS_RESUME",
            payload: { pauseId, action: action || "send", data: typeof data === "string" ? data : pause.payload },
          }, () => void chrome.runtime?.lastError);
        }
        broadcastWsState();
        sendResponse({ ok: true });
        return;
      }

      case "BURP_WS_INJECT": {
        // From sidepanel: forge a frame on an open connection.
        const { connId, direction, data, tabId } = message.payload || {};
        if (!connId) { sendResponse({ ok: false, error: "connId obrigatório" }); return; }
        if (!["send", "recv"].includes(direction)) { sendResponse({ ok: false, error: "direction inválida" }); return; }
        const payload = { connId, direction, data: typeof data === "string" ? data : String(data ?? "") };
        // Target: a specific tab if provided, otherwise broadcast to all lovable tabs.
        try {
          if (tabId) {
            chrome.tabs.sendMessage(tabId, { type: "BURP_WS_INJECT", payload }, () => void chrome.runtime?.lastError);
          } else {
            const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
            for (const t of tabs) {
              if (t.id) chrome.tabs.sendMessage(t.id, { type: "BURP_WS_INJECT", payload }, () => void chrome.runtime?.lastError);
            }
          }
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
          return;
        }
        sendResponse({ ok: true });
        return;
      }

      case "BURP_WS_INJECT_RESULT": {
        // From content script: result of an inject.
        if (!sender || sender.id !== chrome.runtime.id) { sendResponse({ ok: false }); return; }
        const p = message.payload || {};
        state.wsInterceptor.injectLog.unshift({
          ts: Date.now(),
          connId: String(p.connId || ""),
          ok: Boolean(p.ok),
          error: p.error || null,
        });
        if (state.wsInterceptor.injectLog.length > MAX_WS_INJECT_LOG) {
          state.wsInterceptor.injectLog.length = MAX_WS_INJECT_LOG;
        }
        broadcastWsState();
        sendResponse({ ok: true });
        return;
      }

      default: {
        sendResponse({ ok: false, error: "Mensagem desconhecida" });
      }
    }
  })();
  // Fix (b): MUST return `true` here — all cases (including async ones like
  // BURP_SET_HB_LICENSE, BURP_EXECUTE_REQUEST, etc.) send their response inside
  // the async IIFE above. `return true` tells Chrome to keep the channel open.
  return true;
});

// -----------------------------------------------------------------
// Action click → toggle floating panel or open standalone popup
// -----------------------------------------------------------------
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "BURP_TOGGLE_FLOATING" }, { frameId: 0 });
  } catch {
    try {
      await chrome.windows.create({
        url: chrome.runtime.getURL("burp_sidepanel.html"),
        type: "popup",
        width: 1100,
        height: 760,
      });
    } catch (err) {
      log("error", "ui", "Falha ao abrir popup standalone.", { message: err?.message });
    }
  }
});

// Security: wipe sensitive in-memory state before SW is suspended
try {
  chrome.runtime.onSuspend.addListener(() => {
    try {
      // Cancel pending persist timer (avoid ghost callbacks after SW is killed)
      if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
      // Same for ws-frames persist timer (4.0.4 fix C-1)
      if (wsFramesPersistTimer) { clearTimeout(wsFramesPersistTimer); wsFramesPersistTimer = null; }
      state.auth.bearerToken = null;
      state.auth.cookies = null;
      // Also wipe project tokens
      for (const p of Object.values(state.projects)) { p.token = null; }
    } catch {}
  });
} catch {}

bootstrap().catch((error) => {
  state.diagnostics.serviceWorker = { status: "error", detail: error.message };
  log("error", "startup", "Falha fatal ao iniciar o service worker.", { message: error.message });
});
