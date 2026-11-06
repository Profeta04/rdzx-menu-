(() => {
  "use strict";

  // ============================================================
  // Hyper RB sidepanel — segmented render (focus-safe)
  // Renders the shell ONCE; on incremental updates only patches
  // the request list + status badges. Composer/Presets/Filters
  // never get re-rendered, so inputs never lose focus.
  // ============================================================

  // AF-E-C-04: SUPABASE_URL é replicada em burp_background.js:7 — mantenha
  // em sincronia. Sidepanel (classic <script>) e SW (importScripts) não
  // compartilham módulo ES; refactor para fonte única exigiria bundler.
  // Hardcoded Supabase URL (4.0.4): o antigo placeholder "__SUPABASE_URL__"
  // nunca era substituído por nenhum build pipeline, gerava ruído em DevTools
  // e o try/catch silenciava o erro. Agora é determinístico.
  const SUPABASE_URL = "https://cvbgrjauqjawrsyknhyj.supabase.co";
  const SUPABASE_FN  = `${SUPABASE_URL}/functions/v1`;

  // Anon key (mesma usada por burp_background.js). Necessária para o REST
  // ler `burp_presets` (RLS: Public can read enabled presets).
  const SUPABASE_REST = "https://cvbgrjauqjawrsyknhyj.supabase.co/rest/v1";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmdyamF1cWphd3JzeWtuaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk1OTYsImV4cCI6MjA5MTIzNTU5Nn0.JdZeY39iGHcZ5P3p0DDXYVUvNJfMrKp_OraUC5EDyzU";

  // ---------- Preset library ----------
  // Os presets são carregados em runtime da tabela `burp_presets` no Supabase
  // (gerenciada pela aba Hyper RB do painel admin). Assim, qualquer edição
  // feita lá reflete na extensão sem precisar republicar o .zip.
  // Placeholders `{{LICENSE_KEY}}`, `{{DEVICE_ID}}`, `{{PROJECT_ID}}`,
  // `{{LOVABLE_TOKEN}}`, etc. são substituídos em runtime via
  // BURP_GET_CREDENTIALS.
  let PRESETS = [];
  let presetsLoaded = false;
  let presetsLoading = null;
  let booted = false; // set to true after buildShell() succeeds

  async function loadPresetsFromDB(force = false) {
    if (presetsLoaded && !force) return PRESETS;
    if (presetsLoading) return presetsLoading;
    presetsLoading = (async () => {
      try {
        const url = `${SUPABASE_REST}/burp_presets?enabled=eq.true&select=slug,name,description,method,url_template,headers_template,body_template,kind,sort_order&order=sort_order.asc`;
        const res = await fetch(url, {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        PRESETS = (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.slug,
          name: r.name,
          tag: r.kind || "request",
          desc: r.description || "",
          method: (r.method || "GET").toUpperCase(),
          url: r.url_template || "",
          headers: r.headers_template && typeof r.headers_template === "object" ? r.headers_template : {},
          body: r.body_template ?? null,
        }));
        presetsLoaded = true;
        return PRESETS;
      } catch (e) {
        console.warn("[Hyper RB] Falha ao carregar presets do Supabase:", e);
        PRESETS = [];
        return PRESETS;
      } finally {
        presetsLoading = null;
      }
    })();
    return presetsLoading;
  }


  // ---------- State ----------
  const state = {
    data: null,
    selectedRequestId: null,
    detailTab: "overview",
    mainTab: "network",
    isCapturing: true,
    page: 1,
    pageSize: 30,
    filters: { method: "ALL", search: "", status: "ALL" },
    composer: {
      method: "GET",
      url: "",
      body: "",
      headers: "",
      status: { text: "Pronto.", kind: "idle" },
      sending: false,
    },
    presetSearch: "",
    chain: {
      // chain editada como JSON livre (mais flexível p/ v3.0.0; editor visual em v3.1).
      jsonText: "",
      running: false,
      progress: [],   // [{stage, stepIndex, stepId, status, error, ms}]
      summary: null,  // resultado final do último run
      templates: [],  // lazy-loaded do background
    },
    // Multi-select para importar requests do Network → Chain (Fase 3 / F.6)
    selectedForChain: new Set(),
    analyzer: {
      aiContent: "",
      aiLoading: false,
      aiError: "",
    },
  };

  let wsConsoleLoadPromise = null;

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function sendMessage(type, payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          resolve(res || { ok: false, error: "Sem resposta" });
        });
      } catch (e) { reject(e); }
    });
  }
  const fmtBytes = (b) => {
    const v = Number(b || 0);
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / (1024 * 1024)).toFixed(2)} MB`;
  };
  const fmtMs = (ms) => `${Math.max(0, Number(ms || 0))} ms`;
  const fmtDate = (v) => v ? new Date(v).toLocaleString("pt-BR") : "—";
  const methodCls = (m) => `m-${String(m || "GET").toUpperCase()}`;
  const statusCls = (s) => (Number(s) >= 400 || Number(s) === 0 ? "s-err" : "s-ok");
  function parseJsonSafe(v) { if (!v) return null; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } }
  function fmtCode(v) {
    if (v === undefined || v === null || v === "") return "// vazio";
    if (typeof v === "string") { const j = parseJsonSafe(v); return j ? JSON.stringify(j, null, 2) : v; }
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }


  // ── Toast notification system (Wave 2) ──────────────────────────
  function showToast(msg, kind, durationMs) {
    if (kind === undefined) kind = "info";
    if (durationMs === undefined) durationMs = 3500;
    let container = document.getElementById("hrb-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "hrb-toast-container";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.className = `hrb-toast t-${kind}`;
    el.textContent = msg;
    container.appendChild(el);
    const remove = () => {
      el.classList.add("t-out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    };
    const timer = setTimeout(remove, durationMs);
    el.addEventListener("click", () => { clearTimeout(timer); remove(); });
  }

  // bash single-quote escape for cURL generation
  function shq(v) { return "'" + String(v ?? "").replace(/'/g, "'\''") + "'"; }

  // asArray: normalise network store whether Array or Object (B-1/2/3/6 fix)
  function asArray(raw) {
    return Array.isArray(raw) ? raw
         : (raw && typeof raw === "object" ? Object.values(raw) : []);
  }

  // sendMessageSafe: always resolves, never rejects (AF-E-B-01 fix)
  async function sendMessageSafe(type, payload) {
    try { return await sendMessage(type, payload); }
    catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
  }

  function filteredRequests() {
    const raw = state.data?.network;
    const entries = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
    const q = state.filters.search.toLowerCase();
    return entries.filter((e) => {
      const target = `${e.url || ""} ${e.method || ""} ${typeof e.requestBody === "string" ? e.requestBody : JSON.stringify(e.requestBody || "")}`.toLowerCase();
      const matchesSearch = !q || target.includes(q);
      const matchesMethod = state.filters.method === "ALL" || String(e.method).toUpperCase() === state.filters.method;
      const s = Number(e.status || 0);
      const sf = state.filters.status;
      const matchesStatus = sf === "ALL"
        || (sf === "2xx" && s >= 200 && s < 300)
        || (sf === "3xx" && s >= 300 && s < 400)
        || (sf === "4xx" && s >= 400 && s < 500)
        || (sf === "5xx" && s >= 500 && s < 600)
        || (sf === "ERR" && (s === 0 || s >= 400));
      return matchesSearch && matchesMethod && matchesStatus;
    });
  }
  function pagedRequests() {
    const items = filteredRequests();
    const start = (state.page - 1) * state.pageSize;
    return items.slice(start, start + state.pageSize);
  }
  function selectedRequest() {
    // B-1: normalise network before search
    const all = asArray(state.data?.network);
    return all.find((e) => e.id === state.selectedRequestId) || pagedRequests()[0] || null;
  }

  // ---------- INITIAL SHELL ----------
  // Built once. Sub-regions are updated by dedicated functions.
  function buildShell() {
    const root = $("#app");
    root.innerHTML = `
      <div class="topbar">
        <div class="brand">
          <div class="brand-mark">H</div>
          <div>
            <div class="brand-title">Hyper RB</div>
            <div class="brand-sub">Network · Replay · Presets</div>
          </div>
        </div>
        <div class="topbar-actions">
          <button class="btn" data-act="toggle-capture">⏸ Pausar</button>
          <button class="btn" data-act="export-har" title="Exportar histórico em formato HAR 1.2">HAR</button>
          <button class="btn-danger" data-act="clear">Limpar</button>
        </div>
      </div>

      <div class="tabs-main">
        <button class="tab active" data-tab="network">Network</button>
        <button class="tab" data-tab="composer">Composer</button>
        <button class="tab" data-tab="chain" title="Composer Sequence Mode — encadeia N requests com passagem de dados">Chain</button>
        <button class="tab" data-tab="analyzer" title="Estatísticas locais + análise IA do tráfego">Analyzer</button>
        <button class="tab" data-tab="presets">Presets</button>
        <button class="tab" data-tab="scripts" title="12 scripts inteligentes — clique para executar">Scripts</button>
        <button class="tab" data-tab="wsint" title="WebSocket Interceptor — regras, pausa, edição e injeção de frames">WS Intercept</button>
        <button class="tab" data-tab="diag">Diagnostics</button>
      </div>

      <div class="view" id="view-network">
        <div class="net-toolbar">
          <input id="filter-search" class="input" placeholder="Buscar URL, método ou body" />
          <div class="chips" id="method-chips">
            ${["ALL","GET","POST","PUT","DELETE","WS"].map(m => `<button class="chip ${m==="ALL"?"active":""}" data-m="${m}">${m}</button>`).join("")}
          </div>
          <div class="status-chips" id="status-chips">
            ${[["ALL",""],["2xx","s-2xx"],["3xx","s-3xx"],["4xx","s-4xx"],["5xx","s-5xx"],["ERR","s-err"]].map(([l,c]) => `<button class="chip ${c} ${l==="ALL"?"active":""}" data-sf="${l}">${l}</button>`).join("")}
          </div>
          <div class="chain-import-bar">
            <span id="chain-sel-count" class="chain-sel-count">0 selecionadas</span>
            <button id="chain-import-btn" class="btn" disabled title="Importa as requests marcadas como uma chain (máx. 10)">→ Importar p/ Chain</button>
            <button id="chain-sel-clear" class="btn" disabled title="Limpa seleção">×</button>
          </div>
        </div>
        <div class="slash-bar" title="Slash commands — digite /help">
          <span class="slash-prefix">/</span>
          <input id="slash-input" placeholder="explain · recipe · curl · fetch · analyze · chain · clear · help" />
          <span class="slash-hint">Enter</span>
        </div>
        <div id="slash-help" class="slash-help" style="display:none;"></div>
        <div class="net-body">
          <div class="req-list" id="req-list"></div>
          <div class="detail" id="detail"></div>
        </div>
        <div class="pagination" id="pagination"></div>
      </div>

      <div class="view" id="view-composer" style="display:none">
        <div class="composer">
          <div class="composer-row">
            <select id="cmp-method" class="select">
              ${["GET","POST","PUT","PATCH","DELETE"].map(m => `<option value="${m}">${m}</option>`).join("")}
            </select>
            <input id="cmp-url" class="input" placeholder="https://api.lovable.dev/..." />
          </div>
          <div>
            <div class="card-label">Headers extras (JSON)</div>
            <textarea id="cmp-headers" class="textarea" placeholder='{"x-license-key": "..."}' style="min-height:70px"></textarea>
          </div>
          <div style="flex:1; display:flex; flex-direction:column;">
            <div class="card-label">Body (JSON ou texto)</div>
            <textarea id="cmp-body" class="textarea" placeholder='{"mensagem":"teste"}' style="flex:1; min-height:160px"></textarea>
          </div>
          <div class="composer-actions">
            <div id="cmp-status" class="composer-status">Pronto.</div>
            <button id="cmp-send" class="btn-primary" style="height:38px; padding:0 20px;">Enviar requisição</button>
          </div>
          <div class="card-label" style="margin-top:8px;">Resposta</div>
          <pre id="cmp-response" class="ai-markdown" style="min-height:120px; max-height:280px; overflow:auto; white-space:pre-wrap; word-break:break-word;">— sem resposta ainda —</pre>
        </div>
      </div>

      <div class="view" id="view-chain" style="display:none">
        <div class="chain">
          <div class="chain-header">
            <div class="chain-title">Composer Sequence Mode</div>
            <div class="chain-sub">Encadeia até 10 requests com passagem de dados (<span class="mono">{{stepId.extracted.x}}</span>, <span class="mono">{{vars.y}}</span>, <span class="mono">{{ctx.token}}</span>).</div>
          </div>
          <div class="chain-templates">
            <span class="card-label" style="margin-right:8px;">Templates:</span>
            <div id="chain-templates" class="chain-templates-row">Carregando…</div>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; min-height:200px;">
            <div class="card-label">Chain (JSON)</div>
            <textarea id="chain-json" class="textarea mono" style="flex:1; min-height:180px;" placeholder='{"name":"...", "vars":{}, "steps":[{"id":"s1","method":"GET","url":"https://api.lovable.dev/..."}]}'></textarea>
          </div>
          <div class="composer-actions">
            <div id="chain-status" class="composer-status">Pronto.</div>
            <div style="display:flex; gap:8px;">
              <button id="chain-validate" class="btn">Validar</button>
              <button id="chain-run" class="btn-primary" style="height:38px; padding:0 20px;">Executar chain</button>
            </div>
          </div>
          <div class="card-label" style="margin-top:8px;">Progresso</div>
          <div id="chain-progress" class="chain-progress">Nenhuma execução ainda.</div>
        </div>
      </div>

      <div class="view" id="view-analyzer" style="display:none">
        <div class="analyzer" id="analyzer-body"></div>
      </div>

      <div class="view" id="view-presets" style="display:none">
        <div class="preset-search">
          <input id="preset-search" class="input" placeholder="Buscar preset (pc, cp, watermark, lovable...)" />
        </div>
        <div class="preset-list" id="preset-list"></div>
      </div>

      <div class="view" id="view-diag" style="display:none">
        <div class="diag" id="diag-body"></div>
      </div>

      <div class="view" id="view-scripts" style="display:none">
        <div class="scripts-header">
          <div class="scripts-title">Scripts inteligentes</div>
          <div class="scripts-sub">12 ferramentas one-shot que operam sobre as requests capturadas. Clique em <b>Executar</b>. Tudo roda localmente; ações com IA usam o cliente Groq do background (sanitização dupla).</div>
        </div>
        <div class="scripts-grid" id="scripts-grid">Carregando scripts…</div>
      </div>

      <div class="view" id="view-wsint" style="display:none">
        <div id="wsint-root" class="wsint-root">Carregando WS Interceptor…</div>
      </div>
    `;

    // Tab switching — no full re-render, just toggles display.
    $$(".tabs-main .tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Top actions
    $('[data-act="toggle-capture"]').addEventListener("click", async () => {
      state.isCapturing = !state.isCapturing;
      await sendMessage("BURP_SET_CAPTURE", { enabled: state.isCapturing });
      $('[data-act="toggle-capture"]').textContent = state.isCapturing ? "⏸ Pausar" : "▶ Retomar";
    });
    $('[data-act="clear"]').addEventListener("click", async () => {
      await sendMessage("BURP_CLEAR_NETWORK");
      await refresh();
    });
    $('[data-act="export-har"]').addEventListener("click", exportHar);

    // Network filters
    const search = $("#filter-search");
    search.addEventListener("input", debounce(() => {
      state.filters.search = search.value;
      state.page = 1;
      renderList();
      renderPagination();
    }, 200));
    $("#method-chips").addEventListener("click", (e) => {
      const t = e.target.closest("[data-m]");
      if (!t) return;
      state.filters.method = t.dataset.m;
      state.page = 1;
      $$("#method-chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.m === state.filters.method));
      renderList();
      renderPagination();
    });

    // Status filter chips — B-7: scope to container, not document
    $("#status-chips").addEventListener("click", (e) => {
      const t = e.target.closest("[data-sf]");
      if (!t) return;
      state.filters.status = t.dataset.sf;
      state.page = 1;
      $$("#status-chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.sf === state.filters.status));
      renderList();
      renderPagination();
    });

    // ── Keyboard shortcuts (Wave 2) ─────────────────────────────
    const TABS = ["network", "composer", "chain", "analyzer", "presets", "scripts", "diag"];
    document.addEventListener("keydown", (ev) => {
      // Ignore inside inputs/textareas
      const tag = (ev.target.tagName || "").toLowerCase();
      const inInput = tag === "input" || tag === "textarea" || tag === "select" || ev.target.isContentEditable;

      // Ctrl+1..7 — switch tabs
      if (ev.ctrlKey && !ev.altKey && !ev.shiftKey && ev.key >= "1" && ev.key <= "7") {
        const idx = Number(ev.key) - 1;
        if (idx < TABS.length) { ev.preventDefault(); switchTab(TABS[idx]); }
        return;
      }

      // Ctrl+K — focus slash command input
      if (ev.ctrlKey && !ev.altKey && !ev.shiftKey && (ev.key === "k" || ev.key === "K")) {
        ev.preventDefault();
        const sl = $("#slash-input");
        if (sl) { switchTab("network"); sl.focus(); sl.select(); }
        return;
      }

      // Esc — clear active search / slash input
      if (ev.key === "Escape" && !inInput) {
        const search = $("#filter-search");
        const slash = $("#slash-input");
        if (search && search.value) { search.value = ""; state.filters.search = ""; state.page = 1; renderList(); renderPagination(); }
        if (slash && slash.value) { slash.value = ""; }
        const help = $("#slash-help"); if (help) help.style.display = "none";
        return;
      }
    });

    // Composer bindings — read-only feedback, never overwrite while typing.
    $("#cmp-method").addEventListener("change", (e) => { state.composer.method = e.target.value; });
    $("#cmp-url").addEventListener("input", (e) => { state.composer.url = e.target.value; });
    $("#cmp-headers").addEventListener("input", (e) => { state.composer.headers = e.target.value; });
    $("#cmp-body").addEventListener("input", (e) => { state.composer.body = e.target.value; });
    $("#cmp-send").addEventListener("click", executeComposer);

    // Preset search
    $("#preset-search").addEventListener("input", (e) => {
      state.presetSearch = e.target.value;
      renderPresets();
    });

    // Preset clicks (event delegation)
    $("#preset-list").addEventListener("click", (e) => {
      const useBtn = e.target.closest("[data-preset-use]");
      const sendBtn = e.target.closest("[data-preset-send]");
      if (useBtn) loadPreset(useBtn.dataset.presetUse, false);
      if (sendBtn) loadPreset(sendBtn.dataset.presetSend, true);
    });

    // Chain bindings
    $("#chain-json").addEventListener("input", (e) => { state.chain.jsonText = e.target.value; });
    $("#chain-validate").addEventListener("click", validateChainFromUI);
    $("#chain-run").addEventListener("click", runChainFromUI);
    $("#chain-templates").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tpl]");
      if (!btn) return;
      loadChainTemplate(btn.dataset.tpl);
    });

    // Request list clicks (event delegation)
    $("#req-list").addEventListener("click", (e) => {
      const check = e.target.closest("[data-chain-pick]");
      if (check) {
        const id = check.dataset.chainPick;
        if (check.checked) state.selectedForChain.add(id);
        else state.selectedForChain.delete(id);
        updateChainImportBar();
        e.stopPropagation();
        return;
      }
      const item = e.target.closest("[data-req-id]");
      if (!item) return;
      state.selectedRequestId = item.dataset.reqId;
      renderList();
      renderDetail();
    });

    // Chain import bar
    $("#chain-import-btn").addEventListener("click", importSelectedToChain);
    $("#chain-sel-clear").addEventListener("click", () => {
      state.selectedForChain.clear();
      updateChainImportBar();
      renderList();
    });

    // Slash command palette (Fase 4)
    const slashInput = $("#slash-input");
    if (slashInput) {
      slashInput.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        const raw = slashInput.value.trim();
        if (!raw) return;
        runSlashCommand(raw);
        slashInput.value = "";
      });
    }

    // Detail tab clicks (delegation)
    $("#detail").addEventListener("click", (e) => {
      const tab = e.target.closest("[data-dtab]");
      const action = e.target.closest("[data-detail-act]");
      if (tab) { state.detailTab = tab.dataset.dtab; renderDetail(); return; }
      if (action) handleDetailAction(action.dataset.detailAct);
    });

    // Pagination delegation
    $("#pagination").addEventListener("click", (e) => {
      if (e.target.matches("[data-page-prev]")) { state.page = Math.max(1, state.page - 1); renderList(); renderPagination(); }
      if (e.target.matches("[data-page-next]")) {
        const total = Math.max(1, Math.ceil(filteredRequests().length / state.pageSize));
        state.page = Math.min(total, state.page + 1);
        renderList(); renderPagination();
      }
    });
  }

  function switchTab(name) {
    state.mainTab = name;
    $$(".tabs-main .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    ["network","composer","chain","analyzer","presets","scripts","wsint","diag"].forEach((n) => {
      const v = document.getElementById(`view-${n}`);
      if (v) v.style.display = (n === name) ? "flex" : "none";
    });
    if (name === "presets") renderPresets();
    if (name === "diag") renderDiag();
    if (name === "chain") ensureChainTemplatesLoaded();
    if (name === "analyzer") renderAnalyzer();
    if (name === "scripts") renderScriptsTab();
    if (name === "wsint") {
      activateWsConsole();
    }
  }

  function renderWsConsoleFailure(error) {
    const root = document.getElementById("wsint-root");
    if (!root) return;
    const message = error?.message || String(error || "Falha desconhecida");
    root.innerHTML = `
      <div class="wsint-empty">
        Módulo WS Intercept não carregou: ${escapeHtml(message)}<br>
        Recarregue a extensão; se persistir, gere novamente o build Hyper RB v4.4.3.
      </div>`;
  }

  function ensureWsConsoleLoaded() {
    if (window.__BURP_WS_CONSOLE__?.activate) return Promise.resolve(window.__BURP_WS_CONSOLE__);
    if (wsConsoleLoadPromise) return wsConsoleLoadPromise;
    wsConsoleLoadPromise = new Promise((resolve, reject) => {
      let src;
      try { src = chrome.runtime.getURL("burp_ws_console.js"); }
      catch (e) { reject(e); return; }

      const existing = document.querySelector('script[data-hyper-rb-ws-console="true"]');
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.src = `${src}?_r=${Date.now()}`;
      script.async = false;
      script.dataset.hyperRbWsConsole = "true";
      script.onload = () => {
        if (window.__BURP_WS_CONSOLE__?.activate) resolve(window.__BURP_WS_CONSOLE__);
        else reject(new Error("burp_ws_console.js carregou, mas não registrou __BURP_WS_CONSOLE__"));
      };
      script.onerror = () => reject(new Error("burp_ws_console.js ausente ou bloqueado no build instalado"));
      (document.head || document.documentElement).appendChild(script);
    }).catch((error) => {
      wsConsoleLoadPromise = null;
      throw error;
    });
    return wsConsoleLoadPromise;
  }

  async function activateWsConsole() {
    const root = document.getElementById("wsint-root");
    if (root && !window.__BURP_WS_CONSOLE__?.activate) {
      root.innerHTML = `<div class="wsint-empty">Inicializando WS Interceptor…</div>`;
    }
    try {
      const wsConsole = await ensureWsConsoleLoaded();
      wsConsole.activate();
    } catch (e) {
      console.warn("[Hyper RB] WS console activate falhou", e);
      renderWsConsoleFailure(e);
    }
  }

  // ---------- Segmented renderers ----------

  function renderList() {
    const list = $("#req-list");
    if (!list) return;
    const entries = pagedRequests();
    if (!entries.length) {
      list.innerHTML = `<div class="empty">Nenhuma request capturada ainda.<br>Abra <b>lovable.dev</b> e interaja.</div>`;
      return;
    }
    list.innerHTML = entries.map((e) => `
      <div class="req-item ${e.id === state.selectedRequestId ? "active" : ""}" data-req-id="${escapeHtml(e.id)}">
        <input type="checkbox" class="req-check" data-chain-pick="${escapeHtml(e.id)}" ${state.selectedForChain.has(e.id) ? "checked" : ""} title="Adicionar à chain importada" />
        <div class="req-top">
          <span class="method-pill ${methodCls(e.method)}">${escapeHtml(e.method || "GET")}</span>
          <span class="status ${statusCls(e.status)}">${escapeHtml(e.status || 0)}</span>
        </div>
        <div class="req-url">${escapeHtml(e.url || "")}</div>
        <div class="req-meta">
          <span>${escapeHtml(e.kind || "fetch")}</span>
          <span>${fmtMs(e.timingMs)}</span>
          <span>${fmtBytes(e.responseSize)}</span>
        </div>
      </div>
    `).join("");
  }

  function updateChainImportBar() {
    const count = state.selectedForChain.size;
    const lbl = $("#chain-sel-count");
    const btn = $("#chain-import-btn");
    const clr = $("#chain-sel-clear");
    if (lbl) lbl.textContent = `${count} selecionada${count === 1 ? "" : "s"}`;
    if (btn) btn.disabled = count === 0 || count > 10;
    if (clr) clr.disabled = count === 0;
    if (lbl) lbl.classList.toggle("over", count > 10);
  }

  function renderDetail() {
    const pane = $("#detail");
    if (!pane) return;
    const e = selectedRequest();
    if (!e) {
      pane.innerHTML = `<div class="empty">Selecione uma request à esquerda.</div>`;
      return;
    }
    const tab = state.detailTab;
    const tabs = ["overview","request","response","timing"];
    const tabBar = `<div class="detail-tabs">${tabs.map((t) => `<button class="tab ${tab===t?"active":""}" data-dtab="${t}">${t}</button>`).join("")}</div>`;

    let body = "";
    if (tab === "overview") {
      body = `
        <div class="card">
          <div class="card-label">Resumo</div>
          <div class="kv">
            <div class="kv-row"><div class="kv-key">URL</div><div>${escapeHtml(e.url)}</div></div>
            <div class="kv-row"><div class="kv-key">Método</div><div>${escapeHtml(e.method)}</div></div>
            <div class="kv-row"><div class="kv-key">Status</div><div class="${statusCls(e.status)}">${escapeHtml(e.status||0)} ${escapeHtml(e.statusText||"")}</div></div>
            <div class="kv-row"><div class="kv-key">Tempo</div><div>${fmtMs(e.timingMs)}</div></div>
            <div class="kv-row"><div class="kv-key">Tamanho</div><div>${fmtBytes(e.responseSize)}</div></div>
            <div class="kv-row"><div class="kv-key">Capturada</div><div>${fmtDate(e.startedAt)}</div></div>
          </div>
        </div>`;
    } else if (tab === "request") {
      body = `
        <div class="card"><div class="card-label">Headers</div><pre>${escapeHtml(fmtCode(e.requestHeaders || {}))}</pre></div>
        <div class="card"><div class="card-label">Body</div><pre>${escapeHtml(fmtCode(e.requestBody))}</pre></div>`;
    } else if (tab === "response") {
      body = `
        <div class="card"><div class="card-label">Headers</div><pre>${escapeHtml(fmtCode(e.responseHeaders || {}))}</pre></div>
        <div class="card"><div class="card-label">Body</div><pre>${escapeHtml(fmtCode(e.responseBody))}</pre></div>
        ${Array.isArray(e.wsFrames) && e.wsFrames.length ? `
          <div class="card"><div class="card-label">WebSocket Frames (${e.wsFrames.length})</div>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:340px; overflow:auto;">
              ${e.wsFrames.map((f) => `
                <div style="border-left:3px solid ${f.direction==='send'?'#bf00ff':f.direction==='recv'?'#33c987':f.direction==='close'?'#888':'#ff5577'}; padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:6px;">
                  <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.1em; opacity:0.7; display:flex; gap:8px; justify-content:space-between;">
                    <span>${f.direction === 'send' ? '↑ SEND' : f.direction === 'recv' ? '↓ RECV' : f.direction.toUpperCase()} · #${f.frameIndex}</span>
                    <span>${escapeHtml(new Date(f.timestamp).toLocaleTimeString('pt-BR'))}</span>
                  </div>
                  <pre style="margin:4px 0 0; font-size:11px; white-space:pre-wrap; word-break:break-all;">${escapeHtml(String(f.payload || '').slice(0, 1200))}</pre>
                </div>
              `).join("")}
            </div>
          </div>` : ""}`;
    } else {
      body = `
        <div class="card"><div class="card-label">Timing</div>
          <div class="kv">
            <div class="kv-row"><div class="kv-key">Total</div><div>${fmtMs(e.timingMs)}</div></div>
            <div class="kv-row"><div class="kv-key">Início</div><div>${fmtDate(e.startedAt)}</div></div>
            <div class="kv-row"><div class="kv-key">Erro</div><div>${escapeHtml(e.error || "—")}</div></div>
          </div>
        </div>`;
    }

    pane.innerHTML = `
      <div class="detail-head">
        <div class="detail-url">${escapeHtml(e.url || "")}</div>
        <div class="detail-sub">${escapeHtml(e.method)} · ${escapeHtml(e.status||0)} · ${fmtMs(e.timingMs)}</div>
        <div class="detail-tabs" style="margin-top:10px">
          <button class="btn" data-detail-act="to-composer">↗ Composer</button>
          <button class="btn" data-detail-act="ai-explain" title="Explica esta request usando IA (sanitizada)">🧠 Explicar</button>
          <button class="btn" data-detail-act="ai-recipe" title="Gera um preset editável p/ o Composer via IA">🪄 Recipe IA</button>
          <button class="btn" data-detail-act="ai-mutate" title="Sugere mutações seguras p/ fuzzing (IA)">🧪 Mutações</button>
          ${e && (Number(e.status) === 0 || Number(e.status) >= 400) ? `<button class="btn" data-detail-act="ai-diagnose" title="Diagnóstico IA da falha">🩺 Diagnosticar</button>` : ""}
          <button class="btn" data-detail-act="copy-curl">cURL</button>
          <button class="btn" data-detail-act="copy-fetch">fetch()</button>
          <button class="btn" data-detail-act="copy-json">Copy JSON</button>
        </div>
      </div>
      ${tabBar}
      ${body}
      <div class="card" id="ai-explain-card" style="display:none;">
        <div class="card-label">🧠 Explicação IA</div>
        <div id="ai-explain-content" class="ai-explain">—</div>
      </div>
    `;
  }

  function renderPagination() {
    const el = $("#pagination");
    if (!el) return;
    const total = filteredRequests().length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    el.innerHTML = `
      <span>${total} request(s) capturada(s)</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <button class="btn" data-page-prev ${state.page<=1?"disabled":""}>‹</button>
        <span>${state.page} / ${totalPages}</span>
        <button class="btn" data-page-next ${state.page>=totalPages?"disabled":""}>›</button>
      </div>`;
  }

  function renderPresets() {
    const list = $("#preset-list");
    if (!list) return;
    if (!presetsLoaded) {
      list.innerHTML = `<div class="empty">Carregando presets do Supabase…</div>`;
      loadPresetsFromDB().then(() => renderPresets());
      return;
    }
    const q = (state.presetSearch || "").toLowerCase();
    const items = PRESETS.filter((p) =>
      !q || `${p.name} ${p.desc} ${p.tag} ${p.url}`.toLowerCase().includes(q)
    );
    if (!items.length) {
      list.innerHTML = q
        ? `<div class="empty">Nenhum preset corresponde a "${escapeHtml(q)}".</div>`
        : `<div class="empty">Nenhum preset cadastrado. Adicione em <strong>Admin · Hyper RB · Presets</strong>.</div>
           <div style="margin-top:8px"><button class="btn" id="preset-refresh">Recarregar</button></div>`;
      const r = $("#preset-refresh");
      if (r) r.addEventListener("click", () => loadPresetsFromDB(true).then(() => renderPresets()));
      return;
    }
    list.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:11px; opacity:.7;">${items.length} preset(s) · sincronizado com painel</span>
        <button class="btn" id="preset-refresh" style="height:26px; font-size:11px;">↻ Recarregar</button>
      </div>
    ` + items.map((p) => `
      <div class="preset-card">
        <div class="preset-head">
          <div class="preset-name">${escapeHtml(p.name)}</div>
          <span class="preset-tag">${escapeHtml(p.tag)}</span>
        </div>
        <div class="preset-desc">${escapeHtml(p.desc)}</div>
        <div class="preset-url">${escapeHtml(p.method)} ${escapeHtml(p.url)}</div>
        <div class="preset-actions">
          <button class="btn" data-preset-use="${escapeHtml(p.id)}">Carregar no Composer</button>
          <button class="btn-primary" data-preset-send="${escapeHtml(p.id)}" style="height:30px;">Carregar e abrir</button>
        </div>
      </div>
    `).join("");
    const r2 = $("#preset-refresh");
    if (r2) r2.addEventListener("click", () => loadPresetsFromDB(true).then(() => renderPresets()));
  }

  function renderDiag() {
    const el = $("#diag-body");
    if (!el) return;
    const d = state.data || {};
    const diags = d.diagnostics || {};
    const badge = (s) => s === "ready" ? "b-ready" : s === "error" ? "b-err" : "b-wait";
    const hb = d.hbLicense || {};
    el.innerHTML = `
      <div class="status-grid">
        <div class="stat-card">
          <div class="stat-label">Auth Lovable</div>
          <div class="stat-val">${d.auth?.hasBearerToken ? "Capturado" : "Sem token"}</div>
          <div class="stat-meta">${escapeHtml(d.auth?.bearerTokenPreview || "—")}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Requests</div>
          <div class="stat-val">${d.stats?.entryCount || 0}</div>
          <div class="stat-meta">${state.isCapturing ? "Capturando" : "Pausado"}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Projeto Lovable</div>
          <div class="stat-val" style="font-size:11px; font-family:monospace; word-break:break-all;">${escapeHtml(d.auth?.projectId || "—")}</div>
          <div class="stat-meta">${escapeHtml(d.auth?.workspaceId || "—")}</div>
        </div>
      </div>
      <div class="diag-card" style="margin-top:12px">
        <div class="diag-head">
          <div class="diag-title">Licença HyperBuild (opcional)</div>
          <span class="badge ${hb.hasKey ? "b-ready" : "b-wait"}">${hb.hasKey ? "configurada" : "não definida"}</span>
        </div>
        <div class="diag-detail" style="margin-bottom:8px">
          Usada para requests que exigem licença HyperBuild (presets <code>/pc</code>, <code>/cp</code>, etc).
          Substitui o placeholder <code>{{HB_LICENSE}}</code> nos presets.
          ${hb.preview ? `Atual: <code>${escapeHtml(hb.preview)}</code>` : ""}
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="hb-license-input" class="input" type="password" placeholder="HYPER-XXXXXXXXX..." style="flex:1" />
          <button id="hb-license-save" class="btn-primary" style="height:34px; padding:0 16px;">Salvar</button>
          <button id="hb-license-clear" class="btn" style="height:34px;">Limpar</button>
        </div>
        <div id="hb-license-status" class="composer-status" style="margin-top:6px; font-size:11px;">—</div>
      </div>
      ${Object.entries(diags).map(([k, v]) => `
        <div class="diag-card">
          <div class="diag-head">
            <div class="diag-title">${escapeHtml(k)}</div>
            <span class="badge ${badge(v.status)}">${escapeHtml(v.status || "—")}</span>
          </div>
          <div class="diag-detail">${escapeHtml(v.detail || "—")}</div>
        </div>
      `).join("")}
    `;

    const saveBtn = $("#hb-license-save");
    const clearBtn = $("#hb-license-clear");
    const input = $("#hb-license-input");
    const status = $("#hb-license-status");
    saveBtn?.addEventListener("click", async () => {
      const v = input.value.trim();
      if (!v) { status.textContent = "Informe uma licença ou use Limpar."; status.className = "composer-status warn"; return; }
      const res = await sendMessage("BURP_SET_HB_LICENSE", { license: v });
      if (res?.ok) {
        status.textContent = `Licença salva (${res.hbLicense?.preview || "ok"}).`;
        status.className = "composer-status ok";
        input.value = "";
        await refresh();
      } else {
        status.textContent = res?.error || "Falha ao salvar.";
        status.className = "composer-status err";
      }
    });
    clearBtn?.addEventListener("click", async () => {
      const res = await sendMessage("BURP_SET_HB_LICENSE", { license: "" });
      if (res?.ok) {
        status.textContent = "Licença removida.";
        status.className = "composer-status ok";
        await refresh();
      }
    });
  }

  // ---------- Composer actions ----------
  function setComposerStatus(text, kind = "idle") {
    const el = $("#cmp-status");
    if (!el) return;
    el.textContent = text;
    el.className = `composer-status ${kind}`;
  }

  // Substitui placeholders {{X}} recursivamente em qualquer string usando o
  // mapa de credenciais capturadas. Se um valor não estiver disponível,
  // mantém o placeholder e devolve a lista de pendências para alertar o user.
  function substitutePlaceholders(value, creds, missing) {
    const TOKEN_MAP = {
      LICENSE_KEY: creds.license_key,
      DEVICE_ID: creds.device_id,
      SESSION_ID: creds.session_id,
      LOVABLE_TOKEN: creds.lovable_token,
      PROJECT_ID: creds.project_id,
      WORKSPACE_ID: creds.workspace_id,
      HB_LICENSE: creds.hb_license,
      SUPABASE_URL: creds.supabase_url,
      SUPABASE_ANON_KEY: creds.supabase_anon_key,
      FINDING_ID: creds.finding_id,
    };
    // Special "raw" tokens that must replace the entire string value with a
    // non-string JS value (e.g. an array). Used for fields like finding_ids.
    const RAW_TOKEN_MAP = {
      FINDING_IDS: Array.isArray(creds.finding_ids) && creds.finding_ids.length
        ? creds.finding_ids
        : (creds.finding_id ? [creds.finding_id] : null),
    };
    if (typeof value === "string") {
      // Whole-string raw replacement: "{{FINDING_IDS}}" => actual array
      const rawMatch = value.match(/^\{\{([A-Z_]+)\}\}$/);
      if (rawMatch && Object.prototype.hasOwnProperty.call(RAW_TOKEN_MAP, rawMatch[1])) {
        const raw = RAW_TOKEN_MAP[rawMatch[1]];
        if (raw == null) {
          if (!missing.includes(rawMatch[1])) missing.push(rawMatch[1]);
          return value;
        }
        return raw;
      }
      return value.replace(/\{\{([A-Z_]+)\}\}/g, (full, key) => {
        if (TOKEN_MAP[key] != null && TOKEN_MAP[key] !== "") return String(TOKEN_MAP[key]);
        if (!missing.includes(key)) missing.push(key);
        return full;
      });
    }
    if (Array.isArray(value)) return value.map((v) => substitutePlaceholders(v, creds, missing));
    if (value && typeof value === "object") {
      const out = {};
      for (const k of Object.keys(value)) out[k] = substitutePlaceholders(value[k], creds, missing);
      return out;
    }
    return value;
  }

  async function loadPreset(id, openComposer) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;

    let creds = {};
    try {
      const res = await sendMessage("BURP_GET_CREDENTIALS");
      if (res?.ok && res.credentials) creds = res.credentials;
    } catch (err) {
      console.warn("[Hyper RB] falha ao carregar credenciais capturadas", err);
    }

    const missing = [];
    const url = substitutePlaceholders(p.url, creds, missing);
    const headers = p.headers ? substitutePlaceholders(p.headers, creds, missing) : null;
    const body = p.body == null ? null : substitutePlaceholders(p.body, creds, missing);

    state.composer.method = p.method;
    state.composer.url = url;
    state.composer.headers = headers ? JSON.stringify(headers, null, 2) : "";
    state.composer.body = body == null ? "" : JSON.stringify(body, null, 2);
    $("#cmp-method").value = p.method;
    $("#cmp-url").value = url;
    $("#cmp-headers").value = state.composer.headers;
    $("#cmp-body").value = state.composer.body;

    if (missing.length) {
      setComposerStatus(
        `Preset "${p.name}" carregado, mas faltam dados capturados: ${missing.join(", ")}. Abra lovable.dev / faça login na extensão.`,
        "warn"
      );
    } else {
      setComposerStatus(`Preset "${p.name}" carregado com credenciais capturadas.`, "ok");
    }
    if (openComposer) switchTab("composer");
  }

  // ---------- HAR export ----------
  async function exportHar() {
    try {
      const res = await sendMessage("BURP_EXPORT_HAR");
      if (!res?.ok) throw new Error(res?.error || "Falha ao gerar HAR");
      const blob = new Blob([JSON.stringify(res.har, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `hyper-rb-${ts}.har`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      showToast(`Falha ao exportar HAR: ${err.message || err}`, 'err');
    }
  }

  // ---------- Postman v2.1 export (B.12 / Fase 5) ----------
  function exportPostman() {
    const raw = state.data?.network;
    const entries = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
    if (!entries.length) { showToast("Nada para exportar.", "warn"); return; }
    const items = entries.map((e) => {
      let parsedUrl;
      try { parsedUrl = new URL(e.url); } catch { parsedUrl = null; }
      const headerArr = Object.entries(e.requestHeaders || {}).map(([k, v]) => ({ key: k, value: String(v) }));
      const rawBody = e.requestBody == null ? "" :
        typeof e.requestBody === "string" ? e.requestBody : JSON.stringify(e.requestBody);
      return {
        name: `${e.method || "GET"} ${parsedUrl?.pathname || e.url || ""}`.slice(0, 100),
        request: {
          method: String(e.method || "GET").toUpperCase(),
          header: headerArr,
          body: rawBody ? { mode: "raw", raw: rawBody, options: { raw: { language: "json" } } } : undefined,
          url: parsedUrl ? {
            raw: e.url,
            protocol: parsedUrl.protocol.replace(":", ""),
            host: parsedUrl.hostname.split("."),
            path: parsedUrl.pathname.split("/").filter(Boolean),
            query: Array.from(parsedUrl.searchParams.entries()).map(([key, value]) => ({ key, value })),
          } : { raw: e.url || "" },
        },
        response: [],
      };
    });
    const collection = {
      info: {
        name: `Hyper RB · ${new Date().toLocaleString("pt-BR")}`,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        _exporter_id: "hyper-rb",
      },
      item: items,
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url; a.download = `hyper-rb-${ts}.postman_collection.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadEntryIntoComposer(e) {
    // Postman v2.1 export (Fase 5 — B.12) precisa estar acessível antes do uso.
    if (!e) return;
    state.composer.method = String(e.method || "GET").toUpperCase();
    state.composer.url = e.url || "";
    state.composer.headers = e.requestHeaders ? JSON.stringify(e.requestHeaders, null, 2) : "";
    let body = e.requestBody;
    if (body && typeof body !== "string") { try { body = JSON.stringify(body, null, 2); } catch { body = String(body); } }
    state.composer.body = body || "";
    $("#cmp-method").value = state.composer.method;
    $("#cmp-url").value = state.composer.url;
    $("#cmp-headers").value = state.composer.headers;
    $("#cmp-body").value = state.composer.body;
  }

  function handleDetailAction(act) {
    const e = selectedRequest();
    if (!e) return;
    if (act === "to-composer") {
      loadEntryIntoComposer(e);
      switchTab("composer");
      setComposerStatus("Request carregada do interceptor.", "ok");
      return;
    }
    if (act === "copy-curl") {
      const _headerParts = Object.entries(e.requestHeaders || {})
        .map(([k, v]) => `  -H ${shq(`${k}: ${v}`)}`);
      const _rawBody = typeof e.requestBody === "string"
        ? e.requestBody
        : (e.requestBody ? JSON.stringify(e.requestBody) : "");
      const _parts = [`curl -X ${e.method} ${shq(e.url)}`, ..._headerParts];
      if (_rawBody) _parts.push(`  --data-raw ${shq(_rawBody)}`);
      const _curl = _parts.join(" \\\n");
      navigator.clipboard.writeText(_curl).catch(() => {});
    }
    if (act === "copy-fetch") {
      const snippet = `fetch(${JSON.stringify(e.url)}, ${JSON.stringify({method:e.method,headers:e.requestHeaders||{},body:e.requestBody||undefined},null,2)})`;
      navigator.clipboard.writeText(snippet).catch(()=>{});
    }
    if (act === "copy-json") {
      navigator.clipboard.writeText(fmtCode(e.responseJson || parseJsonSafe(e.responseBody) || e.requestBody)).catch(()=>{});
    }
    if (act === "ai-explain") {
      runAiExplain(e);
    }
    if (act === "ai-recipe") {
      runAiRecipe(e);
    }
    if (act === "ai-mutate") {
      runAiSimple(e, "BURP_AI_MUTATE", "🧪 Mutações IA", "Gerando sugestões de mutação…");
    }
    if (act === "ai-diagnose") {
      runAiSimple(e, "BURP_AI_DIAGNOSE", "🩺 Diagnóstico IA", "Diagnosticando falha…");
    }
  }

  async function runAiSimple(entry, msgType, title, loadingTxt) {
    const card = document.getElementById("ai-explain-card");
    const content = document.getElementById("ai-explain-content");
    if (!card || !content) return;
    card.style.display = "block";
    content.innerHTML = `<span class="ai-loading">${escapeHtml(loadingTxt)}</span>`;
    try {
      const res = await sendMessage(msgType, { entryId: entry.id });
      if (!res?.ok) {
        content.innerHTML = `<span class="ai-error">${escapeHtml(res?.error || "Falha.")}</span>`;
        return;
      }
      const md = String(res.content || "").trim() || "(resposta vazia)";
      const tag = res.cached ? `<span class="ai-tag">cache</span>` : `<span class="ai-tag ai-tag-live">live</span>`;
      content.innerHTML = `${tag}<div class="ai-recipe-name">${escapeHtml(title)}</div><pre class="ai-markdown">${escapeHtml(md)}</pre>`;
    } catch (err) {
      content.innerHTML = `<span class="ai-error">${escapeHtml(err.message || String(err))}</span>`;
    }
  }

  async function runAiExplain(entry) {
    const card = document.getElementById("ai-explain-card");
    const content = document.getElementById("ai-explain-content");
    if (!card || !content) return;
    card.style.display = "block";
    content.innerHTML = `<span class="ai-loading">Analisando request com IA…</span>`;
    try {
      const res = await sendMessage("BURP_AI_EXPLAIN", { entryId: entry.id });
      if (!res?.ok) {
        content.innerHTML = `<span class="ai-error">${escapeHtml(res?.error || "Falha ao explicar request.")}</span>`;
        return;
      }
      const md = String(res.content || "").trim() || "(resposta vazia)";
      const tag = res.cached ? `<span class="ai-tag">cache</span>` : `<span class="ai-tag ai-tag-live">live</span>`;
      content.innerHTML = `${tag}<pre class="ai-markdown">${escapeHtml(md)}</pre>`;
    } catch (err) {
      content.innerHTML = `<span class="ai-error">${escapeHtml(err.message || String(err))}</span>`;
    }
  }

  async function runAiRecipe(entry) {
    const card = document.getElementById("ai-explain-card");
    const content = document.getElementById("ai-explain-content");
    if (!card || !content) return;
    card.style.display = "block";
    content.innerHTML = `<span class="ai-loading">Gerando recipe IA…</span>`;
    try {
      const res = await sendMessage("BURP_AI_RECIPE", { entryId: entry.id });
      if (!res?.ok || !res.recipe) {
        content.innerHTML = `<span class="ai-error">${escapeHtml(res?.error || "Falha ao gerar recipe.")}</span>`;
        return;
      }
      const r = res.recipe;
      const tag = res.cached ? `<span class="ai-tag">cache</span>` : `<span class="ai-tag ai-tag-live">live</span>`;
      content.innerHTML = `
        ${tag}
        <div class="ai-recipe">
          <div class="ai-recipe-name">🪄 ${escapeHtml(r.name || "Recipe")}</div>
          <div class="ai-recipe-desc">${escapeHtml(r.description || "")}</div>
          <pre class="ai-markdown">${escapeHtml(fmtCode({ method: r.method, url: r.url, headers: r.headers || {}, body: r.body ?? "" }))}</pre>
          <button class="btn-primary" id="ai-recipe-load" style="height:30px;">Carregar no Composer</button>
        </div>`;
      $("#ai-recipe-load")?.addEventListener("click", () => loadRecipeIntoComposer(r));
    } catch (err) {
      content.innerHTML = `<span class="ai-error">${escapeHtml(err.message || String(err))}</span>`;
    }
  }

  function loadRecipeIntoComposer(recipe) {
    const method = String(recipe.method || "GET").toUpperCase();
    const url = String(recipe.url || "");
    const headers = recipe.headers && typeof recipe.headers === "object" ? recipe.headers : {};
    const body = recipe.body == null || recipe.body === "" ? "" :
      (typeof recipe.body === "string" ? recipe.body : JSON.stringify(recipe.body, null, 2));
    state.composer.method = method;
    state.composer.url = url;
    state.composer.headers = Object.keys(headers).length ? JSON.stringify(headers, null, 2) : "";
    state.composer.body = body;
    $("#cmp-method").value = method;
    $("#cmp-url").value = url;
    $("#cmp-headers").value = state.composer.headers;
    $("#cmp-body").value = body;
    switchTab("composer");
    setComposerStatus("Recipe IA carregado. Edite os placeholders {{...}} se precisar.", "ok");
  }

  async function importSelectedToChain() {
    const ids = Array.from(state.selectedForChain);
    if (!ids.length) return;
    if (ids.length > 10) return;
    // Preserve a ordem de captura (mais antigos primeiro).
    // B-3: normalise network store
    const order = asArray(state.data?.network).map((n) => n.id);
    const ordered = ids.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    try {
      const res = await sendMessage("BURP_BUILD_CHAIN_FROM_ENTRIES", { entryIds: ordered });
      if (!res?.ok || !res.chain) {
        showToast(res?.error || "Falha ao montar chain.", 'err');
        return;
      }
      state.chain.jsonText = JSON.stringify(res.chain, null, 2);
      const ta = $("#chain-json");
      if (ta) ta.value = state.chain.jsonText;
      state.selectedForChain.clear();
      updateChainImportBar();
      renderList();
      switchTab("chain");
      const statusEl = $("#chain-status");
      if (statusEl) {
        statusEl.textContent = `Chain importada com ${res.chain.steps.length} steps. Revise placeholders e clique Validar.`;
        statusEl.className = "composer-status ok";
      }
    } catch (e) {
      showToast(e?.message || String(e), 'err');
    }
  }

  async function executeComposer() {
    const btn = $("#cmp-send");
    if (state.composer.sending) return;
    state.composer.sending = true;
    btn.disabled = true;
    setComposerStatus("Enviando via edge function /burp...", "idle");

    const url = $("#cmp-url").value.trim();
    const method = $("#cmp-method").value;
    const headersTxt = $("#cmp-headers").value.trim();
    const bodyTxt = $("#cmp-body").value.trim();

    let headers = {};
    if (headersTxt) {
      try { headers = JSON.parse(headersTxt); }
      catch { setComposerStatus("Headers: JSON inválido.", "err"); state.composer.sending=false; btn.disabled=false; return; }
    }
    let body = null;
    if (bodyTxt) { try { body = JSON.parse(bodyTxt); } catch { body = bodyTxt; } }

    try {
      const res = await sendMessage("BURP_EXECUTE_REQUEST", { url, method, headers, body });
      const respEl = document.getElementById("cmp-response");
      if (!res?.ok) {
        setComposerStatus(res?.error || "Falha ao executar request.", "err");
        if (respEl) respEl.textContent = res?.error || "Falha ao executar request.";
      } else {
        const r = res.result || {};
        if (r.mappedError) {
          const m = r.mappedError;
          setComposerStatus(
            `${m.error_code} · ${m.error_display}. ${m.user_action || ""}`.trim(),
            "warn"
          );
        } else {
          setComposerStatus(
            `OK — status ${r.status ?? "?"} (${fmtMs(r.timingMs)})`,
            r.status >= 400 ? "warn" : "ok"
          );
        }
        if (respEl) {
          const headerLines = r.responseHeaders
            ? Object.entries(r.responseHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")
            : "";
          const rawBody = r.responseBody != null
            ? (typeof r.responseBody === "string" ? r.responseBody : JSON.stringify(r.responseBody, null, 2))
            : "(sem corpo)";
          const body = rawBody.length > 16000 ? rawBody.slice(0, 16000) + "\n…[truncated]" : rawBody;
          respEl.textContent = `HTTP ${r.status ?? "?"} (${fmtMs(r.timingMs)})\n${headerLines}\n\n${body}`;
        }
        if (res.state) { state.data = res.state; renderList(); renderPagination(); }
        if (r.id) {
          state.selectedRequestId = r.id;
          renderDetail();
          // E5 — diagnóstico IA automático em falhas (4xx/5xx ou status 0)
          const st = Number(r.status || 0);
          if (st === 0 || st >= 400) {
            const failed = asArray(state.data?.network).find((n) => n.id === r.id);
            if (failed) runAiSimple(failed, "BURP_AI_DIAGNOSE", "🩺 Diagnóstico IA (auto)", "Analisando falha…");
          }
        }
      }
    } catch (err) {
      setComposerStatus(err.message || String(err), "err");
    } finally {
      state.composer.sending = false;
      btn.disabled = false;
    }
  }

  // ---------- Chain (Composer Sequence Mode) ----------
  function setChainStatus(text, kind) {
    const el = $("#chain-status");
    if (!el) return;
    el.textContent = text;
    el.className = `composer-status ${kind || "idle"}`;
  }

  async function ensureChainTemplatesLoaded() {
    if (state.chain.templates.length) { renderChainTemplates(); return; }
    try {
      const res = await sendMessage("BURP_GET_CHAIN_TEMPLATES");
      if (res?.ok) state.chain.templates = res.templates || [];
    } catch {}
    renderChainTemplates();
  }

  function renderChainTemplates() {
    const host = $("#chain-templates");
    if (!host) return;
    if (!state.chain.templates.length) { host.textContent = "Nenhum template disponível."; return; }
    host.innerHTML = state.chain.templates.map((t) =>
      `<button class="btn" data-tpl="${escapeHtml(t.id)}" title="${escapeHtml(t.description || "")}">${escapeHtml(t.name)}</button>`
    ).join(" ");
  }

  function loadChainTemplate(id) {
    const tpl = state.chain.templates.find((t) => t.id === id);
    if (!tpl) return;
    state.chain.jsonText = JSON.stringify(tpl.chain, null, 2);
    const ta = $("#chain-json");
    if (ta) ta.value = state.chain.jsonText;
    setChainStatus(`Template "${tpl.name}" carregado. Ajuste vars/headers e execute.`, "ok");
  }

  function parseChainFromUI() {
    const txt = ($("#chain-json").value || "").trim();
    if (!txt) { setChainStatus("Cole ou carregue uma chain primeiro.", "warn"); return null; }
    try { return JSON.parse(txt); }
    catch (e) { setChainStatus(`JSON inválido: ${e.message}`, "err"); return null; }
  }

  function validateChainFromUI() {
    const chain = parseChainFromUI();
    if (!chain) return;
    const Chains = self.HyperRBChains;
    if (!Chains) { setChainStatus("Módulo de chains não carregado.", "err"); return; }
    const { valid, errors } = Chains.validateChain(chain);
    if (valid) setChainStatus(`Chain OK — ${chain.steps.length} step(s).`, "ok");
    else setChainStatus(`Inválida: ${errors.join("; ")}`, "err");
  }

  function renderChainProgress() {
    const host = $("#chain-progress");
    if (!host) return;
    const items = state.chain.progress;
    if (!items.length && !state.chain.summary) { host.textContent = "Nenhuma execução ainda."; return; }
    const rows = items.map((p) => {
      const cls = p.stage === "step:ok" ? "s-ok" : p.stage === "step:failed" ? "s-err" : "";
      const label = p.stage.replace("step:", "");
      const extra = p.error ? ` — ${escapeHtml(p.error)}` : (p.status ? ` (HTTP ${p.status}${p.ms ? `, ${p.ms}ms` : ""})` : "");
      return `<div class="chain-step-row ${cls}"><span class="mono">${escapeHtml(p.stepId || "—")}</span> <b>${escapeHtml(label)}</b>${extra}</div>`;
    }).join("");
    const summary = state.chain.summary
      ? `<div class="chain-summary"><b>Done.</b> ${state.chain.summary.okCount}/${state.chain.summary.executed} ok · ${fmtMs(state.chain.summary.durationMs)}</div>`
      : "";
    host.innerHTML = rows + summary;
  }

  async function runChainFromUI() {
    if (state.chain.running) return;
    const chain = parseChainFromUI();
    if (!chain) return;
    const Chains = self.HyperRBChains;
    if (!Chains) { setChainStatus("Módulo de chains não carregado. Recarregue a extensão.", "err"); return; }
    const { valid, errors } = Chains.validateChain(chain);
    if (!valid) { setChainStatus(`Inválida: ${errors.join("; ")}`, "err"); return; }

    state.chain.running = true;
    state.chain.progress = [];
    state.chain.summary = null;
    renderChainProgress();
    setChainStatus(`Executando ${chain.steps.length} step(s)…`, "idle");
    const btn = $("#chain-run");
    if (btn) btn.disabled = true;

    try {
      const res = await sendMessage("BURP_EXECUTE_CHAIN", { chain });
      if (!res?.ok) {
        setChainStatus(res?.error || "Falha ao executar chain.", "err");
      } else {
        state.chain.summary = res.summary;
        // B-4: null-guard res.summary
        const ok = res.summary?.okCount === res.summary?.executed;
        setChainStatus(`Chain finalizada — ${res.summary?.okCount ?? "?"}/${res.summary?.executed ?? "?"} OK (${fmtMs(res.summary?.durationMs)})`, ok ? "ok" : "warn");
        renderChainProgress();
        if (res.state) { state.data = res.state; if (state.mainTab === "network") { renderList(); renderPagination(); } }
      }
    } catch (err) {
      setChainStatus(err.message || String(err), "err");
    } finally {
      state.chain.running = false;
      if (btn) btn.disabled = false;
    }
  }

  // ---------- Network Analyzer (Fase 4) ----------
  // Agrupa entries por (METHOD + endpoint), calcula avg/p95, taxa de erro
  // e mostra top latência + status. Nenhuma dependência de IA — IA é opcional.
  function endpointKey(e) {
    let path = "";
    try { path = new URL(e.url).pathname || ""; } catch { path = e.url || ""; }
    // colapsa segmentos que parecem ID (uuid, hex, números longos)
    path = path.replace(/\/[0-9a-f]{8,}(?=\/|$)/gi, "/:id")
               .replace(/\/\d{4,}(?=\/|$)/g, "/:id");
    return `${String(e.method || "GET").toUpperCase()} ${path}`;
  }
  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  }
  function computeAnalyzerMetrics() {
    // B-2: normalise network before iterating
    const all = asArray(state.data?.network);
    const total = all.length;
    if (!total) return { total: 0, errors: 0, errorRate: 0, avgMs: 0, p95Ms: 0, endpoints: [], slowest: [], statusDist: {} };
    const errors = all.filter((e) => Number(e.status) === 0 || Number(e.status) >= 400).length;
    const times = all.map((e) => Number(e.timingMs || 0)).filter((n) => n >= 0).sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const avgMs = times.length ? Math.round(sum / times.length) : 0;
    const p95Ms = Math.round(percentile(times, 95));
    // Agrupamento por endpoint
    const groups = new Map();
    for (const e of all) {
      const k = endpointKey(e);
      const g = groups.get(k) || { key: k, count: 0, sumMs: 0, errors: 0, statuses: [], times: [] };
      g.count += 1;
      g.sumMs += Number(e.timingMs || 0);
      g.times.push(Number(e.timingMs || 0));
      const st = Number(e.status || 0);
      g.statuses.push(st);
      if (st === 0 || st >= 400) g.errors += 1;
      groups.set(k, g);
    }
    const endpoints = Array.from(groups.values()).map((g) => {
      const sorted = g.times.slice().sort((a, b) => a - b);
      return {
        key: g.key,
        count: g.count,
        avgMs: Math.round(g.sumMs / g.count),
        p95Ms: Math.round(percentile(sorted, 95)),
        errors: g.errors,
        errorRate: g.count ? g.errors / g.count : 0,
      };
    }).sort((a, b) => b.count - a.count);
    const slowest = all.slice().sort((a, b) => Number(b.timingMs || 0) - Number(a.timingMs || 0)).slice(0, 8);
    const statusDist = {};
    for (const e of all) {
      const bucket = Number(e.status) === 0 ? "ERR" :
        Number(e.status) < 200 ? "1xx" :
        Number(e.status) < 300 ? "2xx" :
        Number(e.status) < 400 ? "3xx" :
        Number(e.status) < 500 ? "4xx" : "5xx";
      statusDist[bucket] = (statusDist[bucket] || 0) + 1;
    }
    return { total, errors, errorRate: errors / total, avgMs, p95Ms, endpoints, slowest, statusDist };
  }

  function renderAnalyzer() {
    const host = $("#analyzer-body");
    if (!host) return;
    const m = computeAnalyzerMetrics();
    if (!m.total) {
      host.innerHTML = `<div class="empty">Nenhuma request capturada ainda. Use a aba Network primeiro.</div>`;
      return;
    }
    const topByVol = m.endpoints.slice(0, 8);
    const topByLat = m.endpoints.slice().sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 8);
    // B.10 — Error Pattern Miner (agrupa 4xx/5xx por endpoint + sample do response)
    const errorEntries = asArray(state.data?.network).filter((e) => Number(e.status) === 0 || Number(e.status) >= 400);
    const errorGroups = new Map();
    for (const e of errorEntries) {
      const k = endpointKey(e);
      const g = errorGroups.get(k) || { key: k, count: 0, statuses: new Set(), sample: null };
      g.count += 1;
      g.statuses.add(String(e.status || 0));
      if (!g.sample) g.sample = e;
      errorGroups.set(k, g);
    }
    const errorPatterns = Array.from(errorGroups.values()).sort((a, b) => b.count - a.count).slice(0, 6);
    const errClass = m.errorRate >= 0.2 ? "err" : m.errorRate >= 0.05 ? "warn" : "";
    const latClass = m.p95Ms >= 2000 ? "err" : m.p95Ms >= 800 ? "warn" : "";
    const statusRow = Object.entries(m.statusDist)
      .map(([k, v]) => `<span class="badge ${k.startsWith("5")||k==="ERR"?"b-err":k.startsWith("4")?"b-wait":"b-ready"}">${k}: ${v}</span>`)
      .join(" ");

    const renderTable = (rows) => `
      <table class="analyzer-table">
        <thead><tr><th>Endpoint</th><th class="num">#</th><th class="num">avg</th><th class="num">p95</th><th class="num">err</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td title="${escapeHtml(r.key)}">${escapeHtml(r.key.length > 70 ? r.key.slice(0,70)+"…" : r.key)}</td>
              <td class="num">${r.count}</td>
              <td class="num">${r.avgMs} ms</td>
              <td class="num">${r.p95Ms} ms</td>
              <td class="num">${r.errors} (${Math.round(r.errorRate*100)}%)</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    const slowestTable = `
      <table class="analyzer-table">
        <thead><tr><th>Método</th><th>URL</th><th class="num">status</th><th class="num">tempo</th></tr></thead>
        <tbody>
          ${m.slowest.map((e) => `
            <tr>
              <td><span class="method-pill ${methodCls(e.method)}">${escapeHtml(e.method||"GET")}</span></td>
              <td title="${escapeHtml(e.url)}">${escapeHtml((e.url||"").slice(0,80))}</td>
              <td class="num ${statusCls(e.status)}">${escapeHtml(e.status||0)}</td>
              <td class="num">${fmtMs(e.timingMs)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    const aiCard = `
      <div class="analyzer-card">
        <h4>🧠 Análise IA</h4>
        <div class="analyzer-actions" style="margin-bottom:8px;">
          <button id="analyzer-ai-run" class="btn-primary" style="height:32px; padding:0 14px;" ${state.analyzer.aiLoading?"disabled":""}>
            ${state.analyzer.aiLoading ? "Analisando…" : "Analisar tráfego com IA"}
          </button>
          <span class="slash-hint">Envia até 50 requests sanitizadas (sem tokens) para o AI Gateway.</span>
        </div>
        ${state.analyzer.aiError ? `<div class="ai-error">${escapeHtml(state.analyzer.aiError)}</div>` : ""}
        ${state.analyzer.aiContent
          ? `<div class="analyzer-ai-output">${escapeHtml(state.analyzer.aiContent)}</div>`
          : (!state.analyzer.aiLoading ? `<div class="slash-hint">Clique acima para gerar insights.</div>` : "")}
      </div>`;

    host.innerHTML = `
      <div class="analyzer-metrics">
        <div class="analyzer-metric"><div class="lbl">Total</div><div class="val">${m.total}</div><div class="sub">requests</div></div>
        <div class="analyzer-metric ${errClass}"><div class="lbl">Erros</div><div class="val">${m.errors}</div><div class="sub">${Math.round(m.errorRate*100)}% do total</div></div>
        <div class="analyzer-metric"><div class="lbl">Latência média</div><div class="val">${m.avgMs} ms</div><div class="sub">${m.endpoints.length} endpoints únicos</div></div>
        <div class="analyzer-metric ${latClass}"><div class="lbl">p95</div><div class="val">${m.p95Ms} ms</div><div class="sub">95º percentil</div></div>
      </div>
      <div class="analyzer-actions" style="padding:0 4px;">
        <button id="analyzer-export-postman" class="btn" title="Exporta Postman v2.1 com todas as requests capturadas">📤 Postman v2.1</button>
        <button id="analyzer-export-har" class="btn" title="Exporta HAR">📤 HAR</button>
      </div>
      <div class="analyzer-card"><h4>Distribuição de status</h4><div style="display:flex; gap:6px; flex-wrap:wrap;">${statusRow}</div></div>
      <div class="analyzer-card"><h4>Top endpoints por volume</h4>${renderTable(topByVol)}</div>
      <div class="analyzer-card"><h4>Top endpoints por latência (p95)</h4>${renderTable(topByLat)}</div>
      ${errorPatterns.length ? `
      <div class="analyzer-card">
        <h4>Padrões de erro (B.10)</h4>
        <table class="analyzer-table">
          <thead><tr><th>Endpoint</th><th class="num">#</th><th>Status</th><th>Amostra response</th></tr></thead>
          <tbody>
            ${errorPatterns.map((g) => {
              const sampleBody = g.sample?.responseBody;
              const sampleText = typeof sampleBody === "string" ? sampleBody : (sampleBody ? JSON.stringify(sampleBody) : "—");
              return `<tr>
                <td title="${escapeHtml(g.key)}">${escapeHtml(g.key.length > 60 ? g.key.slice(0,60)+"…" : g.key)}</td>
                <td class="num">${g.count}</td>
                <td>${Array.from(g.statuses).map((s) => `<span class="badge ${Number(s)>=500||s==='0'?'b-err':'b-wait'}">${escapeHtml(s)}</span>`).join(" ")}</td>
                <td style="font-family:monospace; font-size:10px; opacity:0.8;">${escapeHtml(String(sampleText).slice(0,120))}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>` : ""}
      <div class="analyzer-card"><h4>Requests mais lentas</h4>${slowestTable}</div>
      ${aiCard}
    `;

    $("#analyzer-ai-run")?.addEventListener("click", runAiAnalyze);
    $("#analyzer-export-postman")?.addEventListener("click", exportPostman);
    $("#analyzer-export-har")?.addEventListener("click", exportHar);
  }

  async function runAiAnalyze() {
    if (state.analyzer.aiLoading) return;
    state.analyzer.aiLoading = true;
    state.analyzer.aiError = "";
    renderAnalyzer();
    try {
      const m = computeAnalyzerMetrics();
      const metrics = {
        total: m.total,
        errors: m.errors,
        errorRate: Number(m.errorRate.toFixed(3)),
        avgMs: m.avgMs,
        p95Ms: m.p95Ms,
        statusDist: m.statusDist,
        topEndpoints: m.endpoints.slice(0, 10),
      };
      const arr = asArray(state.data?.network);
      const entries = arr.slice(0, 50);
      const res = await sendMessage("BURP_AI_ANALYZE", { entries, metrics });
      if (!res?.ok) {
        state.analyzer.aiError = res?.error || "Falha na análise IA.";
      } else {
        state.analyzer.aiContent = res.content || "(resposta vazia)";
      }
    } catch (err) {
      state.analyzer.aiError = err?.message || String(err);
    } finally {
      state.analyzer.aiLoading = false;
      renderAnalyzer();
    }
  }

  // ---------- Slash commands (Fase 4) ----------
  const SLASH_HELP = [
    ["/explain", "Explica a request selecionada via IA."],
    ["/recipe",  "Gera preset IA da request selecionada."],
    ["/mutate",  "Sugere mutações IA da request selecionada."],
    ["/diagnose","Diagnóstico IA da falha (4xx/5xx)."],
    ["/classify","Classifica a ação em PT-BR (cache local)."],
    ["/curl",    "Copia cURL da request selecionada."],
    ["/fetch",   "Copia snippet fetch() da request selecionada."],
    ["/json",    "Copia JSON de response da request selecionada."],
    ["/analyze", "Abre o Analyzer."],
    ["/ai",      "Roda análise IA sobre o tráfego atual."],
    ["/postman", "Exporta as requests capturadas como Postman v2.1."],
    ["/chain",   "Importa requests marcadas para Chain."],
    ["/composer","Carrega request selecionada no Composer."],
    ["/clear",   "Limpa o histórico de network."],
    ["/har",     "Exporta HAR."],
    ["/help",    "Mostra esta ajuda."],
  ];

  function showSlashHelp(extra) {
    const el = $("#slash-help");
    if (!el) return;
    const rows = SLASH_HELP.map(([cmd, desc]) => `<div><code>${cmd}</code> — ${escapeHtml(desc)}</div>`).join("");
    el.innerHTML = (extra ? `<div style="color:#ffb84d; margin-bottom:6px;">${escapeHtml(extra)}</div>` : "") + rows;
    el.style.display = "block";
    clearTimeout(showSlashHelp._t);
    showSlashHelp._t = setTimeout(() => { el.style.display = "none"; }, 12000);
  }

  function runSlashCommand(raw) {
    const txt = raw.startsWith("/") ? raw.slice(1) : raw;
    const [cmd] = txt.split(/\s+/);
    const c = (cmd || "").toLowerCase();
    const entry = selectedRequest();
    switch (c) {
      case "help":     return showSlashHelp();
      case "analyze":  return switchTab("analyzer");
      case "ai":       switchTab("analyzer"); return runAiAnalyze();
      case "composer": if (!entry) return showSlashHelp("Nenhuma request selecionada."); loadEntryIntoComposer(entry); return switchTab("composer");
      case "explain":  if (!entry) return showSlashHelp("Nenhuma request selecionada."); return runAiExplain(entry);
      case "recipe":   if (!entry) return showSlashHelp("Nenhuma request selecionada."); return runAiRecipe(entry);
      case "mutate":   if (!entry) return showSlashHelp("Nenhuma request selecionada."); return runAiSimple(entry, "BURP_AI_MUTATE", "🧪 Mutações IA", "Gerando mutações…");
      case "diagnose": if (!entry) return showSlashHelp("Nenhuma request selecionada."); return runAiSimple(entry, "BURP_AI_DIAGNOSE", "🩺 Diagnóstico IA", "Diagnosticando…");
      case "classify": if (!entry) return showSlashHelp("Nenhuma request selecionada."); return runAiSimple(entry, "BURP_AI_CLASSIFY", "🏷️ Categoria", "Classificando…");
      case "curl":     if (!entry) return showSlashHelp("Nenhuma request selecionada."); return handleDetailAction("copy-curl");
      case "fetch":    if (!entry) return showSlashHelp("Nenhuma request selecionada."); return handleDetailAction("copy-fetch");
      case "json":     if (!entry) return showSlashHelp("Nenhuma request selecionada."); return handleDetailAction("copy-json");
      case "chain":    return importSelectedToChain();
      case "postman":  return exportPostman();
      case "har":      return exportHar();
      case "clear":    return sendMessage("BURP_CLEAR_NETWORK").then(refresh);
      default:         return showSlashHelp(`Comando desconhecido: "/${c}".`);
    }
  }

  // ---------- Data ----------
  async function refresh() {
    const res = await sendMessage("BURP_GET_STATE");
    if (!res?.ok) throw new Error(res?.error || "Falha ao obter estado");
    state.data = res.state;
    // B-6: normalise network (may be object) before index access
    { const _net = asArray(state.data?.network);
      if (!state.selectedRequestId && _net[0]) state.selectedRequestId = _net[0].id; }
    renderList();
    renderDetail();
    renderPagination();
    if (state.mainTab === "diag") renderDiag();
  }

  // ---------- Live updates: only patch what changed. ----------
  // Critical: we DO NOT call refresh()/full-render on every tick.
  // The composer textarea keeps focus because we never touch its DOM.
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;
    const t = message.type;
    if (t === "BURP_CHAIN_PROGRESS") {
      const p = message.payload || {};
      if (p.stage && p.stage.startsWith("step:")) {
        state.chain.progress.push({
          stepId: p.stepId,
          stage: p.stage,
          status: p.status,
          error: p.error,
          ms: p.ms,
        });
        if (state.mainTab === "chain") renderChainProgress();
      }
      return;
    }
    if (t === "BURP_NETWORK_UPDATED" || t === "BURP_AUTH_UPDATED" || t === "BURP_LOG_UPDATED" || t === "BURP_STATE_READY") {
      state.data = message.payload || state.data;
      // B-6: normalise network (may be object) before index access
      { const _net = asArray(state.data?.network);
        if (!state.selectedRequestId && _net[0]) state.selectedRequestId = _net[0].id; }
      // Only refresh the network view; skip whichever tab the user is typing in.
      if (state.mainTab === "network") {
        renderList();
        renderPagination();
        // Update detail only if still showing the same selected entry
        renderDetail();
      } else if (state.mainTab === "diag") {
        renderDiag();
      }
      // Composer + Presets tabs: intentionally untouched.
    }
  });

  // ---------- Scripts tab (Bloco B — 12 scripts) ----------

  // Bridge: scripts call ctx.callAI(action, payload) — we forward to background
  // (BURP_AI_* messages). The action string is the canonical slug; mapping is
  // kept here so each script stays decoupled from chrome.runtime.
  async function callAIBridge(action, payload) {
    const map = {
      explain_request: "BURP_AI_EXPLAIN",
      explain_lovable_request: "BURP_AI_EXPLAIN",
      classify_action_ptbr: "BURP_AI_CLASSIFY",
      explain_error: "BURP_AI_DIAGNOSE",
      diagnose_failed_replay: "BURP_AI_DIAGNOSE",
      diff_payloads: "BURP_AI_MUTATE",      // reaproveita endpoint genérico
      summarize_flow: "BURP_AI_ANALYZE",
      analyze_network_traffic: "BURP_AI_ANALYZE",
      suggest_mutations: "BURP_AI_MUTATE",
      convert_to_composer_recipe: "BURP_AI_RECIPE",
    };
    const type = map[action];
    if (!type) return { ok: false, error: `ai_action_unknown:${action}` };
    // Normaliza resposta do background → contrato { ok, data, error?, error_code? }
    const normalize = (res) => {
      if (!res || typeof res !== "object") return { ok: false, error: "ai_no_response" };
      if (!res.ok) return { ok: false, error: res.error || "ai_error", error_code: res.error_code };
      const data = res.data !== undefined ? res.data
                 : res.content !== undefined ? res.content
                 : res.recipe !== undefined ? res.recipe
                 : res;
      return { ok: true, data, cached: !!res.cached, usage: res.usage };
    };
    // AF-E-B-01: unified via sendMessageSafe
    if (type === "BURP_AI_CLASSIFY" && Array.isArray(payload?.items) && payload.items.length) {
      return sendMessageSafe(type, payload).then(normalize);
    }
    return sendMessageSafe(type, payload || {}).then(normalize);
  }

  // Bridge: scripts call ctx.proxyFetch(url, init) — forwarded to background
  // which routes through the /burp edge function (SSRF + allowlist + rate-limit).
  // AF-E-B-01: replaced raw sendMessage with sendMessageSafe
  async function proxyFetchBridge(url, init) {
    // AF-D-C-02: support optional AbortSignal — reject early if already aborted;
    // the SW does not currently honor mid-flight cancellation, but rejecting at
    // the bridge keeps the contract honest and lets callers gate retries.
    if (init?.signal?.aborted) {
      return { ok: false, error: "aborted", aborted: true };
    }
    const res = await sendMessageSafe("BURP_EXECUTE_REQUEST", {
      url,
      method: init?.method || "GET",
      headers: init?.headers || {},
      body: init?.body ?? null,
    });
    if (init?.signal?.aborted) {
      return { ok: false, error: "aborted", aborted: true };
    }
    const entry = res?.result;
    if (!res?.ok || !entry) return { ok: false, error: res?.error || "proxy_no_response" };
    return {
      ok: Number(entry.status || 0) >= 200 && Number(entry.status || 0) < 400,
      status: Number(entry.status || 0),
      headers: entry.responseHeaders || {},
      body: typeof entry.responseBody === "string" ? entry.responseBody : "",
      durationMs: Number(entry.timingMs || 0),
      error: entry.mappedError?.user_action || entry.mappedError?.error || "",
    };
  }

  // v4.0.1: bridge para scripts obterem body/headers brutos (não-sanitizados
  // pelo `_shared.sanitize`) — necessário para fuzz/replay parsear o JSON real
  // em vez de placeholders `<jwt>` / `<lovable-token>`.
  // AF-E-B-01: replaced raw sendMessage with sendMessageSafe
  async function getRawRequestBridge(id) {
    const res = await sendMessageSafe("BURP_GET_RAW_REQUEST", { id });
    return res || { ok: false, error: "no_response" };
  }

  function renderScriptsTab() {
    const grid = $("#scripts-grid");
    if (!grid) return;
    const registry = window.HYPER_RB_REGISTRY;
    if (!registry) {
      grid.innerHTML = `<div class="empty">Registro de scripts não carregado. Recarregue a extensão.</div>`;
      return;
    }
    const scripts = registry.getScripts();
    if (!scripts.length) {
      grid.innerHTML = `
        <div class="empty">
          Nenhum script registrado ainda.<br>
          Os 12 scripts do Bloco B serão entregues em commits subsequentes
          (Cartographer, Action Classifier, etc).
        </div>`;
      return;
    }
    grid.innerHTML = scripts.map((s) => `
      <div class="script-card" data-script-id="${escapeHtml(s.id)}">
        <div class="script-card-head">
          <span class="script-card-num">#${escapeHtml(s.id)}</span>
          <span class="script-card-name">${escapeHtml(s.name)}</span>
          ${s.needsAI ? '<span class="script-tag tag-ai">IA</span>' : ""}
          ${s.needsNetwork ? '<span class="script-tag tag-net">Rede</span>' : ""}
        </div>
        <div class="script-card-desc">${escapeHtml(s.description || "")}</div>
        <div class="script-card-foot">
          <span class="script-card-meta" id="script-meta-${escapeHtml(s.slug)}">—</span>
          <button class="btn-primary script-run" data-run-script="${escapeHtml(s.slug)}">Executar</button>
        </div>
      </div>
    `).join("");
  }

  // Delegated click for "Executar"
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-run-script]");
    if (!btn) return;
    const slug = btn.dataset.runScript;
    const registry = window.HYPER_RB_REGISTRY;
    if (!registry) return;
    btn.disabled = true;
    const meta = document.getElementById(`script-meta-${slug}`);
    if (meta) meta.textContent = "Executando…";
    try {
      // FIX Bug #2: fetch network entries WITH body data for scripts.
      // getPublicState() strips bodies for perf; BURP_GET_SCRIPT_NETWORK keeps them (capped 4 KB).
      let rawRequests;
      try {
        const scriptNetRes = await sendMessageSafe("BURP_GET_SCRIPT_NETWORK", {});
        rawRequests = scriptNetRes?.ok && Array.isArray(scriptNetRes.entries)
          ? scriptNetRes.entries
          : asArray(state.data?.network);
      } catch {
        rawRequests = asArray(state.data?.network);
      }
      const licenseKey = (state.data && state.data.license && state.data.license.key) || "";
      const result = await registry.runScript(slug, {
        rawRequests,
        licenseKey,
        callAI: callAIBridge,
        proxyFetch: proxyFetchBridge,
        getRawRequest: getRawRequestBridge,
      });
      if (!result.ok) {
        if (meta) meta.textContent = `Erro: ${result.error || "desconhecido"}`;
        return;
      }
      if (meta) {
        const ts = new Date().toLocaleTimeString();
        meta.textContent = `OK • ${result.ms || 0}ms • ${ts}`;
      }
      // Mount drawer + ask script to paint into it.
      if (typeof result.render === "function" && window.HYPER_RB_SHARED) {
        const script = registry.getScript(slug);
        const mountEl = window.HYPER_RB_SHARED.mountDrawer(script?.name || slug);
        try { result.render(mountEl); } catch (err) { mountEl.innerHTML = `<pre class="script-error">${escapeHtml(err.message || String(err))}</pre>`; }
      }
      if (result.artifact && window.HYPER_RB_SHARED) {
        const a = result.artifact;
        window.HYPER_RB_SHARED.downloadBlob(a.filename || a.name || `${slug}.bin`, a.mime || "application/octet-stream", a.content);
      }
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Fatal error fallback ----------
  function renderFallback(err) {
    // After successful boot, do NOT wipe #app — a script from another module may
    // have thrown (e.g. burp_chains.js, a script in scripts/*) and the global
    // window.error listener would otherwise blank the entire panel.
    if (booted) {
      console.error("[Hyper RB] post-boot error (non-fatal, UI preserved):", err);
      try { showToast(`Erro: ${err?.message || String(err)}`, "err", 6000); } catch {}
      return;
    }
    const root = $("#app");
    if (!root) return;
    root.innerHTML = `
      <div style="padding:24px; color:#f5f5f7; font-family:sans-serif;">
        <h2 style="color:#bf00ff; margin-top:0;">Falha ao iniciar Hyper RB</h2>
        <pre style="background:#121214; padding:12px; border-radius:8px; white-space:pre-wrap; color:#ff5577;">${escapeHtml(err?.message || String(err))}</pre>
        <button onclick="location.reload()" style="margin-top:10px; padding:8px 16px; background:#bf00ff; color:#0a0a0c; border:none; border-radius:6px; font-weight:700; cursor:pointer;">Recarregar</button>
      </div>`;
  }
  // Only fatal during pre-boot phase; after boot, falls through to toast above.
  window.addEventListener("error", (ev) => renderFallback(ev.error || new Error(ev.message || "Script error")));
  window.addEventListener("unhandledrejection", (ev) => renderFallback(ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason || "Unhandled rejection"))));

  // ---------- Boot ----------
  function bootNow() {
    try {
      buildShell();
      updateChainImportBar();
      // Mark as booted BEFORE refresh so any async error from other scripts
      // (chains, ai_client, scripts/*) doesn't wipe the rendered shell.
      booted = true;
      refresh().catch((err) => {
        console.error("[Hyper RB] initial refresh failed:", err);
        try { showToast(`Falha ao carregar estado: ${err?.message || err}`, "err", 8000); } catch {}
      });
    } catch (e) {
      booted = false; // boot itself failed — show full fallback
      renderFallback(e);
    }
  }
  // Boot guard: if DOMContentLoaded already fired (script ran late), call boot
  // synchronously. Otherwise wait for the event. Prevents silent black panel
  // when the parser is faster than the script registration.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootNow, { once: true });
  } else {
    bootNow();
  }
})();