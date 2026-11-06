// ===== HyperBuild Captcha Guide Modal (auto-generated) =====
function qlShowCaptchaGuide(detail) {
  try {
    var existing = document.getElementById("ql-captcha-guide");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "ql-captcha-guide";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "background:rgba(0,0,0,0.65)",
      "backdrop-filter:blur(6px)",
      "-webkit-backdrop-filter:blur(6px)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "animation:qlFadeIn .2s ease-out",
    ].join(";");

    var modal = document.createElement("div");
    modal.style.cssText = [
      "max-width:480px",
      "width:92%",
      "background:rgba(18,18,20,0.92)",
      "border:1px solid var(--ql-primary-border)",
      "border-radius:14px",
      "padding:24px",
      "box-shadow:0 20px 60px var(--ql-primary-glow),0 8px 24px rgba(0,0,0,0.6)",
      "color:#f5f5f7",
      "backdrop-filter:blur(24px)",
      "-webkit-backdrop-filter:blur(24px)",
    ].join(";");

    var subtitle = detail && detail.user_action ? detail.user_action : "";

    modal.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
      '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--ql-primary),var(--purple));display:flex;align-items:center;justify-content:center;color:#fff;">' +
      SVG_ICONS.shield.replace('width="14"','width="20"').replace('height="14"','height="20"') +
      "</div>" +
      "<div>" +
      '<div style="font-size:16px;font-weight:700;color:#fff">Verificação de Segurança Necessária</div>' +
      '<div style="font-size:12px;color:#a8a8b3;margin-top:2px">A Lovable detectou tráfego incomum e pediu uma verificação humana</div>' +
      "</div>" +
      "</div>" +
      '<div style="background:var(--ql-primary-glow);border:1px solid var(--ql-primary-border);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#e8e8ec;line-height:1.5">' +
      '<strong style="color:var(--ql-primary)">Por que isso aconteceu?</strong><br>' +
      "O servidor da Lovable detectou muitas requisições em sequência da sua conta e está pedindo confirmação que você é humano. <strong>Não é um bug da extensão.</strong>" +
      "</div>" +
      '<div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:10px">Siga os passos abaixo para resolver:</div>' +
      '<ol style="margin:0 0 16px 0;padding-left:0;list-style:none;counter-reset:qlstep">' +
      '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
      '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:var(--ql-primary);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">1</span>' +
      'Abra <strong style="color:#fff">https://lovable.dev</strong> em uma nova aba do navegador.' +
      "</li>" +
      '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
      '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:var(--ql-primary);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">2</span>' +
      "Faça login com a mesma conta usada na extensão (se ainda não estiver logado)." +
      "</li>" +
      '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
      '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:var(--ql-primary);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">3</span>' +
      'Envie qualquer mensagem em um projeto. <strong style="color:#fff">Complete o captcha</strong> que aparecer (Cloudflare ou similar).' +
      "</li>" +
      '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
      '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:var(--ql-primary);color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">4</span>' +
      "Aguarde 30 segundos e tente enviar novamente pela extensão." +
      "</li>" +
      "</ol>" +
      '<div style="background:rgba(255,200,0,0.08);border:1px solid rgba(255,200,0,0.25);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#ffd966;line-height:1.45;display:flex;gap:8px;align-items:center">' +
      "<span>" +
      SVG_ICONS.alert +
      "</span>" +
      "<span><strong>Dica para evitar:</strong> Aguarde alguns segundos entre cada mensagem. Envios em rajada aumentam a chance do captcha aparecer.</span>" +
      "</div>" +
      '<div style="display:flex;gap:8px">' +
      '<button id="ql-captcha-open" style="flex:1;padding:11px 16px;border-radius:9px;border:none;background:linear-gradient(135deg,var(--ql-primary),var(--purple));color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:transform .15s">Abrir lovable.dev</button>' +
      '<button id="ql-captcha-close" style="padding:11px 16px;border-radius:9px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#e8e8ec;font-weight:500;font-size:13px;cursor:pointer">Entendi</button>' +
      "</div>";

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var openBtn = modal.querySelector("#ql-captcha-open");
    var closeBtn = modal.querySelector("#ql-captcha-close");
    if (openBtn)
      openBtn.onclick = function () {
        try {
          window.open("https://lovable.dev", "_blank", "noopener");
        } catch (_) {}
      };
    if (closeBtn)
      closeBtn.onclick = function () {
        overlay.remove();
      };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });
  } catch (e) {
    console.error("[HyperBuild] Falha ao exibir modal de captcha:", e);
  }
}
// ===== End Captcha Guide Modal =====

// ============================================
// HyperBuild – Business Logic (content)
// Templates HTML estão em content-templates.js
// ============================================

// Shim for chrome.storage when running outside an extension (e.g. preview)
if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
  window.chrome = window.chrome || {
    runtime: {
      id: "mock-extension-id",
      getURL: (path) => path,
      sendMessage: (msg, cb) => {
        console.log("Mock sendMessage:", msg);
        if (cb) setTimeout(() => cb({ status: "ok", ok: true, data: {} }), 0);
      },
      lastError: null,
    },
    storage: {
      local: {
        get: (keys, cb) => {
          const res = {};
          const getVal = (k) => {
            try {
              const val = localStorage.getItem(k);
              return val ? JSON.parse(val) : undefined;
            } catch (e) {
              return undefined;
            }
          };
          if (Array.isArray(keys)) {
            keys.forEach((k) => (res[k] = getVal(k)));
          } else if (typeof keys === "string") {
            res[keys] = getVal(keys);
          } else {
            for (let k in keys) {
              const val = getVal(k);
              res[k] = val !== undefined ? val : keys[k];
            }
          }
          if (cb) setTimeout(() => cb(res), 0);
          return Promise.resolve(res);
        },
        set: (items, cb) => {
          for (let k in items) localStorage.setItem(k, JSON.stringify(items[k]));
          if (cb) setTimeout(cb, 0);
          return Promise.resolve();
        },
        remove: (keys, cb) => {
          if (Array.isArray(keys)) keys.forEach((k) => localStorage.removeItem(k));
          else localStorage.removeItem(keys);
          if (cb) setTimeout(cb, 0);
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    tabs: {
      query: (queryInfo, callback) => {
        if (callback) setTimeout(() => callback([{ id: 1, active: true }]), 0);
        return Promise.resolve([{ id: 1, active: true }]);
      },
    },
    scripting: {
      executeScript: () => Promise.resolve([]),
    },
  };
}

console.log("[ContentScript] HyperBuild v7.0.8 iniciado");

const HB_ALLOWED_SEND_METHODS = ['auto', 'v1', 'v2', 'v3', 'v4', 'v5', 'master'];
window.__hbSelectedSendMethod = window.__hbSelectedSendMethod || 'auto';
function qlNormalizeMethod(id) {
  let normalized = id;
  let parseDepth = 0;
  while (parseDepth < 4) {
    if (typeof normalized === 'string') {
      const trimmed = normalized.trim();
      if (!trimmed) break;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed === normalized) break;
        normalized = parsed;
        parseDepth += 1;
        continue;
      } catch (_) {}
    }
    if (normalized && typeof normalized === 'object') {
      const candidate = normalized.method ?? normalized.id ?? normalized.value;
      if (candidate !== undefined && candidate !== normalized) {
        normalized = candidate;
        parseDepth += 1;
        continue;
      }
    }
    break;
  }
  if (typeof normalized !== 'string') return 'auto';
  const cleaned = normalized.trim().replace(/^"+|"+$/g, '');
  return HB_ALLOWED_SEND_METHODS.includes(cleaned.toLowerCase()) ? cleaned.toLowerCase() : 'auto';
}
function qlApplyMethod(id, options) {
  const persist = !options || options.persist !== false;
  window.__hbSelectedSendMethod = qlNormalizeMethod(id);
  try { localStorage.setItem('hb_send_method', window.__hbSelectedSendMethod); } catch (_) {}
  if (persist) {
    try { chrome.storage.local.set({ hb_send_method: window.__hbSelectedSendMethod }); } catch (_) {}
  }
  return window.__hbSelectedSendMethod;
}
function qlGetMethod() {
  try {
    const localMethod = qlNormalizeMethod(localStorage.getItem('hb_send_method'));
    window.__hbSelectedSendMethod = localMethod !== 'auto' ? localMethod : qlNormalizeMethod(window.__hbSelectedSendMethod);
  } catch (_) {}
  return qlNormalizeMethod(window.__hbSelectedSendMethod);
}
function qlSetMethod(id) { return qlApplyMethod(id); }
async function qlReadMethod() {
  const localMethod = qlGetMethod();
  try {
    const stored = await new Promise((resolve) => chrome.storage.local.get(['hb_send_method'], resolve));
    const remoteMethod = qlNormalizeMethod(stored && stored.hb_send_method);
    if (remoteMethod !== localMethod && (remoteMethod !== 'auto' || localMethod === 'auto')) {
      return qlApplyMethod(remoteMethod, { persist: false });
    }
  } catch (_) {}
  return qlGetMethod();
}
try {
  chrome.storage.local.get(['hb_send_method'], (res) => {
    if (res && typeof res.hb_send_method !== 'undefined') {
      const bootMethod = qlNormalizeMethod(res.hb_send_method);
      const currentMethod = qlGetMethod();
      if (bootMethod !== 'auto' || currentMethod === 'auto') {
        qlApplyMethod(bootMethod, { persist: false });
      }
    }
  });
  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.hb_send_method) return;
      qlApplyMethod(changes.hb_send_method.newValue, { persist: false });
      try {
        if (typeof initPopupMethodSelector === 'function') initPopupMethodSelector();
      } catch (_) {}
    });
  }
} catch (_) {}

const VALIDATE_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/vx";
const OPTIMIZE_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/op";
const NOTIFICATIONS_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/gn";
const PACKAGES_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/gp";
const EXT_PAYMENT_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/pp";
const PROXY_COMMAND_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/pc";
const CREATE_PROJECT_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/cp";
const DOWNLOAD_PROJECT_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/dz";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmdyamF1cWphd3JzeWtuaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk1OTYsImV4cCI6MjA5MTIzNTU5Nn0.JdZeY39iGHcZ5P3p0DDXYVUvNJfMrKp_OraUC5EDyzU";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function sanitizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
    return "";
  } catch (e) {
    return "";
  }
}

function decodeJwtPayload(token) {
  try {
    const raw = String(token || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (e) {
    return null;
  }
}

function bgFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      Object.assign({
        action: "proxyFetch",
        url: url,
        method: options.method || "POST",
        headers: options.headers || {},
        body: options.body || null,
      }, options),
      (resp) => {
        if (chrome.runtime.lastError) {
          console.error("[bgFetch] runtime error:", chrome.runtime.lastError.message);
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!resp) {
          return reject(new Error("Sem resposta do background"));
        }
        if (options.responseType === "base64" && resp.binaryBase64) {
          return resolve(resp);
        }
        if (resp.data && typeof resp.data === "object") {
          resolve(resp.data);
        } else if (!resp.ok) {
          reject(new Error("Fetch failed via background (status " + resp.status + ")"));
        } else {
          resolve(resp.data);
        }
      },
    );
  });
}

(function injectHook() {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("pageHook.js");
    s.onload = () => s.remove();
    (document.documentElement || document.head || document.body).appendChild(s);
  } catch (e) {
    console.warn("[ContentScript] falha ao injetar pageHook", e);
  }
})();

let qlSessionId = null;
let qlHeartbeatInterval = null;
let qlUserName = null;
let qlExpiresAt = null;
let qlActivatedAt = null;
let qlLicenseStatus = null;
let qlOnlineCount = 0;
let qlMinimized = false;
let qlHeight = 520;
let qlSpeechRecognition = null;
let qlIsRecording = false;
let qlDeviceId = null;
let qlShieldActive = false;
let qlAttachedFiles = [];
let qlLicenseValidating = false;

const qlStyle = document.createElement("style");
qlStyle.textContent = `
  :root {
    --ql-primary: var(--accent, #bf00ff);
    --ql-primary-glow: var(--accent-glow, rgba(191, 0, 255, 0.12));
    --ql-primary-border: var(--accent-border, rgba(191, 0, 255, 0.2));
    --ql-text-sub: var(--text-sub, #a890cc);
  }

  .ql-dark,
  .ql-light {
    --ql-primary: var(--accent, #bf00ff);
    --ql-primary-glow: var(--accent-glow, rgba(191, 0, 255, 0.18));
    --ql-primary-border: var(--accent-border, rgba(191, 0, 255, 0.35));
    --ql-secondary: var(--cyan, #00fff7);
    --ql-tertiary: var(--pink, #ff0099);
    --ql-text-sub: var(--text-sub, #a890cc);
  }

  @keyframes qlFadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  
  /* Premium Spring Animation */
  @keyframes qlSpringOpen {
    0%   { opacity: 0; transform: scale(0.95) translateY(10px); }
    70%  { opacity: 1; transform: scale(1.02) translateY(-2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  
  @keyframes qlSpringClose {
    0%   { opacity: 1; transform: scale(1) translateY(0); }
    100% { opacity: 0; transform: scale(0.9) translateY(10px); }
  }

  @keyframes qlBorderPulse {
    0% { border-color: rgba(var(--hb-accent-rgb), 0.3); box-shadow: 0 0 5px rgba(var(--hb-accent-rgb), 0.1); }
    50% { border-color: rgba(var(--hb-accent-rgb), 0.8); box-shadow: 0 0 20px rgba(var(--hb-accent-rgb), 0.4); }
    100% { border-color: rgba(var(--hb-accent-rgb), 0.3); box-shadow: 0 0 5px rgba(var(--hb-accent-rgb), 0.1); }
  }

  @keyframes ql-send-blink {
    0% { background: var(--purple); box-shadow: 0 0 5px var(--ql-primary-glow); }
    50% { background: var(--ql-primary); box-shadow: 0 0 20px var(--hb-glow-strong); }
    100% { background: var(--purple); box-shadow: 0 0 5px var(--ql-primary-glow); }
  }

  @keyframes ql-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes ql-attach-stagger { from { opacity:0; transform: scale(0.8) translateY(10px); } to { opacity:1; transform: scale(1) translateY(0); } }

  .ql-animate-open { animation: qlSpringOpen 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; will-change: transform, opacity; }
  .ql-animate-close { animation: qlSpringClose 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; will-change: transform, opacity; }

  #ql-floating.ql-minimized {
    height: 64px !important;
    overflow: hidden;
    transform: scale(0.98);
  }

  #ql-floating.ql-minimized #ql-header {
    justify-content: space-between !important;
    padding: 0 1.3rem !important;
    height: 64px !important;
    display: flex !important;
    align-items: center !important;
  }

  #ql-floating.ql-minimized .ql-header-right,
  #ql-floating.ql-minimized #ql-header > div:last-child {
    position: absolute !important;
    right: 1.3rem !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }

  .ql-native-active-style {
    border: 2px solid rgba(191, 0, 255, 0.5) !important;
    background: rgba(10, 10, 15, 0.95) !important;
    backdrop-filter: blur(32px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(32px) saturate(180%) !important;
    border-radius: 20px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(191, 0, 255, 0.2) !important;
    padding: 15px !important;
  }

  .ql-dark.ql-native-active-style {
    border: 2px solid rgba(191, 0, 255, 0.6) !important;
    background: rgba(5, 5, 10, 0.98) !important;
  }

  .ql-native-send-active {
    animation: ql-send-blink 2s infinite !important;
    background: var(--ql-primary) !important;
    color: #fff !important;
    border: none !important;
  }

  #ql-native-header {
    background: linear-gradient(135deg, rgba(30, 0, 60, 0.95), rgba(10, 10, 15, 0.98)) !important;
    backdrop-filter: blur(24px) !important;
    -webkit-backdrop-filter: blur(24px) !important;
    border: 1px solid rgba(191, 0, 255, 0.4) !important;
    box-shadow: 0 12px 50px rgba(0, 0, 0, 0.7), 0 0 20px rgba(191, 0, 255, 0.2) !important;
    transition: all 0.3s ease !important;
    border-radius: 16px !important;
    padding: 14px 20px !important;
    margin: 15px !important;
    width: calc(100% - 30px) !important;
  }

  .ql-dark #ql-native-header {
    background: rgba(15, 23, 42, 0.9) !important;
    border-color: rgba(56, 189, 248, 0.3) !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important;
  }

  #ql-native-return-btn {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 12px var(--ql-primary-glow) !important;
  }

  #ql-native-return-btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 20px var(--ql-primary-glow) !important;
    filter: brightness(1.2) !important;
  }

  #ql-native-return-btn:active {
    transform: translateY(0) scale(0.98) !important;
  }
  
  /* Attachments Premium Styling */
  .ql-attach-preview-container {
    display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;
    padding: 8px; border-radius: 12px; background: rgba(0,0,0,0.2);
    border: 1px solid var(--ql-primary-border);
  }

  .ql-dark .ql-attach-preview-container {
    background: rgba(15, 23, 42, 0.4);
    border-color: rgba(56, 189, 248, 0.1);
  }

  .ql-attach-item {
    position: relative; width: 64px; height: 64px; border-radius: 10px;
    overflow: hidden; border: 1px solid var(--ql-primary-border);
    background: rgba(10,3,24,0.6);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s;
    animation: ql-attach-stagger 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  }

  .ql-dark .ql-attach-item {
    border-color: rgba(56, 189, 248, 0.2);
    background: rgba(15, 23, 42, 0.8);
  }

  .ql-attach-item:hover {
    transform: scale(1.1) translateY(-2px);
    border-color: var(--ql-primary);
    z-index: 5;
  }

  .ql-dark .ql-attach-item:hover {
    border-color: rgba(56, 189, 248, 0.5);
  }

  .ql-attach-remove {
    position: absolute; top: 3px; right: 3px;
    width: 16px; height: 16px; border-radius: 50%;
    background: rgba(255,50,80,0.8); border: none;
    color: #fff; font-size: 9px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; opacity: 0;
  }

  .ql-attach-item:hover .ql-attach-remove { opacity: 1; }
  .ql-attach-remove:hover { background: #ff0000; transform: scale(1.2); }

  .ql-drop-zone-active {
    animation: qlBorderPulse 1.5s infinite;
  }

  /* ── ATTACHMENT BADGE ── */
  #ql-attach-badge {
    position: absolute; top: -5px; right: -5px;
    background: var(--ql-primary); color: #fff;
    font-size: 8px; font-weight: 900;
    width: 14px; height: 14px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 10px var(--ql-primary-glow);
  }
  #ql-custom-alert {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999999999;
    background: rgba(28, 28, 30, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid var(--ql-primary-border);
    border-radius: 12px;
    padding: 16px;
    display: none;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    width: 280px;
    animation: qlFadeIn 0.3s ease-out;
  }
  .ql-dark #ql-custom-alert { background: rgba(15, 23, 42, 0.95); }
  .ql-alert-title { font-weight: 800; color: var(--ql-primary); font-size: 14px; }
  .ql-alert-message { color: #fff; font-size: 12px; line-height: 1.4; }
  .ql-alert-ok-btn {
    align-self: flex-end;
    background: var(--ql-primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
`;

(document.head || document.documentElement).appendChild(qlStyle);

