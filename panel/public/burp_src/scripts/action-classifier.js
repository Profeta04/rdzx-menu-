// ============================================================
// Hyper RB · Script #3 · action-classifier
// Classifica requests Lovable/Cloud por categoria, intenção e criticidade via IA.
//
// W1 · Agent C changes:
//   FIX: pathIntent ignorava method — GETs agora nunca recebem "Criação/Deleção" como intenção
//   FIX: inferCriticidade classificava GETs de categoria "Projeto" como "média" — GET puros
//        de recursos não-auth/billing agora retornam "baixa" corretamente
//   FIX: Unicode escapes desnecessários no source (\u00e3 etc) — removidos
//   IMPROVEMENT: contagens por criticidade nos botões de filtro
//   IMPROVEMENT: export JSON em adição ao CSV
//   IMPROVEMENT: filtro "falha" para ver requests que não foram classificadas
// ============================================================
(function registerActionClassifier() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · action-classifier] HYPER_RB_SHARED ausente");
    return;
  }

  const HOST_SUFFIXES = ["lovable.dev", "lovable.app", "supabase.co"];
  const CACHE_KEY = "classifications_cache";
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const CACHE_MAX_ENTRIES = 200;
  const BATCH_SIZE = 25;
  const MAX_CONCURRENCY = 3;

  const normalizePath = S.normalizePath;

  function hostAllowed(host) {
    return HOST_SUFFIXES.some((suffix) => String(host || "").endsWith(suffix));
  }

  function textHash(text) {
    const input = String(text || "");
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function buildCacheKey(req) {
    return textHash([
      String(req.method || "GET").toUpperCase(),
      String(req.url || ""),
      String(req.reqBody || ""),
    ].join("\n"));
  }

  // FIX: pathIntent now considers method to avoid misleading labels on GETs
  function pathIntent(pathname, method) {
    const path = String(pathname || "").toLowerCase();
    const m = String(method || "GET").toUpperCase();
    if (/chat|message|conversation|prompt/.test(path)) return "Interação";
    if (/auth|login|session|token/.test(path)) return "Autenticação";
    if (/asset|file|upload|image/.test(path)) {
      if (m === "GET") return "Leitura de Arquivo";
      return "Arquivo";
    }
    if (/license|billing|subscription/.test(path)) return "Licença";
    if (/project|workspace/.test(path)) {
      if (m === "GET") return "Leitura de Projeto";
      if (m === "DELETE") return "Remoção de Projeto";
      return "Projeto";
    }
    if (m === "GET") return "Consulta";
    if (m === "DELETE") return "Remoção";
    if (m === "POST") return "Criação";
    if (m === "PUT" || m === "PATCH") return "Atualização";
    return "Operação";
  }

  // FIX: GET-only requests that aren't auth/billing should not be "média"
  function inferCriticidade(req, categoria) {
    const path = String(req.pathname || "").toLowerCase();
    const method = String(req.method || "GET").toUpperCase();
    if (/auth|login|session|token|license|billing|payment/.test(path)) return "alta";
    // Only elevate to média for mutating methods or explicitly sensitive categories
    if (method !== "GET") {
      if (/create|update|delete|upload|message/.test(path) || /Projeto|Arquivo/.test(categoria)) return "média";
      return "média"; // any non-GET is at least média
    }
    // GET: stay baixa unless path/category signals sensitivity
    return "baixa";
  }

  function buildRecords(requests) {
    const records = [];
    for (const req of requests || []) {
      if (!req || !hostAllowed(req.host)) continue;
      records.push({
        id: String(req.id || S.cryptoUuid()),
        method: String(req.method || "GET").toUpperCase(),
        url: String(req.url || ""),
        host: String(req.host || ""),
        pathname: normalizePath(req.pathname || "/"),
        bodyExcerpt: S.maskBodyForAI(String(req.reqBody || "").slice(0, 1000)),
      });
    }
    return records;
  }

  function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  async function loadCache(storage) {
    const raw = await storage.get(CACHE_KEY);
    if (!raw || typeof raw !== "object") return {};
    const now = Date.now();
    const next = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object") continue;
      if (now - Number(value.ts || 0) > CACHE_TTL_MS) continue;
      next[key] = value;
    }
    return next;
  }

  async function saveCache(storage, cache) {
    const entries = Object.entries(cache)
      .sort((a, b) => Number(b[1]?.ts || 0) - Number(a[1]?.ts || 0))
      .slice(0, CACHE_MAX_ENTRIES);
    await storage.set(CACHE_KEY, Object.fromEntries(entries));
  }

  async function runLimited(tasks, concurrency) {
    const results = new Array(tasks.length);
    let cursor = 0;
    async function worker() {
      while (cursor < tasks.length) {
        const current = cursor++;
        try {
          results[current] = await tasks[current]();
        } catch (error) {
          results[current] = { ok: false, error: error?.message || String(error) };
        }
      }
    }
    const workers = new Array(Math.min(concurrency, tasks.length)).fill(null).map(worker);
    await Promise.all(workers);
    return results;
  }

  function buildCSV(rows) {
    const header = ["categoria", "criticidade", "metodo", "path", "intencao", "host", "requestId"];
    const csvRows = [header.join(",")];
    for (const row of rows) {
      const values = [
        row.categoria, row.criticidade, row.method, row.pathname,
        row.intencao, row.host, row.id,
      ].map((value) => {
        const text = String(value ?? "");
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      });
      csvRows.push(values.join(","));
    }
    return csvRows.join("\r\n");
  }

  function badgeTone(level) {
    if (level === "alta") return "rgba(255,84,89,0.16);color:#ff8e93;border-color:rgba(255,84,89,0.25);";
    if (level === "média") return "rgba(255,184,77,0.16);color:#ffd089;border-color:rgba(255,184,77,0.25);";
    return "rgba(82,196,125,0.16);color:#9ae6b4;border-color:rgba(82,196,125,0.25);";
  }

  function renderTable(rows, activeFilter) {
    const filtered = activeFilter === "todas"
      ? rows
      : activeFilter === "falha"
        ? rows.filter((row) => row._error || row.categoria === "Falha de classificação")
        : rows.filter((row) => row.criticidade === activeFilter);

    if (!filtered.length) {
      return '<div style="padding:16px;text-align:center;opacity:.6;">Nenhuma request neste filtro.</div>';
    }

    return `
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead style="position:sticky;top:0;background:rgba(8,8,10,0.86);backdrop-filter:blur(8px);">
          <tr>
            <th style="padding:10px;text-align:left;opacity:.6;text-transform:uppercase;font-size:9px;">Categoria</th>
            <th style="padding:10px;text-align:left;opacity:.6;text-transform:uppercase;font-size:9px;">Método</th>
            <th style="padding:10px;text-align:left;opacity:.6;text-transform:uppercase;font-size:9px;">Path</th>
            <th style="padding:10px;text-align:left;opacity:.6;text-transform:uppercase;font-size:9px;">Intenção</th>
            <th style="padding:10px;text-align:left;opacity:.6;text-transform:uppercase;font-size:9px;">Criticidade</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((row) => `
            <tr>
              <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.06);font-weight:700;">${S.escapeHtml(row.categoria)}</td>
              <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.06);font-family:ui-monospace,monospace;color:#bf00ff;">${S.escapeHtml(row.method)}</td>
              <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.06);font-family:ui-monospace,monospace;">${S.escapeHtml(row.pathname)}</td>
              <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.06);">${S.escapeHtml(row.intencao)}</td>
              <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.06);">
                <span style="display:inline-flex;align-items:center;padding:4px 8px;border:1px solid transparent;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;${badgeTone(row.criticidade)}">
                  ${S.escapeHtml(row.criticidade)}
                </span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  const SCRIPT = {
    id: 3,
    slug: "action-classifier",
    name: "Classificador PT-BR",
    description: "Classifica requests Lovable/Cloud por categoria, intenção e criticidade.",
    icon: "🏷️",
    needsAI: true,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx?.requests?.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }

      const records = buildRecords(ctx.requests);
      if (!records.length) {
        return { ok: false, error: "Nenhuma request elegível para classificação." };
      }

      const cache = await loadCache(ctx.storage);
      const rows = [];
      const pending = [];

      for (const record of records) {
        const key = buildCacheKey(record);
        const cached = cache[key]?.value;
        if (cached) {
          rows.push({ ...record, ...cached });
        } else {
          pending.push({ ...record, cacheKey: key });
        }
      }

      const tasks = chunk(pending, BATCH_SIZE).map((batch) => async () => {
        const response = await Promise.race([
          ctx.callAI("classify_action_ptbr", {
            items: batch.map((item) => ({
              id: item.id,
              method: item.method,
              url: item.url,
              bodyExcerpt: item.bodyExcerpt,
            })),
          }),
          new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "timeout" }), 20000)),
        ]);

        if (!response?.ok) {
          return { ok: false, error: response?.error || response?.error_code || "Falha ao classificar lote." };
        }

        const items = Array.isArray(response?.data?.items) ? response.data.items : [];
        const map = new Map(items.map((item) => [String(item.id), item]));
        const classified = batch.map((item) => {
          const ai = map.get(item.id);
          const categoria = String(ai?.categoria || "Não classificado").trim() || "Não classificado";
          // FIX: pass method to pathIntent and use fixed inferCriticidade
          const result = {
            categoria,
            intencao: pathIntent(item.pathname, item.method),
            criticidade: inferCriticidade(item, categoria),
          };
          cache[item.cacheKey] = { value: result, ts: Date.now() };
          return { ...item, ...result };
        });

        return { ok: true, items: classified };
      });

      const batchResults = await runLimited(tasks, MAX_CONCURRENCY);
      let failedBatches = 0;
      for (let bi = 0; bi < batchResults.length; bi++) {
        const result = batchResults[bi];
        if (!result?.ok) {
          failedBatches++;
          const batch = chunk(pending, BATCH_SIZE)[bi] || [];
          for (const item of batch) {
            rows.push({
              ...item,
              categoria: "Falha de classificação",
              intencao: pathIntent(item.pathname, item.method),
              criticidade: inferCriticidade(item, ""),
              _error: result?.error || "batch_failed",
            });
          }
          continue;
        }
        rows.push(...(result.items || []));
      }

      await saveCache(ctx.storage, cache);

      const sortedRows = rows.slice().sort((a, b) => {
        const rank = { alta: 0, média: 1, baixa: 2 };
        return (rank[a.criticidade] ?? 9) - (rank[b.criticidade] ?? 9) || a.pathname.localeCompare(b.pathname);
      });

      const csv = buildCSV(sortedRows);
      // IMPROVEMENT: counts per criticidade for filter badges
      const counts = {
        todas: sortedRows.length,
        alta: sortedRows.filter((r) => r.criticidade === "alta").length,
        média: sortedRows.filter((r) => r.criticidade === "média").length,
        baixa: sortedRows.filter((r) => r.criticidade === "baixa").length,
        falha: sortedRows.filter((r) => r._error || r.categoria === "Falha de classificação").length,
      };

      return {
        ok: true,
        summary: `${sortedRows.length} requests classificadas (${pending.length ? `${pending.length} novas` : "cache reaproveitado"})`,
        render(mountEl) {
          let filter = "todas";

          // IMPROVEMENT: filter buttons with counts; include "falha" filter
          function filterBtn(key, label) {
            const n = counts[key] ?? 0;
            const active = key === filter;
            return `<button data-filter="${key}" style="padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);background:${active ? "rgba(191,0,255,0.14)" : "rgba(255,255,255,0.04)"};color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;">${S.escapeHtml(label)} <span style="opacity:.6;font-weight:400">${n}</span></button>`;
          }

          function rebuildUI() {
            const filterBtns = ["todas", "alta", "média", "baixa", "falha"]
              .map((k) => filterBtn(k, k)).join("");
            mountEl.innerHTML = `
              <div style="display:flex;flex-direction:column;gap:16px;padding:12px;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;">
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    ${filterBtns}
                  </div>
                  <div style="display:flex;gap:8px;">
                    <button data-export-csv style="padding:8px 12px;border-radius:10px;border:1px solid rgba(191,0,255,0.28);background:rgba(191,0,255,0.12);color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;">
                      Exportar CSV
                    </button>
                    <button data-export-json style="padding:8px 12px;border-radius:10px;border:1px solid rgba(191,0,255,0.28);background:rgba(191,0,255,0.12);color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;">
                      Exportar JSON
                    </button>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
                  ${[["Alta", counts.alta], ["Média", counts.média], ["Baixa", counts.baixa]].map(([label, count]) => `
                    <div style="background:rgba(18,18,20,0.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px;">
                      <div style="font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.08em;font-weight:800;">${S.escapeHtml(label)}</div>
                      <div style="margin-top:6px;font-size:24px;font-weight:900;">${count}</div>
                    </div>`).join("")}
                </div>
                <div style="overflow-x:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
                  ${renderTable(sortedRows, filter)}
                </div>
              </div>`;

            mountEl.querySelectorAll("[data-filter]").forEach((btn) => {
              btn.addEventListener("click", () => {
                filter = btn.dataset.filter;
                rebuildUI();
              });
            });
            mountEl.querySelector("[data-export-csv]")?.addEventListener("click", () => {
              S.downloadBlob("hyper-rb-classificacoes.csv", "text/csv", csv);
            });
            // IMPROVEMENT: JSON export
            mountEl.querySelector("[data-export-json]")?.addEventListener("click", () => {
              S.downloadBlob("hyper-rb-classificacoes.json", "application/json",
                JSON.stringify(sortedRows.map((r) => ({
                  id: r.id, categoria: r.categoria, criticidade: r.criticidade,
                  method: r.method, pathname: r.pathname, intencao: r.intencao, host: r.host,
                })), null, 2));
            });
          }

          rebuildUI();
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
