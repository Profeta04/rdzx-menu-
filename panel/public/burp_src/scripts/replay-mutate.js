(function registerReplayMutate() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · replay-mutate] HYPER_RB_SHARED ausente");
    return;
  }

  const MAX_VARIANTS = 10;
  const SLEEP_MS = 150;
  // Hosts permitidos para replay — nunca enviar a hosts arbitrários
  const ALLOWED_REPLAY_HOSTS = /^(([a-z0-9-]+\.)?lovable\.(dev|app)|[a-z0-9-]+\.supabase\.co)$/i;

  const BLOCKED_HEADERS = S.REPLAY_BLOCKED_HEADERS || new Set([
    "authorization", "cookie", "set-cookie", "proxy-authorization",
    "host", "content-length", "transfer-encoding", "connection",
  ]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Valida que a URL alvo pertence a um host permitido */
  function validateReplayUrl(url) {
    try {
      const { hostname } = new URL(url);
      return ALLOWED_REPLAY_HOSTS.test(hostname);
    } catch { return false; }
  }

  function cloneHeaders(headers) {
    const next = {};
    for (const [k, v] of Object.entries(headers || {})) {
      if (BLOCKED_HEADERS.has(String(k).toLowerCase())) continue;
      next[k] = v;
    }
    return next;
  }

  async function runReplays(ctx, variants, onProgress) {
    const results = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      onProgress(i, variants.length, v.label);

      // Re-valida host em cada variante (proteção contra manipulação de URL no DOM)
      if (!validateReplayUrl(v.url || "")) {
        results.push({ label: v.label, ok: false, status: 0, ms: 0, body: "",
          error: `Host não permitido: ${v.url || "(vazio)"}` });
        continue;
      }

      try {
        const res = await ctx.proxyFetch(v.url, {
          method: v.method,
          headers: cloneHeaders(v.headers),
          body: v.body || undefined,
        });
        results.push({
          label: v.label, ok: res.ok, status: res.status,
          ms: res.durationMs, body: (res.body || "").slice(0, 8192), error: res.error,
        });
        // Early abort on repeated 429 to protect the account from rate-limit bans
        if (res.status === 429) {
          const rateLimited = results.filter((r) => r.status === 429).length;
          if (rateLimited >= 3) {
            onProgress(i + 1, variants.length, "⚠ Rate-limited (429) × 3 — abortando");
            break;
          }
          await sleep(SLEEP_MS * 5); // back-off on 429
        }
      } catch (e) {
        results.push({ label: v.label, ok: false, status: 0, ms: 0, body: "",
          error: String((e && e.message) || e) });
      }
      if (i < variants.length - 1) await sleep(SLEEP_MS);
    }
    return results;
  }

  // ── Header Dependency Probe: isola qual header é obrigatório para a request ser aceita ──
  // Estratégia: remove cada header individualmente e observa mudança de status (O(n) probe).
  // Marcamos como "obrigatório" os que, quando removidos, causam status ≠ baseline ou ≥ 400.
  // NOTA: não é bisecção binária — é varredura linear (mais confiável para este caso).
  const MAX_BISECT_HEADERS = 12; // limite p/ não disparar muitas requests
  async function runHeaderBisect(ctx, baseReq, onProgress) {
    const allHeaders = cloneHeaders(baseReq.reqHeaders || {});
    const headerKeys = Object.keys(allHeaders).slice(0, MAX_BISECT_HEADERS);

    if (!headerKeys.length) {
      return { ok: false, error: "Nenhum header disponível para bisecção." };
    }
    if (!validateReplayUrl(baseReq.url || "")) {
      return { ok: false, error: "Host não permitido." };
    }

    // Baseline com todos os headers
    onProgress(0, headerKeys.length + 1, "baseline");
    let baseRes;
    try {
      baseRes = await ctx.proxyFetch(baseReq.url, {
        method: baseReq.method,
        headers: allHeaders,
        body: baseReq.reqBody || undefined,
      });
    } catch (e) {
      return { ok: false, error: `Baseline falhou: ${e?.message || e}` };
    }
    const baseStatus = baseRes.status;

    const findings = [];
    for (let i = 0; i < headerKeys.length; i++) {
      const key = headerKeys[i];
      await sleep(SLEEP_MS);
      onProgress(i + 1, headerKeys.length + 1, `removendo ${key}`);

      // Cria headers sem este
      const withoutKey = { ...allHeaders };
      delete withoutKey[key];

      try {
        const res = await ctx.proxyFetch(baseReq.url, {
          method: baseReq.method,
          headers: withoutKey,
          body: baseReq.reqBody || undefined,
        });
        const changed = res.status !== baseStatus || (!res.ok && baseRes.ok);
        findings.push({ header: key, status: res.status, changed, required: changed });
      } catch {
        findings.push({ header: key, status: 0, changed: true, required: true });
      }
    }

    return { ok: true, baseStatus, findings };
  }

  const SCRIPT = {
    id: 6,
    slug: "replay-mutate",
    name: "Replay & Mutate",
    description: "Replica uma request com até 10 variantes mutáveis (headers/body) e compara respostas. Inclui bisecção de headers obrigatórios.",
    icon: "🧪",
    needsAI: false,
    needsNetwork: true,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }

      const requests = ctx.requests.slice(-50).reverse();

      return {
        ok: true,
        summary: `${requests.length} requests disponíveis para replay`,
        render(mountEl) {
          mountEl.innerHTML = `
            <div class="hyper-rb-replay">
              <div style="margin-bottom:12px;">
                <label style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.6);margin-bottom:6px;">Request base</label>
                <select class="rm-select" style="width:100%;padding:8px;background:rgba(18,18,20,.7);color:#fff;border:1px solid rgba(191,0,255,.3);border-radius:6px;">
                  ${requests.map((r, i) => `<option value="${i}">${S.escapeHtml(r.method)} ${S.escapeHtml((r.host || "") + (r.pathname || ""))}</option>`).join("")}
                </select>
              </div>
              <div style="display:flex;gap:6px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:8px;">
                <button class="rm-tab-btn rm-tab-active" data-tab="variants" style="padding:5px 10px;background:rgba(191,0,255,.2);color:#fff;border:1px solid rgba(191,0,255,.4);border-radius:6px;cursor:pointer;font-size:11px;">Variantes</button>
                <button class="rm-tab-btn" data-tab="bisect" style="padding:5px 10px;background:rgba(255,255,255,.05);color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:6px;cursor:pointer;font-size:11px;">🔬 Bisecção de Headers</button>
              </div>
              <div class="rm-tab-panel" data-panel="variants">
                <div class="rm-variants" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;"></div>
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                  <button class="rm-add" style="padding:8px 12px;background:rgba(191,0,255,.15);color:#fff;border:1px solid rgba(191,0,255,.4);border-radius:6px;cursor:pointer;">+ Variante</button>
                  <button class="rm-run" style="padding:8px 12px;background:#bf00ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Executar replays</button>
                </div>
                <div class="rm-status" style="font-size:12px;color:rgba(255,255,255,.6);margin-bottom:8px;"></div>
                <div class="rm-results"></div>
              </div>
              <div class="rm-tab-panel" data-panel="bisect" style="display:none;">
                <div style="font-size:11px;color:rgba(255,255,255,.6);margin-bottom:10px;line-height:1.5;">
                  Remove cada header individualmente e verifica se o status muda.
                  Headers que causam falha ao serem removidos são marcados como <strong style="color:#ffd27f;">obrigatórios</strong>.
                  Máximo ${MAX_BISECT_HEADERS} headers · ${SLEEP_MS}ms entre requests.
                </div>
                <button class="rm-bisect-run" style="padding:8px 16px;background:#bf00ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🔬 Iniciar bisecção</button>
                <div class="rm-bisect-status" style="font-size:12px;color:rgba(255,255,255,.6);margin:8px 0;"></div>
                <div class="rm-bisect-results"></div>
              </div>
            </div>
          `;

          const select = mountEl.querySelector(".rm-select");
          const variantsEl = mountEl.querySelector(".rm-variants");
          const addBtn = mountEl.querySelector(".rm-add");
          const runBtn = mountEl.querySelector(".rm-run");
          const statusEl = mountEl.querySelector(".rm-status");
          const resultsEl = mountEl.querySelector(".rm-results");
          const bisectRunBtn = mountEl.querySelector(".rm-bisect-run");
          const bisectStatusEl = mountEl.querySelector(".rm-bisect-status");
          const bisectResultsEl = mountEl.querySelector(".rm-bisect-results");

          let variants = [];
          let currentBase = null;

          // Tab switching
          mountEl.querySelectorAll(".rm-tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              mountEl.querySelectorAll(".rm-tab-btn").forEach((b) => {
                b.style.background = "rgba(255,255,255,.05)";
                b.style.borderColor = "rgba(255,255,255,.1)";
              });
              btn.style.background = "rgba(191,0,255,.2)";
              btn.style.borderColor = "rgba(191,0,255,.4)";
              const panel = btn.getAttribute("data-tab");
              mountEl.querySelectorAll(".rm-tab-panel").forEach((p) => {
                p.style.display = p.getAttribute("data-panel") === panel ? "" : "none";
              });
            });
          });

          function renderVariants() {
            variantsEl.innerHTML = variants.map((v, i) => `
              <details style="background:rgba(18,18,20,.5);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px;">
                <summary style="cursor:pointer;color:#fff;font-size:12px;">${S.escapeHtml(v.label)} <button data-rm-del="${i}" style="float:right;background:transparent;border:none;color:#ff6b6b;cursor:pointer;">×</button></summary>
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
                  <input data-rm-label="${i}" value="${S.escapeHtml(v.label)}" placeholder="Rótulo" style="padding:6px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:4px;font-size:11px;" />
                  <textarea data-rm-headers="${i}" placeholder="Headers JSON (sem Authorization)" rows="3" style="padding:6px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:4px;font-family:monospace;font-size:11px;">${S.escapeHtml(JSON.stringify(v.headers, null, 2))}</textarea>
                  <textarea data-rm-body="${i}" placeholder="Body" rows="4" style="padding:6px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:4px;font-family:monospace;font-size:11px;">${S.escapeHtml(v.body || "")}</textarea>
                </div>
              </details>
            `).join("");
          }

          function syncVariantsFromDOM() {
            variantsEl.querySelectorAll("[data-rm-label]").forEach((el) => {
              const i = Number(el.getAttribute("data-rm-label"));
              variants[i].label = el.value || `variant-${i}`;
            });
            variantsEl.querySelectorAll("[data-rm-headers]").forEach((el) => {
              const i = Number(el.getAttribute("data-rm-headers"));
              try { variants[i].headers = cloneHeaders(JSON.parse(el.value || "{}")); } catch {}
            });
            variantsEl.querySelectorAll("[data-rm-body]").forEach((el) => {
              const i = Number(el.getAttribute("data-rm-body"));
              variants[i].body = el.value || "";
            });
          }

          async function loadBase() {
            const idx = Number(select.value || 0);
            const base = requests[idx];
            let rawBody = base.reqBody || "";
            let rawHeaders = base.reqHeaders || {};
            try {
              const raw = await ctx.getRawRequest(base.id);
              if (raw && raw.ok && raw.raw) {
                if (raw.raw.requestBody != null) rawBody = raw.raw.requestBody;
                if (raw.raw.requestHeaders) rawHeaders = raw.raw.requestHeaders;
              }
            } catch {}
            currentBase = { ...base, reqHeaders: rawHeaders, reqBody: rawBody };

            // Valida host antes de expor a UI de replay
            if (!validateReplayUrl(base.url || "")) {
              statusEl.textContent = `⛔ Host "${base.host}" não é permitido para replay.`;
              runBtn.disabled = true;
              bisectRunBtn.disabled = true;
            } else {
              runBtn.disabled = false;
              bisectRunBtn.disabled = false;
              statusEl.textContent = "";
            }

            variants = [{
              label: "original",
              method: base.method,
              url: base.url,
              headers: cloneHeaders(rawHeaders),
              body: rawBody,
            }];
            renderVariants();
          }

          select.addEventListener("change", () => { loadBase(); });

          addBtn.addEventListener("click", () => {
            syncVariantsFromDOM();
            if (variants.length >= MAX_VARIANTS) {
              statusEl.textContent = `Limite de ${MAX_VARIANTS} variantes atingido.`;
              return;
            }
            const base = variants[0] || { method: "GET", url: "", headers: {}, body: "" };
            variants.push({
              label: `variant-${variants.length}`,
              method: base.method,
              url: base.url,
              headers: { ...base.headers },
              body: base.body || "",
            });
            renderVariants();
          });

          variantsEl.addEventListener("click", (e) => {
            const target = e.target;
            if (target && target.matches && target.matches("[data-rm-del]")) {
              syncVariantsFromDOM();
              const i = Number(target.getAttribute("data-rm-del"));
              if (i === 0) { statusEl.textContent = "A variante original não pode ser removida."; return; }
              variants.splice(i, 1);
              renderVariants();
            }
          });

          runBtn.addEventListener("click", async () => {
            syncVariantsFromDOM();
            if (!variants.length) return;
            runBtn.disabled = true;
            runBtn.style.opacity = "0.5";
            resultsEl.innerHTML = "";
            try {
              const results = await runReplays(ctx, variants, (i, total, label) => {
                statusEl.textContent = `Executando ${i + 1}/${total} — ${label}…`;
              });
              statusEl.textContent = `Concluído: ${results.length} replays.`;
              resultsEl.innerHTML = results.map((r) => `
                <div style="background:rgba(18,18,20,.5);border:1px solid ${r.ok ? "rgba(80,200,120,.4)" : "rgba(255,107,107,.4)"};border-radius:6px;padding:10px;margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="color:#fff;font-size:12px;">${S.escapeHtml(r.label)}</strong>
                    <span style="color:${r.ok ? "#7dffb8" : "#ff6b6b"};font-size:11px;">${r.status} · ${r.ms}ms</span>
                  </div>
                  ${r.error ? `<div style="color:#ff6b6b;font-size:11px;">${S.escapeHtml(r.error)}</div>` : ""}
                  <pre style="margin:0;padding:8px;background:rgba(0,0,0,.4);color:rgba(255,255,255,.8);border-radius:4px;font-size:10px;overflow:auto;max-height:160px;white-space:pre-wrap;">${S.escapeHtml((r.body || "").slice(0, 2048))}</pre>
                </div>
              `).join("");
            } catch (e) {
              statusEl.textContent = `Erro: ${e?.message || e}`;
            } finally {
              runBtn.disabled = false;
              runBtn.style.opacity = "";
            }
          });

          // Bisecção de headers
          bisectRunBtn.addEventListener("click", async () => {
            if (!currentBase) { bisectStatusEl.textContent = "Carregue uma request primeiro."; return; }
            bisectRunBtn.disabled = true;
            bisectResultsEl.innerHTML = "";
            const result = await runHeaderBisect(ctx, currentBase, (i, total, label) => {
              bisectStatusEl.textContent = `Testando ${i}/${total} — ${label}…`;
            });
            bisectRunBtn.disabled = false;

            if (!result.ok) {
              bisectStatusEl.textContent = `Erro: ${result.error}`;
              return;
            }
            bisectStatusEl.textContent = `Baseline: HTTP ${result.baseStatus} · ${result.findings.length} headers testados.`;
            bisectResultsEl.innerHTML = `
              <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;">
                <thead><tr>
                  <th style="padding:6px 8px;text-align:left;color:rgba(255,255,255,.5);font-size:10px;">Header</th>
                  <th style="padding:6px 8px;text-align:center;color:rgba(255,255,255,.5);font-size:10px;">Status sem ele</th>
                  <th style="padding:6px 8px;text-align:center;color:rgba(255,255,255,.5);font-size:10px;">Importância</th>
                </tr></thead>
                <tbody>
                  ${result.findings.map((f) => `
                    <tr style="border-top:1px solid rgba(255,255,255,.06);">
                      <td style="padding:6px 8px;font-family:monospace;color:#bf00ff;">${S.escapeHtml(f.header)}</td>
                      <td style="padding:6px 8px;text-align:center;color:${f.status >= 400 || f.status === 0 ? "#ff6b6b" : "#7dffb8"};">${f.status || "erro"}</td>
                      <td style="padding:6px 8px;text-align:center;">
                        ${f.required
                          ? '<span style="background:rgba(255,180,0,.15);color:#ffd27f;padding:2px 8px;border-radius:4px;font-weight:700;">OBRIGATÓRIO</span>'
                          : '<span style="color:rgba(255,255,255,.35);">opcional</span>'}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            `;
          });

          loadBase();
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