const HB_CUSTOMIZE_KEY = "hb_customize_v1";
const HB_THEME_DEFAULTS = {
  accentColor: "#bf00ff",
  cyan: "#00fff7",
  pink: "#ff0099",
  glowIntensity: 0.7,
  cardTransparency: 0.85,
  borderRadius: "1.1rem",
  rgbSpeed: 4,
  gradientStart: "#0f0028",
  gradientEnd: "#020009",
  blurAmount: 28,
  shadowBlur: 20
};
let hbCurrentTheme = null;

function hbClamp(v, min, max) {
  v = Number(v);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function hbHex(value, fallback) {
  let raw = String(value || fallback || "#000000").trim();
  if (!raw.startsWith("#")) raw = "#" + raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    raw = "#" + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
  }
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : String(fallback || "#000000").toLowerCase();
}

function hbRgb(value, fallback) {
  const hex = hbHex(value, fallback).slice(1);
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hbRgbStr(value, fallback) {
  const c = hbRgb(value, fallback);
  return c.r + ", " + c.g + ", " + c.b;
}

function hbMix(a, b, weight) {
  const ca = hbRgb(a, "#000000");
  const cb = hbRgb(b, "#000000");
  const w = hbClamp(weight, 0, 1);
  return "#" + [ca.r, ca.g, ca.b].map((v, i) => {
    const target = [cb.r, cb.g, cb.b][i];
    const s = Math.round(v * (1 - w) + target * w).toString(16);
    return s.length === 1 ? "0" + s : s;
  }).join("");
}

function hbApplyTheme(config) {
  const cfg = Object.assign({}, HB_THEME_DEFAULTS, config || {});
  hbCurrentTheme = cfg;
  const accent = hbHex(cfg.accentColor, HB_THEME_DEFAULTS.accentColor);
  const cyan = hbHex(cfg.cyan, HB_THEME_DEFAULTS.cyan);
  const pink = hbHex(cfg.pink, HB_THEME_DEFAULTS.pink);
  const gradStart = hbHex(cfg.gradientStart, HB_THEME_DEFAULTS.gradientStart);
  const gradEnd = hbHex(cfg.gradientEnd, HB_THEME_DEFAULTS.gradientEnd);
  const purple = hbMix(accent, "#000000", 0.28);
  const gi = hbClamp(cfg.glowIntensity, 0, 1);
  const alpha = hbClamp(cfg.cardTransparency, 0.4, 1);
  const accentRgb = hbRgbStr(accent);
  const cyanRgb = hbRgbStr(cyan);
  const pinkRgb = hbRgbStr(pink);
  const surfaceRgb = hbRgbStr(gradStart);
  const darkRgb = hbRgbStr(gradEnd);
  const root = document.documentElement;
  const glow = "rgba(" + accentRgb + ", " + (gi * 0.24).toFixed(3) + ")";
  const glowStrong = "rgba(" + accentRgb + ", " + (gi * 0.58).toFixed(3) + ")";
  const border = "rgba(" + accentRgb + ", " + (gi * 0.42).toFixed(3) + ")";
  const borderSoft = "rgba(" + accentRgb + ", " + (gi * 0.2).toFixed(3) + ")";
  const rgbGradient = "linear-gradient(110deg, #fff 0%, " + accent + " 28%, " + pink + " 54%, " + cyan + " 78%, " + accent + " 100%)";
  const conic = "conic-gradient(from var(--border-angle-ql), " + accent + " 0%, " + pink + " 22%, " + cyan + " 44%, " + purple + " 66%, " + pink + " 88%, " + accent + " 100%)";

  root.style.setProperty("--hb-accent", accent);
  root.style.setProperty("--hb-accent-rgb", accentRgb);
  root.style.setProperty("--hb-secondary", cyan);
  root.style.setProperty("--hb-secondary-rgb", cyanRgb);
  root.style.setProperty("--hb-tertiary", pink);
  root.style.setProperty("--hb-tertiary-rgb", pinkRgb);
  root.style.setProperty("--hb-purple", purple);
  root.style.setProperty("--hb-gradient-start", gradStart);
  root.style.setProperty("--hb-gradient-end", gradEnd);
  root.style.setProperty("--hb-surface-rgb", surfaceRgb);
  root.style.setProperty("--hb-dark-rgb", darkRgb);
  root.style.setProperty("--hb-card-alpha", alpha);
  root.style.setProperty("--hb-card-bg", "rgba(" + surfaceRgb + ", " + alpha + ")");
  root.style.setProperty("--hb-card-bg-soft", "rgba(" + surfaceRgb + ", " + Math.max(0.44, alpha - 0.16).toFixed(2) + ")");
  root.style.setProperty("--hb-glow", glow);
  root.style.setProperty("--hb-glow-strong", glowStrong);
  root.style.setProperty("--hb-border", border);
  root.style.setProperty("--hb-border-soft", borderSoft);
  root.style.setProperty("--hb-rgb-gradient", rgbGradient);
  root.style.setProperty("--hb-rgb-conic-ql", conic);
  root.style.setProperty("--hb-card-image-overlay",
    "linear-gradient(135deg, rgba(" + darkRgb + ", .18), rgba(" + accentRgb + ", .14)), linear-gradient(180deg, rgba(0,0,0,.04) 0%, rgba(0,0,0,.36) 100%)"
  );
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--neon-purple", accent);
  root.style.setProperty("--purple", purple);
  root.style.setProperty("--cyan", cyan);
  root.style.setProperty("--pink", pink);
  root.style.setProperty("--accent-glow", glow);
  root.style.setProperty("--accent-border", border);
  root.style.setProperty("--dark", gradEnd);
  root.style.setProperty("--dark-rgb", darkRgb);
  root.style.setProperty("--card-bg", "rgba(" + surfaceRgb + ", " + alpha + ")");
  root.style.setProperty("--border", borderSoft);
  root.style.setProperty("--blur-amount", hbClamp(cfg.blurAmount, 8, 60) + "px");
  root.style.setProperty("--shadow-blur", hbClamp(cfg.shadowBlur, 4, 60) + "px");
  root.style.setProperty("--card-radius", cfg.borderRadius || "1.1rem");
  root.style.setProperty("--hb-rgb-dur", hbClamp(cfg.rgbSpeed, 1, 12) + "s");
  root.style.setProperty("--ql-primary", accent);
  root.style.setProperty("--ql-primary-glow", glow);
  root.style.setProperty("--ql-primary-border", border);
  root.style.setProperty("--ql-secondary", cyan);
  root.style.setProperty("--ql-tertiary", pink);

  const floating = document.getElementById("ql-floating");
  if (floating) {
    floating.style.setProperty("--ql-primary", accent);
    floating.style.setProperty("--ql-primary-glow", glow);
    floating.style.setProperty("--ql-primary-border", border);
    floating.style.setProperty("--ql-secondary", cyan);
    floating.style.setProperty("--ql-tertiary", pink);
  }

  hbApplyUserCards(cfg);
  hbApplyAvatars(cfg);
}

function hbBgUrl(value) {
  if (!value) return "";
  return "url(" + JSON.stringify(String(value)) + ")";
}

function hbApplyUserCards(cfg) {
  const card = document.getElementById("ql-user-card-inner");
  if (!card) return;
  const prev = card.querySelector(".hb-bg-overlay");
  if (prev) prev.remove();
  if (cfg && cfg.userCardBg) {
    card.setAttribute("data-has-bg", "1");
    card.style.backgroundImage = "var(--hb-card-image-overlay), " + hbBgUrl(cfg.userCardBg);
    card.style.backgroundSize = "cover";
    card.style.backgroundPosition = "center";
    card.style.backgroundRepeat = "no-repeat";
    card.style.backgroundColor = "var(--hb-card-bg)";
    card.style.imageRendering = "high-quality";
    const ov = document.createElement("div");
    ov.className = "hb-bg-overlay";
    ov.style.cssText = "position:absolute;inset:0;border-radius:inherit;background:var(--hb-card-image-overlay);pointer-events:none;z-index:0;";
    card.insertBefore(ov, card.firstChild);
    Array.from(card.children).forEach((ch) => {
      const cls = ch.className || "";
      if (cls.indexOf("ql-rgb-border") === -1 && cls.indexOf("hb-bg-overlay") === -1) {
        ch.style.position = "relative";
        ch.style.zIndex = "2";
      }
    });
  } else {
    card.removeAttribute("data-has-bg");
    card.style.backgroundImage = "";
    card.style.backgroundSize = "";
    card.style.backgroundPosition = "";
    card.style.backgroundRepeat = "";
    card.style.backgroundColor = "";
    card.style.imageRendering = "";
  }
}

function hbApplyAvatars(cfg) {
  const inner = document.getElementById("ql-avatar-inner");
  if (!inner) return;
  const img = cfg && cfg.avatarImg ? String(cfg.avatarImg) : null;
  if (img) {
    inner.innerHTML = `<img src="${img}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
    inner.dataset.hbAvatar = "1";
  } else if (inner.dataset.hbAvatar === "1") {
    delete inner.dataset.hbAvatar;
    inner.innerHTML = SVG_ICONS.user;
  }
}

function hbInjectFloatingThemeOverrides() {
  if (document.getElementById("hb-floating-theme-overrides")) return;
  const style = document.createElement("style");
  style.id = "hb-floating-theme-overrides";
  style.textContent = `
    #ql-floating{background:rgba(var(--hb-dark-rgb),.88)!important;border-color:var(--ql-primary-border)!important;border-radius:18px!important;box-shadow:0 0 0 1px rgba(var(--hb-accent-rgb),.12),0 0 var(--shadow-blur,36px) var(--ql-primary-glow),0 26px 68px rgba(0,0,0,.82)!important;backdrop-filter:blur(var(--blur-amount,28px)) saturate(168%)!important;-webkit-backdrop-filter:blur(var(--blur-amount,28px)) saturate(168%)!important;}
    #ql-floating:not(.ql-minimized){display:flex!important;flex-direction:column!important;max-height:calc(100vh - 24px)!important;min-height:460px;}
    #ql-floating #ql-body{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;padding:0 1rem 1rem!important;}
    #ql-floating #ql-tab-content{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding-right:3px!important;scrollbar-width:thin;scrollbar-color:var(--ql-primary-border) transparent;}
    #ql-floating #ql-tab-content::-webkit-scrollbar{width:4px}#ql-floating #ql-tab-content::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--ql-primary),var(--ql-tertiary));border-radius:6px}
    .ql-logo-text,.ql-user-name-text,.ql-gate-logo-text,.ql-imm-title{background:var(--hb-rgb-gradient)!important;background-size:300% auto!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;}
    .ql-user-card-wrap{position:relative!important;isolation:isolate!important;overflow:visible!important;margin:.72rem 1rem .9rem!important;}
    .ql-rgb-border,.ql-dark .ql-rgb-border{inset:-1.5px!important;z-index:0!important;opacity:.95!important;background:var(--hb-rgb-conic-ql)!important;animation-duration:var(--hb-rgb-dur,4s)!important;border-radius:calc(var(--card-radius,1.1rem) + 2px)!important;filter:none!important;}
    .ql-rgb-border::after,.ql-dark .ql-rgb-border::after{content:''!important;position:absolute!important;inset:1.5px!important;border-radius:calc(var(--card-radius,1.1rem) + .5px)!important;background:var(--hb-card-bg)!important;display:block!important;}
    .ql-user-card-wrap:has(#ql-user-card-inner[data-has-bg]) .ql-rgb-border::after{background:transparent!important;}
    #ql-user-card-inner{position:relative!important;z-index:1!important;overflow:hidden!important;}
    .ql-user-card,.ql-dark .ql-user-card,#ql-user-card-inner{background:var(--hb-card-bg)!important;border-color:transparent!important;border-radius:calc(var(--card-radius,1.1rem) - 2px)!important;box-shadow:none!important;}
    .ql-user-card::before,.ql-user-card::after,.ql-dark .ql-user-card::before,.ql-dark .ql-user-card::after,#ql-user-card-inner::before,#ql-user-card-inner::after{content:none!important;display:none!important;background:none!important;box-shadow:none!important;animation:none!important;}
    .ql-avatar,.ql-dark .ql-avatar{background:linear-gradient(135deg,var(--purple),var(--ql-primary),var(--ql-secondary))!important;box-shadow:0 0 20px var(--hb-glow-strong),0 0 36px var(--ql-primary-glow)!important;}
    .ql-tab-active,.ql-dark .ql-tab.ql-tab-active,.ql-btn-send,.ql-dark .ql-btn-send,.ql-gate-btn,.ql-imm-exit{background:linear-gradient(110deg,var(--purple),var(--ql-primary),var(--ql-tertiary))!important;border-color:var(--ql-primary-border)!important;box-shadow:0 0 22px var(--ql-primary-glow),0 6px 18px rgba(0,0,0,.25)!important;}
    .ql-icon-btn,.ql-dark .ql-icon-btn{background:rgba(var(--hb-accent-rgb),.075)!important;border-color:var(--hb-border-soft)!important;color:rgba(var(--hb-accent-rgb),.72)!important;border-radius:10px!important;}
    .ql-icon-btn:hover,.ql-dark .ql-icon-btn:hover,.ql-quick-btn:hover{background:rgba(var(--hb-accent-rgb),.18)!important;border-color:var(--ql-primary)!important;color:var(--ql-primary)!important;box-shadow:0 0 16px var(--ql-primary-glow)!important;}
    .ql-msg-textarea,.ql-dark .ql-msg-textarea,.ql-gate-input{background:rgba(var(--hb-surface-rgb),.54)!important;border-color:var(--hb-border-soft)!important;caret-color:var(--ql-primary)!important;}
    .ql-quick-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;margin:10px 0 4px!important;padding-bottom:2px!important;}
    .ql-quick-btn{min-width:0!important;min-height:58px!important;height:auto!important;padding:8px 4px!important;white-space:normal!important;line-height:1.15!important;overflow:visible!important;background:rgba(var(--hb-accent-rgb),.075)!important;border-color:var(--hb-border-soft)!important;color:var(--ql-text-sub)!important;}
    .ql-section-title,#ql-rgb-toggle,.ql-gate-logo-svg{color:var(--ql-primary)!important;filter:drop-shadow(0 0 8px var(--ql-primary-glow))!important;}
  `;
  (document.head || document.documentElement).appendChild(style);
}

function hbSyncQlAvatarFromTheme(themeCfg) {
  const nextAvatar = (themeCfg && themeCfg.avatarImg) ? String(themeCfg.avatarImg) : null;
  try {
    chrome.storage.local.get(["ql_avatar"], (r) => {
      const currentAvatar = r && r.ql_avatar ? String(r.ql_avatar) : null;
      if (currentAvatar === nextAvatar) return;
      if (nextAvatar) chrome.storage.local.set({ ql_avatar: nextAvatar });
      else chrome.storage.local.remove(["ql_avatar"]);
    });
  } catch (_) {}
}

function hbSyncThemeAvatarFromQl(nextAvatar) {
  try {
    chrome.storage.local.get([HB_CUSTOMIZE_KEY], (r) => {
      const raw = (r && r[HB_CUSTOMIZE_KEY]) || {};
      const currentAvatar = raw.avatarImg ? String(raw.avatarImg) : null;
      const normalizedNext = nextAvatar ? String(nextAvatar) : null;
      if (currentAvatar === normalizedNext) return;
      const nextCfg = Object.assign({}, HB_THEME_DEFAULTS, raw, { avatarImg: normalizedNext });
      chrome.storage.local.set({ [HB_CUSTOMIZE_KEY]: nextCfg });
    });
  } catch (_) {}
}

function hbBootThemeSync() {
  hbInjectFloatingThemeOverrides();
  try {
    chrome.storage.local.get([HB_CUSTOMIZE_KEY, "ql_avatar"], (res) => {
      const storedTheme = (res && res[HB_CUSTOMIZE_KEY]) || {};
      const qlAvatar = (res && res.ql_avatar) ? String(res.ql_avatar) : null;
      const mergedTheme = Object.assign({}, HB_THEME_DEFAULTS, storedTheme);
      if (!mergedTheme.avatarImg && qlAvatar) {
        mergedTheme.avatarImg = qlAvatar;
        chrome.storage.local.set({ [HB_CUSTOMIZE_KEY]: mergedTheme });
      }
      hbApplyTheme(mergedTheme);
      hbSyncQlAvatarFromTheme(mergedTheme);
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes[HB_CUSTOMIZE_KEY]) {
          const nextTheme = changes[HB_CUSTOMIZE_KEY].newValue || HB_THEME_DEFAULTS;
          hbApplyTheme(nextTheme);
          hbSyncQlAvatarFromTheme(nextTheme);
        }
        if (changes.ql_avatar) {
          hbSyncThemeAvatarFromQl(changes.ql_avatar.newValue || null);
        }
      });
    }
  } catch (_) {
    hbApplyTheme();
  }
}

hbBootThemeSync();

let qlActiveTab = "prompt";
let qlChatHistory = [];
const QL_HISTORY_KEY = "ql_chat_history";
const QL_MAX_HISTORY = 200;

function getDeviceId() {
  return getHardwareFingerprint();
}

let qlUIMode = "floating"; // Default

let __hbRgbStorageWritten = false;
function forcePopupRgbOn(box) {
  try {
    const floating = box || document.getElementById("ql-floating");
    if (document.documentElement.classList.contains("rgb-off") || document.documentElement.classList.contains("ql-no-rgb")) {
      document.documentElement.classList.remove("rgb-off", "ql-no-rgb");
    }
    if (document.body && (document.body.classList.contains("rgb-off") || document.body.classList.contains("ql-no-rgb"))) {
      document.body.classList.remove("rgb-off", "ql-no-rgb");
    }
    if (floating) {
      if (floating.classList.contains("rgb-off") || floating.classList.contains("ql-no-rgb") || floating.classList.contains("ql-light")) {
        floating.classList.remove("rgb-off", "ql-no-rgb", "ql-light");
      }
      if (!floating.classList.contains("ql-dark")) floating.classList.add("ql-dark");
      if (floating.getAttribute("data-theme") !== "dark") floating.setAttribute("data-theme", "dark");
      const border = floating.querySelector("#ql-rgb-border-el");
      if (border && !border.dataset.rgbInit) {
        border.dataset.rgbInit = "1";
        border.style.display = "block";
        border.style.animation = "rgb-spin-ql var(--hb-rgb-dur, 4s) linear infinite";
      }
    }
    document.querySelectorAll("#ql-theme-btn").forEach((btn) => {
      if (btn.dataset.iconSet === "moon") return;
      btn.dataset.iconSet = "moon";
      btn.innerHTML = SVG_ICONS.moon;
    });
    if (!__hbRgbStorageWritten && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      __hbRgbStorageWritten = true;
      chrome.storage.local.set({ ql_rgb_enabled: true, ql_dark_mode: true });
    }
  } catch (_) {}
}

const UIController = {
  async opening(box) {
    if (!box) return;
    box.classList.add("ql-animate-open");
    await new Promise((r) => setTimeout(r, 500));
    box.classList.remove("ql-animate-open");
  },
  async closing(box) {
    if (!box) return;
    box.classList.add("ql-animate-close");
    await new Promise((r) => setTimeout(r, 400));
    box.style.display = "none";
    box.classList.remove("ql-animate-close");
  },
  async toggleMode(targetMode) {
    const floating = document.getElementById("ql-floating");
    if (targetMode === "sidepanel") {
      if (floating) await this.closing(floating);
      console.log("[ContentScript] Mode changed to sidepanel, floating UI closed");
    } else if (targetMode === "floating") {
      if (floating) {
        floating.style.display = "block";
        await this.opening(floating);
      } else {
        _buildFloatingUI();
      }
      console.log("[ContentScript] Mode changed to floating, UI opened");
    }
  },
};

function createUI() {
  if (document.getElementById("ql-floating")) return;
  chrome.storage.local.get(["ql_ui_mode", "ql_sidebar_mode", "ql_native_chat"], (res) => {
    if (res.ql_ui_mode) {
      qlUIMode = res.ql_ui_mode;
    } else if (res.ql_sidebar_mode === true) {
      qlUIMode = "sidepanel";
    } else if (res.ql_native_chat === true) {
      qlUIMode = "floating";
    }

    if (qlUIMode === "sidepanel") {
      console.log("[ContentScript] Sidepanel mode active, skipping floating UI");
      const existing = document.getElementById("ql-floating");
      if (existing) existing.style.display = "none";
      return;
    }

    _buildFloatingUI();
  });
}

// Global UI Mode and Theme listener
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.ql_ui_mode) {
      const nextMode = changes.ql_ui_mode.newValue;
      UIController.toggleMode(nextMode);
      qlUIMode = nextMode;
    }
    // Cross-context logout sync: outro contexto removeu a chave -> volta para o gate na hora.
    if (changes.ql_license_key && changes.ql_license_key.oldValue && !changes.ql_license_key.newValue) {
      try {
        if (qlHeartbeatInterval) { clearInterval(qlHeartbeatInterval); qlHeartbeatInterval = null; }
        qlSessionId = null;
        qlUserName = null;
        const box = document.getElementById("ql-floating");
        if (box) showLicenseGate(box);
        chrome.storage.local.get(["ql_logout_reason", "ql_logout_message"], (r) => {
          if (r && r.ql_logout_reason === "device_conflict" && r.ql_logout_message) {
            setTimeout(() => {
              try { showCustomAlert("Acesso Negado", r.ql_logout_message); } catch (_) {}
            }, 400);
          }
        });
      } catch (e) { console.warn("[QL] cross-context logout sync failed:", e); }
    }
    if (changes.ql_native_chat) {
      if (changes.ql_native_chat.newValue === true) {
        if (!qlNativeChatActive) activateNativeChat();
      } else {
        if (qlNativeChatActive) deactivateNativeChat();
      }
    }
    if (changes.ql_avatar) {
      const avatarInner = document.getElementById("ql-avatar-inner");
      if (avatarInner) {
        if (changes.ql_avatar.newValue) {
          avatarInner.innerHTML = `<img src="${changes.ql_avatar.newValue}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        } else {
          avatarInner.innerHTML = SVG_ICONS.user;
        }
      }
    }
    if (changes.ql_dark_mode) {
      const isDark = changes.ql_dark_mode.newValue === true;
      const box = document.getElementById("ql-floating");
      if (box) {
        if (isDark) {
          box.classList.add("ql-dark");
          box.classList.remove("ql-light");
        } else {
          box.classList.add("ql-light");
          box.classList.remove("ql-dark");
        }
      }
      // Update shield and native chat if they exist
      const shield = document.getElementById("ql-shield-overlay");
      if (shield) {
        if (isDark) shield.classList.add("ql-dark");
        else shield.classList.remove("ql-dark");
      }
      const nativeHeader = document.getElementById("ql-native-header");
      if (nativeHeader) {
        if (isDark) nativeHeader.classList.add("ql-dark");
        else nativeHeader.classList.remove("ql-dark");
      }
      const chatForm = document.querySelector("form#chat-input");
      if (chatForm) {
        if (isDark && qlNativeChatActive) {
          chatForm.classList.add("ql-dark");
        } else {
          chatForm.classList.remove("ql-dark");
        }
        const chatInputContainer = chatForm.parentElement;
        if (chatInputContainer) {
          if (isDark && qlNativeChatActive) {
            chatInputContainer.classList.add("ql-dark");
          } else {
            chatInputContainer.classList.remove("ql-dark");
          }
        }
      }
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "ping") {
    sendResponse({ status: "ok" });
    return false;
  }
  if (msg.action === "toggleFloatingUI") {
    const floating = document.getElementById("ql-floating");
    if (floating) {
      if (floating.style.display === "none") {
        floating.style.display = "block";
        UIController.opening(floating);
      } else {
        UIController.closing(floating);
      }
    } else {
      _buildFloatingUI();
    }
    sendResponse({ status: "ok" });
  }
  if (msg.action === "createProjectNative") {
    (async () => {
      try {
        const projectId = await createLovableProject();
        sendResponse({ ok: true, projectId });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true; // async
  }
});

function _buildFloatingUI() {
  if (qlNativeChatActive) return;
  if (document.getElementById("ql-floating")) return;

  const box = document.createElement("div");
  box.id = "ql-floating";
  const boxWidth = 385;
  const initialLeft = Math.max(10, (window.innerWidth - boxWidth) / 2);
  const initialTop = Math.max(50, (window.innerHeight - 550) / 2);
  box.style.left = initialLeft + "px";
  box.style.top = initialTop + "px";

  chrome.storage.local.get(
    [
      "ql_license_valid",
      "ql_license_key",
      "ql_minimized",
      "ql_height",
      "ql_dark_mode",
      "ql_user_name",
      "ql_expires_at",
      "ql_activated_at",
      "ql_license_status",
      "ql_session_id",
      QL_HISTORY_KEY,
    ],
    async (res) => {
      qlMinimized = res.ql_minimized || false;
      qlHeight = res.ql_height || 520;
      qlChatHistory = res[QL_HISTORY_KEY] || [];
      qlDeviceId = await getDeviceId();

      box.classList.add("ql-dark");
      box.classList.remove("ql-light", "ql-no-rgb", "rgb-off");
      if (qlMinimized) {
        box.classList.add("ql-minimized");
      }

      document.body.appendChild(box);

      if (res.ql_license_valid) {
        qlUserName = res.ql_user_name || null;
        qlExpiresAt = res.ql_expires_at || null;
        qlActivatedAt = res.ql_activated_at || null;
        qlLicenseStatus = res.ql_license_status || null;
        qlSessionId = res.ql_session_id || null;
        showMainUI(box);

        if (res.ql_license_key) {
          fetch(VALIDATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              license_key: res.ql_license_key,
              session_id: res.ql_session_id,
              heartbeat: true,
              device_id: qlDeviceId,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.valid) {
                qlUserName = data.user_name || qlUserName;
                qlExpiresAt = data.expires_at || qlExpiresAt;
                qlActivatedAt = data.activated_at || qlActivatedAt;
                qlLicenseStatus = data.status || qlLicenseStatus;
                qlSessionId = data.session_id || qlSessionId;
                chrome.storage.local.set({
                  ql_user_name: qlUserName,
                  ql_expires_at: qlExpiresAt,
                  ql_activated_at: qlActivatedAt,
                  ql_license_status: qlLicenseStatus,
                  ql_session_id: qlSessionId,
                });
                const nameEl = document.querySelector(".ql-profile-name");
                if (nameEl) nameEl.textContent = qlUserName || "User";
                updateTrialCountdown();
              } else if (data.reason === "device_conflict") {
                chrome.storage.local.remove([
                  "ql_license_valid",
                  "ql_license_key",
                  "ql_session_id",
                  "ql_user_name",
                  "ql_expires_at",
                  "ql_activated_at",
                  "ql_license_status",
                ]);
                const b = document.getElementById("ql-floating");
                if (b) showLicenseGate(b);
                setTimeout(() => showCustomAlert("Acesso Negado", data.message), 500);
              } else {
                chrome.storage.local.remove([
                  "ql_license_valid",
                  "ql_license_key",
                  "ql_session_id",
                  "ql_user_name",
                  "ql_expires_at",
                  "ql_activated_at",
                  "ql_license_status",
                ]);
                const b = document.getElementById("ql-floating");
                if (b) showLicenseGate(b);
              }
            })
            .catch(() => {});
        }
      } else {
        showLicenseGate(box);
      }

      setupDrag();
      setupResize();
      setupDarkMode();

      forcePopupRgbOn(box);
    },
  );
}

