// ===== HyperBuild Captcha Guide Modal (auto-generated) =====
function qlShowCaptchaGuide(detail) {
  try {
    var existing = document.getElementById("ql-captcha-guide");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = "ql-captcha-guide";
    overlay.style.cssText = [
      "position:fixed","inset:0","z-index:2147483647",
      "background:rgba(0,0,0,0.65)","backdrop-filter:blur(6px)",
      "-webkit-backdrop-filter:blur(6px)",
      "display:flex","align-items:center","justify-content:center",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "animation:qlFadeIn .2s ease-out"
    ].join(";");

    var modal = document.createElement("div");
    modal.style.cssText = [
      "max-width:480px","width:92%",
      "background:rgba(18,18,20,0.92)","border:1px solid rgba(191,0,255,0.4)",
      "border-radius:14px","padding:24px",
      "box-shadow:0 20px 60px rgba(191,0,255,0.25),0 8px 24px rgba(0,0,0,0.6)",
      "color:#f5f5f7","backdrop-filter:blur(24px)",
      "-webkit-backdrop-filter:blur(24px)"
    ].join(";");

    var subtitle = (detail && detail.user_action) ? detail.user_action : "";

    modal.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
         '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#bf00ff,#7a00cc);display:flex;align-items:center;justify-content:center;font-size:18px">' + SP_SVG.shield + '</div>' +
        '<div>' +
          '<div style="font-size:16px;font-weight:700;color:#fff">Verificação de Segurança Necessária</div>' +
          '<div style="font-size:12px;color:#a8a8b3;margin-top:2px">A Lovable detectou tráfego incomum e pediu uma verificação humana</div>' +
        '</div>' +
      '</div>' +

      '<div style="background:rgba(191,0,255,0.08);border:1px solid rgba(191,0,255,0.2);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#e8e8ec;line-height:1.5">' +
        '<strong style="color:#d97cff">Por que isso aconteceu?</strong><br>' +
        'O servidor da Lovable detectou muitas requisições em sequência da sua conta e está pedindo confirmação que você é humano. <strong>Não é um bug da extensão.</strong>' +
      '</div>' +

      '<div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:10px">Siga os passos abaixo para resolver:</div>' +

      '<ol style="margin:0 0 16px 0;padding-left:0;list-style:none;counter-reset:qlstep">' +
        '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#bf00ff;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">1</span>' +
          'Abra <strong style="color:#fff">https://lovable.dev</strong> em uma nova aba do navegador.' +
        '</li>' +
        '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#bf00ff;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">2</span>' +
          'Faça login com a mesma conta usada na extensão (se ainda não estiver logado).' +
        '</li>' +
        '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#bf00ff;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">3</span>' +
          'Envie qualquer mensagem em um projeto. <strong style="color:#fff">Complete o captcha</strong> que aparecer (Cloudflare ou similar).' +
        '</li>' +
        '<li style="counter-increment:qlstep;padding:10px 12px 10px 42px;position:relative;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;font-size:13px;color:#e8e8ec;line-height:1.45">' +
          '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#bf00ff;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">4</span>' +
          'Aguarde 30 segundos e tente enviar novamente pela extensão.' +
        '</li>' +
      '</ol>' +

       '<div style="background:rgba(255,200,0,0.08);border:1px solid rgba(255,200,0,0.25);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#ffd966;line-height:1.45;display:flex;gap:8px;align-items:center">' +
         '<span>' + SP_SVG.alertCircle + '</span>' +
         '<span><strong>Dica para evitar:</strong> Aguarde alguns segundos entre cada mensagem. Envios em rajada aumentam a chance do captcha aparecer.</span>' +
       '</div>' +

      '<div style="display:flex;gap:8px">' +
        '<button id="ql-captcha-open" style="flex:1;padding:11px 16px;border-radius:9px;border:none;background:linear-gradient(135deg,#bf00ff,#9000c9);color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:transform .15s">Abrir lovable.dev</button>' +
        '<button id="ql-captcha-close" style="padding:11px 16px;border-radius:9px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#e8e8ec;font-weight:500;font-size:13px;cursor:pointer">Entendi</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var openBtn = modal.querySelector("#ql-captcha-open");
    var closeBtn = modal.querySelector("#ql-captcha-close");
    if (openBtn) openBtn.onclick = function () {
      try { window.open("https://lovable.dev", "_blank", "noopener"); } catch(_) {}
    };
    if (closeBtn) closeBtn.onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  } catch (e) {
    console.error("[HyperBuild] Falha ao exibir modal de captcha:", e);
  }
}
// ===== End Captcha Guide Modal =====

// ============================================================
// HyperBuild - Side Panel Logic (Business Logic Only)
// Templates/HTML estão em sidepanel-templates.js
// ============================================================

// Shim for chrome.storage when running outside an extension (e.g. preview)
if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
  window.chrome = window.chrome || {
    runtime: {
      id: "mock-extension-id",
      sendMessage: (msg, cb) => {
        console.log("Mock sendMessage:", msg);
        if (cb) setTimeout(() => cb({ status: "ok", data: {} }), 0);
      },
      lastError: null
    },
    storage: {
      local: {
        get: (keys, cb) => {
          const res = {};
          const getVal = (k) => {
            try {
              const val = localStorage.getItem(k);
              return val ? JSON.parse(val) : undefined;
            } catch (e) { return undefined; }
          };
          if (Array.isArray(keys)) {
            keys.forEach(k => res[k] = getVal(k));
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
          if (Array.isArray(keys)) keys.forEach(k => localStorage.removeItem(k));
          else localStorage.removeItem(keys);
          if (cb) setTimeout(cb, 0);
          return Promise.resolve();
        }
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {}
      }
    },
    tabs: {
      query: (queryInfo, callback) => {
        if (callback) setTimeout(() => callback([{ id: 1, active: true }]), 0);
        return Promise.resolve([{ id: 1, active: true }]);
      }
    },
    scripting: {
      executeScript: () => Promise.resolve([])
    }
  };
}

