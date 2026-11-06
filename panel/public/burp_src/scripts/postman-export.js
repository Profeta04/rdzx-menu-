// ============================================================
// Hyper RB · Scripts · #12 postman-export
// Exporta requests sanitizadas para Postman Collection v2.1.0.
// Agrupa folders por host. Bodies binários omitidos.
// FIX (Wave 1 · Agent C): body language detection (json/text/raw).
// FIX/IMPROVE (Wave 1 · Agent G):
//   - BUG: port não-padrão ausente no urlToPostman → corrigido
//   - BUG: variable:[]} vazio — agora emite {{baseUrl_host}} por host
//   - MELHORIA: urlToPostman usa {{baseUrl_host}} como host base
//   - MELHORIA: response[] populado com 1 exemplo capturado por request
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · postman-export] HYPER_RB_SHARED ausente"); return; }

  function headersToPostman(h) {
    const out = [];
    if (!h) return out;
    for (const [k, v] of Object.entries(h)) {
      out.push({ key: String(k), value: String(v ?? ""), type: "text" });
    }
    return out;
  }

  // ── Env var name helper ──────────────────────────────────
  // Converts "api.example.com" → "baseUrl_api_example_com"
  function hostVarName(host) {
    return "baseUrl_" + String(host || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
  }

  // ── FIX: include port when non-standard ─────────────────
  function urlToPostman(rawUrl, useVar) {
    try {
      const u = new URL(rawUrl);
      const query = [];
      u.searchParams.forEach((value, key) => query.push({ key, value }));

      // FIX: include non-standard port
      const portStr = u.port ? u.port : "";
      const pathParts = u.pathname.split("/").filter(Boolean);

      if (useVar) {
        // Use {{baseUrl_host}} variable as host, keep protocol + port inline in raw
        const varName = hostVarName(u.hostname);
        const raw = `{{${varName}}}${u.pathname}${u.search}`;
        return {
          raw,
          host: [`{{${varName}}}`],
          path: pathParts,
          ...(query.length ? { query } : {}),
        };
      }

      return {
        raw: rawUrl,
        protocol: u.protocol.replace(":", ""),
        host: u.hostname.split("."),
        ...(portStr ? { port: portStr } : {}),
        path: pathParts,
        ...(query.length ? { query } : {}),
      };
    } catch {
      return { raw: String(rawUrl || "") };
    }
  }

  /** Detect body language for Postman raw mode */
  function detectBodyLanguage(req) {
    const ct = (req.reqHeaders && (req.reqHeaders["content-type"] || req.reqHeaders["Content-Type"])) || "";
    const ctLow = ct.toLowerCase();
    if (ctLow.includes("application/json") || ctLow.includes("+json")) return "json";
    if (ctLow.includes("text/html")) return "html";
    if (ctLow.includes("application/xml") || ctLow.includes("text/xml")) return "xml";
    if (ctLow.includes("text/javascript") || ctLow.includes("application/javascript")) return "javascript";
    // Heuristic: try JSON parse
    const body = String(req.reqBody || "").trim();
    if ((body.startsWith("{") || body.startsWith("[")) ) {
      try { JSON.parse(body); return "json"; } catch {}
    }
    return "text";
  }

  function buildBody(req) {
    if (req.reqBody == null || req.reqBody === "") return undefined;
    if (S.isBinaryContentType(req.reqHeaders)) return undefined;
    const ct = (req.reqHeaders && (req.reqHeaders["content-type"] || req.reqHeaders["Content-Type"])) || "";
    // Form URL-encoded
    if (ct.toLowerCase().includes("application/x-www-form-urlencoded")) {
      try {
        const params = new URLSearchParams(req.reqBody);
        const urlencoded = [];
        params.forEach((value, key) => urlencoded.push({ key, value, type: "text" }));
        return { mode: "urlencoded", urlencoded };
      } catch {}
    }
    const language = detectBodyLanguage(req);
    return { mode: "raw", raw: String(req.reqBody), options: { raw: { language } } };
  }

  function shortName(req) {
    const path = req.pathname || "/";
    const trimmed = path.length > 60 ? path.slice(0, 57) + "…" : path;
    return `${req.method} ${trimmed}`;
  }

  // ── IMPROVEMENT: build an example saved-response for Postman ──
  function buildExampleResponse(req) {
    if (!req.resBody && !req.status) return null;
    try {
      // Postman saved response shape (v2.1)
      const resHeaders = req.resHeaders
        ? Object.entries(req.resHeaders).map(([key, value]) => ({ key, value: String(value ?? "") }))
        : [];
      return {
        id: S.cryptoUuid(),
        name: `${req.status ?? "?"} — captured`,
        originalRequest: {
          method: req.method,
          header: headersToPostman(req.reqHeaders),
          url: urlToPostman(req.url, false),
        },
        status: httpStatusText(req.status),
        code: req.status ?? 0,
        _postman_previewlanguage: detectResLanguage(req),
        header: resHeaders,
        cookie: [],
        body: String(req.resBody || ""),
      };
    } catch {
      return null;
    }
  }

  function detectResLanguage(req) {
    const ct = (req.resHeaders && (req.resHeaders["content-type"] || req.resHeaders["Content-Type"])) || "";
    const ctLow = ct.toLowerCase();
    if (ctLow.includes("application/json") || ctLow.includes("+json")) return "json";
    if (ctLow.includes("text/html")) return "html";
    if (ctLow.includes("application/xml") || ctLow.includes("text/xml")) return "xml";
    return "text";
  }

  const _HTTP_TEXTS = {
    200:"OK",201:"Created",204:"No Content",
    301:"Moved Permanently",302:"Found",304:"Not Modified",
    400:"Bad Request",401:"Unauthorized",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",
    409:"Conflict",422:"Unprocessable Entity",429:"Too Many Requests",
    500:"Internal Server Error",502:"Bad Gateway",503:"Service Unavailable",
  };
  function httpStatusText(code) {
    return _HTTP_TEXTS[code] ? _HTTP_TEXTS[code] : String(code || "Unknown");
  }

  function buildCollection(requests) {
    const ts = new Date().toISOString();
    const folders = new Map();
    // Track all distinct hosts for env variables
    const allHosts = new Map(); // host → {protocol, port}
    let total = 0;

    for (const r of requests) {
      if (!r || !r.url) continue;
      const host = r.host || "unknown-host";

      // Collect host metadata for variable generation
      if (!allHosts.has(host)) {
        try {
          const u = new URL(r.url);
          allHosts.set(host, {
            protocol: u.protocol.replace(":", ""),
            hostname: u.hostname,
            port: u.port || "",
          });
        } catch {
          allHosts.set(host, { protocol: "https", hostname: host, port: "" });
        }
      }

      if (!folders.has(host)) folders.set(host, []);
      const body = buildBody(r);
      const exampleRes = buildExampleResponse(r);

      folders.get(host).push({
        name: shortName(r),
        request: {
          method: r.method,
          header: headersToPostman(r.reqHeaders),
          // IMPROVEMENT: use {{baseUrl_host}} variable in URL
          url: urlToPostman(r.url, true),
          ...(body ? { body } : {}),
        },
        // IMPROVEMENT: populate with one captured example response
        response: exampleRes ? [exampleRes] : [],
      });
      total++;
    }

    const items = [];
    for (const [host, reqs] of folders) {
      items.push({ name: host, item: reqs });
    }

    // IMPROVEMENT: emit Postman collection variables for each host
    const variable = [];
    for (const [host, meta] of allHosts) {
      const varName = hostVarName(host);
      const portSuffix = meta.port ? `:${meta.port}` : "";
      variable.push({
        key: varName,
        value: `${meta.protocol}://${meta.hostname}${portSuffix}`,
        type: "string",
        description: `Base URL para o host: ${host}`,
      });
    }

    return {
      info: {
        _postman_id: S.cryptoUuid(),
        name: `Hyper RB Export ${ts}`,
        description: "Exportação gerada pela Hyper RB · script postman-export.\nVariáveis de ambiente {{baseUrl_*}} disponíveis por host.",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: items,
      // IMPROVEMENT: populated env variable list (was always [])
      variable,
      event: [],
      _meta: { generatedAt: ts, totalRequests: total, totalFolders: items.length },
    };
  }

  const SCRIPT = {
    id: 12,
    slug: "postman-export",
    name: "Postman Collection",
    description: "Exporta requests capturadas como Postman Collection v2.1.0 (folders por host, {{baseUrl}} vars, exemplos de response).",
    icon: "📦",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }

      const collection = buildCollection(ctx.requests);
      const json = JSON.stringify(collection, null, 2);
      const filename = `hyper-rb-postman-${Date.now()}.json`;
      const varCount = collection.variable.length;

      return {
        ok: true,
        summary: `${collection._meta.totalRequests} requests · ${collection._meta.totalFolders} hosts · ${varCount} var(s)`,
        artifact: { filename, mime: "application/json", content: json },
        render(mountEl) {
          const folders = collection.item;
          const rows = folders.map((f) => `
            <tr>
              <td>${S.escapeHtml(f.name)}</td>
              <td style="text-align:right">${f.item.length}</td>
              <td style="font-family:ui-monospace,monospace;font-size:9px;color:rgba(255,255,255,.45)">{{${hostVarName(f.name)}}}</td>
            </tr>
          `).join("");

          const varRows = collection.variable.map((v) => `
            <tr>
              <td style="font-family:ui-monospace,monospace;font-size:9px">{{${S.escapeHtml(v.key)}}}</td>
              <td style="font-family:ui-monospace,monospace;font-size:9px;color:rgba(255,255,255,.55)">${S.escapeHtml(v.value)}</td>
            </tr>
          `).join("");

          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">Postman Collection v2.1.0</div>
                  <div class="hyper-rb-section-sub">
                    ${S.escapeHtml(String(collection._meta.totalRequests))} requests agrupadas em
                    ${S.escapeHtml(String(collection._meta.totalFolders))} folder(s).
                    Bodies binários omitidos. Headers sanitizados.
                    ${varCount} variável(is) de ambiente {{baseUrl_*}}.
                  </div>
                </div>
                <button class="hyper-rb-btn hyper-rb-btn-primary dl-postman">⬇ Baixar .json</button>
              </div>
              <table class="hyper-rb-table">
                <thead><tr><th>Host (folder)</th><th style="text-align:right">Requests</th><th>Variável</th></tr></thead>
                <tbody>${rows || `<tr><td colspan="3">Nenhuma request elegível.</td></tr>`}</tbody>
              </table>
              ${varRows ? `
              <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.5);font-weight:600;letter-spacing:.05em;">ENV VARIABLES</div>
              <table class="hyper-rb-table" style="margin-top:4px">
                <thead><tr><th>Variável</th><th>Valor padrão</th></tr></thead>
                <tbody>${varRows}</tbody>
              </table>` : ""}
            </div>
          `;

          mountEl.querySelector(".dl-postman")?.addEventListener("click", () => {
            S.downloadBlob(filename, "application/json", json);
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