function bindFloatingLicenseGate() {
  const btn = document.getElementById("ql-validate-btn");
  const input = document.getElementById("ql-license-input");
  if (btn && !btn.dataset.bound) {
    btn.type = "button";
    btn.dataset.bound = "1";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      validateLicense();
    });
  }
  if (input && !input.dataset.bound) {
    input.dataset.bound = "1";
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        validateLicense();
      }
    });
    input.addEventListener("input", function () {
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase();
      try { input.setSelectionRange(pos, pos); } catch (_) {}
    });
  }
}

function showLicenseGate(box) {
  box.innerHTML = templateLicenseGate(qlMinimized);
  hbApplyTheme(hbCurrentTheme);

  box.classList.add("ql-dark");
  box.classList.remove("ql-light");
  box.classList.add("ql-license-gate-active");
  forcePopupRgbOn(box);

  setupMinimize();
  setupDarkMode();
  setupDrag();
  setupResize();
  bindFloatingLicenseGate();

  const buyBtn = document.getElementById("ql-buy-license-btn");
  if (buyBtn) buyBtn.addEventListener("click", function () { showPaymentUI(box); });
}

async function validateLicense() {
  if (qlLicenseValidating) return;
  const input = document.getElementById("ql-license-input");
  const log = document.getElementById("ql-license-log");
  const btn = document.getElementById("ql-validate-btn");
  const key = input ? input.value.trim().toUpperCase() : "";

  // Helper local — substitui setFloatingLicenseLog (que não existia e causava
  // ReferenceError silencioso, deixando o botão preso em "Validando...").
  const setLog = (html, kind) => {
    if (!log) return;
    log.className = kind === "success" ? "ql-log-success"
      : kind === "error" ? "ql-log-error"
      : "ql-log-info";
    log.innerHTML = html;
  };
  const resetBtn = () => {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = "Ativar Agora";
  };

  if (!key) {
    setLog(SVG_ICONS.alertCircle + " Insira uma chave", "error");
    return;
  }

  if (!key.startsWith("HYPER-")) {
    setLog(SVG_ICONS.ban + " Licença inválida (HYPER-...)", "error");
    return;
  }

  setLog(SVG_ICONS.clock + " Validando...", "info");
  if (btn) { btn.disabled = true; btn.textContent = "Validando..."; }
  qlLicenseValidating = true;

  try {
    if (!qlDeviceId) qlDeviceId = await getDeviceId();

    const data = await bgFetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: key, device_id: qlDeviceId }),
    });

    if (data.valid) {
      qlSessionId = data.session_id;
      qlUserName = data.user_name;
      qlExpiresAt = data.expires_at;
      qlActivatedAt = data.activated_at;
      qlLicenseStatus = data.status;
      qlOnlineCount = data.online_count || 0;

      chrome.storage.local.set(
        {
          ql_license_valid: true,
          ql_license_key: key,
          ql_session_id: data.session_id,
          ql_user_name: data.user_name || null,
          ql_expires_at: data.expires_at || null,
          ql_activated_at: data.activated_at || null,
          ql_license_status: data.status || null,
        },
        () => {
          qlLicenseValidating = false;
          resetBtn();
          setLog(SVG_ICONS.check + " " + (data.message || "Licença ativada!"), "success");
          setTimeout(() => {
            const box = document.getElementById("ql-floating");
            if (box) showMainUI(box);
            startHeartbeat(key);
          }, 800);
        },
      );
    } else {
      resetBtn();
      setLog(SVG_ICONS.ban + " " + (data.message || "Chave inválida"), "error");
      qlLicenseValidating = false;
    }
  } catch (err) {
    resetBtn();
    setLog(SVG_ICONS.ban + " " + ((err && err.message) || "Erro de conexão"), "error");
    qlLicenseValidating = false;
  }
}

document.addEventListener("click", (event) => {
  const btn = event.target && event.target.closest ? event.target.closest("#ql-validate-btn") : null;
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  validateLicense();
}, true);

document.addEventListener("keydown", (event) => {
  if (!event.target || event.target.id !== "ql-license-input" || event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  validateLicense();
}, true);

document.addEventListener("input", (event) => {
  const input = event.target;
  if (!input || input.id !== "ql-license-input") return;
  const pos = input.selectionStart;
  input.value = input.value.toUpperCase();
  try { input.setSelectionRange(pos, pos); } catch (_) {}
}, true);

function showMainUI(box) {
  box.classList.remove("ql-license-gate-active");
  var greeting = qlUserName || "User";
  box.innerHTML = templateMainUI(greeting, "", qlMinimized);
  box.style.height = qlHeight + "px";
  hbApplyTheme(hbCurrentTheme);
  forcePopupRgbOn(box);

  setTimeout(() => {
    renderTabContent();
    setupMinimize();
    setupDrag();
    setupResize();

    forcePopupRgbOn(box);

    if (qlExpiresAt) {
      const dateEl = document.getElementById("ql-expires-date");
      if (dateEl) dateEl.textContent = new Date(qlExpiresAt).toLocaleDateString("pt-BR");
    }

    const sidePanelBtn = document.getElementById("ql-sidepanel-btn");
    if (sidePanelBtn) {
      sidePanelBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "activateSidebar" }, (resp) => {
          if (resp && resp.ok) {
            box.remove();
          }
        });
      });
    }

    const logoutBtn = document.getElementById("ql-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        chrome.storage.local.remove(
          [
            "ql_license_valid",
            "ql_license_key",
            "ql_session_id",
            "ql_user_name",
            "ql_expires_at",
            "ql_activated_at",
            "ql_license_status",
          ],
          () => {
            showLicenseGate(box);
          },
        );
      });
    }

    setupTabs();
  }, 30);
}

function setupClearMsg() {
  const btn = document.getElementById("ql-clear-msg");
  const msg = document.getElementById("ql-msg");
  if (btn && msg) {
    btn.addEventListener("click", () => {
      msg.value = "";
      const sendBtn = document.getElementById("ql-send-btn");
      if (sendBtn) sendBtn.disabled = true;
    });
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.ql_license_valid) {
    if (changes.ql_license_valid.newValue === true) {
      const box = document.getElementById("ql-floating");
      if (box && box.classList.contains("ql-license-gate-active")) {
        chrome.storage.local.get([
          "ql_user_name",
          "ql_expires_at",
          "ql_activated_at",
          "ql_license_status",
          "ql_session_id"
        ], (res) => {
          qlUserName = res.ql_user_name;
          qlExpiresAt = res.ql_expires_at;
          qlActivatedAt = res.ql_activated_at;
          qlLicenseStatus = res.ql_license_status;
          qlSessionId = res.ql_session_id;
          showMainUI(box);
        });
      }
    }
  }
});

function showStatusMessage(message) {
  const el = document.getElementById("ql-response-area");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
    el.style.opacity = "1";
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => {
        el.style.display = "none";
      }, 300);
    }, 4000);
  } else {
    console.log("[Status Message]:", message);
  }
}

function showCustomAlert(title, message) {
  showStatusMessage(message);
}

function hbBase64ToBlob(base64, contentType) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType || "application/zip" });
}

function hbTriggerBlobDownload(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName || "HyperBuild-Project.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function setupDownloadProjectButton() {
  const btn = document.getElementById("ql-download-project-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = SVG_ICONS.loader;

    try {
      await requestLatestTokenFromHook();
      const storageData = await new Promise((resolve) => {
        chrome.storage.local.get(["lovable_projectId", "lovable_token", "ql_license_key", "ql_session_id"], resolve);
      });

      const projectId = storageData.lovable_projectId || "";
      const licenseKey = storageData.ql_license_key || "";
      let tokenLovable = storageData.lovable_token || "";
      if (typeof tokenLovable === "string" && tokenLovable.startsWith("Bearer ")) {
        tokenLovable = tokenLovable.slice(7);
      }

      if (!projectId) throw new Error("Projeto não sincronizado.");
      if (!tokenLovable) throw new Error("Token Lovable ausente. Faça login em lovable.dev e tente novamente.");
      if (!qlDeviceId) {
        try { qlDeviceId = await getHardwareFingerprint(); } catch (_) {}
      }
      if (!qlDeviceId) throw new Error("Dispositivo não identificado.");

      const response = await bgFetch(DOWNLOAD_PROJECT_URL, {
        method: "POST",
        responseType: "base64",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, "x-license-key": licenseKey },
        body: JSON.stringify({
          license_key: licenseKey,
          session_id: qlSessionId || storageData.ql_session_id,
          projeto_id: projectId,
          device_id: qlDeviceId,
          token_lovable: tokenLovable,
        }),
      });

      if (response?.data?.success === false) {
        const err = response.data;
        throw new Error([err.error_display, err.user_action].filter(Boolean).join(" — ") || "Falha ao baixar projeto.");
      }
      if (!response || !response.binaryBase64) throw new Error("ZIP não retornado pelo backend.");

      hbTriggerBlobDownload(
        hbBase64ToBlob(response.binaryBase64, response.contentType),
        response.fileName || `lovable-project-${projectId}.zip`,
      );
      showStatusMessage("Download do projeto iniciado.");
    } catch (err) {
      showCustomAlert("Erro", err.message || "Falha ao baixar projeto.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });
}

function setupOptimize() {
  const btn = document.getElementById("ql-optimize-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const textarea = document.getElementById("ql-msg");
    if (!textarea || !textarea.value.trim()) {
      showCustomAlert("Atenção", "Digite um prompt antes de otimizar.");
      return;
    }
    const originalPrompt = textarea.value.trim();
    btn.classList.add("ql-tool-loading");
    btn.disabled = true;

    try {
      const data = await bgFetch(GROQ_API_URL, {
        action: "proxyGroq",
        method: "POST",
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 1024,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "Você é uma IA especializada em refinar prompts sem alterar sua lógica original.\n\nSua função é apenas:\n- Melhorar clareza\n- Organizar melhor as informações\n- Deixar o texto mais objetivo, técnico e detalhado\n- Corrigir ambiguidades e melhorar interpretação da IA\n\nREGRAS ABSOLUTAS:\n- NÃO adicionar novas funcionalidades, ideias ou sistemas\n- NÃO mudar a intenção do prompt\n- NÃO alterar fluxo, estrutura ou lógica\n- NÃO remover informações importantes\n- NÃO inventar contexto\n\nResponda APENAS com o prompt refinado, sem explicações, sem introdução, sem aspas extras.",
            },
            {
              role: "user",
              content: originalPrompt,
            },
          ],
        }),
      });
      const optimized = data.choices?.[0]?.message?.content?.trim();
      if (optimized) {
        textarea.value = optimized;
        textarea.dispatchEvent(new Event("input"));
        showCustomAlert("Prompt Otimizado!", "Seu prompt foi aprimorado com IA Groq.");
      } else {
        throw new Error("Resposta vazia da IA");
      }
    } catch (err) {
      console.error("[HyperBuild] Groq optimize error:", err);
      // Fallback to Supabase endpoint
      try {
        const storageData = await new Promise((r) =>
          chrome.storage.local.get(["ql_license_key", "ql_session_id"], r),
        );
        const licenseKey = storageData.ql_license_key || "";
        const sessionId = qlSessionId || storageData.ql_session_id || "";

        if (!qlDeviceId) {
          try { qlDeviceId = await getHardwareFingerprint(); } catch (_) {}
        }

        const data = await bgFetch(OPTIMIZE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            "x-license-key": licenseKey,
          },
          body: JSON.stringify({
            prompt: originalPrompt,
            session_id: sessionId,
            device_id: qlDeviceId,
          }),
        });
        if (data.optimized_prompt) {
          textarea.value = data.optimized_prompt;
          textarea.dispatchEvent(new Event("input"));
          showCustomAlert("Prompt Otimizado!", "Seu prompt foi aprimorado.");
        } else {
          throw new Error(data.error || "Sem resposta");
        }
      } catch (e2) {
        showCustomAlert("Erro", "Falha ao otimizar: " + (err.message || ""));
      }
    } finally {
      btn.classList.remove("ql-tool-loading");
      btn.disabled = false;
    }
  });
}