(function(){

  console.log("[HyperBuild] Sidepanel v6.2 inicializado");
  const SUPABASE_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co";
  const BURP_URL = SUPABASE_URL + "/functions/v1/burp";
  const VALIDATE_URL = SUPABASE_URL + "/functions/v1/vx";
  const OPTIMIZE_URL = SUPABASE_URL + "/functions/v1/op";
  const NOTIFICATIONS_URL = SUPABASE_URL + "/functions/v1/gn";
  const VERSIONS_URL = SUPABASE_URL + "/functions/v1/gv";
  const USER_ROLES_URL = SUPABASE_URL + "/functions/v1/gr";
  const PROXY_COMMAND_URL = SUPABASE_URL + "/functions/v1/pc";
  const CREATE_PROJECT_URL = SUPABASE_URL + "/functions/v1/cp";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmdyamF1cWphd3JzeWtuaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk1OTYsImV4cCI6MjA5MTIzNTU5Nn0.JdZeY39iGHcZ5P3p0DDXYVUvNJfMrKp_OraUC5EDyzU";

  let sessionId = null, userName = null, expiresAt = null, licenseStatus = null, heartbeatInterval = null, deviceId = null, isResellerUser = false;
  let spAttachedFiles = [];
  let spActiveTab = 'prompt';
  let spChatHistory = [];
  let currentScriptIndex = 0;
  const SP_MAX_FILES = 15;
  const SP_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB as per requirement (minimum 20MB)
  const SP_HISTORY_KEY = 'ql_chat_history';
  const SP_MAX_HISTORY = 200;
  const CURRENT_EXT_VERSION = "6.2";

  const UIController = {
    async opening() {
      const card = document.querySelector('.glass-card');
      if (card) {
        card.classList.add('sp-animate-open');
        await new Promise(r => setTimeout(r, 500));
        card.classList.remove('sp-animate-open');
      }
    },
    async closing() {
      const card = document.querySelector('.glass-card');
      if (card) {
        card.classList.add('sp-animate-close');
        await new Promise(r => setTimeout(r, 400));
        window.close();
      } else {
        window.close();
      }
    }
  };



  // --- Utilities ---
  function safeSendMessage(msg) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) return reject(new Error("Extension context invalidated"));
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(resp);
        });
      } catch(e) { reject(new Error("Extension context invalidated")); }
    });
  }

  function bgFetch(url, opts = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        // Se estiver em modo mock/preview, faz fetch real para não travar o preview
        if (chrome.runtime.id === "mock-extension-id") {
          console.log("[HyperBuild] Mock Fetch:", url);
          const response = await fetch(url, {
            method: opts.method || "POST",
            headers: opts.headers || {},
            body: opts.body || null
          });
          if (!response.ok) throw new Error("Fetch failed: " + response.status);
          const data = await response.json();
          return resolve(data);
        }

        if (!chrome.runtime || !chrome.runtime.id) return reject(new Error("Extension context invalidated"));
        chrome.runtime.sendMessage({ action: "proxyFetch", url, method: opts.method || "POST", headers: opts.headers || {}, body: opts.body || null }, (resp) => {
          if(chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if(!resp) return reject(new Error("No response"));
          if(resp.data && typeof resp.data === "object") resolve(resp.data);
          else if(!resp.ok) reject(new Error("Fetch failed (" + resp.status + ")"));
          else resolve(resp.data);
        });
      } catch(e) { 
        console.error("[HyperBuild] bgFetch Error:", e);
        reject(e); 
      }
    });
  }

  function getDeviceId() {
    return getHardwareFingerprint();
  }

  function showResponse(msg) {
    const box = document.getElementById('sp-response-box');
    if (box) {
      box.textContent = msg;
      box.classList.add('visible');
      setTimeout(() => box.classList.remove('visible'), 4000);
    }
  }

  function showAlert(title, message) {
    const existing = document.querySelector('.sp-alert-overlay');
    if(existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'sp-alert-overlay';
    overlay.innerHTML = spTemplateAlert(title, message);
    document.body.appendChild(overlay);
    overlay.querySelector('.sp-alert-ok').addEventListener('click', () => overlay.remove());
    setTimeout(() => overlay.remove(), 4000);
  }

  // --- Header Event Listeners ---
  document.getElementById('sp-back-to-popup').addEventListener('click', () => {
    try { chrome.storage.local.set({ ql_ui_mode: 'floating' }); } catch(e) {}
    try { chrome.runtime.sendMessage({ action: "activateFloating" }); } catch(e) {}
    try { window.close(); } catch(e) {}
  });

  document.addEventListener('click', (e) => {
    const themeBtn = e.target.closest('#ql-theme-btn');
    if (themeBtn) {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      
      const themeKnob = document.getElementById('themeKnob');
      if(themeKnob) themeKnob.innerHTML = next === 'dark' ? SP_SVG.moon : SP_SVG.sun;
      
      // Also update any other theme buttons that might be visible (like in license gate)
      document.querySelectorAll('#ql-theme-btn').forEach(btn => {
        if (btn !== themeBtn) {
           // If it's the knob-less version, just swap icons if needed
           // but most of them will just be the same ID
        }
      });
      
      chrome.storage.local.set({ ql_dark_mode: next === 'dark' });
    }
  });

   const logoutBtn = document.querySelector('.sp-logout-btn');
   if (logoutBtn) {
     logoutBtn.addEventListener('click', () => {
       if(heartbeatInterval) clearInterval(heartbeatInterval);
       chrome.storage.local.remove(["ql_license_valid","ql_license_key","ql_session_id","ql_user_name","ql_expires_at","ql_activated_at","ql_license_status"], () => {
         userName = null; expiresAt = null; licenseStatus = null; sessionId = null;
         showLicenseGate();
       });
     });
   }

  // --- Notifications ---
  const notifPanel = document.getElementById('sp-notif-panel');
  document.querySelector('.sp-notif-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = notifPanel.style.display !== 'none';
    notifPanel.style.display = isOpen ? 'none' : 'block';
    if(!isOpen) loadNotifications();
  });
  document.getElementById('sp-notif-close').addEventListener('click', () => { notifPanel.style.display = 'none'; });

  async function loadNotifications() {
    const list = document.getElementById('sp-notif-list');
    list.innerHTML = '<p class="sp-notif-empty">Carregando...</p>';
    try {
      const data = await bgFetch(NOTIFICATIONS_URL, { method: "GET", headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } });
      if(!data || !data.length) { list.innerHTML = '<p class="sp-notif-empty">Nenhuma notificação.</p>'; return; }
      const ids = data.map(n => n.id);
      chrome.storage.local.set({ ql_read_notifs: ids });
      const badge = document.querySelector('.sp-notif-badge');
      if(badge) badge.style.display = 'none';
      list.innerHTML = data.map(n => spTemplateNotifItem(n)).join('');
    } catch(e) { list.innerHTML = '<p class="sp-notif-empty">Erro ao carregar.</p>'; }
  }

  async function checkUnread() {
    try {
      const data = await bgFetch(NOTIFICATIONS_URL, { method: "GET", headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } });
      if(!data || !data.length) return;
      chrome.storage.local.get(["ql_read_notifs"], res => {
        const readIds = res.ql_read_notifs || [];
        const unread = data.filter(n => !readIds.includes(n.id)).length;
        const badge = document.querySelector('.sp-notif-badge');
        if(badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
      });
    } catch(e) {}
  }

  // --- Update Check ---
  async function checkForUpdate() {
    try {
      const data = await bgFetch(VERSIONS_URL, { method: "GET", headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } });
      if (!data || !data.length) return;
      const latest = data[0];
      if (latest.version !== CURRENT_EXT_VERSION && latest.is_alert_active) {
        const banner = document.getElementById('sp-update-banner');
        if (banner) {
          const dlUrl = latest.file_path ? SUPABASE_URL + "/storage/v1/object/public/extension-releases/" + latest.file_path : null;
          banner.innerHTML = spTemplateUpdateBanner(latest.version, latest.changelog, dlUrl);
          banner.style.display = 'block';
        }
      }
    } catch(e) {}
  }

  // --- Reseller Role Check ---
  async function checkResellerRole() {
    try {
      const _ur_lic = await new Promise(rr => chrome.storage.local.get(["ql_license_key"], rr)); const data = await bgFetch(USER_ROLES_URL, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, "x-license-key": _ur_lic.ql_license_key || "" }, body: JSON.stringify({ user_id: await getUserId() }) });
      if (data && Array.isArray(data) && data.some(r => r.role === 'reseller' || r.role === 'admin')) {
        isResellerUser = true;
        const btn = document.getElementById('sp-reseller-btn');
        if (btn) btn.style.display = 'block';
      }
    } catch(e) {}
  }

  async function getUserId() {
    return new Promise(r => chrome.storage.local.get(["ql_license_key"], async res => {
      if (!res.ql_license_key) return r('');
      try {
        const data = await bgFetch(SUPABASE_URL + "/functions/v1/gu", { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, "x-license-key": res.ql_license_key }, body: JSON.stringify({ license_key: res.ql_license_key }) });
        if (data && data.length && data[0].user_id) r(data[0].user_id);
        else r('');
      } catch(e) { r(''); }
    }));
  }

  // --- License Gate ---
  function showLicenseGate() {
    const body = document.getElementById('sp-body');
    body.innerHTML = spTemplateLicenseGate();
    document.getElementById('sp-validate-btn').addEventListener('click', validateLicense);
    
    // Update theme icons for all theme buttons (including the one inside license gate)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('#ql-theme-btn').forEach(btn => {
      // If it has a knob (header version), update the knob
      const knob = btn.querySelector('#themeKnob');
      if (knob) {
        knob.innerHTML = isDark ? SP_SVG.moon : SP_SVG.sun;
      } else {
        // If it's a direct icon button, update its innerHTML
        btn.innerHTML = isDark ? SP_SVG.moon : SP_SVG.sun;
      }
    });
  }

  async function validateLicense() {
    const input = document.getElementById('sp-license-input');
    const log = document.getElementById('sp-license-log');
    if(log) log.style.display = 'block';
    const key = input ? input.value.trim().toUpperCase() : '';
    if(!key) { showResponse('Insira uma chave'); return; }
    if(!key.startsWith('HYPER-')) { showResponse('Licença inválida'); return; }
    showResponse('Validando...');
    try {
      if(!deviceId) deviceId = await getDeviceId();
      const data = await bgFetch(VALIDATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ license_key: key, device_id: deviceId }) });
      if(data.valid) {
        sessionId = data.session_id; userName = data.user_name; expiresAt = data.expires_at; licenseStatus = data.status;
        chrome.storage.local.set({ ql_license_valid: true, ql_license_key: key, ql_session_id: data.session_id, ql_user_name: data.user_name || null, ql_expires_at: data.expires_at || null, ql_activated_at: data.activated_at || null, ql_license_status: data.status || null }, () => {
          showResponse(data.message || 'Ativado!');
          setTimeout(() => { showMainUI(); startHeartbeat(key); }, 800);
        });
      } else {
        showResponse(data.message || 'Chave inválida');
      }
    } catch(err) { showResponse('Erro de conexão'); }
  }

  // --- Chat History ---
  function loadChatHistory(cb) {
    chrome.storage.local.get([SP_HISTORY_KEY], (r) => {
      const stored = r[SP_HISTORY_KEY];
      spChatHistory = Array.isArray(stored) ? stored : [];
      if (cb) cb();
    });
  }

  function saveChatHistory() {
    if (spChatHistory.length > SP_MAX_HISTORY) spChatHistory = spChatHistory.slice(-SP_MAX_HISTORY);
    chrome.storage.local.set({ [SP_HISTORY_KEY]: spChatHistory });
  }

  function addToHistory(text, status) {
    spChatHistory.push({ text: text, timestamp: new Date().toISOString(), status: status || 'ok' });
    saveChatHistory();
    updateHistoryBadge();
  }

  function updateHistoryBadge() {
    var badge = document.querySelector('.sp-tab[data-tab="history"] .sp-tab-badge');
    if (badge) badge.textContent = spChatHistory.length;
  }

  function renderHistoryTab() {
    var container = document.getElementById('sp-tab-content');
    if (!container) return;
    container.innerHTML = spTemplateChatHistory(spChatHistory);
    // Scroll to bottom
    var msgs = container.querySelector('.sp-chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    // Clear button
    var clearBtn = document.getElementById('sp-chat-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        spChatHistory = [];
        saveChatHistory();
        renderHistoryTab();
      });
    }
    // History Use buttons
    container.querySelectorAll('.sp-history-use').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        switchTab('prompt');
        const msgInput = document.getElementById('sp-msg');
        if (msgInput) {
          msgInput.value = text;
          msgInput.dispatchEvent(new Event('input'));
        }
      });
    });
  }


  function renderPromptTab() {
    var container = document.getElementById('sp-tab-content');
    if (!container) return;
    container.innerHTML = spTemplatePromptContent();
  }

  function switchTab(tab) {
    spActiveTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    if (tab === 'burp') {
      renderBurpTab();
    } else if (tab === 'history') {
      loadChatHistory(function() { renderHistoryTab(); });
    } else {
      showMainUIContent();
    }
  }

  function renderBurpTab() {
    const container = document.getElementById('sp-tab-content');
    if (!container) return;
    container.innerHTML = spTemplateBurpContent();

    const sendBtn = document.getElementById('burp-send-btn');
    const responseArea = document.getElementById('burp-response-area');
    const responseBody = document.getElementById('burp-response-body');
    const statusBadge = document.getElementById('burp-status-badge');

    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const url = document.getElementById('burp-url').value;
        const method = document.getElementById('burp-method').value;
        const headersRaw = document.getElementById('burp-headers').value;
        const payloadRaw = document.getElementById('burp-payload').value;

        if (!url) {
          showResponse('URL é obrigatória');
          return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = 'EXECUTANDO...';
        responseArea.style.display = 'none';

        try {
          let headers = {};
          if (headersRaw.trim()) {
            try { headers = JSON.parse(headersRaw); } catch(e) { throw new Error('Headers JSON inválido'); }
          }

          let payload = null;
          if (payloadRaw.trim()) {
            try { payload = JSON.parse(payloadRaw); } catch(e) { payload = payloadRaw; }
          }

          const sd = await new Promise(r => chrome.storage.local.get(["lovable_token"], r));
          const token = (sd.lovable_token || '').replace(/^Bearer\s+/i, '').trim();

          const result = await bgFetch(BURP_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ url, method, payload, headers })
          });

          responseArea.style.display = 'block';
          statusBadge.textContent = 'STATUS: ' + (result.status || '200');

          try {
            const formatted = JSON.stringify(JSON.parse(result.body), null, 2);
            responseBody.textContent = formatted;
          } catch(e) {
            responseBody.textContent = result.body || 'Sem corpo de resposta';
          }

          if (result.status >= 400) {
            statusBadge.style.background = 'rgba(255,0,85,0.1)';
            statusBadge.style.color = '#ff0055';
          } else {
            statusBadge.style.background = 'rgba(0,255,100,0.1)';
            statusBadge.style.color = '#00ff64';
          }
        } catch (err) {
          showResponse('Erro: ' + err.message);
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = 'EXECUTAR REQUEST';
        }
      });
    }
  }



  // --- Main UI ---
  function showMainUI() {
    const body = document.getElementById('sp-body');
    
    // Ensure header icons are correct
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const knob = document.getElementById('themeKnob');
    if(knob) knob.innerHTML = isDark ? SP_SVG.moon : SP_SVG.sun;

    loadChatHistory(function() {
      body.innerHTML = '<div id="sp-update-banner" style="display:none"></div>' +
        '<div id="sp-profile-header"></div>' +
        spTemplateTabs(spActiveTab, spChatHistory.length) +
        '<div id="sp-tab-content"></div>';

      updateLicenseProfile(userName, expiresAt, licenseStatus);
      UIController.opening(); // Trigger premium opening animation

      document.querySelectorAll('.tab-btn').forEach(function(t) {
        t.addEventListener('click', function() { switchTab(t.getAttribute('data-tab')); });
      });

      if (spActiveTab === 'history') {
        renderHistoryTab();
      } else {
        showMainUIContent();
      }

      updateSync();
      chrome.storage.onChanged.addListener((ch, area) => { 
        if(area === "local") {
          if(ch.lovable_projectId || ch.lovable_token) updateSync(); 
          if(ch.ql_ui_mode && ch.ql_ui_mode.newValue === 'floating') {
            console.log("[Sidepanel] UI Mode switched to floating, closing sidepanel with animation");
            UIController.closing();
          }
        }
      });
      chrome.runtime.onMessage.addListener((msg) => { if(msg.action === "closeSidePanel") UIController.closing(); });
      updateCountdown();

      chrome.storage.local.get(["ql_license_key","ql_session_id","ql_user_name","ql_expires_at","ql_license_status", "ql_ui_mode"], r => {
        if (r.ql_ui_mode === 'floating') {
          UIController.closing();
          return;
        }
        if(r.ql_license_key) { 
          sessionId = r.ql_session_id || sessionId; 
          userName = r.ql_user_name || userName;
          expiresAt = r.ql_expires_at || expiresAt;
          licenseStatus = r.ql_license_status || licenseStatus;
          startHeartbeat(r.ql_license_key); 
          updateLicenseProfile(userName, expiresAt, licenseStatus);
        }
      });

      checkUnread();
      checkForUpdate();
      checkResellerRole();
    });
  }

  function updateLicenseProfile(name, expiry, status) {
    const el = document.getElementById('sp-profile-header');
    if (el) el.innerHTML = spTemplateLicenseHeader(name, expiry, status);
  }

  function showMainUIContent() {
    const container = document.getElementById('sp-tab-content');
    if (!container) return;
    container.innerHTML = spTemplatePromptContent();
    
    // Setup actions
    const sendBtn = document.getElementById('sp-send');
    const msgInput = document.getElementById('sp-msg');
    const clearBtn = document.getElementById('sp-clear-msg');
    const attachBtn = document.getElementById('sp-attach');
    const optimizeBtn = document.getElementById('sp-optimize');
    const dropZone = document.getElementById('sp-drop-zone');
    const dropOverlay = document.getElementById('sp-drop-overlay');
    const fileInput = document.getElementById('sp-file-input');

    // Drag & Drop implementation
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('sp-drop-zone-active');
        if (dropOverlay) dropOverlay.style.display = 'flex';
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, () => {
          dropZone.classList.remove('sp-drop-zone-active');
          if (dropOverlay) dropOverlay.style.display = 'none';
        });
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length) spProcessFiles(files);
      });
    }

    // Clip (Paste) implementation
    msgInput.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file') files.push(item.getAsFile());
      }
      if (files.length) spProcessFiles(files);
    });

    const watermarkBtn = document.getElementById('sp-remove-watermark');
    const shieldBtn = document.getElementById('sp-shield-btn');
    const nativeChatBtn = document.getElementById('sp-native-chat-btn');
    const newProjectBtn = document.getElementById('sp-new-project-btn');

    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', async () => {
        const originalHTML = newProjectBtn.innerHTML;
        newProjectBtn.disabled = true;
        newProjectBtn.innerHTML = '<span style="display:inline-flex; vertical-align:middle; margin-right:4px;">' + SP_SVG.clock + '</span> Criando...';
        try {
          const sd = await new Promise(r => chrome.storage.local.get(['lovable_token', 'ql_license_key', 'ql_hw_fingerprint'], r));
          const rawToken = (sd.lovable_token || '').replace(/^Bearer\s+/i, '').trim();
          if (!rawToken) throw new Error('Token do Lovable não encontrado. Abra lovable.dev e faça login.');
          const licenseKey = sd.ql_license_key || '';
          if (!licenseKey) throw new Error('Licença não encontrada. Faça login na extensão antes de criar projetos.');
          let deviceId = sd.ql_hw_fingerprint || '';
          if (!deviceId && typeof getHardwareFingerprint === 'function') {
            try { deviceId = await getHardwareFingerprint(); } catch (_) {}
          }

          const pData = await bgFetch(CREATE_PROJECT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'x-license-key': licenseKey },
            body: JSON.stringify({
              token_lovable: rawToken,
              device_id: deviceId
            })
          });
          
          if (!pData || !pData.success) {
            throw new Error(pData?.message || 'Falha ao criar projeto via Proxy.');
          }

          const project = pData.project || pData.data;
          const projectId = project?.id || project?.project_id;
          if (!projectId) throw new Error('ID do projeto não retornado.');

          showResponse('Projeto criado!');
          chrome.tabs.create({ url: 'https://lovable.dev/projects/' + projectId });
        } catch (err) {
          console.error('[Sidepanel] Create project error:', err);
          showResponse(err.message || 'Falha ao criar projeto.');
        } finally {
          newProjectBtn.disabled = false;
          newProjectBtn.innerHTML = originalHTML;
        }
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (msgInput) msgInput.value = '';
      });
    }
    if (attachBtn) {
      attachBtn.addEventListener('click', () => {
        const fileInput = document.getElementById('sp-file-input');
        if (fileInput) fileInput.click();
      });
    }
    if (optimizeBtn) optimizeBtn.addEventListener('click', handleOptimize);
    if (watermarkBtn) watermarkBtn.addEventListener('click', handleRemoveWatermark);
    if (shieldBtn) shieldBtn.addEventListener('click', handleShieldToggle);
    if (nativeChatBtn) {
      nativeChatBtn.addEventListener('click', () => {
        // First close the sidepanel UI smoothly
        UIController.closing();
        // Then notify content script to activate native chat (single source of truth)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "activateNativeChat" }, () => {
              // Ignore errors (content script may not be loaded on this tab)
              if (chrome.runtime.lastError) console.log("[Sidepanel] activateNativeChat msg error:", chrome.runtime.lastError.message);
            });
          }
        });
        // Persist state AFTER messaging to avoid double-trigger via storage listener
        setTimeout(() => {
          chrome.storage.local.set({ 
            ql_native_chat: true, 
            ql_sidebar_mode: false 
          });
          // Close the actual chrome side panel
          chrome.runtime.sendMessage({ action: "closeSidePanel" });
        }, 100);
      });
    }

    // Initialize attachment system
    setupSpFileAttachment();
    setupSpeech();


    // Update shield UI on load
    chrome.storage.local.get(["ql_shield_active"], res => {
      if (res.ql_shield_active) {
        if (shieldBtn) {
          shieldBtn.classList.add('sp-shield-active');
          shieldBtn.style.background = 'var(--accent-glow)';
          shieldBtn.style.borderColor = 'var(--neon-purple)';
          shieldBtn.style.color = '#fff';
        }
        const label = document.getElementById('sp-shield-label');
        if (label) label.textContent = 'Desativar Escudo';
      }
    });

    setupSpFileAttachment();
  }

  function showResponse(msg) {
    const box = document.getElementById('sp-response-box');
    if (!box) return;
    box.textContent = msg;
    box.classList.add('visible');
    setTimeout(() => box.classList.remove('visible'), 3000);
  }

  function handleShieldToggle() {
    const btn = document.getElementById('sp-shield-btn');
    const label = document.getElementById('sp-shield-label');
    chrome.storage.local.get(["ql_shield_active"], res => {
      const next = !res.ql_shield_active;
      chrome.storage.local.set({ ql_shield_active: next });
      
      if (btn) {
        if (next) {
          btn.classList.add('sp-shield-active');
          btn.style.background = 'var(--accent-glow)';
          btn.style.borderColor = 'var(--neon-purple)';
          btn.style.color = '#fff';
        } else {
          btn.classList.remove('sp-shield-active');
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
        }
      }
      if (label) label.textContent = next ? 'Desativar Escudo' : 'Ativar Escudo';
      showResponse(next ? 'Escudo ativado com sucesso!' : 'Escudo desativado');
      
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "toggleShield", active: next });
      });
    });
  }



  // --- Sync Status ---
  function updateSync() {
    chrome.storage.local.get(["lovable_projectId","lovable_token"], r => {
      const el = document.getElementById('sp-sync');
      if(!el) return;
      if(r.lovable_projectId && r.lovable_token) { 
        el.className = 'sp-sync-status sp-sync-ok'; 
        el.innerHTML = '<span style="display:inline-flex; vertical-align:middle; margin-right:4px;">' + SP_SVG.check + '</span> Sincronizado: ' + r.lovable_projectId.substring(0,6) + '...'; 
      }
      else { 
        el.className = 'sp-sync-status sp-sync-waiting'; 
        el.innerHTML = '<span style="display:inline-flex; vertical-align:middle; margin-right:4px;">' + SP_SVG.clock + '</span> Aguardando sincronização...'; 
      }
    });
  }

  // --- Countdown ---
  function updateCountdown() {
    if(!expiresAt) return;
    const el = document.getElementById('sp-countdown');
    if(!el) return;
    el.style.display = 'flex';
    const expiresMs = new Date(expiresAt).getTime();
    const totalDuration = Math.max(expiresMs - Date.now(), 3600000);
    function tick() {
      const remaining = expiresMs - Date.now();
      if(remaining <= 0) { el.innerHTML = '<span style="color:var(--ql-danger);font-weight:600;font-size:12px">Licença expirada</span>'; return; }
      const days = Math.floor(remaining / 86400000);
      const hrs = Math.floor((remaining % 86400000) / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      const pct = Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
      let timeStr = days > 0 ? days + 'd ' + hrs + 'h ' + mins + 'm' : hrs > 0 ? hrs + 'h ' + mins + 'm ' + String(secs).padStart(2,'0') + 's' : mins + ':' + String(secs).padStart(2,'0');
      const label = licenseStatus === 'trial' ? 'Teste expira em' : 'Plano expira em';
      const urgentClass = pct < 20 ? ' sp-bar-urgent' : '';
      el.innerHTML = spTemplateCountdown(label, timeStr, pct, urgentClass);
    }
    tick();
    setInterval(tick, 1000);
  }

  // --- JWT Decode ---
  function spDecodeJwtUserId(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      return payload.sub || payload.user_id || null;
    } catch(e) { return null; }
  }

  // --- Image Compression ---
  async function spCompressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_DIM = 1280;
        let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (!blob) return resolve({ file, previewUrl: null });
          resolve({ file: new File([blob], file.name, { type: outputType }), previewUrl: URL.createObjectURL(blob) });
        }, outputType, file.type === 'image/png' ? undefined : 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, previewUrl: null }); };
      img.src = url;
    });
  }

  // --- File Upload ---
  function spInferContentType(file) {
    if (file && typeof file.type === 'string' && file.type.trim()) return file.type;
    const name = (file && file.name ? file.name : '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    const map = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      zip: 'application/zip',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      webm: 'video/webm'
    };
    return map[ext] || 'application/octet-stream';
  }

  function spFormatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function spBuildUploadFileName(fileId, file) {
    const rawName = file && file.name ? String(file.name) : '';
    const ext = rawName.includes('.') ? rawName.split('.').pop().toLowerCase() : '';
    const safeExt = ext && /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
    return fileId + '.' + safeExt;
  }

  async function spUploadFileDirect(file, token) {
    const fileId = crypto.randomUUID();
    const userId = spDecodeJwtUserId(token);
    if (!userId) throw new Error('userId não extraído do token');

    const contentType = spInferContentType(file);
    const uploadFileName = spBuildUploadFileName(fileId, file);

    const uploadResp = await bgFetch('https://api.lovable.app/files/generate-upload-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ file_name: uploadFileName, content_type: contentType, status: 'uploading' })
    });

    var signedUrl = (uploadResp && uploadResp.url) || (uploadResp && uploadResp.signed_url) || (uploadResp && uploadResp.signedUrl) || (uploadResp && uploadResp.data && uploadResp.data.url) || null;
    if (!signedUrl) throw new Error('URL assinada não retornada');

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('PUT falhou: ' + xhr.status));
      xhr.onerror = () => reject(new Error('Erro de rede'));
      xhr.send(file);
    });

    try {
      await bgFetch('https://api.lovable.app/files/generate-download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ dir_name: userId, file_name: uploadFileName })
      });
    } catch(e) {}

    return { file_id: uploadFileName, file_name: file.name || 'file' };
  }

  // --- Attachment Preview ---
  function spRenderAttachPreview() {
    const container = document.getElementById('sp-attach-preview');
    if (!container) return;
    if (spAttachedFiles.length === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }
    container.style.display = 'flex';
    container.innerHTML = spAttachedFiles.map((f, i) => spTemplateAttachItem(f, i)).join('');
    container.querySelectorAll('.sp-attach-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        if (spAttachedFiles[idx] && spAttachedFiles[idx].previewUrl) URL.revokeObjectURL(spAttachedFiles[idx].previewUrl);
        spAttachedFiles.splice(idx, 1);
        spRenderAttachPreview();
      });
    });
  }

  // --- File Attachment Setup ---
  async function spProcessFiles(files) {
    if (!files || !files.length) return;
    const sd = await new Promise(r => chrome.storage.local.get(['lovable_token','lovable_projectId'], r));
    let token = sd.lovable_token || '';
    if (token.startsWith('Bearer ')) token = token.slice(7);
    const projectId = sd.lovable_projectId || '';
    if (!token || !projectId) {
      showAlert('Atenção', 'Projeto não sincronizado. Abra um projeto Lovable antes de anexar arquivos.');
      return;
    }

    for (const file of files) {
      if (spAttachedFiles.length >= SP_MAX_FILES) break;
      if (file.size > SP_MAX_FILE_SIZE) { showAlert('Grande', file.name + ' excede 100MB.'); continue; }
      
      const mimeType = file.type || 'application/octet-stream';
      const isImg = UploadManager.isImageType(mimeType);
      const isVid = UploadManager.isVideoType(mimeType);
      const objectUrl = URL.createObjectURL(file);
      
      const idx = spAttachedFiles.length;
      const entry = { 
        uid: crypto.randomUUID(),
        file_name: file.name, 
        previewUrl: (isImg || isVid) ? objectUrl : null, 
        file_type: mimeType, 
        sizeLabel: UploadManager.formatFileSize(file.size), 
        uploading: true, 
        uploadFailed: false,
        rawFile: file,
        publicUrl: null
      };
      
      spAttachedFiles.push(entry);
      spRenderAttachPreview();

      (async (e) => {
        try {
          const result = await UploadManager.uploadFile(e.rawFile, { projectId, token });
          e.file_id = result.file_id;
          e.mime_type = result.mime_type;
          e.optimisticImageUrl = result.optimisticImageUrl;
          e.uploading = false;
        } catch(err) {
          console.error('[SP Attach] Upload failed:', err);
          e.uploading = false;
          e.uploadFailed = true;
        } finally {
          spRenderAttachPreview();
          // Sync with Build/Lovable
          chrome.storage.local.set({
            ql_current_attachments: spAttachedFiles
              .filter(f => f.file_id)
              .map(f => ({ file_id: f.file_id, name: f.file_name, type: f.mime_type || f.file_type, optimisticImageUrl: f.optimisticImageUrl }))
          });
        }
      })(entry);
    }
  }

  function setupSpFileAttachment() {
    const fileInput = document.getElementById('sp-file-input');
    const dropZone = document.getElementById('sp-drop-zone');
    const dropOverlay = document.getElementById('sp-drop-overlay');
    if (!fileInput) return;

    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = '';
      if (files.length) await spProcessFiles(files);
    });

    if (dropZone && dropOverlay) {
      let dragCounter = 0;
      dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault(); e.stopPropagation();
        dragCounter++;
        if (dragCounter === 1) dropOverlay.style.display = 'flex';
      });
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
      });
      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault(); e.stopPropagation();
        dragCounter--;
        if (dragCounter <= 0) { dragCounter = 0; dropOverlay.style.display = 'none'; }
      });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault(); e.stopPropagation();
        dragCounter = 0; dropOverlay.style.display = 'none';
        if (e.dataTransfer?.files?.length) await spProcessFiles(Array.from(e.dataTransfer.files));
      });
    }
  }


  // --- Modo Plano Alert ---

  // --- Convert file to base64 ---
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  function setupSpeech() {
    const btn = document.getElementById("sp-speech");
    if (!btn) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btn.title = "Reconhecimento de voz não suportado neste navegador";
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
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
      const textarea = document.getElementById("sp-msg");
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
          if (event.results[i].isFinal) finalTranscript += transcript + " ";
          else interim += transcript;
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
          case "not-allowed": errorMessage = "Permissão do microfone negada. Verifique as configurações do navegador."; break;
          case "no-speech": errorMessage = "Nenhuma fala detectada. Tente novamente."; break;
          case "audio-capture": errorMessage = "Nenhum dispositivo de áudio encontrado."; break;
          default: errorMessage = `Erro: ${event.error}`;
        }
        showAlert("Erro de Voz", errorMessage);
      };
      recognition.onend = () => {
        isRecording = false;
        btn.classList.remove("ql-recording");
        btn.title = "Clique para falar";
        console.log("[HyperBuild] Gravação finalizada");
      };
      recognition.start();
    }
    function stopRecording() { if (recognition && isRecording) recognition.stop(); }
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isRecording) stopRecording();
      else startRecording();
    });
  }

  var SP_WATERMARK_PROMPT = "Adicione isso ao arquivo index.css do projecto \n" +
    "a[href*=\"lovable.app\"], \n" +
    "iframe[src*=\"lovable.app\"], \n" +
    "a[href*=\"lovable.dev\"], \n" +
    "iframe[src*=\"lovable.dev\"], \n" +
    "div[style*=\"Edit with Lovable\"],\n" +
    ".lovable-badge {\n" +
    "  display: none !important;\n" +
    "  opacity: 0 !important;\n" +
    "  visibility: hidden !important;\n" +
    "  pointer-events: none !important;\n" +
    "  position: absolute !important;\n" +
    "  z-index: -9999 !important;\n" +
    "}";

  async function handleRemoveWatermark() {
    const btn = document.getElementById("sp-remove-watermark");
    if(!btn) return;
    btn.disabled = true;
    btn.textContent = "⏳ Enviando...";

    try {
      const sd = await new Promise(r => chrome.storage.local.get(["lovable_projectId","lovable_token","ql_license_key","ql_session_id"], r));
      const token = (sd.lovable_token || "").replace(/^Bearer\s+/i, '');
      const pid = sd.lovable_projectId || "";
      const licKey = sd.ql_license_key || "";

      if(!pid || !token) {
        showResponse("⚠ Projeto não sincronizado.");
        btn.disabled = false;
        btn.textContent = "🚫 Remover marca D'água";
        return;
      }

      const payload = {
        license_key: licKey,
        session_id: sessionId,
        projeto_id: pid,
        token_lovable: token,
        mensagem: SP_WATERMARK_PROMPT,
      };

      try {
        if (typeof getHardwareFingerprint === "function") {
          const did = await getHardwareFingerprint();
          if (did) payload.device_id = did;
        }
      } catch (_) {}

      const result = await bgFetch(PROXY_COMMAND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify(payload)
      });

      if(result && result.success === false) {
        if (result && result.error_code === "CAPTCHA_REQUIRED") { qlShowCaptchaGuide(result); throw new Error("Verificação de segurança necessária. Siga as instruções do modal."); } throw new Error([result.error_display, result.user_action].filter(Boolean).join(" — ") || result.message || "Erro no envio");
      }

      showResponse("Marca de água removida!");
    } catch(err) {
      showResponse("✗ " + (err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = "🚫 Remover marca D'água";
    }
  }

  // --- Send Message ---
  async function handleSend() {
    const msgInput = document.getElementById('sp-msg');
    const msg = msgInput ? msgInput.value.trim() : '';
    const btn = document.getElementById('sp-send');
    
    // Check if there are pending uploads
    const isUploading = spAttachedFiles.some(f => f.uploading);
    if (isUploading) { showResponse('⏳ Aguarde o upload dos arquivos...'); return; }

    if(!msg && spAttachedFiles.length === 0) { 
      showResponse('⚠ Prompt vazio'); 
      return; 
    }
    
    if (btn) {
      btn.disabled = true; 
      btn.textContent = '⚡ Enviando...';
      btn.classList.add('ql-send-blink');
    }

     const attachments = spAttachedFiles
       .filter(f => !f.uploading && !f.uploadFailed && f.file_id)
       .map(f => ({
         file_id: f.file_id,
         name: f.file_name,
         type: f.mime_type || f.file_type,
         optimisticImageUrl: f.optimisticImageUrl || null,
       }));

    try {
      const sd = await new Promise(r => chrome.storage.local.get(["lovable_projectId","lovable_token","ql_license_key","ql_session_id"], r));
      let token = sd.lovable_token || ''; const pid = sd.lovable_projectId || ''; const licKey = sd.ql_license_key || '';
      if(!pid || !token) { 
        showResponse('⚠ Projeto não sincronizado'); 
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; btn.classList.remove('ql-send-blink'); }
        return; 
      }
      if(token.startsWith('Bearer ')) token = token.slice(7);

      const payload = {
        license_key: licKey,
        session_id: sessionId || sd.ql_session_id,
        projeto_id: pid,
        token_lovable: token,
        mensagem: msg,
        attachments: attachments.length ? attachments : undefined
      };

      const result = await bgFetch(PROXY_COMMAND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify(payload)
      });

      if (result && result.success === false) {
        if (result.error_code === "CAPTCHA_REQUIRED") { 
          qlShowCaptchaGuide(result); 
          throw new Error("Verificação de segurança necessária. Siga as instruções do modal."); 
        } 
        throw new Error([result.error_display, result.user_action].filter(Boolean).join(" — ") || result.message || "Erro no envio");
      }

       showResponse('Sucesso');
      
      addToHistory(msg || "[Anexos]", 'ok');
      if (msgInput) msgInput.value = '';
      spAttachedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      spAttachedFiles = [];
      spRenderAttachPreview();
    } catch(err) { 
      showResponse('✗ ' + (err.message || err)); 
      addToHistory(msg || "[Anexos]", 'error'); 
    } finally { 
      if (btn) {
        btn.disabled = false; 
        btn.textContent = 'Enviar'; 
        btn.classList.remove('ql-send-blink');
      }
    }
  }


  // --- Optimize Prompt ---
  async function handleOptimize() {
    const textarea = document.getElementById('sp-msg');
    const btn = document.getElementById('sp-optimize');
    if(!textarea || !textarea.value.trim()) { showAlert('Atenção', 'Digite um prompt antes de otimizar.'); return; }
    btn.classList.add('sp-tool-loading'); btn.disabled = true;
    try {
      const sd = await new Promise(r => chrome.storage.local.get(["ql_license_key"], r));
      const data = await bgFetch(OPTIMIZE_URL, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, "x-license-key": sd.ql_license_key || "" }, body: JSON.stringify({ prompt: textarea.value.trim() }) });
      if(data.optimized_prompt) { textarea.value = data.optimized_prompt; showAlert('Prompt Otimizado! ✨', 'Seu prompt foi aprimorado com IA.'); }
      else if(data.error) showAlert('Erro', data.error);
    } catch(err) { showAlert('Erro', 'Falha ao otimizar: ' + (err.message || '')); }
    finally { btn.classList.remove('sp-tool-loading'); btn.disabled = false; }
  }

  // --- Heartbeat ---
  function startHeartbeat(key) {
    if(heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          clearInterval(heartbeatInterval);
          console.warn("[SP] Heartbeat stopped: extension context invalidated");
          return;
        }
        const data = await bgFetch(VALIDATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ license_key: key, session_id: sessionId, heartbeat: true, device_id: deviceId }) });
        if(!data.valid) {
          clearInterval(heartbeatInterval);
          chrome.storage.local.remove(["ql_license_valid","ql_license_key","ql_session_id","ql_user_name","ql_expires_at","ql_activated_at","ql_license_status"], () => showLicenseGate());
          if(data.reason === 'device_conflict') setTimeout(() => showAlert('Acesso Negado', data.message), 500);
          return;
        }
        if(data.user_name) { userName = data.user_name; const el = document.getElementById('sp-name'); if(el) el.textContent = data.user_name; }
        if(data.expires_at) expiresAt = data.expires_at;
        if(data.status) licenseStatus = data.status;
      } catch(e) {
        if (e.message && e.message.includes("Extension context invalidated")) {
          clearInterval(heartbeatInterval);
          console.warn("[SP] Heartbeat stopped: extension context invalidated");
        }
      }
    }, 60000);
  }

  // --- Initialize ---
  (async function init() {
    try {
      // Timeout de 2s para evitar travamento se o fingerprint falhar ou demorar
      deviceId = await Promise.race([
        getDeviceId(),
        new Promise(resolve => setTimeout(() => resolve('timeout-' + Date.now()), 2000))
      ]);
    } catch(e) {
      console.warn("[HyperBuild] Error getting deviceId, using fallback:", e);
      deviceId = 'error-' + Date.now();
    }
    
    // Auto-login no modo preview/mock para facilitar o desenvolvimento
    if (chrome.runtime.id === "mock-extension-id") {
      chrome.storage.local.get(["ql_license_valid"], res => {
        if (!res.ql_license_valid) {
          console.log("[HyperBuild] Auto-activating Preview Mode");
          userName = "Admin (Preview)";
          expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
          licenseStatus = "active";
          sessionId = "preview-session";
          chrome.storage.local.set({ 
            ql_license_valid: true, 
            ql_license_key: "PREVIEW-MODE", 
            ql_session_id: "preview-session", 
            ql_user_name: userName, 
            ql_expires_at: expiresAt, 
            ql_license_status: "active" 
          }, () => showMainUI());
        }
      });
    }

    chrome.storage.local.get(["ql_dark_mode"], r => { 
      const isDark = r.ql_dark_mode === true;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      
      const knob = document.getElementById('themeKnob');
      if(knob) knob.innerHTML = isDark ? SP_SVG.moon : SP_SVG.sun;
      
      document.querySelectorAll('#ql-theme-btn').forEach(btn => {
        if (!btn.querySelector('#themeKnob')) {
          btn.innerHTML = isDark ? SP_SVG.moon : SP_SVG.sun;
        }
      });
    });
    chrome.storage.local.get(["ql_license_valid","ql_license_key","ql_user_name","ql_expires_at","ql_activated_at","ql_license_status","ql_session_id"], async (res) => {
      if(res.ql_license_valid) {
        userName = res.ql_user_name || null;
        expiresAt = res.ql_expires_at || null;
        licenseStatus = res.ql_license_status || null;
        sessionId = res.ql_session_id || null;
        showMainUI();
        if(res.ql_license_key && res.ql_license_key !== "PREVIEW-MODE") {
          try {
            const data = await bgFetch(VALIDATE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ license_key: res.ql_license_key, session_id: sessionId, heartbeat: true, device_id: deviceId }) });
            if(data.valid) {
              userName = data.user_name || userName; expiresAt = data.expires_at || expiresAt; licenseStatus = data.status || licenseStatus; sessionId = data.session_id || sessionId;
              chrome.storage.local.set({ ql_user_name: userName, ql_expires_at: expiresAt, ql_license_status: licenseStatus, ql_session_id: sessionId });
              const nameEl = document.getElementById('sp-name'); if(nameEl) nameEl.textContent = userName || 'User';
              updateCountdown();
            } else {
              chrome.storage.local.remove(["ql_license_valid","ql_license_key","ql_session_id","ql_user_name","ql_expires_at","ql_activated_at","ql_license_status"]);
              showLicenseGate();
              if(data.reason === 'device_conflict') setTimeout(() => showAlert('Acesso Negado', data.message), 500);
            }
          } catch(e) {}
        }
      } else if (chrome.runtime.id !== "mock-extension-id") {
        showLicenseGate();
      }
    });
  })();

  // --- Background effects (visual only) ---
  function initStars() { console.log("[Sidepanel] initStars stub called"); }
  function initParticles() { console.log("[Sidepanel] initParticles stub called"); }
  function setupSettings() { console.log("[Sidepanel] setupSettings stub called"); }

  // Initialize background effects
  initStars();
  initParticles();
  setupSettings();

})();
