// ============================================
// HyperBuild – Background Script
// ============================================

// Carrega o módulo de segurança (HMAC) no service worker.
// Em contexto de preview/mock (sem chrome.runtime real), importScripts
// não existe — fazemos guarda defensiva.
try {
  if (typeof importScripts === "function") {
    importScripts("security.js");
  }
} catch (e) {
  console.warn("[Background] security.js não pôde ser carregado:", e && e.message);
}

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
      onMessage: {
        addListener: () => {},
        removeListener: () => {}
      },
      lastError: null
    },
    action: {
      onClicked: {
        addListener: () => {},
        removeListener: () => {}
      }
    },
    sidePanel: {
      setPanelBehavior: () => Promise.resolve(),
      open: () => Promise.resolve()
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

console.log("[Background] HyperBuild service worker iniciado v6.9");

const GROQ_API_KEY = "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function hbArrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function hbExtractFileName(contentDisposition, fallbackName) {
  const header = String(contentDisposition || "");
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) return decodeURIComponent(utf8Match[1]);
  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  if (plainMatch && plainMatch[1]) return plainMatch[1];
  return fallbackName;
}


// Initialize UI mode preference
chrome.storage.local.get(["ql_ui_mode", "ql_sidebar_mode", "ql_native_chat"], (res) => {
  let mode = res.ql_ui_mode;
  
  if (!mode) {
    if (res.ql_sidebar_mode === true) mode = 'sidepanel';
    else if (res.ql_native_chat === true) mode = 'floating';
    else mode = 'floating';
    chrome.storage.local.set({ ql_ui_mode: mode });
  }

  const isSidepanel = mode === 'sidepanel';
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: isSidepanel }).catch(() => {});
  console.log("[Background] UI Mode initialized:", mode);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.ql_ui_mode) {
    const newMode = changes.ql_ui_mode.newValue;
    const isSidepanel = newMode === 'sidepanel';
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: isSidepanel }).catch(() => {});
    
    chrome.storage.local.set({ 
      ql_sidebar_mode: isSidepanel,
      ql_native_chat: false // Never default to native chat when switching modes
    });
    console.log("[Background] UI Mode updated:", newMode);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  // CRITICAL: chrome.sidePanel.open() must be called SYNCHRONOUSLY within the
  // user gesture (no await before it). We pre-open the side panel optimistically
  // and only keep it visible if needed. For floating mode, we send a message
  // to the content script and CLOSE the panel if the content script responds.
  let res;
  try {
    res = await chrome.storage.local.get(["ql_ui_mode"]);
  } catch (e) {
    res = {};
  }

  if (res.ql_ui_mode === 'sidepanel') {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.error("[Background] action.onClicked sidePanel error:", err);
    }
    return;
  }

  // Floating mode: try to toggle the in-page UI. If the content script is
  // unavailable (e.g. chrome:// pages, web store), fall back gracefully.
  chrome.tabs.sendMessage(tab.id, { action: "toggleFloatingUI" }, () => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[Background] Content script unavailable on this tab:",
        chrome.runtime.lastError.message
      );
      // Cannot open side panel here — user gesture context is already lost.
      // Notify the user via badge so they understand why nothing happened.
      try {
        chrome.action.setBadgeText({ text: "!", tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#bf00ff", tabId: tab.id });
        setTimeout(() => {
          try { chrome.action.setBadgeText({ text: "", tabId: tab.id }); } catch(_) {}
        }, 3000);
      } catch (_) {}
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "lovableSync") {
    const updates = {};
    if (msg.token) updates.lovable_token = msg.token;
    if (msg.projectId) updates.lovable_projectId = msg.projectId;
    if (Object.keys(updates).length) {
      chrome.storage.local.set(updates, () => {
        console.log("[Background] saved:", Object.keys(updates).join(", "));
      });
    }
  }

  if (msg && msg.action === "activateSidebar") {
    chrome.storage.local.set({ ql_ui_mode: 'sidepanel' });
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        sendResponse({ ok: true });
      }).catch((err) => {
        sendResponse({ ok: true, deferred: true, message: "Clique no ícone da extensão para abrir o painel lateral." });
      });
    } else {
      sendResponse({ ok: true, deferred: true, message: "Clique no ícone da extensão para abrir o painel lateral." });
    }
    return true;
  }

  if (msg && msg.action === "activateFloating") {
    chrome.storage.local.set({ ql_ui_mode: 'floating' });
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.action === "openCustomizePanel") {
    chrome.storage.local.set({ hb_open_customize_request: Date.now() });
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        sendResponse({ ok: true });
      }).catch(() => {
        sendResponse({ ok: true, deferred: true });
      });
    } else {
      sendResponse({ ok: true, deferred: true });
    }
    return true;
  }

  if (msg && msg.action === "openSidePanel") {
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        sendResponse({ ok: true });
      }).catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });
    } else {
      sendResponse({ ok: false, error: "No tab context" });
    }
    return true;
  }


  if (msg && (msg.action === "proxyFetch" || msg.action === "proxyGroq")) {
    (async () => {
      try {
        let url = msg.url;
        let method = msg.method || "POST";
        let headers = msg.headers || {};

        if (msg.action === "proxyGroq") {
          url = GROQ_API_URL;
          headers["Authorization"] = "Bearer " + GROQ_API_KEY;
          headers["Content-Type"] = "application/json";
        }

        console.log("[Background] proxy ->", url);
        const opts = { method, headers };
        if (msg.body) opts.body = msg.body;
        // Auto-assinatura HMAC para endpoints do backend (Supabase Functions).
        // Mantém compatibilidade total: se security.js não carregou, segue cru.
        let finalOpts = opts;
        try {
          if (self.__HB_SECURITY && self.__HB_SECURITY.shouldSign(msg.url)) {
            finalOpts = await self.__HB_SECURITY.withSignedHeaders(msg.url, opts);
          }
        } catch (signErr) {
          console.warn("[Background] HMAC signing falhou, seguindo sem assinatura:", signErr && signErr.message);
        }
        const resp = await fetch(msg.url, finalOpts);
        const wantsBinary = msg.responseType === "base64";

        if (wantsBinary) {
          const contentType = resp.headers.get("content-type") || "application/octet-stream";
          const fileName = hbExtractFileName(
            resp.headers.get("content-disposition"),
            "HyperBuild-Project.zip",
          );

          if (contentType.includes("application/json")) {
            const text = await resp.text();
            let data;
            try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
            sendResponse({ ok: resp.ok, status: resp.status, data, contentType, fileName });
            return;
          }

          const buffer = await resp.arrayBuffer();
          sendResponse({
            ok: resp.ok,
            status: resp.status,
            binaryBase64: hbArrayBufferToBase64(buffer),
            contentType,
            fileName,
          });
          return;
        }

        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
        sendResponse({ ok: resp.ok, status: resp.status, data });
      } catch(err) {
        console.error("[Background] proxyFetch error:", err);
        sendResponse({ ok: false, status: 0, data: { error: err.message || "Fetch failed in background" } });
      }
    })();
    return true;
  }

});
