(() => {
  const state = {
    data: null,
     selectedRequestId: null,
     detailTab: "overview",
     mainTab: "network", // "network" or "composer"
     isCapturing: true,
    page: 1,
    pageSize: 50,
    filters: {
      method: "ALL",
      type: "ALL",
      status: "ALL", // ALL | 2xx | 3xx | 4xx | 5xx
      search: "",
    },
    composer: {
      method: "GET",
      url: "https://api.lovable.dev/v1/projects",
      body: "",
      sending: false,
    },
  };

  let heartbeatTimer = null;
  const app = document.getElementById("app");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function sendMessage(type, payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response || { ok: false, error: "Sem resposta" });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatMs(ms) {
    return `${Math.max(0, Number(ms || 0))} ms`;
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("pt-BR");
    } catch {
      return String(value);
    }
  }

  function methodClass(method) {
    return `method-${String(method || "GET").toUpperCase()}`;
  }

  function statusClass(status) {
    return Number(status) >= 400 || Number(status) === 0 ? "status-error" : "status-ok";
  }

  function getDiagBadgeClass(status) {
    if (status === "ready") return "badge-ready";
    if (status === "error") return "badge-error";
    return "badge-waiting";
  }

  function parseJsonSafe(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function formatCodeBlock(value) {
    if (value === undefined || value === null || value === "") return "// vazio";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function buildJsonTree(value) {
    if (value === null) return '<span class="json-value-null">null</span>';
    if (typeof value === "string") return `<span class="json-value-string">"${escapeHtml(value)}"</span>`;
    if (typeof value === "number") return `<span class="json-value-number">${value}</span>`;
    if (typeof value === "boolean") return `<span class="json-value-boolean">${value}</span>`;
    if (Array.isArray(value)) {
      return `<div class="json-tree">${value.map((item, index) => `<div class="json-node"><span class="json-key">[${index}]</span>: ${buildJsonTree(item)}</div>`).join("")}</div>`;
    }
    return `<div class="json-tree">${Object.entries(value).map(([key, item]) => `<div class="json-node"><span class="json-key">${escapeHtml(key)}</span>: ${buildJsonTree(item)}</div>`).join("")}</div>`;
  }

  function filteredRequests() {
    const entries = state.data?.network || [];
    return entries.filter((entry) => {
      const searchTarget = [
        entry.url,
        entry.method,
        entry.requestBody,
        entry.responseBody,
        JSON.stringify(entry.requestHeaders || {}),
        JSON.stringify(entry.responseHeaders || {}),
      ].join(" ").toLowerCase();
      const matchesSearch = !state.filters.search || searchTarget.includes(state.filters.search.toLowerCase());
      const matchesMethod = state.filters.method === "ALL" || String(entry.method).toUpperCase() === state.filters.method;
      const matchesType = state.filters.type === "ALL" || String(entry.kind).toLowerCase() === state.filters.type.toLowerCase();
      const statusFilter = state.filters.status;
      const statusNum = Number(entry.status || 0);
      const matchesStatus = statusFilter === "ALL" ||
        (statusFilter === "2xx" && statusNum >= 200 && statusNum < 300) ||
        (statusFilter === "3xx" && statusNum >= 300 && statusNum < 400) ||
        (statusFilter === "4xx" && statusNum >= 400 && statusNum < 500) ||
        (statusFilter === "5xx" && statusNum >= 500 && statusNum < 600);
      return matchesSearch && matchesMethod && matchesType && matchesStatus;
    });
  }

  function pagedRequests() {
    const items = filteredRequests();
    const start = (state.page - 1) * state.pageSize;
    return items.slice(start, start + state.pageSize);
  }

  function selectedRequest() {
    const items = state.data?.network || [];
    return items.find((entry) => entry.id === state.selectedRequestId) || pagedRequests()[0] || null;
  }

  function loadEntryIntoComposer(entry) {
    if (!entry) return;
    state.composer.method = String(entry.method || "GET").toUpperCase();
    state.composer.url = entry.url || "";
    let body = entry.requestBody;
    if (body && typeof body !== "string") {
      try { body = JSON.stringify(body, null, 2); } catch { body = String(body); }
    }
    state.composer.body = body || "";
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(
      () => showToast("Copiado para a área de transferência", "success"),
      () => showToast("Falha ao copiar", "error"),
    );
  }

  // Inline toast — auto-dismiss after 5s. Items 12 (error/info notifications).
  function showToast(message, type = "info") {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.style.cssText = "position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    const bg = type === "error" ? "#3b1212" : type === "success" ? "#0f3a1f" : "#1a1f2e";
    const border = type === "error" ? "#7a1f1f" : type === "success" ? "#1f7a3a" : "#2a3550";
    el.style.cssText = `pointer-events:auto;background:${bg};color:#f3f4f6;border:1px solid ${border};padding:10px 14px;border-radius:8px;font-size:13px;max-width:360px;box-shadow:0 6px 20px rgba(0,0,0,0.45);opacity:0;transform:translateY(-6px);transition:opacity .18s,transform .18s;`;
    el.textContent = String(message);
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      setTimeout(() => el.remove(), 220);
    }, 5000);
  }

  function renderOverview(entry) {
    return `
      <div class="section-card">
        <div class="section-label">Resumo</div>
        <div class="key-value-grid">
          <div class="kv-row"><div class="kv-key">URL</div><div class="mono">${escapeHtml(entry.url)}</div></div>
          <div class="kv-row"><div class="kv-key">Origem</div><div>${escapeHtml(entry.source || "page")}</div></div>
          <div class="kv-row"><div class="kv-key">Tipo</div><div>${escapeHtml(entry.kind || "fetch")}</div></div>
          <div class="kv-row"><div class="kv-key">Status</div><div class="${statusClass(entry.status)}">${escapeHtml(entry.status || 0)} ${escapeHtml(entry.statusText || "")}</div></div>
          <div class="kv-row"><div class="kv-key">Tempo</div><div>${formatMs(entry.timingMs)}</div></div>
          <div class="kv-row"><div class="kv-key">Tamanho</div><div>${formatBytes(entry.responseSize)}</div></div>
          <div class="kv-row"><div class="kv-key">Capturada em</div><div>${formatDate(entry.startedAt)}</div></div>
        </div>
      </div>
      <div class="section-card">
        <div class="section-label">Auth reutilizada</div>
        <div class="key-value-grid">
          <div class="kv-row"><div class="kv-key">Bearer</div><div>${entry.auth?.hasBearerToken ? escapeHtml(entry.auth.tokenPreview || "capturado") : "Não capturado"}</div></div>
          <div class="kv-row"><div class="kv-key">Cookies</div><div>${escapeHtml(entry.auth?.cookiesPreview || "Não capturados")}</div></div>
          <div class="kv-row"><div class="kv-key">Project ID</div><div class="mono">${escapeHtml(entry.auth?.projectId || "—")}</div></div>
          <div class="kv-row"><div class="kv-key">Workspace ID</div><div class="mono">${escapeHtml(entry.auth?.workspaceId || "—")}</div></div>
        </div>
      </div>
    `;
  }

  function renderRequestTab(entry) {
    return `
      <div class="section-card">
        <div class="section-label">Headers</div>
        <pre>${escapeHtml(formatCodeBlock(entry.requestHeaders || {}))}</pre>
      </div>
      <div class="section-card">
        <div class="section-label">Body</div>
        <pre>${escapeHtml(formatCodeBlock(entry.requestBody))}</pre>
      </div>
    `;
  }

  function renderResponseTab(entry) {
    const parsed = entry.responseJson || parseJsonSafe(entry.responseBody);
    return `
      <div class="section-card">
        <div class="section-label">Headers</div>
        <pre>${escapeHtml(formatCodeBlock(entry.responseHeaders || {}))}</pre>
      </div>
      <div class="section-card">
        <div class="section-label">Preview JSON</div>
        ${parsed ? buildJsonTree(parsed) : `<pre>${escapeHtml(formatCodeBlock(entry.responseBody))}</pre>`}
      </div>
      <div class="section-card">
        <div class="section-label">Response bruta</div>
        <pre>${escapeHtml(formatCodeBlock(entry.responseBody))}</pre>
      </div>
    `;
  }

  function renderTimingTab(entry) {
    return `
      <div class="section-card">
        <div class="section-label">Timing</div>
        <div class="key-value-grid">
          <div class="kv-row"><div class="kv-key">Tempo total</div><div>${formatMs(entry.timingMs)}</div></div>
          <div class="kv-row"><div class="kv-key">Início</div><div>${formatDate(entry.startedAt)}</div></div>
          <div class="kv-row"><div class="kv-key">Status</div><div>${escapeHtml(entry.status || 0)}</div></div>
          <div class="kv-row"><div class="kv-key">Tamanho</div><div>${formatBytes(entry.responseSize)}</div></div>
          <div class="kv-row"><div class="kv-key">Erro</div><div>${escapeHtml(entry.error || "—")}</div></div>
        </div>
      </div>
    `;
  }

  function renderDetailContent(entry) {
    if (!entry) {
      return `
        <div class="empty-state" style="text-align:center;padding:36px 20px;">
          <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.45;margin:0 auto 14px;display:block;">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <div class="empty-title">Inspector pronto</div>
          <div class="empty-body">Selecione uma request à esquerda para ver headers, payload e response — ou envie uma manualmente pelo Composer.</div>
          <div class="empty-body" style="margin-top:10px;opacity:0.6;font-size:12px;">Atalhos: <b>Ctrl+Enter</b> envia · <b>Ctrl+L</b> limpa · <b>Esc</b> fecha detalhe</div>
        </div>
      `;
    }
    if (state.detailTab === "request") return renderRequestTab(entry);
    if (state.detailTab === "response") return renderResponseTab(entry);
    if (state.detailTab === "timing") return renderTimingTab(entry);
    return renderOverview(entry);
  }

  function buildFetchSnippet(entry) {
    return `fetch(${JSON.stringify(entry.url)}, ${JSON.stringify({
      method: entry.method,
      headers: entry.requestHeaders || {},
      body: entry.requestBody || undefined,
    }, null, 2)})`;
  }

  function buildCurlSnippet(entry) {
    const headers = Object.entries(entry.requestHeaders || {}).map(([key, value]) => `-H ${JSON.stringify(`${key}: ${value}`)}`).join(" ");
    const body = entry.requestBody ? ` --data ${JSON.stringify(entry.requestBody)}` : "";
    return `curl -X ${entry.method} ${headers}${body} ${JSON.stringify(entry.url)}`;
  }

  function bindEvents() {
    document.querySelectorAll("[data-method-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.filters.method = button.getAttribute("data-method-filter") || "ALL";
        state.page = 1;
        render();
      });
    });

    const typeSelect = document.getElementById("filter-type");
     const searchInput = document.getElementById("filter-search");
     const requestUrl = document.getElementById("request-url");
     const requestMethod = document.getElementById("request-method");
     const requestBody = document.getElementById("request-body");
     const clearButton = document.getElementById("clear-network");
     const debugToggle = document.getElementById("debug-toggle");
     const replayButton = document.getElementById("execute-request");
     const prevPage = document.getElementById("page-prev");
     const nextPage = document.getElementById("page-next");
     const refreshState = document.getElementById("refresh-state");
     const stopCaptureBtn = document.getElementById("stop-capture");
 
     if (stopCaptureBtn) {
       stopCaptureBtn.addEventListener("click", async () => {
         state.isCapturing = !state.isCapturing;
         await sendMessage("BURP_SET_CAPTURE", { enabled: state.isCapturing });
         render();
       });
     }
 
     document.querySelectorAll("[data-main-tab]").forEach(tab => {
       tab.addEventListener("click", () => {
         state.mainTab = tab.getAttribute("data-main-tab");
         render();
       });
      });

    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        state.filters.type = typeSelect.value;
        state.page = 1;
        render();
      });
    }
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.filters.search = searchInput.value;
        state.page = 1;
        render();
      });
    }
    if (clearButton) {
      clearButton.addEventListener("click", async () => {
        await sendMessage("BURP_CLEAR_NETWORK");
        await refresh();
      });
    }
    if (refreshState) {
      refreshState.addEventListener("click", refresh);
    }
    if (debugToggle) {
      debugToggle.addEventListener("click", async () => {
        const response = await sendMessage("BURP_SET_DEBUG", { enabled: !state.data?.debug });
        state.data = response.state;
        render();
      });
    }
    if (requestUrl) {
      requestUrl.addEventListener("input", () => { state.composer.url = requestUrl.value; });
    }
    if (requestMethod) {
      requestMethod.addEventListener("change", () => { state.composer.method = requestMethod.value; });
    }
    if (requestBody) {
      requestBody.addEventListener("input", () => { state.composer.body = requestBody.value; });
    }

    if (replayButton) {
      replayButton.addEventListener("click", async () => {
        const responseBox = document.getElementById("composer-status");
        if (state.composer.sending) return;
        state.composer.sending = true;
        replayButton.disabled = true;
        replayButton.innerHTML = `<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:burp-spin .8s linear infinite;margin-right:8px;vertical-align:-3px;"></span>Enviando…`;
        responseBox.textContent = "Enviando request via edge function Burp...";
        let bodyPayload = null;
        if (requestBody.value.trim()) {
          try {
            bodyPayload = JSON.parse(requestBody.value);
          } catch {
            bodyPayload = requestBody.value;
          }
        }
        let response;
        try {
          response = await sendMessage("BURP_EXECUTE_REQUEST", {
           url: requestUrl.value.trim(),
           method: requestMethod.value,
           headers: {},
           body: bodyPayload,
         });
        } catch (err) {
          response = { ok: false, error: err?.message || "Falha de comunicação" };
        } finally {
          state.composer.sending = false;
          replayButton.disabled = false;
          replayButton.textContent = "Enviar Requisição";
        }
        if (!response.ok) {
          responseBox.textContent = response.error || "Falha ao executar request.";
          showToast(response.error || "Falha ao executar request.", "error");
          return;
        }
        responseBox.textContent = "Request enviada com sucesso.";
        showToast("Request enviada com sucesso", "success");
        state.data = response.state;
        state.selectedRequestId = response.result.id;
        render();
      });
    }
    if (prevPage) {
      prevPage.addEventListener("click", () => {
        state.page = Math.max(1, state.page - 1);
        render();
      });
    }
    if (nextPage) {
      nextPage.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(filteredRequests().length / state.pageSize));
        state.page = Math.min(totalPages, state.page + 1);
        render();
      });
    }

    document.querySelectorAll("[data-request-id]").forEach((item) => {
      item.addEventListener("click", () => {
        state.selectedRequestId = item.getAttribute("data-request-id");
        loadEntryIntoComposer(selectedRequest());
        render();
      });
    });

    document.querySelectorAll("[data-detail-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.detailTab = tab.getAttribute("data-detail-tab") || "overview";
        render();
      });
    });

    const statusFilter = document.getElementById("filter-status");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => {
        state.filters.status = statusFilter.value;
        state.page = 1;
        render();
      });
    }

    document.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = selectedRequest();
        if (!entry) { showToast("Selecione uma request primeiro", "info"); return; }
        const action = button.getAttribute("data-copy");
        if (action === "request") {
          loadEntryIntoComposer(entry);
          copyText(JSON.stringify({ method: entry.method, url: entry.url, body: entry.requestBody }, null, 2));
          const status = document.getElementById("composer-status");
          if (status) status.textContent = "Request carregada no composer. Pronta para reenvio.";
           state.mainTab = "composer";
          render();
           return;
        }
        if (action === "payload") copyText(formatCodeBlock(entry.requestBody));
        if (action === "headers") copyText(formatCodeBlock(entry.requestHeaders));
        if (action === "response") copyText(formatCodeBlock(entry.responseBody));
        if (action === "fetch") copyText(buildFetchSnippet(entry));
        if (action === "curl") copyText(buildCurlSnippet(entry));
        if (action === "json") copyText(formatCodeBlock(entry.responseJson || parseJsonSafe(entry.responseBody) || entry.requestBody));
      });
    });

    const handle = document.getElementById("resize-handle");
    const grid = document.getElementById("network-grid");
    if (handle && grid && window.innerWidth > 960) {
      let dragging = false;
      handle.addEventListener("mousedown", () => { dragging = true; });
      window.addEventListener("mouseup", () => { dragging = false; });
      window.addEventListener("mousemove", (event) => {
        if (!dragging) return;
        const rect = grid.getBoundingClientRect();
        const width = ((event.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(28, Math.min(60, width));
        document.documentElement.style.setProperty("--list-width", `${clamped}%`);
      });
    }
  }

  function render() {
    const data = state.data;
    const entries = pagedRequests();
    const total = filteredRequests().length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const entry = selectedRequest();
    if (!state.selectedRequestId && entry) state.selectedRequestId = entry.id;

    app.innerHTML = `
      <div class="app-shell">
        <div class="topbar">
           <div class="brand-wrap" style="cursor: pointer;" onclick="window.location.reload()">
            <div class="brand-mark">B</div>
            <div>
              <div class="brand-title">Burp Lovable</div>
              <div class="brand-subtitle">Network live · replay engine · startup diagnostics</div>
            </div>
          </div>
          <div class="toolbar-actions">
             <button class="tab-btn ${state.mainTab === "network" ? "active" : ""}" data-main-tab="network">Interceptador</button>
             <button class="tab-btn ${state.mainTab === "composer" ? "active" : ""}" data-main-tab="composer">Composer</button>
             <div style="width: 20px;"></div>
            <button class="ghost-btn" id="refresh-state">Atualizar</button>
            <button class="ghost-btn" id="debug-toggle">${data?.debug ? "Debug on" : "Debug off"}</button>
          </div>
        </div>

        <div class="status-strip">
          <div class="status-card">
            <div class="status-label">Autenticação</div>
            <div class="status-value">${data?.auth?.hasBearerToken ? "Token capturado" : "Sem token"}</div>
            <div class="status-meta mono">${escapeHtml(data?.auth?.bearerTokenPreview || "—")}</div>
          </div>
          <div class="status-card">
            <div class="status-label">Requests</div>
            <div class="status-value">${data?.stats?.entryCount || 0}</div>
            <div class="status-meta">Captura em tempo real</div>
          </div>
          <div class="status-card">
            <div class="status-label">Projeto</div>
            <div class="status-value mono">${escapeHtml(data?.auth?.projectId || "—")}</div>
            <div class="status-meta mono">${escapeHtml(data?.auth?.workspaceId || "—")}</div>
          </div>
        </div>

        <div class="diagnostics-grid">
          ${Object.entries(data?.diagnostics || {}).map(([key, diag]) => `
            <div class="diag-card">
              <div class="diag-top">
                <div class="diag-title">${escapeHtml(key)}</div>
                <span class="badge ${getDiagBadgeClass(diag.status)}">${escapeHtml(diag.status)}</span>
              </div>
              <div class="diag-detail">${escapeHtml(diag.detail || "—")}</div>
            </div>
          `).join("")}
        </div>


        ${data?.debug ? `
          <div class="debug-panel">
            <h2>Startup diagnostics</h2>
            <p>Logs internos sanitizados da inicialização e dos módulos do service worker/content/page hook.</p>
            <div class="debug-log-list">
              ${(data?.startupLogs || []).slice(0, 12).map((log) => `
                <div class="debug-log-item">
                  <div class="debug-log-head">
                    <span class="badge ${log.level === "error" ? "badge-error" : log.level === "warn" ? "badge-waiting" : "badge-live"}">${escapeHtml(log.level)}</span>
                    <span class="mono">${escapeHtml(formatDate(log.timestamp))}</span>
                  </div>
                  <div class="debug-log-message">${escapeHtml(log.module)} · ${escapeHtml(log.message)}</div>
                  ${log.meta ? `<div class="debug-log-meta mono">${escapeHtml(JSON.stringify(log.meta))}</div>` : ""}
                </div>
              `).join("") || `<div class="debug-log-item">Sem logs ainda.</div>`}
            </div>
          </div>
        ` : ""}

        <div class="workspace">
           ${state.mainTab === "network" ? `
           <div class="network-toolbar">
            <input id="filter-search" class="search-input" placeholder="Buscar por URL, método, body ou header" value="${escapeHtml(state.filters.search)}">
             <button class="chip-btn" data-method-filter="ALL">ALL</button>
             <button class="chip-btn" data-method-filter="GET">GET</button>
            <button class="chip-btn" data-method-filter="POST">POST</button>
            <button class="chip-btn" data-method-filter="PUT">PUT</button>
            <button class="chip-btn" data-method-filter="DELETE">DELETE</button>
            <select id="filter-type" class="panel-select">
              <option value="ALL" ${state.filters.type === "ALL" ? "selected" : ""}>Todos</option>
              <option value="fetch" ${state.filters.type === "fetch" ? "selected" : ""}>Fetch/XHR</option>
              <option value="graphql" ${state.filters.type === "graphql" ? "selected" : ""}>GraphQL</option>
              <option value="xhr" ${state.filters.type === "xhr" ? "selected" : ""}>XHR</option>
            </select>
            <select id="filter-status" class="panel-select" title="Filtrar por status">
              ${["ALL","2xx","3xx","4xx","5xx"].map(s => `<option value="${s}" ${state.filters.status===s?"selected":""}>${s==="ALL"?"Status":s}</option>`).join("")}
            </select>
            <button class="ghost-btn" id="clear-network">Limpar</button>
             <button class="ghost-btn ${state.isCapturing ? "status-error" : "status-ok"}" id="stop-capture">${state.isCapturing ? "Parar Captura" : "Retomar Captura"}</button>
           </div>
           ` : ""}
 
           ${state.mainTab === "composer" ? `
           <div class="composer" style="display: flex; flex-direction: column; height: 100%; grid-template-columns: 1fr;">
             <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px;">
               <select id="request-method" class="panel-select">
                 ${["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => `<option value="${method}" ${state.composer.method === method ? "selected" : ""}>${method}</option>`).join("")}
               </select>
               <input id="request-url" class="text-input mono" placeholder="https://api.lovable.dev/v1/projects" value="${escapeHtml(state.composer.url)}">
             </div>
             <div style="flex: 1; margin: 12px 0;">
               <textarea id="request-body" class="panel-textarea mono" style="height: 100%; min-height: 200px;" placeholder='{"payload": true}'>${escapeHtml(state.composer.body)}</textarea>
             </div>
             <div style="display: flex; justify-content: space-between; align-items: center;">
               <div id="composer-status" class="hint-text">Headers e Auth automáticos.</div>
               <button class="primary-btn" id="execute-request" style="width: 200px; height: 44px;">Enviar Requisição</button>
             </div>
           </div>
           ` : ""}
 
           ${state.mainTab === "network" ? `
           <div class="network-grid" id="network-grid">
             <div class="request-list">
               ${entries.length ? entries.map((item) => `
                 <div class="request-item ${item.id === state.selectedRequestId ? "active" : ""}" data-request-id="${escapeHtml(item.id)}">
                   <div class="request-top">
                     <span class="method-pill ${methodClass(item.method)}">${escapeHtml(item.method)}</span>
                     <span class="status-code ${statusClass(item.status)}">${escapeHtml(item.status || 0)}</span>
                   </div>
                   <div class="request-url mono">${escapeHtml(item.url)}</div>
                   <div class="request-bottom">
                     <div class="request-meta">
                       <span>${escapeHtml(item.kind || "fetch")}</span>
                       <span>${formatMs(item.timingMs)}</span>
                       <span>${formatBytes(item.responseSize)}</span>
                     </div>
                     ${item.source === "replay" ? "" : `<span class="badge badge-live">live</span>`}
                   </div>
                 </div>
               `).join("") : `
                 <div class="empty-state">
                   <div class="empty-title">Nenhuma request capturada</div>
                   <div class="empty-body">O hook intercepta tráfego real.</div>
                 </div>
               `}
               <div class="request-list-footer">
                 <span>${total} item(ns)</span>
                 <div class="toolbar-actions">
                   <button class="ghost-btn" id="page-prev" ${state.page <= 1 ? "disabled" : ""}>Anterior</button>
                   <span>Página ${state.page} / ${totalPages}</span>
                   <button class="ghost-btn" id="page-next" ${state.page >= totalPages ? "disabled" : ""}>Próxima</button>
                 </div>
               </div>
             </div>
             <div class="detail-pane">
               <div class="detail-header">
                 <div style="flex: 1; min-width: 0;">
                   <div class="detail-title mono" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${entry ? escapeHtml(entry.url) : "Inspector"}</div>
                   <div class="detail-subtitle">${entry ? `${escapeHtml(entry.method)} · ${escapeHtml(entry.status || 0)} · ${formatMs(entry.timingMs)}` : "Selecione uma request."}</div>
                 </div>
                 <div class="detail-actions">
                   <button class="ghost-btn" data-copy="request">Carregar no Composer</button>
                    <button class="ghost-btn" data-copy="curl" title="Copiar como cURL">cURL</button>
                    <button class="ghost-btn" data-copy="fetch" title="Copiar como fetch()">fetch()</button>
                    <button class="ghost-btn" data-copy="headers" title="Copiar headers">Headers</button>
                    <button class="ghost-btn" data-copy="response" title="Copiar response">Response</button>
                   <button class="ghost-btn" data-copy="json">JSON</button>
                 </div>
               </div>
               <div class="tabbar">
                 ${["overview", "request", "response", "timing"].map((tab) => `<button class="tab-btn ${state.detailTab === tab ? "active" : ""}" data-detail-tab="${tab}">${tab}</button>`).join("")}
               </div>
               <div class="detail-content">
                 ${renderDetailContent(entry)}
               </div>
             </div>
           </div>
           ` : ""}
         </div>
       </div>
     `;
     bindEvents();
   }

  async function refresh() {
    const response = await sendMessage("BURP_GET_STATE");
    if (!response?.ok) throw new Error(response?.error || "Falha ao obter estado");
    state.data = response.state;
    if (state.data) state.data.license = { valid: true, userName: "Acesso Total" };
    if (!state.selectedRequestId && state.data?.network?.[0]) state.selectedRequestId = state.data.network[0].id;
    render();
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      try {
        await sendMessage("BURP_HEARTBEAT");
      } catch {}
    }, 60000);
  }

  function renderFallback(error) {
    app.innerHTML = `
      <div class="app-shell">
        <div class="fallback-card">
          <div class="fallback-title">Falha ao renderizar o sidepanel</div>
          <div class="fallback-body">${escapeHtml(error?.message || String(error))}</div>
          <button class="primary-btn" id="reload-panel">Recarregar</button>
        </div>
      </div>
    `;
    document.getElementById("reload-panel").addEventListener("click", () => window.location.reload());
  }

  window.addEventListener("error", (event) => renderFallback(event.error || new Error(event.message)));
  window.addEventListener("unhandledrejection", (event) => renderFallback(event.reason || new Error("Unhandled rejection")));

  // Idempotent runtime message listener: guard against double-registration if the
  // script is re-evaluated (e.g. devtools reload) within the same context.
  if (!window.__burpRuntimeListenerInstalled) {
    window.__burpRuntimeListenerInstalled = true;
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "BURP_NETWORK_UPDATED" || message?.type === "BURP_AUTH_UPDATED" || message?.type === "BURP_LOG_UPDATED" || message?.type === "BURP_STATE_READY") {
        state.data = message.payload;
        if (!state.selectedRequestId && state.data.network?.[0]) state.selectedRequestId = state.data.network[0].id;
        render();
      }
    });
  }

  // Keyboard shortcuts: Ctrl/Cmd+Enter sends from Composer, Ctrl/Cmd+L clears
  // the network log, Escape deselects the active request.
  if (!window.__burpShortcutsInstalled) {
    window.__burpShortcutsInstalled = true;
    document.addEventListener("keydown", async (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === "Enter") {
        const btn = document.getElementById("execute-request");
        if (btn && !btn.disabled) { event.preventDefault(); btn.click(); }
        return;
      }
      if (mod && (event.key === "l" || event.key === "L")) {
        const tag = (event.target && event.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return; // do not hijack typing
        event.preventDefault();
        try {
          await sendMessage("BURP_CLEAR_NETWORK");
          state.selectedRequestId = null;
          await refresh();
          showToast("Histórico limpo", "success");
        } catch (err) {
          showToast(err?.message || "Falha ao limpar", "error");
        }
        return;
      }
      if (event.key === "Escape") {
        if (state.selectedRequestId) {
          state.selectedRequestId = null;
          render();
        }
      }
    });
  }

  // Inject spinner keyframes once (used by Composer loading state).
  if (!document.getElementById("burp-runtime-styles")) {
    const style = document.createElement("style");
    style.id = "burp-runtime-styles";
    style.textContent = "@keyframes burp-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }

  refresh().then(startHeartbeat).catch(renderFallback);
})();
