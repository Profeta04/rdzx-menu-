(function registerComposerExplain() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · composer-explain] HYPER_RB_SHARED ausente");
    return;
  }

  const CACHE_KEY = "cache_v1";
  const TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_ENTRIES = 50;

  function hashRequest(r) {
    const body = (r.reqBody || "").slice(0, 2048);
    return S.sha256Hex(`${r.method}|${r.url}|${body}`);
  }

  async function getCache(ctx) {
    const c = (await ctx.storage.get(CACHE_KEY)) || {};
    return c && typeof c === "object" ? c : {};
  }

  async function setCache(ctx, cache) {
    const entries = Object.entries(cache)
      .filter(([, v]) => v && Date.now() - v.ts < TTL_MS)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, MAX_ENTRIES);
    await ctx.storage.set(CACHE_KEY, Object.fromEntries(entries));
  }

  function renderMarkdown(md) {
    const safe = S.escapeHtml(md || "");
    return safe
      .replace(/^### (.+)$/gm, "<h4>$1</h4>")
      .replace(/^## (.+)$/gm, "<h3>$1</h3>")
      .replace(/^# (.+)$/gm, "<h2>$1</h2>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br/>");
  }

  function callWithTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "timeout" }), ms)),
    ]);
  }

  function buildRequestList(ctx, limit = 100) {
    return ctx.requests
      .slice(-limit)
      .reverse()
      .map((r) => ({
        id: r.id,
        label: `${r.method} ${r.host}${r.pathname}`.slice(0, 80),
        status: r.status,
        method: r.method,
        host: r.host,
        pathname: r.pathname,
      }));
  }

  // FIX (Bug #1): pass entryId so BURP_AI_EXPLAIN can resolve by ID in state.network.
  // Also pass request as fallback for edge cases where the SW no longer holds the entry.
  async function callExplainAI(ctx, req) {
    return ctx.callAI("explain_lovable_request", {
      entryId: req.id,
      request: req,
    });
  }

  async function callRecipeAI(ctx, req) {
    return ctx.callAI("convert_to_composer_recipe", {
      entryId: req.id,
      request: req,
    });
  }

  function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
        return true;
      }
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  const SCRIPT = {
    id: 11,
    slug: "composer-explain",
    name: "/explain <reqId>",
    description: "Explica uma request Lovable via IA e oferece replicar no Composer.",
    icon: "🧠",
    needsAI: true,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }

      const list = buildRequestList(ctx);

      return {
        ok: true,
        summary: `${ctx.requests.length} requests disponíveis`,
        render(mountEl) {
          mountEl.innerHTML = `
            <div class="hyper-rb-composer-explain">
              <div class="ce-toolbar">
                <label>Request:</label>
                <select class="ce-select">
                  ${list
                    .map(
                      (r) =>
                        `<option value="${S.escapeHtml(r.id)}">${S.escapeHtml(r.label)}${
                          r.status ? ` · ${r.status}` : ""
                        }</option>`
                    )
                    .join("")}
                </select>
                <button class="ce-explain" type="button">Explicar</button>
                <button class="ce-copy" type="button" title="Copiar explicação" disabled>📋 Copiar</button>
                <button class="ce-replicate" type="button" disabled>Replicar no Composer</button>
              </div>
              <div class="ce-req-info" style="display:none;"></div>
              <div class="ce-output">
                <div class="hyper-rb-empty">Selecione uma request e clique em Explicar.</div>
              </div>
            </div>
            <style>
              .hyper-rb-composer-explain { display:flex; flex-direction:column; gap:12px; }
              .ce-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
              .ce-toolbar select { flex:1; min-width:200px; background:rgba(18,18,20,.7); color:#fff; border:1px solid rgba(191,0,255,.3); padding:6px 8px; border-radius:6px; }
              .ce-toolbar button { background:rgba(191,0,255,.15); color:#fff; border:1px solid rgba(191,0,255,.4); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; }
              .ce-toolbar button:disabled { opacity:.4; cursor:not-allowed; }
              .ce-toolbar button:hover:not(:disabled) { background:rgba(191,0,255,.3); }
              .ce-req-info { background:rgba(191,0,255,.06); border:1px solid rgba(191,0,255,.2); border-radius:6px; padding:6px 10px; font-size:11px; color:rgba(255,255,255,.75); font-family:monospace; display:flex; gap:12px; flex-wrap:wrap; }
              .ce-req-info span { display:flex; gap:4px; align-items:center; }
              .ce-req-info .ce-method { font-weight:700; color:#bf00ff; }
              .ce-output { background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:12px; min-height:120px; max-height:480px; overflow:auto; font-size:12px; line-height:1.5; }
              .ce-output h2,.ce-output h3,.ce-output h4 { color:#bf00ff; margin:8px 0 4px; }
              .ce-output code { background:rgba(191,0,255,.15); padding:1px 4px; border-radius:3px; font-family:monospace; }
              .hyper-rb-empty { color:rgba(255,255,255,.5); font-style:italic; }
              .hyper-rb-loading { color:rgba(191,0,255,.8); }
              .hyper-rb-error { color:#ff5577; }
              .ce-copy-flash { animation:ceFlash .6s ease; }
              @keyframes ceFlash { 0%{background:rgba(115,255,184,.25)} 100%{background:transparent} }
            </style>
          `;

          const select = mountEl.querySelector(".ce-select");
          const btnExplain = mountEl.querySelector(".ce-explain");
          const btnCopy = mountEl.querySelector(".ce-copy");
          const btnReplicate = mountEl.querySelector(".ce-replicate");
          const reqInfo = mountEl.querySelector(".ce-req-info");
          const output = mountEl.querySelector(".ce-output");
          let lastReqId = null;
          let lastExplanation = null;

          // Improvement #1: show request summary bar when a request is selected
          function updateReqInfo(reqId) {
            const meta = list.find((r) => r.id === reqId);
            if (!meta) { reqInfo.style.display = "none"; return; }
            reqInfo.style.display = "flex";
            reqInfo.innerHTML = `
              <span><span class="ce-method">${S.escapeHtml(meta.method)}</span></span>
              <span>${S.escapeHtml(meta.host)}${S.escapeHtml(meta.pathname)}</span>
              ${meta.status ? `<span style="margin-left:auto;opacity:.6;">HTTP ${meta.status}</span>` : ""}
            `;
          }
          select.addEventListener("change", () => updateReqInfo(select.value));
          updateReqInfo(select.value);

          btnExplain.addEventListener("click", async () => {
            const reqId = select.value;
            const req = ctx.requests.find((r) => r.id === reqId);
            if (!req) {
              output.innerHTML = '<div class="hyper-rb-error">Request não encontrada no contexto local.</div>';
              return;
            }
            output.innerHTML = '<div class="hyper-rb-loading">Consultando IA…</div>';
            btnExplain.disabled = true;
            btnCopy.disabled = true;
            btnReplicate.disabled = true;

            try {
              const hash = await hashRequest(req);
              const cache = await getCache(ctx);
              let explanation = cache[hash]?.value;

              if (!explanation) {
                // BUG FIX: pass entryId so BURP_AI_EXPLAIN resolves in state.network
                const res = await callWithTimeout(callExplainAI(ctx, req), 20000);
                if (!res.ok) {
                  const code = res.error_code ? ` [${res.error_code}]` : "";
                  output.innerHTML = `<div class="hyper-rb-error">Falha na IA${code}: ${S.escapeHtml(
                    res.error || "erro desconhecido"
                  )}</div>`;
                  btnExplain.disabled = false;
                  return;
                }
                explanation =
                  typeof res.data === "string" ? res.data : res.data?.markdown || res.data?.content || JSON.stringify(res.data);
                cache[hash] = { value: explanation, ts: Date.now() };
                await setCache(ctx, cache);
              }

              lastReqId = reqId;
              lastExplanation = explanation;
              output.innerHTML = renderMarkdown(explanation);
              btnCopy.disabled = false;
              btnReplicate.disabled = false;
            } catch (e) {
              ctx.log?.("error", "composer-explain falhou", { message: String(e?.message || e) });
              output.innerHTML = `<div class="hyper-rb-error">Erro: ${S.escapeHtml(String(e?.message || e))}</div>`;
            } finally {
              btnExplain.disabled = false;
            }
          });

          // Improvement #2: copy explanation to clipboard
          btnCopy.addEventListener("click", () => {
            if (!lastExplanation) return;
            const ok = copyToClipboard(lastExplanation);
            if (ok) {
              btnCopy.textContent = "✓ Copiado!";
              output.classList.add("ce-copy-flash");
              setTimeout(() => {
                btnCopy.textContent = "📋 Copiar";
                output.classList.remove("ce-copy-flash");
              }, 1500);
            }
          });

          btnReplicate.addEventListener("click", async () => {
            if (!lastReqId) return;
            const req = ctx.requests.find((r) => r.id === lastReqId);
            if (!req) return;
            btnReplicate.disabled = true;
            const note = document.createElement("div");
            note.className = "hyper-rb-loading";
            note.textContent = "Gerando recipe…";
            output.appendChild(note);

            try {
              // BUG FIX: also pass entryId here for consistency
              const res = await callWithTimeout(callRecipeAI(ctx, req), 20000);
              if (!res.ok) {
                note.className = "hyper-rb-error";
                note.textContent = `Falha: ${res.error || "erro"}`;
                return;
              }
              const recipe = res.data;
              try {
                chrome.runtime.sendMessage(
                  { type: "applyComposerRecipe", recipe },
                  () => void chrome.runtime.lastError
                );
              } catch {}
              note.className = "";
              note.style.color = "#73ffb8";
              note.textContent = "Recipe enviado ao Composer ✓";
            } catch (e) {
              note.className = "hyper-rb-error";
              note.textContent = `Erro: ${String(e?.message || e)}`;
            } finally {
              btnReplicate.disabled = false;
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
