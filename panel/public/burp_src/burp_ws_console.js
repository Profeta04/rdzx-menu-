// =============================================================================
// Hyper RB · WS Interceptor Console (v4.4.5)
// Renderiza a aba "WS Intercept" do sidepanel: lista de conexões WS, regras
// de intercept (pause/drop/rewrite), fila de frames pausados e injetor manual.
// Todo o estado vive no background SW; este módulo só consulta e renderiza.
// =============================================================================
(function () {
  "use strict";
  if (window.__BURP_WS_CONSOLE__) return;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtTs = (ts) => { try { return new Date(ts).toLocaleTimeString(); } catch { return ""; } };
  const trunc = (s, n = 140) => { const v = String(s ?? ""); return v.length > n ? v.slice(0, n) + "…" : v; };
  const CONTENT_RULE_ID = "hyper-rb-content-intercept";
  const DEFAULT_CONTENT_PATH = "data.event.content";
  const DEFAULT_LOVABLE_TRAJECTORY_URL = "^wss://api\\.lovable\\.dev/projects/971dffb5-f1af-4b30-b50d-a3da7170a5ce/ws/trajectory(?:\\?.*)?$";

  let wsState = { rules: [], pauses: [], injectLog: [], connections: [] };
  let mounted = false;

  function parseJsonMaybe(text) {
    if (!text || typeof text !== "string") return null;
    try { return JSON.parse(text); } catch { return null; }
  }

  function readPath(obj, path) {
    const parts = String(path || "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    let cursor = obj;
    for (const part of parts) {
      if (cursor == null || typeof cursor !== "object") return undefined;
      cursor = cursor[part];
    }
    return cursor;
  }

  function parsePath(path) {
    const parts = String(path || "").replace(/\[(\d+)\]/g, ".$1").split(".").map((x) => x.trim()).filter(Boolean);
    return parts.every((p) => /^[A-Za-z0-9_$-]+$/.test(p) && !["__proto__", "prototype", "constructor"].includes(p)) ? parts : [];
  }

  function setPath(obj, path, value) {
    const parts = parsePath(path);
    if (!parts.length || !obj || typeof obj !== "object") return false;
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
    return true;
  }

  function extractContent(payload) {
    const parsed = parseJsonMaybe(payload);
    const value = parsed ? readPath(parsed, DEFAULT_CONTENT_PATH) : undefined;
    return typeof value === "string" ? value : "";
  }

  function buildContentRuleFromPayload(payload) {
    const content = extractContent(payload);
    return {
      id: CONTENT_RULE_ID,
      label: "Editar content Lovable",
      direction: "recv",
      mode: "rewrite",
      urlRegex: DEFAULT_LOVABLE_TRAJECTORY_URL,
      payloadRegex: '"content"\\s*:',
      rewritePath: DEFAULT_CONTENT_PATH,
      rewriteTo: content || "oi",
      enabled: true,
    };
  }

  function getContentRule() {
    return (wsState.rules || []).find((r) => r.id === CONTENT_RULE_ID) || null;
  }

  function buildPayloadWithContent(payload, content) {
    const parsed = parseJsonMaybe(payload);
    if (!parsed || !setPath(parsed, DEFAULT_CONTENT_PATH, content)) return payload;
    return JSON.stringify(parsed);
  }

  function send(type, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (res) => {
          if (chrome.runtime?.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
          resolve(res || { ok: false, error: "sem resposta" });
        });
      } catch (e) { resolve({ ok: false, error: e?.message || String(e) }); }
    });
  }

  async function refresh() {
    const res = await send("BURP_WS_GET_STATE");
    if (res?.ok && res.ws) { wsState = res.ws; render(); }
  }

  // Listen for broadcasts from SW
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "BURP_WS_STATE_UPDATED" && msg.payload) {
        wsState = msg.payload;
        if (mounted) render();
      }
    });
  } catch {}

  function render() {
    const root = $("#wsint-root");
    if (!root) return;

    root.innerHTML = `
      <div class="wsint-header">
        <div class="wsint-title">WebSocket Interceptor</div>
        <div class="wsint-sub">Captura, pausa, edita e injeta frames WS em conexões abertas em <b>lovable.dev</b>. Regras aplicam-se em tempo real; frames pausados ficam em hold até 30s.</div>
      </div>

      ${renderContentInterceptPanel()}

      <section class="wsint-section">
        <div class="wsint-section-head">
          <h4>Conexões abertas (${wsState.connections.length})</h4>
          <button class="btn btn-sm" id="wsint-refresh">Atualizar</button>
        </div>
        <div class="wsint-conn-list">
          ${wsState.connections.length === 0
            ? `<div class="wsint-empty">Nenhuma conexão WS capturada.</div>`
            : wsState.connections.map((c) => `
              <div class="wsint-conn">
                <div class="wsint-conn-url" title="${esc(c.url)}">${esc(trunc(c.url, 90))}</div>
                <div class="wsint-conn-meta">
                  <span class="wsint-pill">${esc(c.statusText || "—")}</span>
                  <span>${c.frameCount || 0} frames</span>
                  <code class="wsint-mono">${esc(String(c.id).slice(0, 8))}</code>
                  <button class="btn btn-sm" data-inject-conn="${esc(c.id)}">Injetar…</button>
                </div>
              </div>
            `).join("")
          }
        </div>
      </section>

      <section class="wsint-section">
        <div class="wsint-section-head">
          <h4>Frames recentes</h4>
          <span class="wsint-hint">Clique em editar para alterar <code>${DEFAULT_CONTENT_PATH}</code></span>
        </div>
        <div class="wsint-frame-list">
          ${getRecentFrames().length === 0
            ? `<div class="wsint-empty">Nenhum frame recebido ainda.</div>`
            : getRecentFrames().map((f) => renderFrameRow(f)).join("")
          }
        </div>
      </section>

      <section class="wsint-section">
        <div class="wsint-section-head">
          <h4>Frames pausados (${wsState.pauses.length})</h4>
        </div>
        <div class="wsint-pause-list">
          ${wsState.pauses.length === 0
            ? `<div class="wsint-empty">Sem frames em hold. Crie uma regra com modo <b>pause</b> abaixo.</div>`
            : wsState.pauses.map((p) => renderPauseCard(p)).join("")
          }
        </div>
      </section>

      <section class="wsint-section">
        <div class="wsint-section-head">
          <h4>Regras de intercept (${wsState.rules.length}/50)</h4>
          <button class="btn btn-sm" id="wsint-add-rule">+ Nova regra</button>
        </div>
        <div class="wsint-rule-list" id="wsint-rule-list">
          ${wsState.rules.length === 0
            ? `<div class="wsint-empty">Sem regras. Clique em <b>+ Nova regra</b> para criar.</div>`
            : wsState.rules.map((r, i) => renderRuleRow(r, i)).join("")
          }
        </div>
        <div class="wsint-rule-actions" style="${wsState.rules.length ? "" : "display:none"}">
          <button class="btn-primary btn-sm" id="wsint-save-rules">Salvar regras</button>
          <span class="wsint-hint">Regras com URL ou payload regex inválido são ignoradas em runtime.</span>
        </div>
      </section>

      ${wsState.injectLog.length ? `
        <section class="wsint-section">
          <div class="wsint-section-head"><h4>Log de injeções (últimas ${Math.min(wsState.injectLog.length, 10)})</h4></div>
          <div class="wsint-log">
            ${wsState.injectLog.slice(0, 10).map((l) => `
              <div class="wsint-log-row ${l.ok ? "ok" : "err"}">
                <span>${fmtTs(l.ts)}</span>
                <code class="wsint-mono">${esc(String(l.connId).slice(0, 8))}</code>
                <span>${l.ok ? "OK" : esc(l.error || "erro")}</span>
              </div>
            `).join("")}
          </div>
        </section>
      ` : ""}
    `;

    wireEvents(root);
  }

  function renderContentInterceptPanel() {
    const existing = getContentRule();
    const rule = existing || buildContentRuleFromPayload("");
    return `
      <section class="wsint-section wsint-content-panel">
        <div class="wsint-section-head">
          <h4>Content Intercept</h4>
          <label class="wsint-switch">
            <input type="checkbox" id="wsint-content-enabled" ${rule.enabled !== false ? "checked" : ""} />
            <span></span>
          </label>
        </div>
        <div class="wsint-rule-row">
          <input class="input input-sm" id="wsint-content-url" placeholder="URL regex opcional" value="${esc(rule.urlRegex || "")}" />
          <input class="input input-sm" id="wsint-content-payload" placeholder="Payload regex" value="${esc(rule.payloadRegex || '"content"\\s*:')}" />
        </div>
        <textarea class="wsint-textarea" id="wsint-content-value" placeholder="Digite o novo content que será aplicado ao enviar o frame editado">${esc(rule.rewriteTo || "")}</textarea>
        <div class="wsint-rule-actions">
          <button class="btn-primary btn-sm" id="wsint-content-save">Aplicar regra</button>
          <button class="btn btn-sm" id="wsint-content-disable">Desativar</button>
          <span class="wsint-hint">Automático: frames recebidos nesse WS terão <code>${DEFAULT_CONTENT_PATH}</code> reescrito antes da página processar.</span>
        </div>
      </section>
    `;
  }

  function renderRuleRow(r, i) {
    return `
      <div class="wsint-rule" data-rule-idx="${i}">
        <div class="wsint-rule-row">
          <input class="input input-sm" data-f="label" placeholder="Label (opcional)" value="${esc(r.label || "")}" />
          <select class="select select-sm" data-f="direction">
            ${["send", "recv", "any"].map((d) => `<option value="${d}" ${r.direction === d ? "selected" : ""}>${d.toUpperCase()}</option>`).join("")}
          </select>
          <select class="select select-sm" data-f="mode">
            ${["pause", "drop", "rewrite"].map((m) => `<option value="${m}" ${r.mode === m ? "selected" : ""}>${m}</option>`).join("")}
          </select>
          <label class="wsint-check"><input type="checkbox" data-f="enabled" ${r.enabled !== false ? "checked" : ""}/> ativa</label>
          <button class="btn btn-sm wsint-danger" data-rule-del="${i}">Remover</button>
        </div>
        <div class="wsint-rule-row">
          <input class="input input-sm" data-f="urlRegex" placeholder="URL regex (opcional)" value="${esc(r.urlRegex || "")}" />
          <input class="input input-sm" data-f="payloadRegex" placeholder="Payload regex (opcional)" value="${esc(r.payloadRegex || "")}" />
        </div>
        <input class="input input-sm" data-f="rewritePath" placeholder="JSON path p/ rewrite (ex: data.event.content)" value="${esc(r.rewritePath || "")}" />
        <textarea class="wsint-textarea" data-f="rewriteTo" placeholder="Novo valor. Se JSON path estiver preenchido, só esse campo é alterado; senão substitui o payload inteiro.">${esc(r.rewriteTo || "")}</textarea>
      </div>
    `;
  }

  function renderPauseCard(p) {
    const content = extractContent(p.payload || "");
    const contentRule = getContentRule();
    const editorContent = contentRule?.rewriteTo || content;
    return `
      <div class="wsint-pause" data-pause-id="${esc(p.pauseId)}">
        <div class="wsint-pause-head">
          <span class="wsint-pill wsint-pill-${p.direction === "send" ? "send" : "recv"}">${esc(String(p.direction || "recv").toUpperCase())}</span>
          <span class="wsint-pause-ts">${fmtTs(p.ts)}</span>
          <code class="wsint-mono">conn ${esc(String(p.connId).slice(0, 8))}</code>
        </div>
        <div class="wsint-pause-url" title="${esc(p.url)}">${esc(trunc(p.url, 90))}</div>
        ${content ? `
          <label class="wsint-field-label">${DEFAULT_CONTENT_PATH}</label>
          <textarea class="wsint-textarea wsint-content-editor" data-pause-content>${esc(editorContent)}</textarea>
        ` : ""}
        <label class="wsint-field-label">Payload completo</label>
        <textarea class="wsint-textarea" data-pause-payload>${esc(p.payload || "")}</textarea>
        <div class="wsint-pause-actions">
          <button class="btn btn-sm" data-resume-original>Enviar original</button>
          <button class="btn-primary btn-sm" data-resume-content ${content ? "" : "disabled"}>Enviar content editado</button>
          <button class="btn btn-sm" data-resume-edited>Enviar payload editado</button>
          <button class="btn btn-sm wsint-danger" data-resume-drop>Drop</button>
        </div>
      </div>
    `;
  }

  function getRecentFrames() {
    const frames = [];
    for (const c of wsState.connections || []) {
      const list = Array.isArray(c.frames) ? c.frames : [];
      for (const f of list) frames.push({ ...f, connId: c.id, url: c.url });
    }
    return frames
      .filter((f) => f.direction === "recv" || f.direction === "send")
      .sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0))
      .slice(0, 12);
  }

  function renderFrameRow(f) {
    const content = extractContent(f.payload);
    return `
      <div class="wsint-frame" data-frame-conn="${esc(f.connId)}" data-frame-idx="${esc(f.frameIndex)}">
        <div class="wsint-frame-head">
          <span class="wsint-pill wsint-pill-${f.direction === "send" ? "send" : "recv"}">${esc(String(f.direction).toUpperCase())}</span>
          <code class="wsint-mono">#${esc(f.frameIndex)}</code>
          <span>${fmtTs(f.timestamp)}</span>
          ${content ? `<button class="btn btn-sm" data-frame-content-rule>Editar content…</button>` : ""}
        </div>
        <div class="wsint-frame-url" title="${esc(f.url)}">${esc(trunc(f.url, 90))}</div>
        ${content ? `<div class="wsint-content-preview" title="${esc(content)}">content: ${esc(trunc(content, 180))}</div>` : ""}
        <pre class="wsint-frame-payload">${esc(trunc(f.payload, 1200))}</pre>
      </div>
    `;
  }

  function collectRulesFromDom() {
    const rows = document.querySelectorAll(".wsint-rule");
    const rules = [];
    rows.forEach((row, i) => {
      const existing = wsState.rules[i] || {};
      const get = (f) => row.querySelector(`[data-f="${f}"]`);
      rules.push({
        id: existing.id || crypto.randomUUID(),
        label: get("label")?.value || "",
        direction: get("direction")?.value || "send",
        mode: get("mode")?.value || "pause",
        enabled: get("enabled")?.checked !== false,
        urlRegex: get("urlRegex")?.value || "",
        payloadRegex: get("payloadRegex")?.value || "",
        rewritePath: get("rewritePath")?.value || "",
        rewriteTo: get("rewriteTo")?.value || "",
      });
    });
    return rules;
  }

  function wireEvents(root) {
    $("#wsint-refresh", root)?.addEventListener("click", refresh);

    const saveContentRule = async (enabledOverride) => {
      const existing = getContentRule() || buildContentRuleFromPayload("");
      const rules = (wsState.rules || []).filter((r) => r.id !== CONTENT_RULE_ID);
      const enabledInput = $("#wsint-content-enabled", root);
      const rule = {
        ...existing,
        id: CONTENT_RULE_ID,
        label: "Interceptar content Lovable",
        direction: "recv",
        mode: "rewrite",
        urlRegex: $("#wsint-content-url", root)?.value || DEFAULT_LOVABLE_TRAJECTORY_URL,
        payloadRegex: $("#wsint-content-payload", root)?.value || '"content"\\s*:',
        rewritePath: DEFAULT_CONTENT_PATH,
        rewriteTo: $("#wsint-content-value", root)?.value || "oi",
        enabled: enabledOverride != null ? Boolean(enabledOverride) : enabledInput?.checked !== false,
      };
      const res = await send("BURP_WS_SET_RULES", { rules: [rule, ...rules] });
      if (!res?.ok) { alert("Falha ao aplicar regra: " + (res?.error || "?")); return; }
      wsState = res.ws || wsState;
      render();
    };

    $("#wsint-content-save", root)?.addEventListener("click", () => saveContentRule());
    $("#wsint-content-enabled", root)?.addEventListener("change", (e) => saveContentRule(e.target.checked));
    $("#wsint-content-disable", root)?.addEventListener("click", () => saveContentRule(false));

    $("#wsint-add-rule", root)?.addEventListener("click", () => {
      wsState.rules.push({
        id: crypto.randomUUID(),
        label: "", direction: "send", mode: "pause",
        urlRegex: "", payloadRegex: "", rewritePath: "", rewriteTo: "", enabled: true,
      });
      render();
    });

    $("#wsint-save-rules", root)?.addEventListener("click", async () => {
      const rules = collectRulesFromDom();
      const res = await send("BURP_WS_SET_RULES", { rules });
      if (!res?.ok) { alert("Falha ao salvar regras: " + (res?.error || "?")); return; }
      wsState = res.ws || wsState;
      render();
    });

    root.querySelectorAll("[data-rule-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.dataset.ruleDel);
        const collected = collectRulesFromDom();
        collected.splice(idx, 1);
        const res = await send("BURP_WS_SET_RULES", { rules: collected });
        if (res?.ok) { wsState = res.ws || wsState; render(); }
      });
    });

    // Pause actions
    root.querySelectorAll(".wsint-pause").forEach((card) => {
      const pauseId = card.dataset.pauseId;
      const textarea = card.querySelector("[data-pause-payload]");
      const original = wsState.pauses.find((p) => p.pauseId === pauseId)?.payload || "";
      card.querySelector("[data-resume-original]")?.addEventListener("click", () =>
        send("BURP_WS_RESUME", { pauseId, action: "send", data: original }).then(refresh)
      );
      card.querySelector("[data-resume-edited]")?.addEventListener("click", () =>
        send("BURP_WS_RESUME", { pauseId, action: "send", data: textarea?.value ?? "" }).then(refresh)
      );
      card.querySelector("[data-resume-content]")?.addEventListener("click", () => {
        const contentInput = card.querySelector("[data-pause-content]");
        const nextPayload = buildPayloadWithContent(original, contentInput?.value ?? "");
        send("BURP_WS_RESUME", { pauseId, action: "send", data: nextPayload }).then(refresh);
      });
      card.querySelector("[data-resume-drop]")?.addEventListener("click", () =>
        send("BURP_WS_RESUME", { pauseId, action: "drop" }).then(refresh)
      );
    });

    // Inject prompt
    root.querySelectorAll("[data-inject-conn]").forEach((btn) => {
      btn.addEventListener("click", () => openInjectModal(btn.dataset.injectConn));
    });

    root.querySelectorAll("[data-frame-content-rule]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".wsint-frame");
        const connId = card?.dataset.frameConn;
        const frameIndex = Number(card?.dataset.frameIdx);
        const conn = (wsState.connections || []).find((c) => c.id === connId);
        const frame = (conn?.frames || []).find((f) => Number(f.frameIndex) === frameIndex);
        const rule = buildContentRuleFromPayload(frame?.payload || "");
        wsState.rules.unshift(rule);
        render();
      });
    });
  }

  function openInjectModal(connId) {
    let modal = document.getElementById("wsint-inject-modal");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "wsint-inject-modal";
    modal.className = "wsint-modal";
    modal.innerHTML = `
      <div class="wsint-modal-card">
        <h4>Injetar frame na conexão <code class="wsint-mono">${esc(String(connId).slice(0, 8))}</code></h4>
        <div class="wsint-modal-row">
          <label>Direção:</label>
          <select class="select" id="wsint-inject-dir">
            <option value="send">SEND (cliente → servidor)</option>
            <option value="recv">RECV (forjar resposta do servidor)</option>
          </select>
        </div>
        <label>Payload:</label>
        <textarea class="wsint-textarea" id="wsint-inject-data" style="min-height:140px" placeholder='{"type":"ping"}'></textarea>
        <div class="wsint-modal-actions">
          <button class="btn" id="wsint-inject-cancel">Cancelar</button>
          <button class="btn-primary" id="wsint-inject-send">Injetar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    $("#wsint-inject-cancel", modal).onclick = () => modal.remove();
    $("#wsint-inject-send", modal).onclick = async () => {
      const direction = $("#wsint-inject-dir", modal).value;
      const data = $("#wsint-inject-data", modal).value;
      const res = await send("BURP_WS_INJECT", { connId, direction, data });
      if (!res?.ok) { alert("Falha: " + (res?.error || "?")); return; }
      modal.remove();
      setTimeout(refresh, 200);
    };
  }

  window.__BURP_WS_CONSOLE__ = {
    activate() {
      mounted = true;
      refresh();
    },
  };
})();