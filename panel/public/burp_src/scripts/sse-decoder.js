// ============================================================
// Hyper RB · Scripts · #7 sse-decoder
// Parser SSE (text/event-stream) + timeline + export NDJSON.
// FIXES (Wave 1 · Agent E):
//   - parseSSELocal: parser CRLF-tolerante local como fallback de S.parseSSE.
//   - keep-alive comments (:) filtrados silenciosamente.
//   - Botão "⬇ Payload" por evento para exportar JSON individual.
//   - Contador de keep-alive/comments exibido no summary.
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · sse-decoder] HYPER_RB_SHARED ausente"); return; }

  // FIX: parser SSE local tolerante a CRLF como fallback/complemento de S.parseSSE
  function parseSSELocal(raw) {
    const events = [];
    let state = { data: [], event: undefined, id: undefined, lastEventId: undefined, retry: undefined };
    let keepAliveCount = 0;

    // FIX: split on \r\n or \n (CRLF-tolerant)
    const lines = String(raw || "").split(/\r\n|\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, ""); // strip any stray \r

      // Blank line → dispatch event
      if (line === "") {
        if (state.data.length > 0) {
          const dataStr = state.data.join("\n");
          let parsed = null;
          try { parsed = JSON.parse(dataStr); } catch (_) {}
          // Classify type via shared regex or fallback
          const type = (S.LOVABLE_TYPE_RE && parsed)
            ? (String(parsed.event || parsed.type || state.event || "message").toLowerCase())
            : (state.event || "message");
          events.push({
            event: state.event || "message",
            type,
            data: dataStr,
            parsed,
            id: state.id ?? state.lastEventId ?? null,
            retry: state.retry ?? null,
          });
          state.lastEventId = state.id ?? state.lastEventId;
        }
        state = { data: [], event: undefined, id: undefined, lastEventId: state.lastEventId, retry: undefined };
        continue;
      }

      // FIX: keep-alive / comment lines — skip silently
      if (line.startsWith(":")) { keepAliveCount++; continue; }

      const colonIdx = line.indexOf(":");
      let field, value;
      if (colonIdx === -1) { field = line; value = ""; }
      else { field = line.slice(0, colonIdx); value = line.slice(colonIdx + 1).replace(/^ /, ""); }

      switch (field) {
        case "event": state.event = value; break;
        case "data":  state.data.push(value); break;
        case "id":    if (!value.includes("\0")) state.id = value; break;
        case "retry": { const n = parseInt(value, 10); if (!isNaN(n)) state.retry = n; break; }
      }
    }
    events._keepAliveCount = keepAliveCount;
    return events;
  }

  function isSseRequest(r) {
    if (!r) return false;
    if (r.isSSE) return true;
    const ct = (r.resHeaders && (r.resHeaders["content-type"] || r.resHeaders["Content-Type"])) || "";
    return String(ct).toLowerCase().includes("text/event-stream");
  }

  function summarizeTypes(events) {
    const counts = {};
    for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
    return counts;
  }

  function buildNdjson(streams) {
    const lines = [];
    for (const s of streams) {
      for (const e of s.events) {
        lines.push(JSON.stringify({
          reqId: s.reqId, host: s.host, path: s.path,
          id: e.id, event: e.event, type: e.type, retry: e.retry,
          data: e.parsed ?? e.data,
        }));
      }
    }
    return lines.join("\n");
  }

  const SCRIPT = {
    id: 7,
    slug: "sse-decoder",
    name: "Decodificador SSE",
    description: "Parseia streams text/event-stream e mostra timeline de eventos (tool_call, delta, done).",
    icon: "📡",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const sseReqs = ctx.requests.filter(isSseRequest);
      if (!sseReqs.length) return { ok: false, error: "Nenhuma request SSE (text/event-stream) capturada." };

      const streams = [];
      let totalEvents = 0;
      let totalKeepAlive = 0;
      const globalCounts = {};

      for (const r of sseReqs) {
        // Use S.parseSSE if available, fallback to local CRLF-tolerant parser
        let events;
        try {
          events = S.parseSSE ? S.parseSSE(r.resBody || "") : parseSSELocal(r.resBody || "");
          // If S.parseSSE returned empty but local finds events, prefer local
          if ((!events || events.length === 0) && r.resBody) {
            const local = parseSSELocal(r.resBody);
            if (local.length > 0) events = local;
          }
        } catch (_) {
          events = parseSSELocal(r.resBody || "");
        }
        events = events || [];
        totalKeepAlive += events._keepAliveCount || 0;

        const counts = summarizeTypes(events);
        for (const [k, v] of Object.entries(counts)) globalCounts[k] = (globalCounts[k] || 0) + v;
        totalEvents += events.length;
        streams.push({ reqId: r.id, host: r.host, path: r.pathname, method: r.method, ts: r.ts, events, counts });
      }

      const ndjson = buildNdjson(streams);
      const filename = `hyper-rb-sse-${Date.now()}.ndjson`;

      return {
        ok: true,
        summary: `${streams.length} stream(s) · ${totalEvents} evento(s)${totalKeepAlive ? ` · ${totalKeepAlive} keep-alive` : ""}`,
        artifact: { filename, mime: "application/x-ndjson", content: ndjson },
        render(mountEl) {
          mountEl.innerHTML = `<div class="hyper-rb-loading">Renderizando timeline…</div>`;
          const allTypes = Object.keys(globalCounts).sort();
          const typeChips = allTypes.map((t) =>
            `<button class="hyper-rb-chip" data-type="${S.escapeHtml(t)}" aria-pressed="true">${S.escapeHtml(t)} · ${globalCounts[t]}</button>`
          ).join("");
          const streamSelector = streams.map((s, i) =>
            `<option value="${i}">${S.escapeHtml(s.method)} ${S.escapeHtml(s.host)}${S.escapeHtml(s.path)} (${s.events.length} ev)</option>`
          ).join("");

          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">SSE Timeline</div>
                  <div class="hyper-rb-section-sub">${S.escapeHtml(streams.length)} stream(s) · ${S.escapeHtml(totalEvents)} evento(s)${totalKeepAlive ? ` · ${totalKeepAlive} keep-alive` : ""}.</div>
                </div>
                <button class="hyper-rb-btn hyper-rb-btn-primary dl-ndjson">⬇ Baixar .ndjson</button>
              </div>
              <div class="hyper-rb-toolbar">
                <label>Stream:&nbsp;<select class="hyper-rb-select stream-sel">${streamSelector}</select></label>
              </div>
              <div class="hyper-rb-toolbar type-filters">${typeChips || "<span>Sem eventos</span>"}</div>
              <ol class="hyper-rb-timeline" data-region="timeline"></ol>
            </div>`;

          const timeline = mountEl.querySelector('[data-region="timeline"]');
          const sel = mountEl.querySelector(".stream-sel");
          const activeTypes = new Set(allTypes);

          function renderTimeline() {
            const idx = Number(sel.value) || 0;
            const stream = streams[idx];
            if (!stream) { timeline.innerHTML = ""; return; }
            const items = stream.events
              .filter((e) => activeTypes.has(e.type))
              .map((e, i) => {
                const preview = e.parsed ? JSON.stringify(e.parsed, null, 2) : (e.data || "");
                const previewSafe = S.escapeHtml(preview.length > 800 ? preview.slice(0, 800) + "…" : preview);
                // FIX: per-event export button
                const payloadJson = JSON.stringify(e.parsed ?? e.data, null, 2);
                const payloadB64 = btoa(unescape(encodeURIComponent(payloadJson)));
                return `
                  <li class="hyper-rb-timeline-item" data-type="${S.escapeHtml(e.type)}">
                    <div class="hyper-rb-timeline-marker"></div>
                    <div class="hyper-rb-timeline-body">
                      <div class="hyper-rb-timeline-head">
                        <span class="hyper-rb-badge">${S.escapeHtml(e.type)}</span>
                        ${e.id ? `<span class="hyper-rb-mono">id=${S.escapeHtml(e.id)}</span>` : ""}
                        <span class="hyper-rb-mono">#${i + 1}</span>
                        <a class="hyper-rb-btn" style="margin-left:auto;font-size:10px;padding:2px 7px;"
                           href="data:application/json;base64,${payloadB64}"
                           download="sse-event-${i + 1}.json" title="Exportar payload">⬇</a>
                      </div>
                      <details>
                        <summary>ver payload (${preview.length} chars)</summary>
                        <pre class="hyper-rb-pre">${previewSafe}</pre>
                      </details>
                    </div>
                  </li>`;
              }).join("");
            timeline.innerHTML = items || `<li class="hyper-rb-empty">Nenhum evento corresponde aos filtros.</li>`;
          }

          sel.addEventListener("change", renderTimeline);
          mountEl.querySelectorAll(".type-filters .hyper-rb-chip").forEach((chip) => {
            chip.addEventListener("click", () => {
              const t = chip.getAttribute("data-type");
              if (activeTypes.has(t)) { activeTypes.delete(t); chip.setAttribute("aria-pressed", "false"); }
              else { activeTypes.add(t); chip.setAttribute("aria-pressed", "true"); }
              renderTimeline();
            });
          });
          mountEl.querySelector(".dl-ndjson")?.addEventListener("click", () => {
            S.downloadBlob(filename, "application/x-ndjson", ndjson);
          });
          renderTimeline();
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
