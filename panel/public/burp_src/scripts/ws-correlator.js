// ============================================================
// Hyper RB · Scripts · #23 ws-correlator
// Correlaciona POST /chat com frames WebSocket; gera timeline,
// métricas e receita de replay.
// FIXES (Wave 1 · Agent E):
//   - Correlação BIDIRECIONAL: SEND→RECV e RECV→SEND (server-push → ack).
//   - extractCorrId() cobre id, requestId, correlationId, seq, msgId.
//   - Export NDJSON exporta payload completo (sem truncar a 256 chars).
//   - aggregateForRequest: também conta frames enviados (outbound).
//   - buildRecipe: inclui avg_recv_ms e avg_send_ms separados.
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · ws-correlator] HYPER_RB_SHARED ausente"); return; }

  function classifyFrame(frame) {
    if (!frame) return "frame";
    const p = frame.payload;
    if (p === "[DONE]") return "done";
    let parsed = frame.parsed || null;
    if (!parsed && p && typeof p === "string") {
      try { parsed = JSON.parse(p); } catch { /* noop */ }
    }
    if (!parsed) return "frame";
    const ev = (parsed.event || "").toLowerCase();
    if (ev === "event_created") return "event_created";
    if (ev === "tool_call" || parsed.tool) return "tool_call";
    if (ev === "tool_result") return "tool_result";
    if (ev === "message_delta" || ev === "content_block_delta") return "message_delta";
    if (ev === "done") return "done";
    return "frame";
  }

  const WS_PARSE_LIMIT = 64 * 1024;
  function parsedOf(frame) {
    let parsed = frame.parsed || null;
    if (!parsed && frame.payload && typeof frame.payload === "string") {
      if (frame.payload.length <= WS_PARSE_LIMIT) {
        try { parsed = JSON.parse(frame.payload); } catch { /* noop */ }
      }
    }
    return parsed;
  }

  // FIX: extract correlation ID from multiple common fields
  function extractCorrId(parsed) {
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed.id ?? parsed.requestId ?? parsed.correlationId ?? parsed.seq ?? parsed.msgId ?? parsed.message_id;
  }

  function aggregateForRequest(req, frames) {
    const window60 = frames.filter(f => f.ts >= req.ts && f.ts <= req.ts + 60000);

    let firstDelta = null, firstToolCall = null, toolCallCount = 0;
    const toolsSet = new Set();
    let hasDone = false;

    // FIX: track bidirectional correlation within window
    const recvFrames = window60.filter(f => f.dir === "in" || f.direction === "recv");
    const sendFrames = window60.filter(f => f.dir === "out" || f.direction === "send");
    const corrPairs = []; // { req: frame, res: frame, rtt }

    // SEND→RECV pairs
    for (const sf of sendFrames) {
      const sfId = extractCorrId(parsedOf(sf));
      const match = recvFrames.find(rf => {
        const rfId = extractCorrId(parsedOf(rf));
        return sfId != null && sfId === rfId && rf.ts >= sf.ts;
      });
      if (match) corrPairs.push({ req: sf, res: match, rtt: match.ts - sf.ts, dir: "send→recv" });
    }

    // FIX: RECV→SEND pairs (server-push ack pattern)
    for (const rf of recvFrames) {
      const rfId = extractCorrId(parsedOf(rf));
      const alreadyMatched = corrPairs.some(p => p.res === rf);
      if (alreadyMatched) continue;
      const ackFrame = sendFrames.find(sf => {
        const sp = parsedOf(sf);
        const ackId = sp?.ackId ?? sp?.replyTo ?? sp?.in_reply_to ?? extractCorrId(sp);
        return rfId != null && ackId === rfId && sf.ts > rf.ts;
      });
      if (ackFrame) corrPairs.push({ req: rf, res: ackFrame, rtt: ackFrame.ts - rf.ts, dir: "recv→send" });
    }

    for (const f of window60) {
      const type = classifyFrame(f);
      const parsed = parsedOf(f);
      if (type === "message_delta" && firstDelta === null) firstDelta = f.ts;
      if (type === "tool_call") {
        toolCallCount++;
        if (firstToolCall === null) firstToolCall = f.ts;
        if (parsed && parsed.tool) toolsSet.add(String(parsed.tool));
      }
      if (type === "done") hasDone = true;
    }

    return {
      req, frames: window60,
      time_to_first_token_ms: firstDelta !== null ? firstDelta - req.ts : null,
      thinking_time_ms: firstToolCall !== null ? firstToolCall - req.ts : null,
      total_tool_calls: toolCallCount,
      tools_used: [...toolsSet],
      final_status: hasDone ? "done" : "open",
      frame_count: window60.length,
      corr_pairs: corrPairs, // FIX: expose bidirectional pairs
    };
  }

  function buildRecipe(aggregates) {
    const allEvents = [];
    const recvLatencies = [], sendLatencies = [];

    for (const agg of aggregates) {
      const types = [...new Set(agg.frames.map(classifyFrame))];
      for (const t of types) if (!allEvents.includes(t)) allEvents.push(t);
      if (agg.time_to_first_token_ms !== null) recvLatencies.push(agg.time_to_first_token_ms);
      // FIX: separate send latency from corrPairs
      for (const p of (agg.corr_pairs || [])) {
        if (p.dir === "send→recv") sendLatencies.push(p.rtt);
      }
    }

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const endpoint = aggregates[0] ? `POST ${aggregates[0].req.url}` : "POST <chat-endpoint>";

    return {
      endpoint,
      body_template: { mensagem: "<USER_INPUT>", fast_mode: true, files: [] },
      expected_ws_events: allEvents,
      avg_ttft_ms: avg(recvLatencies),      // time-to-first-token
      avg_req_rtt_ms: avg(sendLatencies),   // FIX: send→recv RTT
    };
  }

  // ---- tabs setup ----
  function setupTabs(root) {
    const buttons = root.querySelectorAll(".hyper-rb-tab-btn");
    const panels  = root.querySelectorAll(".hyper-rb-tab-panel");
    function activate(slug) {
      buttons.forEach(b => {
        const active = b.dataset.tab === slug;
        b.style.background   = active ? "#334155" : "transparent";
        b.style.color        = active ? "#e2e8f0" : "#94a3b8";
        b.style.borderBottom = active ? "2px solid #6366f1" : "2px solid transparent";
      });
      panels.forEach(p => { p.style.display = p.dataset.panel === slug ? "" : "none"; });
    }
    buttons.forEach(b => b.addEventListener("click", () => activate(b.dataset.tab)));
    activate("timeline");
  }

  function renderInto(mountEl, aggregates, recipe, totalFrames) {
    const chatCount = aggregates.length;

    let timelineHtml = "";
    for (const agg of aggregates) {
      const reqLabel = `<span style="font-weight:600;color:#a5b4fc;">${S.escapeHtml(agg.req.pathname)}</span>`;
      // FIX: show bidirectional correlation info
      const corrCount = (agg.corr_pairs || []).length;
      timelineHtml += `<div style="margin-bottom:16px;border-left:3px solid #6366f1;padding-left:10px;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${reqLabel} — ${agg.frame_count} frame(s)${corrCount ? ` · <span style="color:#34d399">${corrCount} par(es) correlacionados</span>` : ""}</div>`;

      for (const f of agg.frames) {
        const type = classifyFrame(f);
        const relMs = f.ts - agg.req.ts;
        const dir = f.dir || f.direction || "?";
        const dirColor = (dir === "in" || dir === "recv") ? "#34d399" : "#60a5fa";
        const dirLabel = (dir === "in" || dir === "recv") ? "↙ in" : "↗ out";
        const preview = S.escapeHtml((f.payload || "").slice(0, 120));
        const typeColors = { message_delta: "#fbbf24", tool_call: "#f472b6", tool_result: "#a78bfa", done: "#34d399", event_created: "#38bdf8", frame: "#94a3b8" };
        const typeColor = typeColors[type] || "#94a3b8";

        // FIX: mark correlated frames
        const isCorr = (agg.corr_pairs || []).some(p => p.req === f || p.res === f);
        const corrMark = isCorr ? `<span style="color:#34d399;font-size:9px;">↔</span>` : "";

        timelineHtml += `
          <div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;border-bottom:1px solid #1e293b;font-size:11px;">
            <span style="color:${dirColor};white-space:nowrap;min-width:40px;">${dirLabel}</span>
            <span style="color:${typeColor};white-space:nowrap;min-width:90px;">${type}${corrMark}</span>
            <span style="color:#64748b;white-space:nowrap;min-width:70px;">+${relMs}ms</span>
            <span style="color:#cbd5e1;word-break:break-all;opacity:.8;">${preview}</span>
          </div>`;
      }
      if (agg.frames.length === 0) timelineHtml += `<div style="color:#64748b;font-size:11px;padding:4px 0;">Nenhum frame WS na janela de 60s.</div>`;
      timelineHtml += `</div>`;
    }
    if (!timelineHtml) timelineHtml = `<div style="color:#64748b;font-size:12px;">Nenhum chat correlacionado.</div>`;

    let aggHtml = "";
    for (const agg of aggregates) {
      const ttft = agg.time_to_first_token_ms !== null ? S.formatMs(agg.time_to_first_token_ms) : "—";
      const think = agg.thinking_time_ms !== null ? S.formatMs(agg.thinking_time_ms) : "—";
      const tools = agg.tools_used.length ? agg.tools_used.map(S.escapeHtml).join(", ") : "—";
      const statusColor = agg.final_status === "done" ? "#34d399" : "#fbbf24";
      const corrCount = (agg.corr_pairs || []).length;
      aggHtml += `
        <div class="hyper-rb-card" style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px;margin-bottom:12px;">
          <div style="font-size:11px;color:#a5b4fc;font-weight:600;margin-bottom:8px;">${S.escapeHtml(agg.req.pathname)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
            <div><span style="color:#64748b;">TTFT:</span> <span style="color:#e2e8f0;">${ttft}</span></div>
            <div><span style="color:#64748b;">Thinking:</span> <span style="color:#e2e8f0;">${think}</span></div>
            <div><span style="color:#64748b;">Tool calls:</span> <span style="color:#e2e8f0;">${agg.total_tool_calls}</span></div>
            <div><span style="color:#64748b;">Status:</span> <span style="color:${statusColor};">${agg.final_status}</span></div>
            <div><span style="color:#64748b;">Corr. pairs:</span> <span style="color:#34d399;">${corrCount}</span></div>
            <div style="grid-column:1/-1;"><span style="color:#64748b;">Tools:</span> <span style="color:#e2e8f0;">${tools}</span></div>
          </div>
        </div>`;
    }
    if (!aggHtml) aggHtml = `<div style="color:#64748b;font-size:12px;">Nenhum dado de agregação.</div>`;

    const recipeJson = JSON.stringify(recipe, null, 2);

    mountEl.innerHTML = `
      <style>
        .hyper-rb-tab-btn { cursor:pointer; padding:6px 14px; border:none; border-radius:4px 4px 0 0; font-size:12px; font-weight:500; transition:all .15s; }
        .hyper-rb-tab-panel { padding:12px 0; }
      </style>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">
        <span style="color:#6366f1;font-weight:600;">${chatCount}</span> chat(s) correlacionado(s) &nbsp;·&nbsp;
        <span style="color:#6366f1;font-weight:600;">${totalFrames}</span> frame(s) WS total
      </div>
      <div style="display:flex;gap:0;border-bottom:2px solid #1e293b;margin-bottom:12px;">
        <button class="hyper-rb-tab-btn" data-tab="timeline">Timeline</button>
        <button class="hyper-rb-tab-btn" data-tab="agregado">Agregado</button>
        <button class="hyper-rb-tab-btn" data-tab="receita">Receita</button>
      </div>
      <div class="hyper-rb-tab-panel" data-panel="timeline">${timelineHtml}</div>
      <div class="hyper-rb-tab-panel" data-panel="agregado" style="display:none;">${aggHtml}</div>
      <div class="hyper-rb-tab-panel" data-panel="receita" style="display:none;">
        <pre style="background:#0f172a;border:1px solid #1e293b;border-radius:6px;padding:12px;font-size:11px;color:#a5b4fc;overflow:auto;max-height:360px;white-space:pre-wrap;word-break:break-all;">${S.escapeHtml(recipeJson)}</pre>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="wsc-export-ndjson" style="background:#6366f1;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px;">Exportar .ndjson</button>
          <button class="wsc-save-preset" style="background:#334155;color:#e2e8f0;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px;">Salvar como Preset</button>
          <div class="wsc-preset-msg" style="font-size:11px;color:rgba(255,255,255,.5);align-self:center;"></div>
        </div>
      </div>`;

    setupTabs(mountEl);

    // FIX: export NDJSON with full payload (not truncated)
    mountEl.querySelector(".wsc-export-ndjson").addEventListener("click", () => {
      const lines = [];
      for (const agg of aggregates) {
        for (const f of agg.frames) {
          const parsed = parsedOf(f);
          const corrPair = (agg.corr_pairs || []).find(p => p.req === f || p.res === f);
          lines.push(JSON.stringify({
            req_url: agg.req.url, req_ts: agg.req.ts, frame_ts: f.ts,
            rel_ms: f.ts - agg.req.ts, dir: f.dir || f.direction,
            type: classifyFrame(f), correlated: !!corrPair,
            corr_dir: corrPair?.dir ?? null, corr_rtt_ms: corrPair?.rtt ?? null,
            payload: f.payload || "", // FIX: full payload, no truncation
            parsed: parsed || null,
          }));
        }
      }
      S.downloadBlob("ws-correlator-timeline.ndjson", "application/x-ndjson", lines.join("\n") || "{}");
    });

    mountEl.querySelector(".wsc-save-preset").addEventListener("click", () => {
      const msg = mountEl.querySelector(".wsc-preset-msg");
      if (msg) msg.textContent = "Exportando JSON local…";
      S.downloadBlob("ws-correlator-recipe.json", "application/json", JSON.stringify(recipe, null, 2));
      if (msg) setTimeout(() => { msg.textContent = ""; }, 3000);
    });
  }

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push({
    id: 23, slug: "ws-correlator", name: "WS Correlator",
    description: "Correlaciona POST /chat com frames WebSocket; correlação bidirecional, timeline, métricas e receita de replay.",
    icon: "🔌", needsAI: false, needsNetwork: false, minRequests: 1,

    async run(ctx) {
      try {
        const frames = await S.loadWsFrames();
        if (frames.length === 0) {
          return {
            ok: true,
            summary: "Captura WS desabilitada — ative em Configurações.",
            render(mountEl) {
              mountEl.innerHTML = `<div style="padding:20px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">📡</div><div style="color:#fbbf24;font-weight:600;margin-bottom:6px;">Captura WS desabilitada</div><div style="color:#94a3b8;font-size:12px;">Ative em Configurações para começar a capturar frames WebSocket.</div></div>`;
            },
          };
        }

        const chatRequests = (ctx.requests || []).filter((r) => {
          const method = (r.method || "").toUpperCase();
          const pathname = r.pathname || r.url || "";
          const host = r.host || r.url || "";
          return method === "POST" && pathname.includes("/chat") && host.includes("lovable.dev");
        });

        const aggregates = chatRequests.map((req) => aggregateForRequest(req, frames));
        const recipe = buildRecipe(aggregates);
        ctx.log("info", `ws-correlator: ${aggregates.length} chat(s), ${frames.length} frame(s)`);

        return {
          ok: true,
          summary: `${aggregates.length} chat(s) correlacionado(s) · ${frames.length} frame(s) WS`,
          render(mountEl) { renderInto(mountEl, aggregates, recipe, frames.length); },
        };
      } catch (e) {
        console.error("[ws-correlator]", e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
  });
})();
