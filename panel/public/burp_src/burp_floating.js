/* Hyper RB — Painel flutuante (overlay injetado, draggable + resizable).
 * Carrega burp_sidepanel.html dentro de um iframe — single source of truth p/ UI.
 * Estado persistido em chrome.storage.local.qlrb_floating_state.
 *
 * Fixes 4.0.4:
 *  - iframe usa posição absoluta (mais robusto que height:100% em flex child)
 *  - loading skeleton + onerror fallback visíveis enquanto iframe carrega
 *  - atributo allow + title no iframe para a11y e APIs do browser
 *  - validação de pos ao restaurar do storage (rejeita 0/negativo)
 *  - aria-label + role=dialog no root para acessibilidade
 *  - Alt+H: preventDefault correto + aria-keyshortcuts no root
 *
 * Fixes Wave-2:
 *  - F1: early-claim usa stub com queue (drain após API real ser exposta)
 *  - F2: ResizeObserver desconectado em pagehide
 *  - F3: pointercancel tratado igual a pointerup (fim de drag)
 *  - F4: reloadCounter previne load stale de sobrescrever estado correto
 *  - F5: keydown listener nomeado + removido em pagehide
 *  - F6: tabIndex="-1" no root para root.focus() funcionar
 */
(() => {
  // Top-frame guard: the floating overlay must only be created once, in the main document.
  // Subframes (including the overlay's own iframe) must never run this script.
  if (window !== window.top) return;

  if (window.__BURP_RB_FLOATING__) return;

  // F1 FIX: Stub with call-queue replaces the raw `true` early-claim.
  // If a BURP_TOGGLE_FLOATING message arrives before this IIFE finishes (e.g. during
  // async micro-task or when content.js fires before floating.js is parsed), the stub
  // queues the call and drains it once the real API object is set at the bottom.
  const _stub = {
    _q: [],
    show()   { this._q.push("show");   },
    hide()   { this._q.push("hide");   },
    toggle() { this._q.push("toggle"); },
  };
  window.__BURP_RB_FLOATING__ = _stub;

  const STORAGE_KEY = "qlrb_floating_state";
  const MIN_WIDTH = 520, MIN_HEIGHT = 420;
  let root = null;
  let visible = false;
  let minimized = false;
  let pos = { top: 80, right: 24, width: 980, height: 680 };

  // F2 FIX: keep ref so we can disconnect on cleanup
  let _resizeObserver = null;

  // F4 FIX: monotonic counter to ignore stale iframe load events after rapid reloads
  let _reloadCounter = 0;

  // ---------- storage helpers ----------
  function _validatePos(p) {
    // Reject any stored dimension that would collapse the panel
    if (!p || typeof p !== "object") return false;
    if (p.width  != null && (isNaN(p.width)  || p.width  < MIN_WIDTH))  delete p.width;
    if (p.height != null && (isNaN(p.height) || p.height < MIN_HEIGHT)) delete p.height;
    if (p.top    != null && (isNaN(p.top)    || p.top    < 0))          delete p.top;
    if (p.right  != null && (isNaN(p.right)  || p.right  < 0))          delete p.right;
    return true;
  }

  function loadState() {
    try {
      chrome.storage?.local?.get([STORAGE_KEY], (data) => {
        if (chrome.runtime?.lastError) return; // extension context invalidated
        if (data && data[STORAGE_KEY]) {
          const stored = data[STORAGE_KEY];
          if (_validatePos(stored)) {
            pos = { ...pos, ...stored };
            if (root) applyPos();
          }
        }
      });
    } catch {}
  }

  function persistState() {
    try {
      chrome.storage?.local?.set({ [STORAGE_KEY]: pos });
    } catch {}
  }

  function applyPos() {
    if (!root) return;
    root.style.top   = `${pos.top}px`;
    root.style.right = `${pos.right}px`;
    root.style.left  = "auto";
    root.style.width = `${pos.width}px`;
    if (!minimized) root.style.height = `${pos.height}px`;
  }

  // ---------- DOM build ----------
  function build() {
    if (root) return root;

    const iframeSrc = chrome.runtime.getURL("burp_sidepanel.html");

    root = document.createElement("div");
    root.id = "hyper-rb-floating-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Hyper RB — painel flutuante");
    root.setAttribute("aria-modal", "false");
    root.setAttribute("aria-keyshortcuts", "Alt+H");
    // F6 FIX: tabIndex required for programmatic focus() to work on a div
    root.setAttribute("tabindex", "-1");

    // Use a loading skeleton behind the iframe so a black iframe is never silent
    root.innerHTML = `
      <div class="hrb-handle" data-drag-handle>
        <div class="hrb-handle-title">
          <div class="hrb-handle-mark" aria-hidden="true">H</div>
          <span>Hyper RB</span>
          <span class="hrb-req-badge" id="hrb-req-badge" title="Requests capturadas"></span>
        </div>
        <div class="hrb-handle-actions">
          <button class="hrb-handle-btn" data-act="reload" title="Recarregar painel" aria-label="Recarregar painel">↻</button>
          <button class="hrb-handle-btn" data-act="minimize" title="Minimizar" aria-label="Minimizar">_</button>
          <button class="hrb-handle-btn" data-act="close"   title="Fechar"     aria-label="Fechar">✕</button>
        </div>
      </div>
      <div class="hrb-body">
        <div class="hrb-loading" aria-live="polite" aria-label="Carregando painel">
          <div class="hrb-loading-shell" aria-hidden="true">
            <div class="hrb-loading-topbar">
              <div class="hrb-loading-brand">
                <div class="hrb-loading-brand-mark">H</div>
                <div class="hrb-loading-brand-copy">
                  <div class="hrb-loading-brand-title">Hyper RB</div>
                  <div class="hrb-loading-brand-sub">Network · Replay · Presets</div>
                </div>
              </div>
            </div>
            <div class="hrb-loading-tabs">
              <span class="hrb-loading-tab hrb-loading-tab-active"></span>
              <span class="hrb-loading-tab"></span>
              <span class="hrb-loading-tab"></span>
              <span class="hrb-loading-tab"></span>
            </div>
            <div class="hrb-loading-layout">
              <div class="hrb-loading-list">
                <span class="hrb-loading-row"></span>
                <span class="hrb-loading-row"></span>
                <span class="hrb-loading-row"></span>
                <span class="hrb-loading-row"></span>
                <span class="hrb-loading-row hrb-loading-row-short"></span>
              </div>
              <div class="hrb-loading-detail">
                <span class="hrb-loading-card hrb-loading-card-lg"></span>
                <span class="hrb-loading-card"></span>
                <span class="hrb-loading-card"></span>
              </div>
            </div>
          </div>
          <span class="hrb-loading-text">Carregando Hyper RB…</span>
        </div>
        <div class="hrb-error" style="display:none" aria-live="assertive">
          <span>⚠️ Falha ao carregar o painel.</span>
          <button class="hrb-handle-btn" data-act="reload-from-error">↻ Tentar novamente</button>
        </div>
        <iframe
          class="hrb-iframe"
          title="Hyper RB — painel interno"
          allow="clipboard-read; clipboard-write; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        ></iframe>
      </div>
    `;

    (document.body || document.documentElement).appendChild(root);

    // Drag
    root.querySelector("[data-drag-handle]").addEventListener("pointerdown", startDrag);

    // Actions
    root.querySelector('[data-act="close"]').addEventListener("click", hide);
    root.querySelector('[data-act="minimize"]').addEventListener("click", toggleMinimize);

    const iframe  = root.querySelector("iframe");
    const loading = root.querySelector(".hrb-loading");
    const error   = root.querySelector(".hrb-error");

    // F4 FIX: doReload captures the counter at call time; the load listener only
    // acts if the counter still matches (ignores stale events from prior reloads).
    function doReload() {
      const myReloadId = ++_reloadCounter;
      if (loading) loading.style.display = "";
      if (error)   error.style.display   = "none";
      if (iframe) {
        iframe.style.opacity = "0";
        // Bust stale cache by appending a timestamp query param
        iframe.src = iframeSrc + "?_r=" + Date.now();
      }
      // Attach a one-shot load listener scoped to this reload attempt
      iframe.addEventListener("load", function onReloadLoad() {
        iframe.removeEventListener("load", onReloadLoad);
        if (_reloadCounter !== myReloadId) return; // stale — a newer reload fired
        if (loading) loading.style.display = "none";
        if (error)   error.style.display   = "none";
        iframe.style.opacity = "1";
      });
    }
    root.querySelector('[data-act="reload"]').addEventListener("click", doReload);
    root.querySelector('[data-act="reload-from-error"]').addEventListener("click", doReload);

    // iframe initial load/error lifecycle → hide skeleton, show content (or error)
    // This covers the very first src set below (not a reload).
    iframe.addEventListener("load", () => {
      // Only handle the initial load (reloadCounter === 0, meaning doReload hasn't run yet)
      if (_reloadCounter !== 0) return;
      if (loading) loading.style.display = "none";
      if (error)   error.style.display   = "none";
      iframe.style.opacity = "1";
    });

    iframe.addEventListener("error", () => {
      if (loading) loading.style.display = "none";
      if (error)   error.style.display   = "";
      iframe.style.opacity = "0";
    });

    // Set initial src AFTER listeners are registered
    iframe.src = iframeSrc;

    // F2 FIX: ResizeObserver stored in module-level var so it can be disconnected
    _resizeObserver = new ResizeObserver(() => {
      if (!visible || minimized) return;
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w >= MIN_WIDTH && h >= MIN_HEIGHT) {
        pos.width  = w;
        pos.height = h;
        persistState();
      }
    });
    _resizeObserver.observe(root);

    applyPos();
    return root;
  }

  // ---------- drag ----------
  function startDrag(e) {
    if (e.target.closest(".hrb-handle-actions")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = root.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = rect.left, startTop = rect.top;
    root.style.left  = `${startLeft}px`;
    root.style.right = "auto";
    root.style.top   = `${startTop}px`;

    const onMove = (ev) => {
      const nextLeft = Math.max(0, Math.min(window.innerWidth  - 80, startLeft + (ev.clientX - startX)));
      const nextTop  = Math.max(0, Math.min(window.innerHeight - 60, startTop  + (ev.clientY - startY)));
      root.style.left = `${nextLeft}px`;
      root.style.top  = `${nextTop}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove",   onMove);
      window.removeEventListener("pointerup",     onUp);
      // F3 FIX: also remove pointercancel to prevent listener leak on cancelled drags
      window.removeEventListener("pointercancel", onUp);
      const r = root.getBoundingClientRect();
      pos.top   = Math.round(r.top);
      pos.right = Math.max(0, Math.round(window.innerWidth - r.right));
      root.style.left  = "auto";
      root.style.right = `${pos.right}px`;
      persistState();
    };
    window.addEventListener("pointermove",   onMove);
    window.addEventListener("pointerup",     onUp);
    // F3 FIX: treat pointercancel identically to pointerup so listeners are always cleaned up
    window.addEventListener("pointercancel", onUp);
  }

  // ---------- visibility ----------
  function show() {
    build();
    root.classList.add("visible");
    visible = true;
    root.focus();
  }
  function hide() {
    if (root) { root.classList.remove("visible"); visible = false; }
  }
  function toggle()         { visible ? hide() : show(); }
  function toggleMinimize() {
    minimized = !minimized;
    if (!root) return;
    root.classList.toggle("minimized", minimized);
    if (!minimized) root.style.height = `${pos.height}px`;
    root.querySelector('[data-act="minimize"]').setAttribute(
      "aria-label", minimized ? "Restaurar" : "Minimizar"
    );
  }

  // ---------- cleanup on page unload ----------
  // F2 + F5: disconnect RO and remove keydown listener to avoid stale references
  // when the extension context is invalidated while the page is still alive.
  // IMPROVEMENT: Live request-count badge — update whenever background broadcasts network changes
  function _updateBadge(count) {
    const badge = document.getElementById("hrb-req-badge");
    if (!badge) return;
    if (typeof count === "number" && count > 0) {
      badge.textContent = count + " req";
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  }
  let _bgMessageListener = null;
  try {
    _bgMessageListener = (msg) => {
      if (msg?.type === "BURP_NETWORK_UPDATED" || msg?.type === "BURP_STATE_READY") {
        const n = msg?.payload?.stats?.entryCount;
        if (typeof n === "number") _updateBadge(n);
      }
      if (msg?.type === "BURP_CLEAR_NETWORK") _updateBadge(0);
    };
    chrome.runtime.onMessage.addListener(_bgMessageListener);
    // Fetch initial count
    chrome.runtime.sendMessage({ type: "BURP_HEALTHCHECK" }, (res) => {
      void chrome.runtime?.lastError;
      if (res?.networkCount) _updateBadge(res.networkCount);
    });
  } catch {}

  function _cleanup() {
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    }
    // F5: remove named keydown handler
    document.removeEventListener("keydown", _onKeyDown);
    // Remove background message listener
    if (_bgMessageListener) {
      try { chrome.runtime.onMessage.removeListener(_bgMessageListener); } catch {}
      _bgMessageListener = null;
    }
  }
  window.addEventListener("pagehide", _cleanup, { once: true });

  // F1: Expose real API — overwrite stub with real object
  const _api = { show, hide, toggle };
  window.__BURP_RB_FLOATING__ = _api;

  // Drain any calls that arrived while the stub was in place
  if (_stub._q.length) {
    _stub._q.forEach((fn) => { try { _api[fn](); } catch {} });
  }

  // F5 FIX: named handler so it can be properly removed in _cleanup
  // Alt+H global toggle — accessibility: announced via aria-keyshortcuts on root
  function _onKeyDown(e) {
    if (e.altKey && (e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      toggle();
    }
  }
  document.addEventListener("keydown", _onKeyDown);

  loadState();
})();
