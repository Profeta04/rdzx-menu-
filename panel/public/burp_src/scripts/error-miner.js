(function registerErrorMiner() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · error-miner] HYPER_RB_SHARED ausente");
    return;
  }

  const EXCERPT_LEN = 300;
  const normalizePath = S.normalizePath;

  function statusClass(status) {
    if (status >= 500) return "err-5xx";
    if (status >= 400) return "err-4xx";
    return "err-other";
  }

  function buildGroups(requests) {
    const groups = new Map();
    const now = Date.now();
    for (const req of requests) {
      const status = Number(req?.status || 0);
      if (!status || status < 400) continue;
      const method = String(req.method || "GET").toUpperCase();
      const host = req.host || "(sem host)";
      const path = normalizePath(req.pathname || "/");
      const key = `${status}|${host}|${method} ${path}`;

      let g = groups.get(key);
      if (!g) {
        g = {
          key, status, host, method, path,
          count: 0,
          firstSeen: req.ts || now,
          lastSeen: req.ts || now,
          timestamps: [],
          sampleReq: req,
          bodyExcerpt: S.maskBodyForAI(String(req.resBody || "").slice(0, EXCERPT_LEN)),
        };
        groups.set(key, g);
      }
      g.count++;
      const ts = req.ts || now;
      if (ts < g.firstSeen) g.firstSeen = ts;
      if (ts > g.lastSeen) { g.lastSeen = ts; g.sampleReq = req; }
      if (ts) g.timestamps.push(ts);
      if (!g.bodyExcerpt && req.resBody) {
        g.bodyExcerpt = S.maskBodyForAI(String(req.resBody).slice(0, EXCERPT_LEN));
      }
    }
    const arr = Array.from(groups.values());
    arr.forEach((g) => { g.anomalyScore = computeAnomalyScore(g, arr); });
    return arr.sort((a, b) => b.anomalyScore - a.anomalyScore);
  }

  function computeAnomalyScore(g, allGroups) {
    const now = Date.now();
    let score = 0;
    if (g.status >= 500) score += 40;
    else if (g.status === 429) score += 35;
    else if (g.status === 401 || g.status === 403) score += 20;
    else if (g.status >= 400) score += 15;
    const ageSec = (now - g.lastSeen) / 1000;
    if (ageSec < 60) score += 20;
    else if (ageSec < 300) score += 10;
    const windowSec = Math.max(1, (g.lastSeen - g.firstSeen) / 1000);
    const errPerMin = (g.count / windowSec) * 60;
    if (errPerMin > 10) score += 20;
    else if (errPerMin > 3) score += 12;
    else if (errPerMin > 1) score += 6;
    if (g.count > 20) score += 10;
    else if (g.count > 5) score += 5;
    return Math.min(100, Math.round(score));
  }

  function scoreColor(score) {
    if (score >= 70) return "#ff6b6b";
    if (score >= 40) return "#ffd27f";
    return "#7dffb8";
  }

  function scoreLabel(score) {
    if (score >= 70) return "CRÍTICO";
    if (score >= 40) return "ALTO";
    if (score >= 20) return "MÉDIO";
    return "BAIXO";
  }

  function formatTime(ts) {
    try { return new Date(ts).toLocaleTimeString("pt-BR"); } catch { return "—"; }
  }

  function renderMarkdownLite(text) {
    const MAX_MD_LEN = 10 * 1024;
    const capped = String(text || "").slice(0, MAX_MD_LEN);
    const safe = S.escapeHtml(capped);
    return safe
      .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  // Improvement #3: build minimal cURL for a group's sample request
  function buildCurl(g) {
    const req = g.sampleReq;
    const url = req.url || `https://${g.host}${g.path}`;
    const parts = [`curl -X ${g.method} '${url}'`];
    const headers = req.reqHeaders || {};
    for (const [k, v] of Object.entries(headers)) {
      if (/^(host|content-length)$/i.test(k)) continue;
      parts.push(`  -H '${k}: ${String(v).replace(/'/g, "'\\''")}' `);
    }
    if (req.reqBody && g.method !== "GET" && g.method !== "HEAD") {
      const body = typeof req.reqBody === "string" ? req.reqBody : JSON.stringify(req.reqBody);
      parts.push(`  --data-raw '${body.slice(0, 2000).replace(/'/g, "'\\''")}'`);
    }
    return parts.join(" \\\n");
  }

  function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).catch(() => {}); return true; }
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta); return ok;
    } catch { return false; }
  }

  const SCRIPT = {
    id: 10,
    slug: "error-miner",
    name: "Minerador de Erros",
    description: "Agrupa respostas 4xx/5xx por endpoint, calcula anomaly score e oferece diagnóstico via IA.",
    icon: "⛏️",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const groups = buildGroups(ctx.requests || []);
      if (!groups.length) {
        return { ok: false, error: "Nenhuma resposta com status ≥ 400 capturada." };
      }

      const totalErrors = groups.reduce((s, g) => s + g.count, 0);
      const criticalCount = groups.filter((g) => g.anomalyScore >= 70).length;

      return {
        ok: true,
        summary: `${groups.length} grupos · ${totalErrors} erros · ${criticalCount} crítico(s)`,
        render(mountEl) {
          // Improvement #4: filter bar (All / 4xx / 5xx)
          mountEl.innerHTML = `
            <div class="hyper-rb-error-miner" style="display:flex;flex-direction:column;gap:12px;padding:8px;">
              <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;">
                <span style="color:#fff;">⛏️ <strong>${groups.length}</strong> grupos · <strong>${totalErrors}</strong> erros totais</span>
                ${criticalCount > 0 ? `<span style="background:rgba(255,60,60,.15);color:#ff6b6b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">⚠ ${criticalCount} crítico(s)</span>` : ""}
                <span class="em-filter-wrap" style="margin-left:auto;display:flex;gap:4px;">
                  <button class="em-filter active" data-filter="all">Todos</button>
                  <button class="em-filter" data-filter="5xx">5xx</button>
                  <button class="em-filter" data-filter="4xx">4xx</button>
                </span>
              </div>
              <div class="em-list" style="display:flex;flex-direction:column;gap:8px;"></div>
            </div>
            <style>
              .hyper-rb-error-miner .em-item{background:rgba(18,18,20,.7);backdrop-filter:blur(24px);border:1px solid rgba(191,0,255,.2);border-radius:10px;padding:10px 12px;}
              .hyper-rb-error-miner .em-item.hidden{display:none;}
              .hyper-rb-error-miner .em-head{display:flex;gap:8px;align-items:center;cursor:pointer;flex-wrap:wrap;}
              .hyper-rb-error-miner .em-badge{font-family:monospace;font-weight:700;padding:2px 8px;border-radius:6px;font-size:11px;}
              .hyper-rb-error-miner .err-5xx{background:rgba(255,60,60,.2);color:#ff6b6b;}
              .hyper-rb-error-miner .err-4xx{background:rgba(255,170,0,.18);color:#ffb84d;}
              .hyper-rb-error-miner .err-other{background:rgba(191,0,255,.15);color:#bf00ff;}
              .hyper-rb-error-miner .em-score-bar{height:4px;border-radius:2px;background:rgba(255,255,255,.1);width:60px;display:inline-block;vertical-align:middle;position:relative;overflow:hidden;}
              .hyper-rb-error-miner .em-score-fill{position:absolute;top:0;left:0;height:100%;border-radius:2px;}
              .hyper-rb-error-miner .em-meta{margin-left:auto;font-size:11px;opacity:.65;display:flex;gap:8px;align-items:center;}
              .hyper-rb-error-miner .em-method{font-family:monospace;font-size:11px;opacity:.8;}
              .hyper-rb-error-miner .em-path{font-family:monospace;font-size:12px;color:#e8e8ec;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;}
              .hyper-rb-error-miner .em-body{display:none;margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;font-size:12px;}
              .hyper-rb-error-miner .em-item.open .em-body{display:block;}
              .hyper-rb-error-miner pre{background:rgba(0,0,0,.35);padding:8px;border-radius:6px;overflow:auto;max-height:200px;white-space:pre-wrap;word-break:break-word;font-size:11px;}
              .hyper-rb-error-miner .em-ai-btn{margin-top:8px;background:linear-gradient(135deg,#bf00ff,#7a00cc);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;}
              .hyper-rb-error-miner .em-ai-btn:disabled{opacity:.5;cursor:not-allowed;}
              .hyper-rb-error-miner .em-curl-btn{margin-top:8px;margin-left:6px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;}
              .hyper-rb-error-miner .em-curl-btn:hover{background:rgba(255,255,255,.15);}
              .hyper-rb-error-miner .em-ai-out{margin-top:8px;padding:8px;background:rgba(191,0,255,.08);border-left:2px solid #bf00ff;border-radius:4px;font-size:12px;line-height:1.5;}
              .em-filter{background:rgba(255,255,255,.07);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.15);padding:3px 10px;border-radius:5px;cursor:pointer;font-size:11px;}
              .em-filter.active{background:rgba(191,0,255,.2);color:#fff;border-color:rgba(191,0,255,.5);}
            </style>
          `;

          const list = mountEl.querySelector(".em-list");

          groups.forEach((g, idx) => {
            const item = document.createElement("div");
            item.className = "em-item";
            item.dataset.status = g.status >= 500 ? "5xx" : "4xx";
            const sc = g.anomalyScore;
            const color = scoreColor(sc);
            item.innerHTML = `
              <div class="em-head" data-idx="${idx}">
                <span class="em-badge ${statusClass(g.status)}">${g.status}</span>
                <span class="em-method">${S.escapeHtml(g.method)}</span>
                <span class="em-path" title="${S.escapeHtml(g.host + g.path)}">${S.escapeHtml(g.host)}${S.escapeHtml(g.path)}</span>
                <span class="em-meta">
                  <span style="font-size:10px;color:${color};font-weight:700;">${scoreLabel(sc)}</span>
                  <span class="em-score-bar"><span class="em-score-fill" style="width:${sc}%;background:${color};"></span></span>
                  <span style="font-size:10px;color:${color};">${sc}</span>
                  <span>×${g.count}</span>
                  <span>${formatTime(g.lastSeen)}</span>
                </span>
              </div>
              <div class="em-body">
                <div style="display:flex;gap:16px;opacity:.7;margin-bottom:6px;font-size:11px;flex-wrap:wrap;">
                  <span>Primeira: ${formatTime(g.firstSeen)}</span>
                  <span>Última: ${formatTime(g.lastSeen)}</span>
                  <span>Anomaly score: <strong style="color:${color};">${sc}/100</strong></span>
                </div>
                ${g.bodyExcerpt ? `<pre>${S.escapeHtml(g.bodyExcerpt)}</pre>` : '<div style="opacity:.5;font-style:italic;">(sem corpo de resposta)</div>'}
                <button class="em-ai-btn" data-idx="${idx}">🤖 Diagnosticar com IA</button>
                <button class="em-curl-btn" data-idx="${idx}">📋 Copiar cURL</button>
                <div class="em-ai-out" style="display:none;"></div>
              </div>
            `;
            list.appendChild(item);
          });

          // Filter buttons
          mountEl.querySelectorAll(".em-filter").forEach((btn) => {
            btn.addEventListener("click", () => {
              mountEl.querySelectorAll(".em-filter").forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
              const f = btn.dataset.filter;
              list.querySelectorAll(".em-item").forEach((item) => {
                item.classList.toggle("hidden", f !== "all" && item.dataset.status !== f);
              });
            });
          });

          list.addEventListener("click", async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;

            const head = target.closest(".em-head");
            if (head && !target.classList.contains("em-ai-btn") && !target.classList.contains("em-curl-btn")) {
              head.parentElement.classList.toggle("open");
              return;
            }

            // Improvement: copy cURL button
            if (target.classList.contains("em-curl-btn")) {
              const idx = Number(target.getAttribute("data-idx"));
              const g = groups[idx];
              if (!g) return;
              const curl = buildCurl(g);
              if (copyToClipboard(curl)) {
                const orig = target.textContent;
                target.textContent = "✓ Copiado!";
                setTimeout(() => { target.textContent = orig; }, 1500);
              }
              return;
            }

            if (target.classList.contains("em-ai-btn")) {
              const idx = Number(target.getAttribute("data-idx"));
              const g = groups[idx];
              if (!g) return;
              const out = target.nextElementSibling;
              if (!out) return;

              target.disabled = true;
              target.textContent = "Analisando…";
              out.style.display = "block";
              out.innerHTML = '<span style="opacity:.7;">Consultando IA…</span>';

              try {
                const res = await Promise.race([
                  ctx.callAI("diagnose_failed_replay", {
                    request: {
                      method: g.sampleReq.method,
                      url: g.sampleReq.url,
                      reqHeaders: g.sampleReq.reqHeaders,
                      reqBody: S.maskBodyForAI(String(g.sampleReq.reqBody || "")),
                    },
                    response: {
                      status: g.status,
                      resHeaders: g.sampleReq.resHeaders,
                      resBody: S.maskBodyForAI(String(g.sampleReq.resBody || "")),
                    },
                    anomaly: { score: g.anomalyScore, count: g.count, burstPerMin: g.count > 1 ? ((g.count / Math.max(1, (g.lastSeen - g.firstSeen) / 1000)) * 60).toFixed(1) : 0 },
                  }),
                  new Promise((r) => setTimeout(() => r({ ok: false, error: "timeout" }), 20000)),
                ]);

                if (res && res.ok && res.data) {
                  const md = typeof res.data === "string" ? res.data : (res.data.markdown || res.data.text || JSON.stringify(res.data));
                  out.innerHTML = renderMarkdownLite(md);
                } else {
                  const code = res?.error_code || "";
                  const msg = res?.error || "Falha desconhecida";
                  out.innerHTML = `<span style="color:#ff6b6b;">Erro: ${S.escapeHtml(code ? code + " — " : "")}${S.escapeHtml(msg)}</span>`;
                }
              } catch (err) {
                out.innerHTML = `<span style="color:#ff6b6b;">Erro: ${S.escapeHtml(err?.message || String(err))}</span>`;
              } finally {
                target.disabled = false;
                target.textContent = "🤖 Diagnosticar com IA";
              }
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
