// ============================================================
// Hyper RB · Script #1 · cartographer
// Mapa de Endpoints — agrupa requests por host + pathTemplate + method,
// normaliza segmentos dinâmicos (UUIDs / numericIds) e infere um
// documento OpenAPI 3.1 navegável. Sem IA, sem rede.
//
// W1 · Agent C changes:
//   FIX: status class for status=0 or unknown → crt-st-unk (was "crt-st-0xx", unstyled)
//   FIX: escapeHtml called on numbers, now always coerced to string
//   FIX: sampleReqId captured but never displayed — now shown with copy button
//   IMPROVEMENT: inline search/filter by host or path
//   IMPROVEMENT: error rate (% 4xx+5xx) shown per endpoint badge
//   IMPROVEMENT: total errors + error rate in toolbar summary
// ============================================================
(function registerCartographer() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · cartographer] HYPER_RB_SHARED ausente");
    return;
  }

  // ---------- helpers ----------
  const MAX_EXAMPLE_BYTES = 2 * 1024;

  const pathTemplate = S.normalizePath;

  function pctile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
  }

  function pickExample(body) {
    if (body == null) return undefined;
    const str = typeof body === "string" ? body : (() => {
      try { return JSON.stringify(body); } catch { return String(body); }
    })();
    if (str.length <= MAX_EXAMPLE_BYTES) return str;
    return str.slice(0, MAX_EXAMPLE_BYTES) + "…";
  }

  function safeJsonParse(s) {
    if (typeof s !== "string") return undefined;
    try { return JSON.parse(s); } catch { return undefined; }
  }

  // FIX: always convert to string before passing to escapeHtml / inserting into HTML
  function es(v) {
    return S.escapeHtml(String(v == null ? "" : v));
  }

  // FIX: compute proper CSS class for a status code integer
  function statusClass(st) {
    const n = Number(st);
    if (n >= 500) return "5xx";
    if (n >= 400) return "4xx";
    if (n >= 300) return "3xx";
    if (n >= 200) return "2xx";
    return "unk";
  }

  // ---------- core ----------
  function buildMap(requests) {
    /** @type {Map<string, any>} */
    const groups = new Map();
    const hosts = new Set();

    for (const r of requests) {
      if (!r || !r.host || !r.method) continue;
      hosts.add(r.host);
      const tpl = pathTemplate(r.pathname || "/");
      const key = `${r.host}|${tpl}|${r.method.toUpperCase()}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          host: r.host,
          path: tpl,
          method: r.method.toUpperCase(),
          count: 0,
          statuses: {},
          durations: [],
          contentTypes: new Set(),
          sampleReqBody: undefined,
          sampleResBody: undefined,
          sampleStatus: undefined,
          sampleResHeaders: undefined,
          sampleReqId: undefined,
        };
        groups.set(key, g);
      }
      g.count++;
      const st = typeof r.status === "number" ? r.status : 0;
      g.statuses[st] = (g.statuses[st] || 0) + 1;
      if (typeof r.durationMs === "number" && isFinite(r.durationMs)) {
        g.durations.push(r.durationMs);
      }
      const ct = (r.resHeaders && (r.resHeaders["content-type"] || r.resHeaders["Content-Type"])) || "";
      if (ct) g.contentTypes.add(String(ct).split(";")[0].trim());
      if (g.sampleReqBody === undefined && r.reqBody) g.sampleReqBody = pickExample(r.reqBody);
      if (g.sampleResBody === undefined && r.resBody) {
        g.sampleResBody = pickExample(r.resBody);
        g.sampleStatus = st || 200;
        g.sampleResHeaders = r.resHeaders || {};
        g.sampleReqId = r.id;
      }
    }

    // Finalize metrics
    const finalized = [];
    for (const g of groups.values()) {
      const sorted = g.durations.slice().sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      // IMPROVEMENT: compute error count (4xx+5xx) per endpoint
      const errorCount = Object.entries(g.statuses)
        .filter(([st]) => Number(st) >= 400)
        .reduce((acc, [, n]) => acc + n, 0);
      const cnt = Object.values(g.statuses).reduce((a, b) => a + b, 0) || g.count;
      const errorRate = cnt > 0 ? Math.round((errorCount / cnt) * 100) : 0;
      finalized.push({
        ...g,
        contentTypes: [...g.contentTypes],
        avgMs: sorted.length ? Math.round(sum / sorted.length) : 0,
        p50Ms: Math.round(pctile(sorted, 50)),
        p95Ms: Math.round(pctile(sorted, 95)),
        durations: undefined,
        errorCount,
        errorRate,
      });
    }
    finalized.sort((a, b) => b.count - a.count);

    // Aggregate-level totals for toolbar
    const totalRequests = finalized.reduce((a, e) => a + e.count, 0);
    const totalErrors = finalized.reduce((a, e) => a + e.errorCount, 0);
    const globalErrorRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0;

    return { hosts: [...hosts].sort(), endpoints: finalized, totalRequests, totalErrors, globalErrorRate };
  }

  function toOpenApi(map) {
    const doc = {
      openapi: "3.1.0",
      info: {
        title: "Hyper RB — Inferred API",
        version: new Date().toISOString().slice(0, 10),
        description: `Inferido a partir de ${map.totalRequests} requests capturadas em ${map.hosts.length} host(s). Taxa de erro global: ${map.globalErrorRate}%.`,
      },
      servers: map.hosts.map((h) => ({ url: `https://${h}` })),
      paths: {},
    };
    for (const e of map.endpoints) {
      const key = e.path;
      if (!doc.paths[key]) doc.paths[key] = {};
      const op = {
        summary: `${e.method} ${e.path}`,
        "x-hyper-rb": {
          host: e.host,
          count: e.count,
          avgMs: e.avgMs,
          p50Ms: e.p50Ms,
          p95Ms: e.p95Ms,
          contentTypes: e.contentTypes,
          statuses: e.statuses,
          errorRate: e.errorRate,
          sampleReqId: e.sampleReqId,
        },
        responses: {},
      };
      if (e.sampleReqBody) {
        const parsed = safeJsonParse(e.sampleReqBody);
        op.requestBody = {
          content: {
            "application/json": parsed !== undefined
              ? { example: parsed }
              : { example: e.sampleReqBody },
          },
        };
      }
      for (const [st, n] of Object.entries(e.statuses)) {
        op.responses[st] = {
          description: `${n} ocorrência(s)`,
        };
      }
      if (e.sampleResBody && e.sampleStatus) {
        const parsed = safeJsonParse(e.sampleResBody);
        const ct = (e.contentTypes[0] || "application/json");
        op.responses[String(e.sampleStatus)] = {
          ...(op.responses[String(e.sampleStatus)] || { description: "sample" }),
          content: {
            [ct]: parsed !== undefined ? { example: parsed } : { example: e.sampleResBody },
          },
        };
      }
      doc.paths[key][e.method.toLowerCase()] = op;
    }
    return doc;
  }

  // ---------- render ----------
  function renderTree(map, openapi, mountEl) {
    const byHost = new Map();
    for (const e of map.endpoints) {
      if (!byHost.has(e.host)) byHost.set(e.host, []);
      byHost.get(e.host).push(e);
    }

    function buildHostsHtml(filterText) {
      const q = filterText.trim().toLowerCase();
      return [...byHost.entries()].map(([host, eps]) => {
        const visible = q
          ? eps.filter((e) => e.path.toLowerCase().includes(q) || e.host.toLowerCase().includes(q))
          : eps;
        if (!visible.length) return "";
        const epsHtml = visible.map((e) => {
          const stHtml = Object.entries(e.statuses)
            .map(([st, n]) => `<span class="crt-st crt-st-${statusClass(st)}">${es(st)}·${es(n)}</span>`)
            .join("");
          const cts = e.contentTypes.length ? `<span class="crt-ct">${es(e.contentTypes.join(", "))}</span>` : "";
          // IMPROVEMENT: show error rate badge if > 0
          const errBadge = e.errorRate > 0
            ? `<span class="crt-err-rate" title="${e.errorCount} erros de ${e.count} total">${e.errorRate}% err</span>`
            : "";
          // FIX: show sampleReqId with copy button
          const reqIdRow = e.sampleReqId
            ? `<div class="crt-row"><b>req.id</b><span class="crt-reqid">${es(e.sampleReqId)}</span><button class="crt-copy-btn" data-copy="${es(e.sampleReqId)}" title="Copiar req ID">⎘</button></div>`
            : "";
          return `
            <details class="crt-ep">
              <summary>
                <span class="crt-method crt-m-${es(e.method.toLowerCase())}">${es(e.method)}</span>
                <span class="crt-path">${es(e.path)}</span>
                <span class="crt-count">${es(e.count)}×</span>
                <span class="crt-ms">p95 ${S.formatMs(e.p95Ms)}</span>
                ${stHtml}
                ${errBadge}
              </summary>
              <div class="crt-ep-body">
                <div class="crt-row"><b>avg</b> ${S.formatMs(e.avgMs)} · <b>p50</b> ${S.formatMs(e.p50Ms)} · <b>p95</b> ${S.formatMs(e.p95Ms)} ${cts}</div>
                ${reqIdRow}
                ${e.sampleReqBody ? `<div class="crt-row"><b>req.body</b><pre>${es(e.sampleReqBody)}</pre></div>` : ""}
                ${e.sampleResBody ? `<div class="crt-row"><b>res.body (${es(e.sampleStatus)})</b><pre>${es(e.sampleResBody)}</pre></div>` : ""}
              </div>
            </details>`;
        }).join("");
        return `
          <details class="crt-host" open>
            <summary><span class="crt-host-name">${es(host)}</span><span class="crt-host-count">${es(visible.length)} endpoint(s)</span></summary>
            <div class="crt-host-body">${epsHtml}</div>
          </details>`;
      }).join("");
    }

    mountEl.innerHTML = `
      <style>
        .crt-wrap{display:flex;flex-direction:column;gap:12px;color:#e6e6ea;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace}
        .crt-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .crt-toolbar .crt-stat{padding:4px 8px;background:rgba(191,0,255,.08);border:1px solid rgba(191,0,255,.25);border-radius:6px;color:#e6e6ea}
        .crt-toolbar .crt-stat-err{padding:4px 8px;background:rgba(255,84,89,.08);border:1px solid rgba(255,84,89,.25);border-radius:6px;color:#ff8e93}
        .crt-btn{padding:6px 12px;background:#bf00ff;color:#0a0a0c;border:none;border-radius:6px;font-weight:700;cursor:pointer}
        .crt-btn:hover{filter:brightness(1.1)}
        .crt-search{padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#e6e6ea;font:11px ui-monospace,monospace;min-width:180px;outline:none}
        .crt-search:focus{border-color:rgba(191,0,255,.5)}
        .crt-host{background:rgba(18,18,20,.55);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px 10px}
        .crt-host > summary{cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0}
        .crt-host-name{font-weight:700;color:#bf00ff}
        .crt-host-count{color:rgba(255,255,255,.55);font-size:11px}
        .crt-host-body{display:flex;flex-direction:column;gap:4px;padding:6px 0 2px}
        .crt-ep{padding:4px 6px;border-radius:6px;background:rgba(255,255,255,.02)}
        .crt-ep > summary{cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap;list-style:none}
        .crt-ep > summary::-webkit-details-marker{display:none}
        .crt-method{font-weight:800;font-size:10px;padding:2px 6px;border-radius:4px;letter-spacing:.5px}
        .crt-m-get{background:#0d4f3c;color:#5cffb1}
        .crt-m-post{background:#0d3e6e;color:#7dbdff}
        .crt-m-put,.crt-m-patch{background:#6e4a0d;color:#ffce7d}
        .crt-m-delete{background:#6e0d1f;color:#ff7d8d}
        .crt-path{color:#e6e6ea;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .crt-count{color:rgba(255,255,255,.7);font-size:11px}
        .crt-ms{color:rgba(255,255,255,.5);font-size:11px}
        .crt-st{font-size:10px;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.06)}
        .crt-st-2xx{color:#5cffb1}.crt-st-3xx{color:#7dbdff}.crt-st-4xx{color:#ffce7d}.crt-st-5xx{color:#ff7d8d}
        .crt-st-unk{color:rgba(255,255,255,.4)}
        .crt-err-rate{font-size:10px;padding:1px 6px;border-radius:3px;background:rgba(255,84,89,.15);color:#ff8e93;border:1px solid rgba(255,84,89,.25)}
        .crt-ct{color:rgba(255,255,255,.45);font-size:10px;margin-left:6px}
        .crt-ep-body{padding:6px 4px 2px;display:flex;flex-direction:column;gap:6px}
        .crt-row{font-size:11px;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .crt-row b{color:#bf00ff;margin-right:4px}
        .crt-reqid{font-family:ui-monospace,monospace;font-size:10px;opacity:.7}
        .crt-copy-btn{padding:1px 6px;background:rgba(191,0,255,.15);border:1px solid rgba(191,0,255,.3);border-radius:4px;color:#bf00ff;cursor:pointer;font-size:10px}
        .crt-copy-btn:hover{background:rgba(191,0,255,.3)}
        .crt-row pre{margin:4px 0 0;padding:6px 8px;background:rgba(0,0,0,.35);border-radius:4px;max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:#d6d6da;width:100%}
        .crt-empty{padding:24px;text-align:center;color:rgba(255,255,255,.5)}
      </style>
      <div class="crt-wrap">
        <div class="crt-toolbar">
          <span class="crt-stat">${es(map.endpoints.length)} endpoints</span>
          <span class="crt-stat">${es(map.hosts.length)} hosts</span>
          <span class="crt-stat">${es(map.totalRequests)} requests</span>
          ${map.globalErrorRate > 0 ? `<span class="crt-stat-err">⚠ ${es(map.globalErrorRate)}% erros</span>` : ""}
          <input class="crt-search" id="crt-search-input" type="text" placeholder="Filtrar por host ou path…" autocomplete="off">
          <span style="flex:1"></span>
          <button class="crt-btn" data-action="dl-openapi">Baixar openapi.json</button>
          <button class="crt-btn" data-action="dl-map" style="background:#3a3a40;color:#e6e6ea">Baixar mapa.json</button>
        </div>
        <div id="crt-hosts-container">
          ${buildHostsHtml("") || `<div class="crt-empty">Nenhum endpoint mapeável.</div>`}
        </div>
      </div>`;

    // IMPROVEMENT: live search
    const searchInput = mountEl.querySelector("#crt-search-input");
    const hostsContainer = mountEl.querySelector("#crt-hosts-container");
    if (searchInput && hostsContainer) {
      searchInput.addEventListener("input", () => {
        const html = buildHostsHtml(searchInput.value);
        hostsContainer.innerHTML = html || `<div class="crt-empty">Nenhum endpoint encontrado para "${es(searchInput.value)}".</div>`;
        attachCopyButtons(hostsContainer);
      });
    }

    // Download buttons
    mountEl.querySelector('[data-action="dl-openapi"]')?.addEventListener("click", () => {
      S.downloadBlob("hyper-rb-openapi.json", "application/json", JSON.stringify(openapi, null, 2));
    });
    mountEl.querySelector('[data-action="dl-map"]')?.addEventListener("click", () => {
      S.downloadBlob("hyper-rb-mapa.json", "application/json", JSON.stringify(map, null, 2));
    });

    // FIX: copy req ID buttons
    function attachCopyButtons(root) {
      root.querySelectorAll(".crt-copy-btn[data-copy]").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const text = btn.getAttribute("data-copy");
          if (text) navigator.clipboard?.writeText(text).catch(() => {});
          const orig = btn.textContent;
          btn.textContent = "✓";
          setTimeout(() => { btn.textContent = orig; }, 1200);
        });
      });
    }
    attachCopyButtons(mountEl);
  }

  // ---------- SCRIPT ----------
  const SCRIPT = {
    id: 1,
    slug: "cartographer",
    name: "Mapa de Endpoints",
    description: "Agrupa por host+path+method, normaliza IDs e infere um OpenAPI 3.1 navegável.",
    icon: "🗺️",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes de executar." };
      }
      const map = buildMap(ctx.requests);
      if (!map.endpoints.length) {
        return { ok: false, error: "Nenhum endpoint identificável (faltam host/method nas requests)." };
      }
      const openapi = toOpenApi(map);
      ctx.log("info", `cartographer: ${map.endpoints.length} endpoints, ${map.hosts.length} hosts, ${map.totalRequests} reqs, ${map.globalErrorRate}% erros`);

      return {
        ok: true,
        summary: `${map.endpoints.length} endpoints em ${map.hosts.length} host(s) · ${map.totalRequests} requests · ${map.globalErrorRate}% erros`,
        render(mountEl) {
          try {
            renderTree(map, openapi, mountEl);
          } catch (e) {
            mountEl.innerHTML = `<pre style="color:#ff7d8d;padding:12px">Falha no render: ${S.escapeHtml(e.message || String(e))}</pre>`;
          }
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