function setupSpeech() {
  const btn = document.getElementById("ql-speech-btn");
  if (!btn) return;

  // Verificar suporte à Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btn.title = "Reconhecimento de voz não suportado neste navegador";
    btn.style.opacity = "0.4";
    btn.style.cursor = "not-allowed";
    console.warn("Web Speech API não suportada");
    return;
  }

  let recognition = null;
  let isRecording = false;

  function startRecording() {
    if (recognition) recognition.stop();

    recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";
    const textarea = document.getElementById("ql-msg");

    recognition.onstart = () => {
      isRecording = true;
      btn.classList.add("ql-recording");
      finalTranscript = textarea ? textarea.value : "";
      btn.title = "Gravando... clique para parar";
      console.log("[HyperBuild] Gravação de voz iniciada");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (textarea) {
        textarea.value = finalTranscript + interim;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    recognition.onerror = (event) => {
      console.error("[HyperBuild] Erro de voz:", event.error);
      isRecording = false;
      btn.classList.remove("ql-recording");
      btn.title = "Clique para falar";

      let errorMessage = "";
      switch (event.error) {
        case "not-allowed":
          errorMessage = "Permissão do microfone negada. Verifique as configurações do navegador.";
          break;
        case "no-speech":
          errorMessage = "Nenhuma fala detectada. Tente novamente.";
          break;
        case "audio-capture":
          errorMessage = "Nenhum dispositivo de áudio encontrado.";
          break;
        default:
          errorMessage = `Erro: ${event.error}`;
      }
      if (typeof showCustomAlert === "function") {
        showCustomAlert("Erro de Voz", errorMessage);
      } else {
        alert(errorMessage);
      }
    };

    recognition.onend = () => {
      isRecording = false;
      btn.classList.remove("ql-recording");
      btn.title = "Clique para falar";
      console.log("[HyperBuild] Gravação finalizada");
    };

    recognition.start();
  }

  function stopRecording() {
    if (recognition && isRecording) {
      recognition.stop();
    }
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

function setupNotifications() {
  const bellBtn = document.querySelector(".ql-notif-btn");
  const panel = document.getElementById("ql-notif-panel");
  const closeBtn = document.getElementById("ql-notif-close");
  if (!bellBtn || !panel) return;

  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    if (!isOpen) loadNotifications();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.style.display = "none";
    });
  }

  checkUnreadNotifications();
}

async function loadNotifications() {
  const list = document.getElementById("ql-notif-list");
  if (!list) return;
  list.innerHTML = '<p class="ql-notif-empty">Carregando...</p>';

  try {
    const data = await bgFetch(NOTIFICATIONS_URL, {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
    });

    if (!data || data.length === 0) {
      list.innerHTML = '<p class="ql-notif-empty">Nenhuma notificação.</p>';
      return;
    }

    const ids = data.map((n) => n.id);
    chrome.storage.local.set({ ql_read_notifs: ids });
    const badge = document.querySelector(".ql-notif-badge");
    if (badge) badge.style.display = "none";

    list.innerHTML = data
      .map((n) => {
        const date = new Date(n.created_at).toLocaleDateString("pt-BR");
        const safeLink = sanitizeUrl(n.link);
        const linkHtml = safeLink
          ? '<a href="' +
            escapeHtml(safeLink) +
            '" target="_blank" rel="noopener noreferrer" class="ql-notif-link">Abrir link →</a>'
          : "";
        return (
          '<div class="ql-notif-item"><div class="ql-notif-item-title">' +
          escapeHtml(n.title) +
          '</div><div class="ql-notif-item-msg">' +
          escapeHtml(n.message) +
          "</div>" +
          linkHtml +
          '<div class="ql-notif-item-date">' +
          date +
          "</div></div>"
        );
      })
      .join("");
  } catch (err) {
    list.innerHTML = '<p class="ql-notif-empty">Erro ao carregar.</p>';
  }
}

async function checkUnreadNotifications() {
  try {
    const data = await bgFetch(NOTIFICATIONS_URL, {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
    });
    if (!data || data.length === 0) return;

    chrome.storage.local.get(["ql_read_notifs"], (res) => {
      const readIds = res.ql_read_notifs || [];
      const unread = data.filter((n) => !readIds.includes(n.id)).length;
      const badge = document.querySelector(".ql-notif-badge");
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread;
          badge.style.display = "flex";
        } else {
          badge.style.display = "none";
        }
      }
    });
  } catch (e) {}
}

function setupSuggestionChips() {
  const container = document.getElementById("ql-chips");
  if (!container) return;
  container.innerHTML = "";
  PROMPT_TEMPLATES.forEach((t) => {
    const chip = document.createElement("button");
    chip.className = "ql-chip";
    chip.innerHTML = t.icon + " " + t.label;
    chip.title = t.prompt;
    chip.addEventListener("click", () => {
      chip.classList.add("ql-chip-selected");
      setTimeout(() => chip.classList.remove("ql-chip-selected"), 600);
      const textarea = document.getElementById("ql-msg");
      if (textarea) {
        textarea.value = t.prompt;
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      }
    });
    container.appendChild(chip);
  });
}

// Watermark removal: o prompt fica server-side no /pc.
// O client envia apenas { action: "remove_watermark" } e o backend
// substitui a mensagem canônica antes de chamar a Lovable API.
var WATERMARK_ACTION = "remove_watermark";

function setupWatermarkButton() {
  var btn = document.getElementById("ql-remove-watermark");
  if (!btn) return;
  btn.addEventListener("click", async function () {
    var log = document.getElementById("ql-log");
    btn.disabled = true;
    btn.textContent = "\u23f3 Enviando...";

    await requestLatestTokenFromHook();

    var storageData = await new Promise(function (resolve) {
      chrome.storage.local.get(["lovable_projectId", "lovable_token", "ql_license_key", "ql_session_id"], resolve);
    });
    var projectId = storageData.lovable_projectId || "";
    var token = storageData.lovable_token || "";
    var licenseKey = storageData.ql_license_key || "";

    if (!projectId || !token) {
      if (log) {
        log.className = "ql-log-error";
        log.innerText = "\u26a0 Projeto n\u00e3o sincronizado.";
      }
      btn.disabled = false;
      btn.innerHTML = SVG_ICONS.ban + " Remover marca D'água";
      return;
    }

    if (token.startsWith("Bearer ")) token = token.slice(7);

    try {
      var payload = {
        license_key: licenseKey,
        session_id: qlSessionId,
        projeto_id: projectId,
        token_lovable: token,
        action: WATERMARK_ACTION,
        mensagem: ".",
      };

      if (!qlDeviceId) {
        try { qlDeviceId = await getHardwareFingerprint(); } catch (_) {}
      }
      if (qlDeviceId) payload.device_id = qlDeviceId;

      var result = await bgFetch(PROXY_COMMAND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify(payload),
      });

      if (result && result.success === false) {
        if (result && result.error_code === "CAPTCHA_REQUIRED") {
          qlShowCaptchaGuide(result);
          throw new Error("Verificação de segurança necessária. Siga as instruções do modal.");
        }
        throw new Error(
          [result.error_display, result.user_action].filter(Boolean).join(" — ") || result.message || "Erro no envio",
        );
      }

      if (log) {
        log.className = "ql-log-success";
        log.innerHTML = SVG_ICONS.checkCircle + " Marca de \u00e1gua removida com sucesso!";
      }
    } catch (err) {
      if (log) {
        log.className = "ql-log-error";
        log.innerHTML = SVG_ICONS.close + " " + (err.message || err);
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = SVG_ICONS.ban + " Remover marca D'água";
    }
  });
}

function updateTrialCountdown() {
  if (!qlExpiresAt) return;
  const el = document.getElementById("ql-trial-countdown");
  if (!el) return;
  el.style.display = "block";

  const createdAt = Date.now();
  const expiresMs = new Date(qlExpiresAt).getTime();
  const totalDuration = Math.max(expiresMs - createdAt, 3600000);

  function update() {
    const remaining = expiresMs - Date.now();
    if (remaining <= 0) {
      el.innerHTML =
        '<span class="ql-countdown-expired">' + SVG_ICONS.clock + ' Licença expirada</span><div class="ql-trial-bar"><div class="ql-trial-bar-fill ql-bar-expired" style="width:0%"></div></div>';
      handleLicenseExpired();
      return;
    }
    const days = Math.floor(remaining / 86400000);
    const hrs = Math.floor((remaining % 86400000) / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const pct = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));

    let timeStr = "";
    if (days > 0) timeStr = days + "d " + hrs + "h " + mins + "m";
    else if (hrs > 0) timeStr = hrs + "h " + mins + "m " + String(secs).padStart(2, "0") + "s";
    else timeStr = mins + ":" + String(secs).padStart(2, "0");

    const urgentClass = pct < 20 ? " ql-bar-urgent" : "";
    const label = qlLicenseStatus === "trial" ? "Teste expira em" : "Plano expira em";

    el.innerHTML =
      '<div class="ql-countdown-row"><span class="ql-countdown-icon">' + SVG_ICONS.loader + '</span><span class="ql-countdown-label">' +
      label +
      '</span><span class="ql-countdown-time">' +
      timeStr +
      '</span></div><div class="ql-trial-bar"><div class="ql-trial-bar-fill' +
      urgentClass +
      '" style="width:' +
      pct +
      '%"></div></div>';
  }
  update();
  if (window.qlCountdownInterval) clearInterval(window.qlCountdownInterval);
  window.qlCountdownInterval = setInterval(update, 1000);
}

function setupMinimize() {
  const btn = document.getElementById("ql-minimize");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const box = document.getElementById("ql-floating");
    if (!box) return;
    qlMinimized = !qlMinimized;
    box.classList.toggle("ql-minimized", qlMinimized);
    btn.innerHTML = qlMinimized ? SVG_ICONS.square : SVG_ICONS.minus;
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      chrome.storage.local.set({ ql_minimized: qlMinimized });
    }
  });
}

function setupDarkMode() {
  // Using delegation to handle all current and future theme buttons
  document.removeEventListener("click", handleThemeClick);
  document.addEventListener("click", handleThemeClick);
}

function handleThemeClick(e) {
  const themeBtn = e.target.closest("#ql-theme-btn");
  if (!themeBtn) return;
  e.stopPropagation();

  const box = document.getElementById("ql-floating");
  if (!box) return;
  forcePopupRgbOn(box);
}

function setupScriptsToggle() {
  const btn = document.getElementById("ql-toggle-scripts");
  const section = document.getElementById("ql-shortcuts-section");
  if (!btn || !section) return;
  btn.addEventListener("click", () => {
    const isShown = section.classList.toggle("ql-show");
    btn.classList.toggle("ql-scripts-btn-active", isShown);
  });
}

function setupShield() {
  const btn = document.getElementById("ql-shield-btn");
  if (!btn) return;

  chrome.storage.local.get(["ql_shield_active"], (res) => {
    if (res.ql_shield_active === true) {
      qlShieldActive = true;
      btn.classList.add("ql-shield-active");
      const label = document.getElementById("ql-shield-label");
      if (label) label.textContent = "Desativar Escudo";
      injectShieldOverlay();
    }
  });

  btn.addEventListener("click", () => {
    qlShieldActive = !qlShieldActive;
    chrome.storage.local.set({ ql_shield_active: qlShieldActive });

    const label = document.getElementById("ql-shield-label");
    if (qlShieldActive) {
      btn.classList.add("ql-shield-active");
      if (label) label.textContent = "Desativar Escudo";
      injectShieldOverlay();
      showCustomAlert("Escudo Ativado", "O input do Lovable está bloqueado. Use a extensão para enviar prompts.");
    } else {
      btn.classList.remove("ql-shield-active");
      if (label) label.textContent = "Ativar Escudo";
      removeShieldOverlay();
      showCustomAlert("Escudo Desativado", "O input do Lovable está liberado novamente.");
    }
  });
}

function injectShieldOverlay() {
  if (document.getElementById("ql-shield-overlay")) return;

  const chatInputContainer = document.querySelector("form#chat-input")?.parentElement;
  const chatForm = document.querySelector("form#chat-input");

  if (!chatForm) {
    setTimeout(injectShieldOverlay, 1000);
    return;
  }

  const target = chatInputContainer || chatForm;
  const existingPos = getComputedStyle(target).position;
  if (existingPos === "static") {
    target.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.id = "ql-shield-overlay";
  chrome.storage.local.get(["ql_dark_mode"], (res) => {
    if (res.ql_dark_mode === true) overlay.classList.add("ql-dark");
    else overlay.classList.add("ql-light");
  });
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:9999;background:rgba(10,3,24,0.7);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;border-radius:18px;border:2px solid rgba(191,0,255,0.4);cursor:not-allowed;pointer-events:all;box-shadow:inset 0 0 30px rgba(191,0,255,0.1);";
  overlay.innerHTML = `
    <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 100%;">
      <div style="width: 52px; height: 52px; background: var(--ql-primary-glow); border: 1px solid var(--ql-primary-border); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; filter: drop-shadow(0 0 12px var(--ql-primary-glow))">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--ql-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div style="color:#fff; font-size:15px; font-weight:900; letter-spacing: 1px; text-transform: uppercase; text-shadow: 0 0 10px var(--ql-primary-glow);">ESCUDO ATIVO</div>
      <div style="color:var(--ql-text-sub); font-size:12px; font-weight:600; opacity: 0.8;">Entrada bloqueada para sua segurança</div>
    </div>
  `;

  overlay.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  chatForm.style.position = "relative";
  chatForm.appendChild(overlay);

  const inputs = chatForm.querySelectorAll("input, button, textarea, [contenteditable]");
  inputs.forEach((el) => {
    if (el.id !== "ql-shield-overlay") {
      el.dataset.qlShieldDisabled = el.disabled || "";
      el.dataset.qlShieldTabindex = el.getAttribute("tabindex") || "";
      el.setAttribute("tabindex", "-1");
      if (el.tagName !== "DIV") el.disabled = true;
      if (el.contentEditable === "true") {
        el.contentEditable = "false";
        el.dataset.qlShieldEditable = "true";
      }
    }
  });
}

function removeShieldOverlay() {
  const overlay = document.getElementById("ql-shield-overlay");
  if (overlay) overlay.remove();

  const chatForm = document.querySelector("form#chat-input");
  if (!chatForm) return;

  const inputs = chatForm.querySelectorAll("[data-ql-shield-disabled]");
  inputs.forEach((el) => {
    const wasDis = el.dataset.qlShieldDisabled;
    if (wasDis === "true") el.disabled = true;
    else if (wasDis === "" || wasDis === "false") el.disabled = false;
    delete el.dataset.qlShieldDisabled;

    const oldTab = el.dataset.qlShieldTabindex;
    if (oldTab) el.setAttribute("tabindex", oldTab);
    else el.removeAttribute("tabindex");
    delete el.dataset.qlShieldTabindex;

    if (el.dataset.qlShieldEditable === "true") {
      el.contentEditable = "true";
      delete el.dataset.qlShieldEditable;
    }
  });
}

function startHeartbeat(licenseKey) {
  if (qlHeartbeatInterval) clearInterval(qlHeartbeatInterval);

  qlHeartbeatInterval = setInterval(async () => {
    try {
      const data = await bgFetch(VALIDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          session_id: qlSessionId,
          heartbeat: true,
          device_id: qlDeviceId,
        }),
      });

      if (!data.valid) {
        clearInterval(qlHeartbeatInterval);
        const msg = data.reason === "device_conflict" ? data.message : null;
        chrome.storage.local.set(
          { ql_logout_reason: data.reason || "invalid", ql_logout_message: msg || "" },
          () => {
            chrome.storage.local.remove(
              [
                "ql_license_valid",
                "ql_license_key",
                "ql_session_id",
                "ql_user_name",
                "ql_expires_at",
                "ql_activated_at",
                "ql_license_status",
              ],
              () => {
                const box = document.getElementById("ql-floating");
                if (box) showLicenseGate(box);
                if (msg) setTimeout(() => showCustomAlert("Acesso Negado", msg), 500);
                setTimeout(() => {
                  try { chrome.storage.local.remove(["ql_logout_reason", "ql_logout_message"]); } catch (_) {}
                }, 3000);
              },
            );
          },
        );
        return;
      }

      qlOnlineCount = data.online_count || 0;
      const countEl = document.getElementById("ql-online-count");
      if (countEl) countEl.textContent = qlOnlineCount;

      if (data.user_name) {
        qlUserName = data.user_name;
        qlLicenseStatus = data.status || qlLicenseStatus;
        qlExpiresAt = data.expires_at || qlExpiresAt;
        qlActivatedAt = data.activated_at || qlActivatedAt;
        if (typeof chrome !== "undefined" && chrome.runtime?.id) {
          chrome.storage.local.set({
            ql_user_name: qlUserName,
            ql_license_status: qlLicenseStatus,
            ql_expires_at: qlExpiresAt,
            ql_activated_at: qlActivatedAt,
          });
        }
        const nameEl = document.querySelector(".ql-profile-name");
        if (nameEl) nameEl.textContent = data.user_name;
      }
    } catch (err) {
      if (err.message?.includes("Extension context invalidated")) {
        if (qlHeartbeatInterval) clearInterval(qlHeartbeatInterval);
        return;
      }
      console.warn("[QL] Heartbeat error", err);
    }
  }, 60000);
}

let qlExpiredHandled = false;

function handleLicenseExpired() {
  if (qlExpiredHandled) return;
  qlExpiredHandled = true;
  if (qlHeartbeatInterval) clearInterval(qlHeartbeatInterval);
  if (window.qlCountdownInterval) clearInterval(window.qlCountdownInterval);

  const overlay = document.createElement("div");
  overlay.className = "ql-sweetalert-overlay";
  overlay.innerHTML = templateExpiredOverlay();

  const box = document.getElementById("ql-floating");
  if (box) box.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("ql-sweetalert-visible"));

  const renewBtn = overlay.querySelector("#ql-sweetalert-renew");
  if (renewBtn) {
    renewBtn.addEventListener("click", () => {
      overlay.remove();
      if (box) showPaymentUI(box);
    });
  }

  const closeBtn = overlay.querySelector("#ql-sweetalert-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      overlay.classList.remove("ql-sweetalert-visible");
      setTimeout(() => {
        overlay.remove();
        chrome.storage.local.remove(
          ["ql_license_valid", "ql_license_key", "ql_session_id", "ql_user_name", "ql_expires_at", "ql_license_status"],
          () => {
            if (box) showLicenseGate(box);
          },
        );
      }, 300);
    });
  }
}

