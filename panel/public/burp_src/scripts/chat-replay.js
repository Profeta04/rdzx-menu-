// ============================================================
// Hyper RB · Script #13 · chat-replay
// Replay interativo do POST /chat (api.lovable.dev|app)
// com editor de prompt e decodificação SSE ao vivo.
// v5.0: BUG#2 fix — hidrata reqBody via getRawRequest quando
//       ausente (body não persistido pelo runtime/pageHook).
//       Melhorias: copy-prompt, token-estimate, status-badge
//       por evento, contagem de chars na timeline.
// ============================================================
(function registerChatReplay() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · chat-replay] HYPER_RB_SHARED ausente");
    return;
  }

  const MAX_REPLAYS = 5;

  function isChatRequest(r) {
    if (!r || r.method !== "POST") return false;
    const host = String(r.host || "").toLowerCase();
    const path = String(r.pathname || "");
    return /(^|\.)lovable\.(dev|app)$/i.test(host) && /\/chat(\/|$|\?)/i.test(path);
  }

  function parseChatBody(reqBody) {
    if (!reqBody || typeof reqBody !== "string") return { body: null, truncated: false };
    const truncated = reqBody.includes("\u2026(+");
    try {
      return { body: JSON.parse(reqBody), truncated };
    } catch {
      return { body: null, truncated };
    }
  }

  // Rough token estimate: ~4 chars per token (OpenAI heuristic)
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(String(text).length / 4);
  }

  // parseSseEvents refatorada: delega ao S.parseSSE compartilhado (_shared.js).
  function parseSseEvents(raw) {
    return S.parseSSE(raw)
      .filter((e) => e.data !== "" || e.event)
      .map((e) => {
        if (/^\s*\[DONE\]\s*$/i.test(e.data) || e.type === "done") {
          return { type: e.event || "done", content: "", raw: null, ts: Date.now() };
        }
        return {
          type: e.type,
          content: e.parsed
            ? (e.parsed.content || e.parsed.delta || e.parsed.text || e.parsed.name || "")
            : e.data,
          raw: e.parsed,
          ts: Date.now(),
        };
      });
  }

  // Sanitiza tipo de evento p/ classe CSS válida.
  function sseClass(type) {
    return String(type || "unknown").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "unknown";
  }

  function renderChatReplay(mountEl, list, ctx) {
    mountEl.innerHTML = `
      <div class="cr-root">
        <div class="cr-section">
          <label class="cr-label">Request /chat alvo</label>
          <select class="cr-select">
            ${list.map((item, i) => `<option value="${i}">${S.escapeHtml(item.label)}</option>`).join("")}
          </select>
        </div>
        <div class="cr-section">
          <label class="cr-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Prompt (edit\u00e1vel)</span>
            <span style="display:flex;gap:6px;align-items:center;">
              <span class="cr-token-est" style="font-family:monospace;font-size:10px;color:rgba(191,0,255,.7);"></span>
              <button class="cr-btn-copy-prompt" type="button" title="Copiar prompt" style="padding:2px 8px;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:4px;cursor:pointer;font-size:10px;">&#128203; Copiar</button>
            </span>
          </label>
          <textarea class="cr-prompt" rows="6" placeholder="Digite o prompt..."></textarea>
        </div>
        <details class="cr-advanced">
          <summary class="cr-label" style="cursor:pointer;">Campos adicionais &#9662;</summary>
          <div class="cr-grid-2">
            <div><label class="cr-label-sm">project_id</label><input class="cr-input cr-project-id" type="text" /></div>
            <div><label class="cr-label-sm">chat_mode</label><input class="cr-input cr-chat-mode" type="text" /></div>
            <div><label class="cr-label-sm">model_slug</label><input class="cr-input cr-model-slug" type="text" /></div>
            <div><label class="cr-label-sm">attachments (JSON)</label><textarea class="cr-input cr-attachments" rows="2">[]</textarea></div>
          </div>
        </details>
        <div class="cr-warn">&#9888;&#65039; M&aacute;ximo <strong>${MAX_REPLAYS} replays</strong> por sess&atilde;o. Cada replay dispara um compose real no Lovable.</div>
        <div style="display:flex;gap:10px;align-items:center;font-size:11px;padding:4px 0;"><label><input type="checkbox" class="cr-fast-mode" checked /> <code>fast_mode</code></label><span style="color:rgba(255,255,255,.4);">Desmarcar envia sem fast_mode (pode ser mais lento ou usar modelo diferente)</span></div>
        <div class="cr-controls">
          <span class="cr-counter">0 / ${MAX_REPLAYS} replays</span>
          <button class="cr-btn-replay" type="button">&#9654; Replay /chat</button>
          <button class="cr-btn-clear" type="button">Limpar timeline</button>
          <button class="cr-btn-export-md" type="button">&#11015; Export MD</button>
        </div>
        <div class="cr-timeline-wrap">
          <div class="cr-timeline-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>SSE Timeline</span>
            <span class="cr-timeline-stats" style="font-family:monospace;font-size:9px;color:rgba(255,255,255,.3);"></span>
          </div>
          <div class="cr-timeline"></div>
        </div>
      </div>
      <style>
        .cr-root { display:flex; flex-direction:column; gap:12px; font-size:12px; color:#e8e8ec; }
        .cr-section { display:flex; flex-direction:column; gap:4px; }
        .cr-label { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:rgba(255,255,255,.5); }
        .cr-label-sm { font-size:10px; color:rgba(255,255,255,.4); }
        .cr-select, .cr-input { width:100%; padding:8px 10px; background:rgba(18,18,20,.8); color:#fff; border:1px solid rgba(191,0,255,.25); border-radius:6px; font-size:12px; box-sizing:border-box; }
        .cr-prompt { width:100%; padding:8px 10px; background:rgba(18,18,20,.8); color:#fff; border:1px solid rgba(191,0,255,.35); border-radius:6px; font-family:system-ui; font-size:13px; resize:vertical; box-sizing:border-box; }
        .cr-advanced { background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:10px; }
        .cr-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
        .cr-warn { background:rgba(255,170,0,.08); border:1px solid rgba(255,170,0,.25); border-radius:8px; padding:8px 12px; color:rgba(255,255,255,.8); font-size:11px; }
        .cr-controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .cr-counter { color:rgba(191,0,255,.8); font-size:11px; font-family:monospace; margin-right:auto; }
        .cr-btn-replay { padding:8px 18px; background:#bf00ff; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px; }
        .cr-btn-replay:hover:not(:disabled) { background:#d400ff; }
        .cr-btn-replay:disabled { opacity:.45; cursor:not-allowed; }
        .cr-btn-clear { padding:8px 12px; background:rgba(255,255,255,.07); color:#fff; border:1px solid rgba(255,255,255,.15); border-radius:6px; cursor:pointer; font-size:12px; }
        .cr-btn-export-md { padding:8px 12px; background:rgba(0,200,120,.1); color:#73ffb8; border:1px solid rgba(0,200,120,.3); border-radius:6px; cursor:pointer; font-size:12px; }
        .cr-btn-export-md:hover:not(:disabled) { background:rgba(0,200,120,.22); }
        .cr-timeline-wrap { background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:12px; min-height:80px; max-height:400px; overflow:auto; }
        .cr-timeline-title { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.35); margin-bottom:8px; }
        .cr-timeline { display:flex; flex-direction:column; gap:4px; }
        .cr-event { display:flex; gap:8px; align-items:flex-start; padding:6px 8px; border-radius:6px; font-size:11px; border-left:3px solid rgba(255,255,255,.2); }
        .cr-event-message_delta { background:rgba(0,200,100,.06); border-left-color:rgba(0,200,100,.5); }
        .cr-event-tool_call { background:rgba(191,0,255,.06); border-left-color:rgba(191,0,255,.5); }
        .cr-event-done { background:rgba(80,180,255,.06); border-left-color:rgba(80,180,255,.5); }
        .cr-event-error { background:rgba(255,60,60,.08); border-left-color:rgba(255,60,60,.5); }
        .cr-event-info { background:rgba(255,255,255,.04); border-left-color:rgba(191,0,255,.6); }
        .cr-event-raw { background:rgba(255,255,255,.03); border-left-color:rgba(255,255,255,.3); }
        .cr-event-type { font-family:monospace; font-weight:700; font-size:10px; white-space:nowrap; color:rgba(255,255,255,.55); }
        .cr-event-body { color:#e8e8ec; word-break:break-word; flex:1; }
        .cr-event-ts { font-family:monospace; font-size:9px; color:rgba(255,255,255,.25); white-space:nowrap; }
      </style>
    `;

    const selectEl    = mountEl.querySelector(".cr-select");
    const promptEl    = mountEl.querySelector(".cr-prompt");
    const projectIdEl = mountEl.querySelector(".cr-project-id");
    const chatModeEl  = mountEl.querySelector(".cr-chat-mode");
    const modelSlugEl = mountEl.querySelector(".cr-model-slug");
    const attachEl    = mountEl.querySelector(".cr-attachments");
    const counterEl   = mountEl.querySelector(".cr-counter");
    const replayBtn   = mountEl.querySelector(".cr-btn-replay");
    const clearBtn    = mountEl.querySelector(".cr-btn-clear");
    const exportBtn   = mountEl.querySelector(".cr-btn-export-md");
    const copyPromptBtn = mountEl.querySelector(".cr-btn-copy-prompt");
    const tokenEstEl  = mountEl.querySelector(".cr-token-est");
    const timelineEl  = mountEl.querySelector(".cr-timeline");
    const statsEl     = mountEl.querySelector(".cr-timeline-stats");

    let replayCount = 0;

    function updateTokenEst() {
      const chars = promptEl.value.length;
      const toks  = estimateTokens(promptEl.value);
      tokenEstEl.textContent = chars ? `~${toks} tokens · ${chars} chars` : "";
    }

    promptEl.addEventListener("input", updateTokenEst);

    copyPromptBtn.addEventListener("click", () => {
      const text = promptEl.value;
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          copyPromptBtn.textContent = "✓ Copiado!";
          setTimeout(() => { copyPromptBtn.textContent = "📋 Copiar"; }, 1500);
        }).catch(() => {
          copyPromptBtn.textContent = "❌ Erro";
          setTimeout(() => { copyPromptBtn.textContent = "📋 Copiar"; }, 1500);
        });
      }
    });

    function populate(idx) {
      const item = list[Number(idx || 0)];
      if (!item) return;
      const b = item.parsed && item.parsed.body;
      promptEl.value     = (b && b.message) || "";
      projectIdEl.value  = (b && b.project_id) || "";
      chatModeEl.value   = (b && b.chat_mode) || "edit";
      modelSlugEl.value  = (b && b.model_slug) || "";
      attachEl.value     = b && b.attachments ? JSON.stringify(b.attachments, null, 2) : "[]";
      updateTokenEst();
      if (item.parsed && item.parsed.truncated) {
        appendSystemEvent("error", "Body original truncado pelo sanitizer. Campos podem estar incompletos.");
      }
      if (item.bodyMissing) {
        appendSystemEvent("error", "\u26A0\uFE0F Body n\u00e3o encontrado (runtime n\u00e3o persistiu). Verifique burp_pageHook.js ou use o Composer novamente.");
      }
    }

    function appendEvent(ev) {
      const div = document.createElement("div");
      div.className = `cr-event cr-event-${sseClass(ev.type)}`;
      const time = new Date(ev.ts).toLocaleTimeString("pt-BR", { hour12: false });
      let bodyText = ev.content || "";
      if (ev.type === "tool_call" && ev.raw && ev.raw.name) {
        bodyText = `${ev.raw.name}(${JSON.stringify(ev.raw.args || ev.raw.arguments || {}).slice(0, 160)})`;
      }
      div.innerHTML = `
        <span class="cr-event-type">${S.escapeHtml(ev.type)}</span>
        <span class="cr-event-body">${S.escapeHtml(String(bodyText).slice(0, 400))}</span>
        <span class="cr-event-ts">${time}</span>
      `;
      timelineEl.appendChild(div);
      timelineEl.scrollTop = timelineEl.scrollHeight;
      // Update stats
      const count = timelineEl.querySelectorAll(".cr-event").length;
      const totalChars = Array.from(timelineEl.querySelectorAll(".cr-event-body"))
        .reduce((acc, el) => acc + (el.textContent || "").length, 0);
      statsEl.textContent = `${count} eventos · ~${estimateTokens(totalChars * 4)} tokens gerados`;
    }

    function appendSystemEvent(type, msg) {
      appendEvent({ type, content: msg, raw: null, ts: Date.now() });
    }

    selectEl.addEventListener("change", () => populate(selectEl.value));
    populate(0);

    clearBtn.addEventListener("click", () => { timelineEl.innerHTML = ""; statsEl.textContent = ""; });
    exportBtn.addEventListener("click", () => {
      const rows = Array.from(timelineEl.querySelectorAll(".cr-event"));
      if (!rows.length) {
        appendSystemEvent("info", "Timeline vazia — nada para exportar.");
        return;
      }
      const item = list[Number(selectEl.value || 0)];
      const header = `# Chat Replay · ${item ? S.escapeHtml(item.label) : "export"}\n\n` +
                     `_Exportado em: ${new Date().toLocaleString("pt-BR")}_\n\n---\n\n`;
      const lines = rows.map((row) => {
        const type = (row.querySelector(".cr-event-type") || {}).textContent || "?";
        const body = (row.querySelector(".cr-event-body") || {}).textContent || "";
        const ts   = (row.querySelector(".cr-event-ts") || {}).textContent || "";
        return `**[${type}]** \`${ts}\`  \n${body}`;
      });
      const md = header + lines.join("\n\n");
      S.downloadBlob(`chat-replay-${Date.now()}.md`, "text/markdown", md);
    });

    replayBtn.addEventListener("click", async () => {
      if (replayCount >= MAX_REPLAYS) {
        appendSystemEvent("error", `Limite de ${MAX_REPLAYS} replays atingido nesta sess\u00e3o.`);
        return;
      }
      const item = list[Number(selectEl.value || 0)];
      if (!item) return;
      if (!item.r.url) {
        appendSystemEvent("error", "URL da request n\u00e3o dispon\u00edvel.");
        return;
      }
      const prompt = promptEl.value.trim();
      if (!prompt) {
        appendSystemEvent("error", "Prompt n\u00e3o pode ser vazio.");
        return;
      }

      let attachments = [];
      try { attachments = JSON.parse(attachEl.value || "[]"); }
      catch { appendSystemEvent("error", "attachments JSON inv\u00e1lido."); return; }

      const fastMode = mountEl.querySelector(".cr-fast-mode")?.checked !== false;
      const bodyObj = Object.assign({}, (item.parsed && item.parsed.body) || {}, {
        message: prompt,
        attachments,
        fast_mode: fastMode,
      });
      const pid = projectIdEl.value.trim();
      const cm  = chatModeEl.value.trim();
      const ms  = modelSlugEl.value.trim();
      if (pid) bodyObj.project_id = pid;
      if (cm)  bodyObj.chat_mode  = cm;
      if (ms)  bodyObj.model_slug = ms;
      // Sanity: remove campos undefined
      for (const k of Object.keys(bodyObj)) if (bodyObj[k] === undefined) delete bodyObj[k];

      replayBtn.disabled = true;
      replayCount++;
      counterEl.textContent = `${replayCount} / ${MAX_REPLAYS} replays`;
      appendSystemEvent("info", `\u25B6 Replay #${replayCount} \u2014 disparando para ${item.r.host}${item.r.pathname}`);

      const _replayAbort = new AbortController();
      try {
        const res = await ctx.proxyFetch(item.r.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "accept": "text/event-stream",
          },
          body: JSON.stringify(bodyObj),
          signal: _replayAbort.signal,
        });
        if (res?.aborted) {
          appendSystemEvent("info", "Replay cancelado.");
          return;
        }

        appendSystemEvent("info", `HTTP ${res.status} \u00b7 ${res.durationMs || "?"}ms`);

        if (!res.ok && !res.body) {
          appendSystemEvent("error", `Falha: ${res.error || "sem body"}`);
          return;
        }

        const events = parseSseEvents(res.body || "");
        if (!events.length) {
          const preview = (res.body || "").slice(0, 600);
          appendSystemEvent("raw", preview || "(resposta vazia)");
        } else {
          for (const ev of events) appendEvent(ev);
        }
      } catch (e) {
        appendSystemEvent("error", `Exce\u00e7\u00e3o: ${String((e && e.message) || e)}`);
      } finally {
        if (replayCount < MAX_REPLAYS) {
          replayBtn.disabled = false;
        } else {
          replayBtn.disabled = true;
          replayBtn.textContent = "Limite atingido";
        }
      }
    });
  }

  const SCRIPT = {
    id: 13,
    slug: "chat-replay",
    name: "Chat Replay",
    description: "Replay interativo do /chat Lovable com editor de prompt e decoder SSE ao vivo.",
    icon: "\uD83D\uDCAC",
    needsAI: false,
    needsNetwork: true,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests || !ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }
      const chatReqs = ctx.requests.filter(isChatRequest);
      if (!chatReqs.length) {
        return {
          ok: false,
          error: "Nenhuma request POST /chat capturada. Interaja com o Composer Lovable e execute novamente.",
        };
      }

      // BUG #2 FIX: hidratar reqBody via getRawRequest para requests sem body persistido
      const hydratedReqs = await Promise.all(
        chatReqs.slice(-20).reverse().map(async (r) => {
          let reqBody = r.reqBody || "";
          let bodyMissing = false;
          if ((!reqBody || !reqBody.trim()) && ctx.getRawRequest) {
            try {
              const raw = await ctx.getRawRequest(r.id);
              if (raw && raw.ok && raw.raw && raw.raw.requestBody) {
                reqBody = raw.raw.requestBody;
              } else {
                bodyMissing = true;
              }
            } catch {
              bodyMissing = true;
            }
          }
          return { r, reqBody, bodyMissing };
        })
      );

      const list = hydratedReqs.map(({ r, reqBody, bodyMissing }) => {
        const parsed = parseChatBody(reqBody);
        const preview = (parsed.body && parsed.body.message)
          ? String(parsed.body.message).slice(0, 80)
          : (reqBody || "").slice(0, 80) || "(sem body)";
        const time = new Date(r.ts).toLocaleTimeString("pt-BR", { hour12: false });
        return { id: r.id, label: `${time} \u00b7 ${preview}`, r: { ...r, reqBody }, parsed, bodyMissing };
      });

      return {
        ok: true,
        summary: `${chatReqs.length} request(s) /chat \u00b7 selecione e edite o prompt`,
        render(mountEl) { renderChatReplay(mountEl, list, ctx); },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