async function showPaymentUI(box, preselectedPkg) {
  if (preselectedPkg) {
    showCheckoutScreen(box, preselectedPkg);
    return;
  }

  box.innerHTML = templatePaymentUI(qlMinimized);

  setupMinimize();
  setupDrag();
  setupResize();

  const backBtn = document.getElementById("ql-pay-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      chrome.storage.local.get(["ql_license_valid"], (res) => {
        if (res.ql_license_valid) showMainUI(box);
        else showLicenseGate(box);
      });
    });
  }

  try {
    const packages = await bgFetch(PACKAGES_URL, {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
    });

    const list = document.getElementById("ql-packages-list");
    if (!list) return;
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      list.innerHTML = '<div class="ql-pay-loading">Nenhum plano disponível.</div>';
      return;
    }

    list.innerHTML = packages.map((pkg) => templatePackageCard(pkg)).join("");

    list.querySelectorAll(".ql-pkg-card").forEach((card) => {
      card.querySelector(".ql-pkg-select-btn").addEventListener("click", () => {
        const pkg = {
          id: card.getAttribute("data-pkg-id"),
          name: card.getAttribute("data-pkg-name"),
          price: card.getAttribute("data-pkg-price"),
        };
        showCheckoutScreen(box, pkg);
      });
    });
  } catch (err) {
    console.error("[QL] Package load error:", err);
    const list = document.getElementById("ql-packages-list");
    if (list) list.innerHTML = '<div class="ql-pay-loading">Erro ao carregar planos. Tente novamente.</div>';
  }
}

function showCheckoutScreen(box, pkg) {
  box.innerHTML = templateCheckoutScreen(pkg, qlMinimized);

  setupMinimize();
  setupDrag();
  setupResize();

  let selectedMethod = "mpesa";

  const backBtn = document.getElementById("ql-checkout-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => showPaymentUI(box));
  }

  document.querySelectorAll(".ql-method-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ql-method-btn").forEach((b) => b.classList.remove("ql-method-active"));
      btn.classList.add("ql-method-active");
      selectedMethod = btn.getAttribute("data-method");
      const hint = document.getElementById("ql-phone-hint");
      if (hint) hint.textContent = selectedMethod === "mpesa" ? "M-Pesa: 84 ou 85" : "e-Mola: 86 ou 87";
    });
  });

  const confirmBtn = document.getElementById("ql-confirm-pay");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      const phone = (document.getElementById("ql-pay-phone") || {}).value
        ? (document.getElementById("ql-pay-phone") || {}).value.replace(/\D/g, "")
        : "";
      const log = document.getElementById("ql-pay-log");

      if (phone.length !== 9) {
        if (log) {
          log.className = "ql-pay-log ql-pay-error";
          log.textContent = "Número deve ter 9 dígitos.";
        }
        return;
      }
      const prefix = phone.substring(0, 2);
      if (selectedMethod === "mpesa" && !["84", "85"].includes(prefix)) {
        if (log) {
          log.className = "ql-pay-log ql-pay-error";
          log.textContent = "M-Pesa: use 84 ou 85.";
        }
        return;
      }
      if (selectedMethod === "emola" && !["86", "87"].includes(prefix)) {
        if (log) {
          log.className = "ql-pay-log ql-pay-error";
          log.textContent = "e-Mola: use 86 ou 87.";
        }
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = SVG_ICONS.loader + " Processando...";
      if (log) {
        log.className = "ql-pay-log ql-pay-info";
        log.textContent = "Enviando solicitação de pagamento...";
      }

      try {
        const storageData = await new Promise((r) => chrome.storage.local.get(["ql_license_key"], r));
        const licenseKey = storageData.ql_license_key || "";

        const result = await bgFetch(EXT_PAYMENT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({
            packageId: pkg.id,
            numero: phone,
            metodo: selectedMethod,
            license_key: licenseKey || undefined,
          }),
        });

        if (result && result.status === "sucesso") {
          const bodyEl = document.getElementById("ql-body");
          if (bodyEl) {
            bodyEl.innerHTML = templatePaymentSuccess(result.license_key);

            const copyBtn = document.getElementById("ql-copy-key");
            if (copyBtn) {
              copyBtn.addEventListener("click", () => {
                navigator.clipboard
                  .writeText(result.license_key)
                  .then(() => {
                    copyBtn.innerHTML = SVG_ICONS.check + " Copiado!";
                    setTimeout(() => {
                      copyBtn.innerHTML = SVG_ICONS.fileText + " Copiar Chave";
                    }, 2000);
                  })
                  .catch(() => {
                    const keyEl = document.getElementById("ql-new-key");
                    if (keyEl) {
                      const r = document.createRange();
                      r.selectNodeContents(keyEl);
                      window.getSelection().removeAllRanges();
                      window.getSelection().addRange(r);
                    }
                    copyBtn.textContent = "Seleccionado — Ctrl+C";
                  });
              });
            }

            const activateBtn = document.getElementById("ql-activate-key");
            if (activateBtn) {
              activateBtn.addEventListener("click", () => {
                chrome.storage.local.set(
                  {
                    ql_license_valid: true,
                    ql_license_key: result.license_key,
                    ql_expires_at: result.expires_at || null,
                    ql_license_status: "active",
                    ql_session_id: null,
                  },
                  () => {
                    qlExpiresAt = result.expires_at || null;
                    qlLicenseStatus = "active";
                    qlExpiredHandled = false;
                    showMainUI(box);
                    startHeartbeat(result.license_key);
                  },
                );
              });
            }
          }
        } else {
          const errMsg = result && result.error ? result.error : "Pagamento falhou. Tente novamente.";
          if (log) {
            log.className = "ql-pay-log ql-pay-error";
            log.innerHTML = SVG_ICONS.close + " " + errMsg;
          }
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = SVG_ICONS.chart + " Pagar " + pkg.price + " MZN";
        }
      } catch (err) {
        if (log) {
          log.className = "ql-pay-log ql-pay-error";
          log.textContent = "✗ " + (err.message || "Erro de conexão.");
        }
        confirmBtn.disabled = false;
        confirmBtn.textContent = "💰 Pagar " + pkg.price + " MZN";
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(createUI, 120));
} else {
  setTimeout(createUI, 120);
}

let tries = 0;
const retryInterval = setInterval(() => {
  if (document.getElementById("ql-floating") || tries >= 8) {
    clearInterval(retryInterval);
    return;
  }
  tries++;
  createUI();
}, 800);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.ql_sidebar_mode) {
    if (changes.ql_sidebar_mode.newValue === true) {
      const floatingBox = document.getElementById("ql-floating");
      if (floatingBox) {
        floatingBox.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        floatingBox.style.opacity = "0";
        floatingBox.style.transform = "scale(0.95)";
        setTimeout(() => floatingBox.remove(), 350);
      }
    } else if (changes.ql_sidebar_mode.newValue === false) {
      chrome.storage.local.get(["ql_native_chat"], (res) => {
        if (res.ql_native_chat === true) return;

        setTimeout(() => {
          _buildFloatingUI();
          setTimeout(() => {
            const floatingBox = document.getElementById("ql-floating");
            if (floatingBox) {
              floatingBox.style.opacity = "0";
              floatingBox.style.transform = "scale(0.95) translateX(20px)";
              requestAnimationFrame(() => {
                floatingBox.style.transition = "opacity 0.4s ease, transform 0.4s ease";
                floatingBox.style.opacity = "1";
                floatingBox.style.transform = "scale(1) translateX(0)";
              });
            }
          }, 50);
        }, 100);
      });
    }
  }
  if (changes.ql_shield_active) {
    qlShieldActive = changes.ql_shield_active.newValue;
    if (qlShieldActive) injectShieldOverlay();
    else removeShieldOverlay();
  }
  if (changes.ql_native_chat) {
    if (changes.ql_native_chat.newValue === true) activateNativeChat();
    else deactivateNativeChat();
  }
});

function updateSyncStatus() {
  chrome.storage.local.get(["lovable_projectId", "lovable_token"], (res) => {
    const status = document.getElementById("ql-sync-status");
    if (!status) return;
    if (res.lovable_projectId && res.lovable_token) {
      status.className = "ql-sync-status ql-sync-ok";
      const pid = res.lovable_projectId.substring(0, 6);
      status.innerHTML = '<span class="ql-sync-text">' + SVG_ICONS.checkCircle + ' Sincronizado! Projeto: ' + pid + "...</span>";
    } else {
      status.className = "ql-sync-status ql-sync-waiting";
      status.innerHTML = '<span class="ql-sync-text">' + SVG_ICONS.loader + ' Aguardando sincronização...</span>';
    }
  });
}

function setupStorageWatch() {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lovable_projectId || changes.lovable_token) {
      updateSyncStatus();
    }
  });
}

function requestLatestTokenFromHook(timeoutMs = 1200) {
  return new Promise((resolve) => {
    let finished = false;

    function finish(updated) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(onStorageChange);
      resolve(updated);
    }

    function onStorageChange(changes, area) {
      if (area !== "local") return;
      if (changes.lovable_token && changes.lovable_token.newValue) {
        finish(true);
      }
    }

    const timer = setTimeout(() => finish(false), Math.max(300, timeoutMs));
    chrome.storage.onChanged.addListener(onStorageChange);

    try {
      window.postMessage({ type: "lovableRequestToken" }, "*");
      setTimeout(() => window.postMessage({ type: "lovableRequestToken" }, "*"), 120);
    } catch (e) {
      finish(false);
    }
  });
}

// ===== CHAT HISTORY SYSTEM (Floating Popup) =====
function loadChatHistory(cb) {
  chrome.storage.local.get([QL_HISTORY_KEY], (res) => {
    qlChatHistory = res[QL_HISTORY_KEY] || [];
    updateHistoryBadge();
    if (cb) cb();
  });
}

function saveChatHistory() {
  if (qlChatHistory.length > QL_MAX_HISTORY) qlChatHistory = qlChatHistory.slice(-QL_MAX_HISTORY);
  chrome.storage.local.set({ [QL_HISTORY_KEY]: qlChatHistory });
}

function addToChatHistory(text, status) {
  qlChatHistory.push({ text: text, timestamp: new Date().toISOString(), status: status || "ok" });
  saveChatHistory();
  updateHistoryBadge();
}

function updateHistoryBadge() {
  const badge = document.getElementById("ql-history-badge");
  if (!badge) return;
  if (qlChatHistory.length > 0) {
    badge.textContent = qlChatHistory.length;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

function formatChatDate(dateStr) {
  var d = new Date(dateStr);
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var diff = (today - msgDay) / 86400000;
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getDay()];
  return d.toLocaleDateString("pt-BR");
}

function formatChatTime(dateStr) {
  var d = new Date(dateStr);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function renderHistoryView() {
  const container = document.getElementById("ql-tab-content");
  if (!container) return;

  if (!qlChatHistory.length) {
    container.innerHTML =
      '<div class="ql-chat-empty"><div style="font-size:28px;margin-bottom:8px;color:var(--ql-primary)">' + SVG_ICONS.msgSquare.replace('width="14"','width="32"').replace('height="14"','height="32"') + '</div><div style="font-size:13px;font-weight:600;color:var(--ql-text-primary,#f4f4f5)">Nenhuma mensagem</div><div style="font-size:11px;color:var(--ql-text-muted,#71717a);margin-top:4px">Seus prompts enviados aparecerão aqui.</div></div>';
    return;
  }

  let html = '<div class="ql-chat-messages">';
  let lastDate = "";
  for (let i = 0; i < qlChatHistory.length; i++) {
    const m = qlChatHistory[i];
    const dateLabel = formatChatDate(m.timestamp);
    if (dateLabel !== lastDate) {
      html += '<div class="ql-chat-date-divider"><span class="ql-chat-date-label">' + dateLabel + "</span></div>";
      lastDate = dateLabel;
    }
    const statusClass = m.status === "error" ? "ql-chat-status-err" : "ql-chat-status-ok";
    const statusText = m.status === "error" ? SVG_ICONS.close + " Erro" : SVG_ICONS.check + " Enviado";
    const truncated = m.text.length > 300 ? escapeHtml(m.text.substring(0, 300)) + "…" : escapeHtml(m.text);
    html +=
      '<div class="ql-chat-bubble" title="' +
      escapeHtml(m.text) +
      '">' +
      truncated +
      '<div class="ql-chat-meta"><span class="' +
      statusClass +
      '">' +
      statusText +
      '</span><span class="ql-chat-time">' +
      formatChatTime(m.timestamp) +
      "</span></div></div>";
  }
  html += "</div>";
  html +=
    '<div class="ql-chat-actions"><span class="ql-chat-count">' +
    qlChatHistory.length +
    " mensagen" +
    (qlChatHistory.length === 1 ? "" : "s") +
    '</span><button class="ql-chat-clear" id="ql-chat-clear">🗑 Limpar</button></div>';
  container.innerHTML = html;

  const msgs = container.querySelector(".ql-chat-messages");
  if (msgs) msgs.scrollTop = msgs.scrollHeight;

  const clearBtn = document.getElementById("ql-chat-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      qlChatHistory = [];
      saveChatHistory();
      updateHistoryBadge();
      renderHistoryView();
    });
  }
}

function renderPromptView() {
  const container = document.getElementById("ql-tab-content");
  if (!container) return;
  // Restore prompt tab content
  container.innerHTML =
    '<textarea id="ql-msg" rows="3" placeholder="Digite seu comando..." spellcheck="false"></textarea>' +
    '<div id="ql-attach-preview" class="ql-attach-preview" style="display:none"></div>' +
    '<div id="ql-shortcuts-section" class="ql-shortcuts-section">' +
    '<span class="ql-shortcuts-title">Scripts Rápidos</span>' +
    '<div class="ql-shortcuts-grid" id="ql-chips"></div>' +
    "</div>" +
    '<div class="ql-action-bar">' +
    '<div class="ql-action-left">' +
    '<button id="ql-toggle-scripts" class="ql-scripts-btn" title="Scripts Rápidos">🚀 Scripts</button>' +
    "</div>" +
    '<div class="ql-action-center">' +
    '<button id="ql-attach-btn" class="ql-attach-btn" title="Anexar arquivo (máx. 10)">📎</button>' +
    '<button id="ql-optimize-btn" class="ql-tool-btn" title="Otimizar com IA">' +
    SVG_ICONS.sparkles +
    "</button>" +
    '<button id="ql-speech-btn" class="ql-tool-btn" title="Voz para texto">' +
    SVG_ICONS.mic +
    "</button>" +
    "</div>" +
    '<div class="ql-action-right-send">' +
    '<button id="ql-send" class="ql-send-btn">Enviar</button>' +
    "</div>" +
    "</div>" +
    '<input type="file" id="ql-file-input" multiple style="display:none" accept="*/*">' +
    '<div id="ql-log"></div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">' +
    '<button id="ql-new-project-btn" style="height: 38px; background: var(--ql-primary-glow); border: 1px solid var(--ql-primary-border); border-radius: 12px; color: #fff; font-weight: 700; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">' +
    "<span>➕</span> Novo Projeto" +
    "</button>" +
    '<button id="ql-remove-watermark" class="ql-watermark-btn" style="margin-top: 0;">🚫 Remover marca D\'água</button>' +
    "</div>" +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">' +
    '<button id="ql-shield-btn" class="ql-shield-btn" style="margin-top: 0;">' +
    SVG_ICONS.shield +
    ' <span id="ql-shield-label">Ativar Escudo</span>' +
    "</button>" +
    '<button id="ql-native-chat-btn" class="ql-native-chat-btn" style="margin-top: 0;">' +
    SVG_ICONS.msgSquare +
    " Usar Chat Nativo" +
    "</button>" +
    "</div>";
  // Re-setup all prompt tab features
  setupSend();
  setupSuggestionChips();
    setupWatermarkButton();
    setupOptimize();
    setupSpeech();
    setupDownloadProjectButton();
  setupScriptsToggle();
  setupFileAttachment();
  setupNewProject();
  setupShield();
  setupNativeChatButton();
}

// setupTabs moved to bottom

// ===== FILE ATTACHMENT SYSTEM (v5) =====
const MAX_FILES = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
// qlAttachedFiles já declarado no topo do ficheiro

function genFileId() {
  return "ql_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function createFileObjectURL(file) {
  try {
    return URL.createObjectURL(file);
  } catch (e) {
    console.warn("[QL Attach] createObjectURL failed:", e);
    return null;
  }
}

function revokeFileEntry(entry) {
  if (entry && entry.objectUrl) {
    try {
      URL.revokeObjectURL(entry.objectUrl);
    } catch (e) {}
    entry.objectUrl = null;
  }
  if (entry && entry.previewUrl && entry.previewUrl !== entry.objectUrl) {
    try {
      URL.revokeObjectURL(entry.previewUrl);
    } catch (e) {}
    entry.previewUrl = null;
  }
}

// Constrói array de {name, type, url} prontos para envio
async function buildFilesPayload(attachedFiles) {
  const result = [];
  for (const entry of attachedFiles) {
    if (entry.uploading || entry.uploadFailed || !entry.publicUrl) continue;

    let type = "file";
    if (UploadManager.isImageType(entry.file_type)) type = "image";
    else if (UploadManager.isVideoType(entry.file_type)) type = "video";

    result.push({
      name: entry.file_name,
      type: type,
      url: entry.publicUrl,
    });
  }
  return result;
}

function renderAttachPreview() {
  const container = document.getElementById("ql-attach-preview");
  const countBar = document.getElementById("ql-attach-count-bar");
  const countEl = document.getElementById("ql-attach-count");
  const badge = document.getElementById("ql-attach-badge");

  if (!container) return;

  if (qlAttachedFiles.length === 0) {
    container.style.display = "none";
    container.innerHTML = "";
    if (countBar) countBar.style.display = "none";
    if (badge) badge.style.display = "none";
    return;
  }

  container.style.display = "flex";
  if (countBar) countBar.style.display = "flex";
  if (countEl) countEl.textContent = qlAttachedFiles.length;
  if (badge) {
    badge.style.display = "flex";
    badge.textContent = qlAttachedFiles.length;
  }

  container.innerHTML = qlAttachedFiles
    .map((f, i) => {
      const isImg = isImageType(f.file_type);
      const uploadingClass = f.uploading ? " ql-attach-uploading" : "";
      const failedClass = f.uploadFailed ? " ql-attach-failed" : "";
      const doneClass = !f.uploading && !f.uploadFailed ? " ql-attach-done" : "";

      let thumbHtml;
      if (isImg && f.previewUrl) {
        thumbHtml = `<div class="ql-attach-thumb-wrap">
        <img class="ql-attach-thumb" src="${escapeHtml(f.previewUrl)}" alt="${escapeHtml(f.file_name)}" loading="lazy">
        ${f.uploading ? '<div class="ql-attach-spinner-overlay"><div class="ql-attach-spin"></div></div>' : ""}
        ${f.uploadFailed ? '<div class="ql-attach-err-overlay">⚠️</div>' : ""}
      </div>`;
      } else {
        const icon = typeof getFileIcon !== "undefined" ? getFileIcon(f.file_type) : "📄";
        thumbHtml = `<div class="ql-attach-icon-wrap">
        <span class="ql-attach-file-icon">${icon}</span>
        ${f.uploading ? '<div class="ql-attach-spinner-overlay"><div class="ql-attach-spin"></div></div>' : ""}
        ${f.uploadFailed ? '<div class="ql-attach-err-overlay">⚠️</div>' : ""}
      </div>`;
      }

      const statusDot = f.uploading
        ? '<span class="ql-attach-status ql-attach-status-uploading" title="Convertendo...">⏳</span>'
        : f.uploadFailed
          ? '<span class="ql-attach-status ql-attach-status-failed" title="Falha ao processar arquivo">⚠</span>'
          : '<span class="ql-attach-status ql-attach-status-ok" title="Pronto para envio">✓</span>';

      return `<div class="ql-attach-item${uploadingClass}${failedClass}${doneClass}" data-uid="${escapeHtml(f.uid)}" data-idx="${i}">
      ${thumbHtml}
      <div class="ql-attach-info">
        <span class="ql-attach-name" title="${escapeHtml(f.file_name)}">${escapeHtml(f.file_name.length > 16 ? f.file_name.substring(0, 14) + "…" : f.file_name)}</span>
        <span class="ql-attach-size">${escapeHtml(f.sizeLabel)}</span>
        ${statusDot}
      </div>
      <button class="ql-attach-remove" data-idx="${i}" title="Remover">✕</button>
    </div>`;
    })
    .join("");

  // Remove handlers
  container.querySelectorAll(".ql-attach-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-idx"));
      if (!isNaN(idx) && qlAttachedFiles[idx]) {
        revokeFileEntry(qlAttachedFiles[idx]);
        qlAttachedFiles.splice(idx, 1);
        renderAttachPreview();
      }
    });
  });

  // Clear all
  const clearAllBtn = document.getElementById("ql-attach-clear-all");
  if (clearAllBtn) {
    clearAllBtn.onclick = () => {
      qlAttachedFiles.forEach((f) => revokeFileEntry(f));
      qlAttachedFiles = [];
      renderAttachPreview();
    };
  }
}

// Core function to process a list of File objects (from input or drop)
async function processAttachFiles(files) {
  if (!files || !files.length) return;

  for (const file of files) {
    // ── Validações ──
    const isDuplicate = qlAttachedFiles.some((f) => f.file_name === file.name && f.rawSize === file.size);
    if (isDuplicate) {
      showFileToast("Duplicado: " + file.name + " já foi anexado.", "warn");
      continue;
    }

    if (qlAttachedFiles.length >= MAX_FILES) {
      showFileToast("Limite de " + MAX_FILES + " arquivos atingido.", "error");
      break;
    }

    if (file.size > MAX_FILE_SIZE) {
      showFileToast("❌ " + file.name + " excede 100MB (" + UploadManager.formatFileSize(file.size) + ")", "error");
      continue;
    }

    const mimeType = file.type || UploadManager.guessMimeFromName?.(file.name) || "application/octet-stream";
    const isImg = UploadManager.isImageType(mimeType);
    const isVid = UploadManager.isVideoType(mimeType);

    // ── Entrada imediata no array com spinner ──
    const objectUrl = createFileObjectURL(file);
    const entry = {
      uid: genFileId(),
      file_name: file.name,
      file_type: mimeType,
      rawSize: file.size,
      sizeLabel: UploadManager.formatFileSize(file.size),
      objectUrl: objectUrl,
      previewUrl: isImg || isVid ? objectUrl : null,
      uploading: true,
      uploadFailed: false,
      rawFile: file,
      publicUrl: null,
    };

    qlAttachedFiles.push(entry);
    renderAttachPreview();

    // ── Processamento assíncrono (Upload para Storage) ──
    (async (e) => {
      try {
        // Obter userId do token se possível para organizar o storage
        let userId = "public";
        try {
          const sd = await new Promise((r) => chrome.storage.local.get(["lovable_token"], r));
          if (sd.lovable_token) {
            const decoded = decodeJwtPayload(sd.lovable_token);
            userId = decoded?.sub || decoded?.user_id || "authenticated";
          }
        } catch (err) {}

        // Fazer upload real para o Supabase Storage
        const result = await UploadManager.uploadFile(e.rawFile, userId);
        e.publicUrl = result.url;
        e.file_id = result.file_id;
        e.uploadFailed = false;
      } catch (err) {
        console.error("[QL Attach] Erro no upload:", err);
        e.uploadFailed = true;
        showFileToast("Falha no upload: " + e.file_name, "error");
      } finally {
        e.uploading = false;
        renderAttachPreview();
      }
    })(entry);
  }
}

function guessMimeFromName(name) {
  if (!name) return "application/octet-stream";
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext] || "application/octet-stream";
}

// Small inline toast for file feedback (distinct from main toast)
function showFileToast(msg, type) {
  const log = document.getElementById("ql-response-area");
  if (!log) {
    showCustomAlert("Arquivo", msg);
    return;
  }

  log.style.display = "block";
  log.className = type === "error" ? "ql-log-error" : type === "warn" ? "ql-log-info" : "ql-log-success";
  const icon = type === "error" ? SVG_ICONS.ban : type === "warn" ? SVG_ICONS.alertCircle : SVG_ICONS.check;
  log.innerHTML = `<span style="display:flex;align-items:center;gap:6px">${icon} ${msg}</span>`;
  clearTimeout(log._toastTimer);
  log._toastTimer = setTimeout(() => {
    log.style.display = "none";
    log.textContent = "";
  }, 3500);
}

function setupFileAttachment() {
  const attachBtn = document.getElementById("ql-attach-btn");
  const fileInput = document.getElementById("ql-file-input");
  const dropZone = document.getElementById("ql-drop-zone");
  const textarea = document.getElementById("ql-msg");

  if (attachBtn && fileInput) {
    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const files = Array.from(fileInput.files);
      if (files.length) processFiles(files);
      fileInput.value = "";
    };
  }

  // Unified Drag & Drop
  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("ql-drop-zone-active");
    });

    ["dragleave", "drop"].forEach((evt) => {
      dropZone.addEventListener(evt, () => dropZone.classList.remove("ql-drop-zone-active"));
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length) processFiles(files);
    });
  }

  // Clip (Paste)
  if (textarea) {
    textarea.addEventListener("paste", (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      const files = [];
      for (const item of items) {
        if (item.kind === "file") files.push(item.getAsFile());
      }
      if (files.length) processFiles(files);
    });
  }
}

function setupNewProject() {
  const btn = document.getElementById("ql-new-project-btn");
  if (btn) {
    btn.onclick = async () => {
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        '<span style="display:inline-flex; vertical-align:middle; margin-right:4px;">' +
        SVG_ICONS.clock +
        "</span> Criando...";
      try {
        const projectId = await createLovableProject();
        window.open(`https://lovable.dev/projects/${projectId}`, "_blank");
      } catch (err) {
        showCustomAlert("Erro", err.message || "Falha ao criar projeto.");
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    };
  }
}

async function createLovableProject() {
  const sd = await new Promise((r) => chrome.storage.local.get([
    "ql_license_key", "ql_hw_fingerprint", "lovable_workspaceId",
  ], r));
  const licenseKey = sd.ql_license_key || "";
  if (!licenseKey) throw new Error("Licença não encontrada. Faça login na extensão.");
  let deviceId = sd.ql_hw_fingerprint || (typeof qlDeviceId !== "undefined" ? qlDeviceId : "") || "";
  if (!deviceId && typeof getDeviceId === "function") { try { deviceId = await getDeviceId(); } catch (_) {} }

  // 1) Validate license (cheap) via cp in validate_only mode.
  const lic = await bgFetch(CREATE_PROJECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, "x-license-key": licenseKey },
    body: JSON.stringify({ device_id: deviceId, validate_only: true }),
  });
  if (!lic || !lic.success) {
    throw new Error(lic?.error_display || lic?.error || "Licença inválida.");
  }

  // 2) Create project NATIVELY from the lovable.dev page (Castle token validates browser fingerprint).
  const name = "Hyper-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const reqId = "cp_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  const result = await new Promise((resolve, reject) => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== "lovableCreateProjectNativeResponse") return;
      if (event.data.reqId !== reqId) return;
      window.removeEventListener("message", handler);
      resolve(event.data);
    };
    window.addEventListener("message", handler);
    window.postMessage({
      type: "lovableCreateProjectNative",
      reqId, name,
      workspaceId: (sd.lovable_workspaceId || "").trim() || undefined,
    }, "*");
    setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Timeout ao criar projeto via lovable.dev."));
    }, 30000);
  });

  if (!result.ok) {
    const msg = result?.data?.message || result?.data?.error || result?.error || `HTTP ${result.status}`;
    throw new Error(`Falha ao criar projeto: ${msg}`);
  }
  const project = result.data;
  const projectId = project?.id || project?.project_id;
  if (!projectId) throw new Error("ID do projeto não retornado.");
  return projectId;
}

async function processFiles(files) {
  if (qlNativeChatActive) {
    showCustomAlert("Atenção", "Para enviar arquivos, utilize o modo pop-up ou o painel lateral da extensão.");
    return;
  }
  const MAX_FILES = 15;
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB

  for (const file of files) {
    if (qlAttachedFiles.length >= MAX_FILES) break;
    if (file.size > MAX_SIZE) {
      showCustomAlert("Arquivo Grande", `${file.name} excede o limite de 25MB.`);
      continue;
    }

    const entry = {
      id: Math.random().toString(36).slice(2, 9),
      name: file.name,
      type: file.type,
      size: UploadManager.formatFileSize(file.size),
      status: "uploading",
      url: null,
      previewUrl: null,
    };

    if (UploadManager.isImageType(file.type)) {
      entry.previewUrl = URL.createObjectURL(file);
    }

    qlAttachedFiles.push(entry);
    renderAttachments();

    // Start upload
    (async () => {
      try {
        const sd = await new Promise((r) => chrome.storage.local.get(["lovable_token"], r));
        let userId = "public";
        if (sd.lovable_token) {
          try {
            const decoded = JSON.parse(atob(sd.lovable_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            userId = decoded?.sub || decoded?.user_id || "authenticated";
          } catch (err) {}
        }

        const result = await UploadManager.uploadFile(file, userId);
        entry.url = result.url;
        entry.file_id = result.file_id;
        entry.status = "done";
      } catch (err) {
        console.error("Upload failed:", err);
        entry.status = "error";
      } finally {
        renderAttachments();
        // Sync with Build/Lovable
        chrome.storage.local.set({
          ql_current_attachments: qlAttachedFiles.map((f) => ({ url: f.url, file_id: f.file_id, name: f.name, type: f.type })),
        });
      }
    })();
  }
}

function renderAttachments() {
  const container = document.getElementById("ql-attach-preview");
  const badge = document.getElementById("ql-attach-badge");
  if (!container) return;

  if (qlAttachedFiles.length === 0) {
    container.style.display = "none";
    if (badge) badge.style.display = "none";
    return;
  }

  container.style.display = "flex";
  if (badge) {
    badge.style.display = "flex";
    badge.textContent = qlAttachedFiles.length;
  }

  container.innerHTML = qlAttachedFiles
    .map((f, i) => {
      const isImg = UploadManager.isImageType(f.type);
      const icon = UploadManager.getFileIcon(f.type, f.name);
      const staggerDelay = i * 0.05 + "s";

      let preview = `<div class="ql-attach-file-icon">${icon}</div>`;
      if (isImg && f.previewUrl) {
        preview = `<img src="${f.previewUrl}" class="ql-attach-thumb" />`;
      }

      return `
      <div class="ql-attach-item" style="animation-delay: ${staggerDelay}">
        <div class="ql-attach-thumb-wrap">
          ${preview}
          ${f.status === "uploading" ? '<div class="ql-attach-spinner-overlay"><div class="ql-attach-spin"></div></div>' : ""}
          ${f.status === "error" ? '<div class="ql-attach-err-overlay">⚠️</div>' : ""}
        </div>
        <button class="ql-attach-remove" data-id="${f.id}" title="Remover">✕</button>
      </div>
    `;
    })
    .join("");

  // Use addEventListener instead of inline onclick for Content Script security/scoping
  container.querySelectorAll(".ql-attach-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      removeAttachment(id);
    });
  });
}

function removeAttachment(id) {
  const idx = qlAttachedFiles.findIndex((f) => f.id === id);
  if (idx > -1) {
    if (qlAttachedFiles[idx].previewUrl) URL.revokeObjectURL(qlAttachedFiles[idx].previewUrl);
    qlAttachedFiles.splice(idx, 1);
    renderAttachments();
  }
}

function setupSend() {
  const btn = document.getElementById("ql-send-btn");
  const msgInput = document.getElementById("ql-msg");
  if (!btn || !msgInput) return;

  btn.addEventListener("click", async () => {
    const msg = msgInput.value.trim();
    const isUploading = qlAttachedFiles.some((f) => f.status === "uploading");
    if (isUploading) {
      showCustomAlert("Aguarde", "Arquivos ainda estão em upload.");
      return;
    }

    if (!msg && qlAttachedFiles.length === 0) return;

    btn.disabled = true;
    btn.textContent = "⚡ Enviando...";
    btn.classList.add("ql-send-blink");

    try {
      const doneFiles = qlAttachedFiles.filter((f) => f.status === "done" && f.url);

      const storageData = await new Promise((r) =>
        chrome.storage.local.get(["lovable_projectId", "lovable_token", "ql_license_key", "ql_session_id"], r),
      );
      let token = storageData.lovable_token || "";
      const pid = storageData.lovable_projectId || "";
      const licKey = storageData.ql_license_key || "";

      if (!pid || !token) {
        showCustomAlert("Atenção", "Projeto não sincronizado.");
        btn.disabled = false;
        btn.textContent = "Enviar";
        btn.classList.remove("ql-send-blink");
        return;
      }
      if (token.startsWith("Bearer ")) token = token.slice(7);

      const attachments = doneFiles.map((f) => ({
        url: f.url,
        optimisticImageUrl: f.url,
        file_id: f.file_id,
        name: f.name,
        type: f.type || "application/octet-stream",
      }));

      // Garante deviceId presente (evita closure-race)
      if (!qlDeviceId || (typeof qlDeviceId === 'string' && (qlDeviceId.startsWith('timeout-') || qlDeviceId.startsWith('error-')))) {
        try { qlDeviceId = await getHardwareFingerprint(); } catch(_) {}
      }

      const payload = {
        license_key: licKey,
        session_id: qlSessionId || storageData.ql_session_id,
        projeto_id: pid,
        token_lovable: token,
        mensagem: msg,
        method: await qlReadMethod(),
        attachments: attachments.length ? attachments : undefined,
        device_id: qlDeviceId || undefined,
      };

      const result = await bgFetch(PROXY_COMMAND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify(payload),
      });

      if (result && result.success === false) {
        if (result.error_code === "CAPTCHA_REQUIRED") {
          qlShowCaptchaGuide(result);
          throw new Error("Verificação de segurança necessária. Siga as instruções do modal.");
        }
        throw new Error(
          [result.error_display, result.user_action].filter(Boolean).join(" — ") || result.message || "Erro no envio",
        );
      }

      showStatusMessage("Sucesso");
      msgInput.value = "";
      qlAttachedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      qlAttachedFiles = [];
      renderAttachments();
      if (typeof addToChatHistory === "function") addToChatHistory(msg || "[Anexos]", "ok");
    } catch (err) {
      console.error("[Send] erro:", err);
      showCustomAlert("Erro", "Falha ao enviar: " + (err.message || ""));
      if (typeof addToChatHistory === "function") addToChatHistory(msg || "[Anexos]", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar";
      btn.classList.remove("ql-send-blink");
    }
  });
}

// Store references to avoid stacking listeners
let _dragCleanup = null;
let _resizeCleanup = null;

function setupDrag() {
  if (_dragCleanup) {
    _dragCleanup();
    _dragCleanup = null;
  }

  const box = document.getElementById("ql-floating");
  const header = document.getElementById("ql-header");
  if (!box || !header) return;

  let dragging = false,
    startX = 0,
    startY = 0,
    startLeft = 0,
    startTop = 0;

  function onPointerDown(e) {
    if (e.target.closest(".ql-minimize-btn") || e.target.closest(".ql-icon-btn") || e.target.closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const rect = box.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    dragging = true;
    try {
      header.setPointerCapture(e.pointerId);
    } catch (ex) {}
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e) {
    if (!dragging) return;
    let newLeft = startLeft + (e.clientX - startX);
    let newTop = startTop + (e.clientY - startY);
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - box.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - box.offsetHeight));
    box.style.left = newLeft + "px";
    box.style.top = newTop + "px";
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      header.releasePointerCapture(e.pointerId);
    } catch (ex) {}
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.body.style.userSelect = "";
  }

  header.addEventListener("pointerdown", onPointerDown, { passive: false });

  _dragCleanup = function () {
    header.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  };
}

function setupResize() {
  if (_resizeCleanup) {
    _resizeCleanup();
    _resizeCleanup = null;
  }

  const box = document.getElementById("ql-floating");
  const handle = document.getElementById("ql-resize-handle");
  if (!box || !handle) return;

  let resizing = false,
    startY = 0,
    startH = 0;

  function onDown(e) {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startY = e.clientY;
    startH = box.offsetHeight;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (ex) {}
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.body.style.userSelect = "none";
  }

  function onMove(e) {
    if (!resizing) return;
    let newH = startH + (e.clientY - startY);
    newH = Math.max(200, Math.min(newH, window.innerHeight * 0.8));
    box.style.height = newH + "px";
  }

  function onUp(e) {
    if (!resizing) return;
    resizing = false;
    qlHeight = box.offsetHeight;
    chrome.storage.local.set({ ql_height: qlHeight });
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (ex) {}
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.body.style.userSelect = "";
  }

  handle.addEventListener("pointerdown", onDown, { passive: false });

  _resizeCleanup = function () {
    handle.removeEventListener("pointerdown", onDown);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
}

// ===== NATIVE CHAT MODE ("Chat Nativo") =====
let qlNativeChatActive = false;
let qlNativeChatCleanup = null;
let qlNativePlusInterval = null;
let qlNativePlusBlocker = null;
let qlNativeFileBlocker = null;
let qlImmersiveCleanup = null;

function activateNativeChat() {
  if (qlNativeChatActive) return;
  qlNativeChatActive = true;

  // Persist state (sidepanel mode disabled, but DO NOT touch ql_shield_active here
  // — preserve user preference; only hide the visual overlay temporarily)
  chrome.storage.local.set({
    ql_native_chat: true,
    ql_sidebar_mode: false,
  });

  // Close any open sidepanel
  try {
    chrome.runtime.sendMessage({ action: "closeSidePanel" });
  } catch (e) {}

  // Hide the floating extension if visible
  const floatingBox = document.getElementById("ql-floating");
  if (floatingBox) {
    floatingBox.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    floatingBox.style.opacity = "0";
    floatingBox.style.transform = "scale(0.95) translateX(20px)";
    setTimeout(() => {
      if (qlNativeChatActive && floatingBox) floatingBox.style.display = "none";
    }, 350);
  }

  // Hide shield overlay visually (without changing user preference)
  removeShieldOverlay();

  // Inject native chat overlay (with retry until form#chat-input exists)
  injectNativeChatOverlay();
}

/* ═══════════════════════════════════════════════════════════════
   IMMERSIVE OVERLAY — covers entire Lovable UI except preview iframe
   ═══════════════════════════════════════════════════════════════ */
function mountImmersiveOverlay() {
  if (document.getElementById("ql-immersive-overlay")) return;

  // Root container
  const root = document.createElement("div");
  root.id = "ql-immersive-overlay";
  root.className = "ql-dark";
  root.innerHTML = `
    <div class="ql-imm-rect ql-imm-top"></div>
    <div class="ql-imm-rect ql-imm-left"></div>
    <div class="ql-imm-rect ql-imm-right"></div>
    <div class="ql-imm-rect ql-imm-bottom"></div>
    <div class="ql-imm-header">
      <div class="ql-imm-brand">
        <span class="ql-imm-logo">⚡</span>
        <div class="ql-imm-brand-text">
          <div class="ql-imm-title">HYPERBUILD</div>
          <div class="ql-imm-subtitle">MODO IMERSIVO ATIVO</div>
        </div>
      </div>
      <div class="ql-imm-status">
        <span class="ql-imm-badge ql-imm-badge-license"><span class="ql-imm-dot"></span>Licença válida</span>
        <span class="ql-imm-badge ql-imm-badge-shield" id="ql-imm-shield-badge"><span class="ql-imm-dot"></span>Escudo</span>
      </div>
      <button class="ql-imm-exit" id="ql-imm-exit-btn" title="Voltar à extensão (ESC)">
        ← Voltar à Extensão
      </button>
    </div>
    <div class="ql-imm-side-content">
      <div class="ql-imm-watermark">HYPERBUILD</div>
      <div class="ql-imm-tagline">Construa mais rápido. Construa melhor.</div>
    </div>
  `;
  document.documentElement.appendChild(root);

  // Update shield badge state
  const updateShieldBadge = () => {
    const badge = document.getElementById("ql-imm-shield-badge");
    if (!badge) return;
    chrome.storage.local.get(["ql_shield_active"], (r) => {
      if (r.ql_shield_active) badge.classList.add("ql-imm-badge-active");
      else badge.classList.remove("ql-imm-badge-active");
    });
  };
  updateShieldBadge();

  // Elevate chat form above the overlay
  const elevateChat = () => {
    const chatForm = document.querySelector("form#chat-input");
    if (!chatForm) return;
    chatForm.classList.add("ql-imm-elevated");
    let p = chatForm.parentElement;
    let depth = 0;
    while (p && depth < 4) {
      p.classList.add("ql-imm-elevated-parent");
      p = p.parentElement;
      depth++;
    }
  };
  elevateChat();

  // Find preview iframe (cascade)
  const findPreview = () => {
    const selectors = [
      'iframe[src*="lovableproject.com"]',
      'iframe[src*="lovable.app"]',
      'iframe[src*="lovable.dev"]',
      'iframe[title*="preview" i]',
      '[data-testid*="preview"] iframe',
      '[data-testid*="preview"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100) return rect;
      }
    }
    return null;
  };

  // Recompute clip rectangles
  const recompute = () => {
    const overlay = document.getElementById("ql-immersive-overlay");
    if (!overlay) return;
    const rect = findPreview();
    const top = overlay.querySelector(".ql-imm-top");
    const left = overlay.querySelector(".ql-imm-left");
    const right = overlay.querySelector(".ql-imm-right");
    const bottom = overlay.querySelector(".ql-imm-bottom");
    const side = overlay.querySelector(".ql-imm-side-content");
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!rect) {
      // No preview — cover full viewport
      top.style.cssText = `top:0;left:0;width:${vw}px;height:${vh}px;display:block;`;
      left.style.display = "none";
      right.style.display = "none";
      bottom.style.display = "none";
      if (side) {
        side.style.left = "0px";
        side.style.width = `${vw}px`;
        side.style.top = "80px";
      }
      return;
    }

    // Top strip (above preview, full width)
    top.style.cssText = `top:0;left:0;width:${vw}px;height:${rect.top}px;display:block;`;
    // Left strip (next to preview, left side)
    left.style.cssText = `top:${rect.top}px;left:0;width:${rect.left}px;height:${rect.height}px;display:block;`;
    // Right strip (next to preview, right side)
    const rightW = vw - rect.right;
    if (rightW > 0) {
      right.style.cssText = `top:${rect.top}px;left:${rect.right}px;width:${rightW}px;height:${rect.height}px;display:block;`;
    } else {
      right.style.display = "none";
    }
    // Bottom strip
    const bottomY = rect.top + rect.height;
    if (bottomY < vh) {
      bottom.style.cssText = `top:${bottomY}px;left:0;width:${vw}px;height:${vh - bottomY}px;display:block;`;
    } else {
      bottom.style.display = "none";
    }
    // Side content positioned in left strip
    if (side && rect.left > 200) {
      side.style.left = "0px";
      side.style.width = `${rect.left}px`;
      side.style.top = `${rect.top + 40}px`;
    } else if (side) {
      side.style.display = "none";
    }
  };
  recompute();

  // Debounced reactivity
  let rafId = null;
  const scheduleRecompute = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      recompute();
      elevateChat();
      rafId = null;
    });
  };

  const ro = new ResizeObserver(scheduleRecompute);
  ro.observe(document.body);

  const mo = new MutationObserver(scheduleRecompute);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

  window.addEventListener("resize", scheduleRecompute);
  window.addEventListener("scroll", scheduleRecompute, true);

  // Storage listener for shield changes
  const storageListener = (changes) => {
    if (changes.ql_shield_active) updateShieldBadge();
  };
  try {
    chrome.storage.onChanged.addListener(storageListener);
  } catch (e) {}

  // ESC key to exit
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      deactivateNativeChat();
    }
  };
  document.addEventListener("keydown", onKey, true);

  // Exit button
  const exitBtn = document.getElementById("ql-imm-exit-btn");
  if (exitBtn) {
    exitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      deactivateNativeChat();
    });
  }

  // Cleanup
  qlImmersiveCleanup = () => {
    try {
      ro.disconnect();
    } catch (e) {}
    try {
      mo.disconnect();
    } catch (e) {}
    try {
      chrome.storage.onChanged.removeListener(storageListener);
    } catch (e) {}
    window.removeEventListener("resize", scheduleRecompute);
    window.removeEventListener("scroll", scheduleRecompute, true);
    document.removeEventListener("keydown", onKey, true);
    if (rafId) cancelAnimationFrame(rafId);
    const r = document.getElementById("ql-immersive-overlay");
    if (r) r.remove();
    document.querySelectorAll(".ql-imm-elevated, .ql-imm-elevated-parent").forEach((el) => {
      el.classList.remove("ql-imm-elevated", "ql-imm-elevated-parent");
    });
  };
}

function unmountImmersiveOverlay() {
  if (qlImmersiveCleanup) {
    qlImmersiveCleanup();
    qlImmersiveCleanup = null;
  }
}

function deactivateNativeChat() {
  if (!qlNativeChatActive) return;
  qlNativeChatActive = false;
  chrome.storage.local.set({ ql_native_chat: false });

  // Unmount immersive overlay first
  unmountImmersiveOverlay();

  // Clean up styling
  const chatForm = document.querySelector("form#chat-input");
  if (chatForm) {
    chatForm.classList.remove("ql-native-active-style");
    chatForm.classList.remove("ql-dark");
    const chatInputContainer = chatForm.parentElement;
    if (chatInputContainer) {
      chatInputContainer.classList.remove("ql-native-active-style");
      chatInputContainer.classList.remove("ql-dark");
      chatInputContainer.style.padding = ""; // Clean up padding
    }
  }

  // Restore Lovable "+" button styles
  const plusBtn = Array.from(chatForm.querySelectorAll("button")).find(
    (b) =>
      b.innerText.includes("+") ||
      b.getAttribute("aria-label")?.toLowerCase().includes("add") ||
      b.getAttribute("aria-label")?.toLowerCase().includes("anexar"),
  );
  if (plusBtn) {
    plusBtn.style.opacity = "";
    plusBtn.style.filter = "";
    plusBtn.style.cursor = "";
    plusBtn.title = "";
  }

  // Clean up injected elements
  if (qlNativeChatCleanup) {
    qlNativeChatCleanup();
    qlNativeChatCleanup = null;
  }

  const header = document.getElementById("ql-native-header");
  if (header) header.remove();
  const returnBtn = document.getElementById("ql-native-return-btn");
  if (returnBtn) returnBtn.remove();

  // Restore send button
  const sendBtn = document.getElementById("chatinput-send-message-button");
  if (sendBtn) {
    sendBtn.classList.remove("ql-native-send-active");
    sendBtn.classList.remove("ql-native-sending");
    sendBtn.style.animation = "";
    sendBtn.disabled = false;
  }

  // Show the extension again if not in sidepanel mode
  chrome.storage.local.get(["ql_ui_mode", "ql_sidebar_mode"], (res) => {
    const isSidepanel = res.ql_ui_mode === "sidepanel" || res.ql_sidebar_mode === true;
    if (!isSidepanel) {
      const floatingBox = document.getElementById("ql-floating");
      if (floatingBox) {
        floatingBox.style.display = "";
        floatingBox.style.opacity = "0";
        floatingBox.style.transform = "scale(0.95)";
        requestAnimationFrame(() => {
          floatingBox.style.transition = "opacity 0.4s ease, transform 0.4s ease";
          floatingBox.style.opacity = "1";
          floatingBox.style.transform = "scale(1) translateX(0)";
        });
      } else {
        _buildFloatingUI();
      }
    } else {
      // If it was in sidepanel mode, tell background to open it (if needed)
      try {
        chrome.runtime.sendMessage({ action: "activateSidebar" });
      } catch (e) {}
    }
  });
}

function injectNativeChatOverlay(retryCount) {
  if (!qlNativeChatActive) return;
  retryCount = retryCount || 0;

  // Wait for chat form to exist (max 20 retries = 10s)
  const chatForm = document.querySelector("form#chat-input");
  if (!chatForm) {
    if (retryCount < 20) {
      setTimeout(() => injectNativeChatOverlay(retryCount + 1), 500);
    } else {
      console.warn("[QL] Native chat form not found after 10s, aborting");
    }
    return;
  }

  // Find container to inject header and attachment preview
  const chatInputContainer = chatForm.parentElement;
  if (!chatInputContainer) return;

  // 1. Create Native Header if it doesn't exist
  if (!document.getElementById("ql-native-header")) {
    const header = document.createElement("div");
    header.id = "ql-native-header";
    header.className = "ql-dark"; // Use dark mode by default
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      margin-bottom: 8px;
      border-radius: 12px;
      font-family: 'Inter', sans-serif;
    `;

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--ql-primary);">${SVG_ICONS.zap}</span>
        <span style="font-weight: 800; font-size: 13px; color: #fff; letter-spacing: 0.5px;">MODO NATIVO</span>
      </div>
      <button id="ql-native-return-btn" style="
        background: var(--ql-primary-border);
        border: 1px solid var(--ql-primary-border);
        color: #fff;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        ${SVG_ICONS.logOut} Sair do Modo Nativo
      </button>
    `;
    chatInputContainer.prepend(header);

    document.getElementById("ql-native-return-btn").onclick = (e) => {
      e.preventDefault();
      deactivateNativeChat();
    };
  }

  // 2. Add Attachment Preview Area if it doesn't exist
  if (!document.getElementById("ql-attach-preview")) {
    const previewArea = document.createElement("div");
    previewArea.id = "ql-attach-preview";
    previewArea.style.cssText = `
      display: none;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0;
      margin-bottom: 8px;
      max-height: 120px;
      overflow-y: auto;
    `;
    // Insert after header or at top of form
    chatForm.prepend(previewArea);
  }

  // 3. Setup File Input for Native Mode (hidden)
  if (!document.getElementById("ql-native-file-input")) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "ql-native-file-input";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    fileInput.onchange = () => {
      const files = Array.from(fileInput.files);
      if (files.length) processFiles(files);
      fileInput.value = "";
    };
    document.body.appendChild(fileInput);
  }

  // Helper: identifica o botão "+" do Lovable de forma robusta
  function isLovablePlusButton(el) {
    if (!el) return false;
    const btn = el.closest && el.closest("button");
    if (!btn) return false;
    if (!chatForm.contains(btn)) return false;
    // Ignora botões internos da nossa extensão
    if (btn.closest("#ql-native-header") || btn.closest("#ql-attach-preview")) return false;
    // Ignora o botão de envio
    if (btn.id === "chatinput-send-message-button") return false;
    // Ignora botões que claramente não são "+"
    const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (
      aria.includes("send") ||
      aria.includes("enviar") ||
      aria.includes("mic") ||
      aria.includes("voice") ||
      aria.includes("visual")
    )
      return false;
    // Heurísticas para identificar o "+":
    // 1. aria-label contém "add", "attach", "anexar", "file", "upload"
    if (/\b(add|attach|anexar|file|upload|plus|mais)\b/i.test(aria)) return true;
    // 2. Possui SVG com ícone de "+" (lucide-plus) ou file input próximo
    const svg = btn.querySelector("svg");
    if (svg) {
      const cls = (svg.getAttribute("class") || "").toLowerCase();
      if (cls.includes("plus") || cls.includes("paperclip") || cls.includes("attach")) return true;
      // Verifica path do "+" (linhas cruzadas)
      const paths = svg.querySelectorAll("path, line");
      for (const p of paths) {
        const d = (p.getAttribute("d") || "") + (p.getAttribute("x1") || "");
        if (d.includes("M5 12h14") || d.includes("M12 5v14")) return true;
      }
    }
    // 3. Botão é o primeiro botão "ícone" do form (geralmente o "+" fica à esquerda)
    const allBtns = Array.from(chatForm.querySelectorAll("button"));
    const iconBtns = allBtns.filter((b) => b.querySelector("svg") && b.id !== "chatinput-send-message-button");
    if (iconBtns[0] === btn && btn.offsetWidth < 50) return true;
    return false;
  }

  // Marca visualmente o botão "+" como desabilitado
  function markPlusButton() {
    const allBtns = Array.from(chatForm.querySelectorAll("button"));
    allBtns.forEach((btn) => {
      if (isLovablePlusButton(btn)) {
        btn.dataset.qlPlusBlocked = "1";
        btn.style.opacity = "0.4";
        btn.style.filter = "grayscale(1)";
        btn.style.cursor = "not-allowed";
        btn.title = "Envio de arquivos disponível apenas via extensão";
      }
    });
  }
  markPlusButton();
  // Re-marca periodicamente caso o React re-renderize
  const plusMarkInterval = setInterval(() => {
    if (!qlNativeChatActive) {
      clearInterval(plusMarkInterval);
      return;
    }
    markPlusButton();
  }, 1500);

  // Interceptor GLOBAL na fase de captura — bloqueia clique no "+" antes do React processar
  function blockPlusClick(e) {
    if (!qlNativeChatActive) return;
    if (isLovablePlusButton(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showCustomAlert("Atenção", "Para enviar arquivos, utilize o modo pop-up ou o painel lateral da extensão.");
    }
  }

  // Interceptor para o <input type="file"> nativo do Lovable
  function blockNativeFileInput(e) {
    if (!qlNativeChatActive) return;
    const target = e.target;
    if (target && target.tagName === "INPUT" && target.type === "file" && target.id !== "ql-native-file-input") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        target.value = "";
      } catch (_) {}
      showCustomAlert("Atenção", "Para enviar arquivos, utilize o modo pop-up ou o painel lateral da extensão.");
    }
  }

  document.addEventListener("click", blockPlusClick, true);
  document.addEventListener("mousedown", blockPlusClick, true);
  document.addEventListener("pointerdown", blockPlusClick, true);
  document.addEventListener("change", blockNativeFileInput, true);
  document.addEventListener("input", blockNativeFileInput, true);

  // Guarda referências para cleanup
  qlNativePlusInterval = plusMarkInterval;
  qlNativePlusBlocker = blockPlusClick;
  qlNativeFileBlocker = blockNativeFileInput;

  // Style the native input area
  chatForm.classList.add("ql-native-active-style");
  if (chatInputContainer) {
    chatInputContainer.classList.add("ql-native-active-style");
    chatInputContainer.style.padding = "10px";
  }

  // Style the send button with blink animation
  const sendBtn = document.getElementById("chatinput-send-message-button");

  if (sendBtn) {
    sendBtn.classList.add("ql-native-send-active");
  }

  // Intercept send button click
  function interceptSend(e) {
    if (!qlNativeChatActive) return;

    // Get text from contenteditable
    const editor = chatForm.querySelector('[contenteditable="true"]');
    const text = editor ? (editor.innerText || editor.textContent || "").trim() : "";

    if (!text && qlAttachedFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    sendViaNativeChat(text, editor);
  }

  // Intercept form submit
  function interceptSubmit(e) {
    if (!qlNativeChatActive) return;

    const editor = chatForm.querySelector('[contenteditable="true"]');
    const text = editor ? (editor.innerText || editor.textContent || "").trim() : "";

    if (!text && qlAttachedFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    sendViaNativeChat(text, editor);
  }

  // Intercept Enter key
  function interceptKeydown(e) {
    if (!qlNativeChatActive) return;
    if (e.key === "Enter" && !e.shiftKey) {
      const editor = chatForm.querySelector('[contenteditable="true"]');
      const text = editor ? (editor.innerText || editor.textContent || "").trim() : "";
      if (!text && qlAttachedFiles.length === 0) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      sendViaNativeChat(text, editor);
    }
  }

  // Intercept drop events to block file attachments in native mode
  function interceptDrop(e) {
    if (!qlNativeChatActive) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showCustomAlert("Atenção", "Para enviar arquivos, utilize o modo pop-up ou o painel lateral da extensão.");
    }
  }

  if (sendBtn) sendBtn.addEventListener("click", interceptSend, true);
  chatForm.addEventListener("submit", interceptSubmit, true);
  chatForm.addEventListener("keydown", interceptKeydown, true);
  chatForm.addEventListener("drop", interceptDrop, true);

  qlNativeChatCleanup = function () {
    if (sendBtn) sendBtn.removeEventListener("click", interceptSend, true);
    chatForm.removeEventListener("submit", interceptSubmit, true);
    chatForm.removeEventListener("keydown", interceptKeydown, true);
    chatForm.removeEventListener("drop", interceptDrop, true);

    // Remove global blockers
    if (qlNativePlusInterval) {
      clearInterval(qlNativePlusInterval);
      qlNativePlusInterval = null;
    }
    if (qlNativePlusBlocker) {
      document.removeEventListener("click", qlNativePlusBlocker, true);
      document.removeEventListener("mousedown", qlNativePlusBlocker, true);
      document.removeEventListener("pointerdown", qlNativePlusBlocker, true);
      qlNativePlusBlocker = null;
    }
    if (qlNativeFileBlocker) {
      document.removeEventListener("change", qlNativeFileBlocker, true);
      document.removeEventListener("input", qlNativeFileBlocker, true);
      qlNativeFileBlocker = null;
    }

    // Restaura visual de qualquer botão "+" marcado
    document.querySelectorAll("button[data-ql-plus-blocked]").forEach((btn) => {
      btn.style.opacity = "";
      btn.style.filter = "";
      btn.style.cursor = "";
      btn.title = "";
      delete btn.dataset.qlPlusBlocked;
    });

    // Clean up our added elements
    const nativeHeader = document.getElementById("ql-native-header");
    if (nativeHeader) nativeHeader.remove();
    const nativePreview = document.getElementById("ql-attach-preview");
    if (nativePreview) nativePreview.remove();
    const nativeFileInput = document.getElementById("ql-native-file-input");
    if (nativeFileInput) nativeFileInput.remove();
  };
}

async function sendViaNativeChat(text, editor) {
  const sendBtn = document.getElementById("chatinput-send-message-button");

  // Check if still uploading
  const isUploading = qlAttachedFiles.some((f) => f.status === "uploading");
  if (isUploading) {
    showNativeChatToast("⚠️ Aguarde o upload dos arquivos...", "warn");
    return;
  }

  // Show sending overlay
  showNativeSendingOverlay(true);

  // Visual feedback
  if (sendBtn) {
    sendBtn.style.animation = "none";
    sendBtn.classList.add("ql-native-sending");
    sendBtn.disabled = true;
  }

  await requestLatestTokenFromHook();

  const storageData = await new Promise((resolve) => {
    chrome.storage.local.get(["lovable_projectId", "lovable_token", "ql_license_key", "ql_session_id"], resolve);
  });
  const projectId = storageData.lovable_projectId || "";
  let token = storageData.lovable_token || "";
  const licenseKey = storageData.ql_license_key || "";

  try {
    if (!projectId || !token) {
      showNativeChatToast("⚠️ Projeto não sincronizado. Navegue no Lovable primeiro.", "error");
      return;
    }

    const payload = {
      license_key: licenseKey,
      session_id: qlSessionId,
      projeto_id: projectId,
      token_lovable: token,
      mensagem: text,
      method: await qlReadMethod(),
      attachments: qlAttachedFiles
        .filter((f) => f.status === "done" && f.url)
        .map((f) => ({ url: f.url, name: f.name, type: (f.type || "").split("/")[0] || "file" })),
    };

    var result = await bgFetch(PROXY_COMMAND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });

    if (result && result.success === false) {
      if (result && result.error_code === "CAPTCHA_REQUIRED") {
        qlShowCaptchaGuide(result);
        throw new Error("Verificação de segurança necessária. Siga as instruções do modal.");
      }
      throw new Error(
        [result.error_display, result.user_action].filter(Boolean).join(" — ") || result.message || "Erro no envio",
      );
    }

    // Clear the editor
    if (editor) {
      editor.innerHTML = '<p><br class="ProseMirror-trailingBreak"></p>';
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }

    addToChatHistory(text || "[Anexos]", "ok");
    showNativeChatToast("\u2713 Prompt enviado com sucesso!", "success");

    // Clear attachments
    qlAttachedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    qlAttachedFiles = [];
    renderAttachments();
  } catch (err) {
    addToChatHistory(text, "error");
    showNativeChatToast("\u2717 " + (err.message || "Erro no envio"), "error");
  } finally {
    showNativeSendingOverlay(false);
    if (sendBtn) {
      sendBtn.classList.remove("ql-native-sending");
      sendBtn.classList.add("ql-native-send-active");
      sendBtn.disabled = false;
      // Animation removed by user request
      sendBtn.style.animation = "";
    }
  }
}

function showNativeSendingOverlay(show) {
  const id = "ql-native-sending-overlay";
  const existing = document.getElementById(id);
  if (!show) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  const el = document.createElement("div");
  el.id = id;
  el.className = "ql-native-sending-overlay";
  el.innerHTML = '<div class="ql-spinner"></div> Enviando prompt...';
  document.body.appendChild(el);
}

function showNativeChatToast(msg, type) {
  const existing = document.getElementById("ql-native-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "ql-native-toast";
  toast.className = "ql-native-toast ql-native-toast-" + type;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("ql-native-toast-visible"));
  setTimeout(() => {
    toast.classList.remove("ql-native-toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setupNativeChatButton() {
  const btn = document.getElementById("ql-native-chat-btn");

  if (btn) {
    btn.addEventListener("click", () => {
      activateNativeChat();
    });
  }
}

// Check if native chat was active on page load
chrome.storage.local.get(["ql_native_chat", "ql_license_valid"], (res) => {
  if (res.ql_native_chat === true && res.ql_license_valid === true) {
    qlNativeChatActive = true;
    const hideFloating = () => {
      const box = document.getElementById("ql-floating");
      if (box) box.style.display = "none";
      else setTimeout(hideFloating, 50);
    };
    hideFloating();
    setTimeout(injectNativeChatOverlay, 100);
  }
});

window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "lovableTokenFound") return;
  const updates = {};
  if (event.data.token && typeof event.data.token === "string") {
    updates.lovable_token = event.data.token.replace(/^Bearer\s+/i, "").trim();
  }
  if (event.data.projectId && typeof event.data.projectId === "string") {
    updates.lovable_projectId = event.data.projectId;
  }
  if (event.data.workspaceId && typeof event.data.workspaceId === "string") {
    updates.lovable_workspaceId = event.data.workspaceId;
  }
  if (event.data.browserSessionId && typeof event.data.browserSessionId === "string") {
    updates.lovable_browser_session_id = event.data.browserSessionId;
  }
  if (event.data.clientGitSha && typeof event.data.clientGitSha === "string") {
    updates.lovable_client_git_sha = event.data.clientGitSha;
  }
  if (event.data.castleToken && typeof event.data.castleToken === "string") {
    updates.lovable_castle_token = event.data.castleToken;
    updates.lovable_castle_token_at = event.data.castleTokenAt || Date.now();
  }
  if (!Object.keys(updates).length) return;
  chrome.storage.local.set(updates, () => {
    updateSyncStatus();
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "hbRefreshLovableSync") {
    try {
      window.postMessage({ type: "lovableRequestToken" }, "*");
      window.postMessage({ type: "lovableRequestCastleToken" }, "*");
      setTimeout(() => window.postMessage({ type: "lovableRequestToken" }, "*"), 120);
    } catch (_) {}
    sendResponse({ ok: true });
  } else if (msg && msg.action === "activateNativeChat") {
    activateNativeChat();
    sendResponse({ ok: true });
  } else if (msg && msg.action === "deactivateNativeChat") {
    deactivateNativeChat();
    sendResponse({ ok: true });
  } else if (msg && msg.action === "removeWatermark") {
    const btn = document.getElementById("ql-remove-watermark");
    if (btn) btn.click();
    sendResponse({ ok: true });
  } else if (msg && msg.action === "toggleShield") {
    qlShieldActive = msg.active;
    chrome.storage.local.set({ ql_shield_active: qlShieldActive });

    // Update local UI if exists
    const btn = document.getElementById("ql-shield-btn");
    const label = document.getElementById("ql-shield-label");
    if (btn) {
      if (qlShieldActive) btn.classList.add("ql-shield-active");
      else btn.classList.remove("ql-shield-active");
    }
    if (label) {
      label.textContent = qlShieldActive ? "Desativar Escudo" : "Ativar Escudo";
    }

    // Perform actual shield logic
    if (qlShieldActive) injectShieldOverlay();
    else removeShieldOverlay();

    sendResponse({ ok: true });
  }
});

function setupTabs() {
  const tabs = document.querySelectorAll(".ql-tab");
  tabs.forEach((tab) => {
    tab.onclick = () => {
      tabs.forEach((t) => t.classList.remove("ql-tab-active"));
      tab.classList.add("ql-tab-active");
      qlActiveTab = tab.dataset.tab;
      renderTabContent();
    };
  });
}

function renderTabContent() {
  const container = document.getElementById("ql-tab-content");
  if (!container) return;

  if (qlActiveTab === "prompt") {
    container.innerHTML = templatePromptContent();

    // Setup listeners for prompt tab
    setupSend();
    setupSuggestionChips();
    setupWatermarkButton();
    setupShield();
    setupOptimize();
    setupFileAttachment();
    setupNewProject();
    setupDownloadProjectButton();
    setupClearMsg();
    setupNativeChatButton();
  } else {
    // History
    if (!qlChatHistory || !qlChatHistory.length) {
      container.innerHTML =
        '<div style="color: var(--ql-text-sub); font-size: 11px; text-align: center; padding: 20px;">Nenhum histórico disponível.</div>';
    } else {
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 10px; font-weight: 800; color: var(--ql-primary); text-transform: uppercase;">Comandos Recentes</span>
          <button id="ql-history-clear" style="background: none; border: none; color: var(--ql-text-sub); font-size: 10px; cursor: pointer;">Limpar</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; padding-right: 5px;" class="ql-history-list">
          ${qlChatHistory
            .slice()
            .reverse()
            .map(
              (item) => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 4px;">
              <p style="font-size: 11px; color: #fff; margin: 0; line-height: 1.4;">${escapeHtml(item.text)}</p>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <span style="font-size: 9px; color: var(--ql-text-sub);">${new Date(item.timestamp).toLocaleTimeString()}</span>
                <button class="ql-history-use" data-text="${escapeHtml(item.text)}" style="background: var(--ql-primary-glow); border: 1px solid var(--ql-primary); color: var(--ql-primary); font-size: 9px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">Usar</button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;

      const clearBtn = document.getElementById("ql-history-clear");
      if (clearBtn) {
        clearBtn.onclick = () => {
          qlChatHistory = [];
          chrome.storage.local.set({ [QL_HISTORY_KEY]: [] });
          renderTabContent();
        };
      }

      container.querySelectorAll(".ql-history-use").forEach((btn) => {
        btn.onclick = () => {
          const text = btn.getAttribute("data-text");
          qlActiveTab = "prompt";
          renderTabContent();
          setTimeout(() => {
            const input = document.getElementById("ql-msg");
            if (input) {
              input.value = text;
              input.focus();
            }
          }, 10);
        };
      });
    }
  }
}


// ── HyperBuild v6.1 – Popup Effects (avatar, tilt, RGB toggle) ──
(function attachPopupEffects() {
  const HB_CUSTOMIZE_OPEN_REQUEST_KEY = "hb_open_customize_request";

  function initPopupAvatar() {
    const avatarBtn = document.getElementById('ql-avatar-btn');
    const avatarInner = document.getElementById('ql-avatar-inner');
    if (!avatarBtn || avatarBtn.dataset.avatarInit) return;
    avatarBtn.dataset.avatarInit = '1';

    // Load saved avatar
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['ql_avatar'], (res) => {
        if (res.ql_avatar && avatarInner) {
          avatarInner.innerHTML = `<img src="${res.ql_avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        }
      });
    }

    let fileInput = document.getElementById('ql-avatar-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'ql-avatar-file-input';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.value = ''; fileInput.click(); });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const SIZE = 80;
          const canvas = document.createElement('canvas');
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext('2d');
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI*2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
          ctx.restore();
          const dataURL = canvas.toDataURL('image/jpeg', 0.92);
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ ql_avatar: dataURL });
            hbSyncThemeAvatarFromQl(dataURL);
          }
          if (avatarInner) avatarInner.innerHTML = `<img src="${dataURL}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function initPopupTilt() {
    const card = document.getElementById('ql-user-card-inner');
    if (!card || card.dataset.tiltInit) return;
    card.dataset.tiltInit = '1';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      const ry = ((x - cx) / cx) * 8;
      const rx = -((y - cy) / cy) * 5;
      card.style.transform = `perspective(500px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.015)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
  }

  function initPopupCardNavigation() {
    const card = document.getElementById('ql-user-card-inner');
    if (!card || card.dataset.customizeNavInit) return;
    card.dataset.customizeNavInit = '1';
    card.style.cursor = 'pointer';
    card.title = 'Abrir personalização';

    card.addEventListener('click', (e) => {
      const avatarBtn = document.getElementById('ql-avatar-btn');
      if (avatarBtn && avatarBtn.contains(e.target)) return;
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.storage) return;
      chrome.storage.local.set({ [HB_CUSTOMIZE_OPEN_REQUEST_KEY]: Date.now() }, () => {
        chrome.runtime.sendMessage({ action: "openCustomizePanel" }, () => {});
      });
    });
  }

  function initPopupRGBToggle() {
    // RGB always on – toggle button removed. Ensure storage flag + class state.
    try {
      forcePopupRgbOn(document.getElementById('ql-floating'));
    } catch (_) {}
    const rgbBorder = document.getElementById('ql-rgb-border-el');
    if (rgbBorder) rgbBorder.style.animation = '';
    initPopupMethodSelector();
  }


  const HB_METHODS_POPUP = [
    { id: 'auto',   label: 'Auto',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>', desc: 'Escolhe automaticamente um dos modos' },
    { id: 'v1',     label: 'V1',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>', desc: 'Modo Simples' },
    { id: 'v2',     label: 'V2',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', desc: 'Modo para tarefas complexas' },
    { id: 'v3',     label: 'V3',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.4c3 0 5.4-2.4 5.4-5.4C22.8 5.4 17.9 2 12 2z"/></svg>', desc: 'Modo com foco em melhorias visuais' },
    { id: 'v4',     label: 'V4',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>', desc: 'Modo com foco em diagnósticos e tarefas complexas' },
    { id: 'v5',     label: 'V5',     icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a4 4 0 0 0 8 0v-1a3 3 0 0 0 2-5 3 3 0 0 0-2-5V6a4 4 0 0 0-4-4z"/><path d="M12 8v8"/><path d="M9 12h6"/></svg>', desc: 'Modo com especialidade em entender contextos antes de executar tarefas' },
    { id: 'master', label: 'Master', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20l-2-12-5 4-3-8-3 8-5-4-2 12z"/></svg>', desc: 'Modo mais potente e inteligente, ótimo para qualquer tipo de tarefa' },
  ];
  let popupMethodDocumentClose = null;
  function popupGetMethod(){ return qlGetMethod(); }
  function popupSetMethod(id){ qlSetMethod(id); }
  function initPopupMethodSelector(){
    const btn = document.getElementById('ql-method-btn');
    const label = document.getElementById('ql-method-label');
    if (!btn || !label) return;
    if (btn.dataset.qlMethodInit === '1') {
      // Already wired – just keep label fresh.
      try {
        const meta = HB_METHODS_POPUP.find(m => m.id === popupGetMethod()) || HB_METHODS_POPUP[0];
        if (label.textContent !== meta.label) label.textContent = meta.label;
      } catch(_) {}
      return;
    }
    btn.dataset.qlMethodInit = '1';
    let menu = document.getElementById('ql-method-menu');
    if (!menu) { menu = document.createElement('div'); menu.id = 'ql-method-menu'; }
    document.querySelectorAll('#ql-method-menu').forEach((el) => { if (el !== menu) el.remove(); });
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    const wasOpen = menu.style.display === 'block';
    menu.style.cssText = `${wasOpen ? 'display:block;' : 'display:none;'}position:fixed;min-width:190px;background:rgba(18,18,20,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid var(--ql-primary-border);border-radius:12px;padding:6px;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,.55);pointer-events:auto;`;
    function syncLabel(){
      const found = HB_METHODS_POPUP.find(m => m.id === popupGetMethod()) || HB_METHODS_POPUP[0];
      if (label.textContent !== found.label) label.textContent = found.label;
      try {
        const iconHost = btn.querySelector('#ql-method-icon') || btn.firstElementChild;
        if (iconHost && iconHost.dataset.renderedIcon !== found.id) {
          iconHost.innerHTML = found.icon;
          iconHost.dataset.renderedIcon = found.id;
        }
      } catch(_) {}
    }
    function render(){
      const cur = popupGetMethod();
      if (menu.dataset.renderedMethod === cur && menu.children.length) return;
      menu.dataset.renderedMethod = cur;
      menu.innerHTML = HB_METHODS_POPUP.map(m => (
        `<div data-method="${m.id}" style="padding:10px 12px; border-radius:8px; cursor:pointer; display:flex; align-items:flex-start; gap:10px; font-size:11px; font-weight:700; color:#f5f5f7;${m.id===cur?' background:rgba(191,0,255,0.18);':''}">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; color:#f5f5f7; flex-shrink:0; margin-top:1px;">${m.icon}</span>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span>${m.label}</span>
            <span style="font-size:10px; font-weight:500; color:#9ca3af; line-height:1.35;">${m.desc}</span>
          </div>
        </div>`
      )).join('');
      menu.querySelectorAll('[data-method]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = el.getAttribute('data-method');
          popupSetMethod(id);
          syncLabel();
          render();
          closeMenu();
        });
      });
    }
    function positionMenu(){
      const r = btn.getBoundingClientRect();
      const menuWidth = Math.max(menu.offsetWidth || 190, 190);
      const menuHeight = Math.max(menu.offsetHeight || 126, 126);
      const left = Math.max(8, Math.min(r.right - menuWidth, window.innerWidth - menuWidth - 8));
      const top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - menuHeight - 8));
      menu.style.position = 'fixed';
      menu.style.zIndex = '2147483647';
      menu.style.minWidth = '190px';
      menu.style.top = top + 'px';
      menu.style.left = left + 'px';
      menu.style.right = 'auto';
    }
    function closeMenu(){ menu.style.display = 'none'; }
    function openMenu(){ render(); menu.style.visibility = 'hidden'; menu.style.display = 'block'; positionMenu(); menu.style.visibility = 'visible'; }
    syncLabel();
    if (!menu.dataset.renderedMethod || menu.dataset.renderedMethod !== popupGetMethod() || !menu.children.length) render();
    if (wasOpen) positionMenu();
    const toggleFromButton = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      forcePopupRgbOn(document.getElementById('ql-floating'));
      const opening = menu.style.display === 'none' || !menu.style.display;
      if (opening) openMenu(); else closeMenu();
    };
    btn.onpointerdown = toggleFromButton;
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    };
    menu.onpointerdown = (e) => {
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    };
    if (popupMethodDocumentClose) document.removeEventListener('pointerdown', popupMethodDocumentClose, true);
    popupMethodDocumentClose = (e) => {
      if (menu.style.display !== 'block') return;
      if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('pointerdown', popupMethodDocumentClose, true);
  }



  function initPopupQuickBtns() {
    document.querySelectorAll('.ql-quick-btn[data-ql-prompt]').forEach(btn => {
      if (btn.dataset.quickInit) return;
      btn.dataset.quickInit = '1';
      btn.addEventListener('click', () => {
        const msgInput = document.getElementById('ql-msg');
        if (msgInput) {
          msgInput.value = btn.getAttribute('data-ql-prompt');
          msgInput.dispatchEvent(new Event('input'));
          msgInput.focus();
        }
        btn.style.transform = 'scale(0.93)';
        setTimeout(() => { btn.style.transform = ''; }, 180);
      });
    });
  }

  // Watch for DOM changes and re-init (debounced; ignore self-induced mutations)
  let __initPending = false;
  let __initLastRun = 0;
  const runInits = () => {
    __initPending = false;
    __initLastRun = Date.now();
    try { initPopupAvatar(); } catch(_) {}
    try { initPopupTilt(); } catch(_) {}
    try { initPopupCardNavigation(); } catch(_) {}
    try { initPopupRGBToggle(); } catch(_) {}
    try { initPopupQuickBtns(); } catch(_) {}
  };
  const observer = new MutationObserver((mutations) => {
    // Skip mutations originating from our own menu / dataset attributes
    let relevant = false;
    for (const m of mutations) {
      const t = m.target;
      if (!t) continue;
      if (t.id === 'ql-method-menu' || (t.closest && t.closest('#ql-method-menu'))) continue;
      relevant = true;
      break;
    }
    if (!relevant) return;
    if (__initPending) return;
    __initPending = true;
    const sinceLast = Date.now() - __initLastRun;
    const delay = sinceLast < 500 ? 500 : 100;
    setTimeout(runInits, delay);
  });

  const observeTarget = document.getElementById('ql-floating') || document.body || document.documentElement;
  // Only watch the floating box subtree; never the whole body.
  const safeTarget = document.getElementById('ql-floating') || observeTarget;
  observer.observe(safeTarget, { childList: true, subtree: true });

  // Initial run
  initPopupAvatar();
  initPopupTilt();
  initPopupCardNavigation();
  initPopupRGBToggle();
  initPopupQuickBtns();
})();
