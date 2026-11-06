// ============================================================
// Hyper RB · Scripts · #21 har-exporter
// Exporta requests capturadas como HAR 1.2 válido.
// Sem IA, sem rede.
// HAR 1.2 spec: http://www.softwareishard.com/blog/har-12-spec/
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · har-exporter] HYPER_RB_SHARED ausente"); return; }

  // Standard HTTP status text map (subset — covers 99% of real traffic)
  const STATUS_TEXT = {
    100: "Continue", 101: "Switching Protocols",
    200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
    206: "Partial Content",
    301: "Moved Permanently", 302: "Found", 303: "See Other",
    304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 405: "Method Not Allowed", 409: "Conflict",
    410: "Gone", 422: "Unprocessable Entity", 429: "Too Many Requests",
    500: "Internal Server Error", 501: "Not Implemented",
    502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
  };

  function statusText(code) {
    return STATUS_TEXT[code] || (code >= 100 && code < 600 ? "Unknown" : "");
  }

  function headersToHar(h) {
    const out = [];
    if (!h) return out;
    for (const [k, v] of Object.entries(h)) {
      out.push({ name: String(k), value: String(v ?? "") });
    }
    return out;
  }

  function urlToQuery(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const q = [];
      u.searchParams.forEach((value, name) => q.push({ name, value }));
      return q;
    } catch { return []; }
  }

  /**
   * buildPostData — HAR 1.2 compliant postData object.
   * For application/x-www-form-urlencoded, includes params[] array (spec §4.4).
   */
  function buildPostData(req) {
    if (!req.reqBody || req.reqBody === "") return undefined;
    if (S.isBinaryContentType(req.reqHeaders)) return undefined;

    const rawCt = (req.reqHeaders && (req.reqHeaders["content-type"] || req.reqHeaders["Content-Type"])) || "text/plain";
    const mimeType = rawCt.split(";")[0].trim();

    // Use S.parseBody for consistent parsing
    const parsed = S.parseBody(req.reqBody, mimeType);

    if (parsed.type === "form" && parsed.params && parsed.params.length > 0) {
      // HAR 1.2 §4.4: for url-encoded, params[] is preferred over text
      return {
        mimeType,
        params: parsed.params.map(({ name, value }) => ({ name, value })),
        text: String(req.reqBody),
      };
    }

    return { mimeType, text: String(req.reqBody) };
  }

  function buildEntry(req, idx) {
    const postData = buildPostData(req);
    const reqBodySize = req.reqBody ? new TextEncoder().encode(req.reqBody).length : 0;
    const resBodySize = req.resBody ? new TextEncoder().encode(req.resBody).length : 0;
    const resMime = (req.resHeaders && (req.resHeaders["content-type"] || req.resHeaders["Content-Type"])) || "application/octet-stream";
    const status = typeof req.status === "number" ? req.status : 0;

    // HAR 1.2 §4.2: time MUST equal sum of timings entries (use -1 for unknown).
    // Fix: keep everything consistent — if durationMs unknown, all timings are -1.
    const hasDuration = typeof req.durationMs === "number" && req.durationMs >= 0;
    const waitMs = hasDuration ? Math.max(0, req.durationMs) : -1;
    // send=0, receive=0 are valid; total time = send+wait+receive = durationMs
    const totalTime = hasDuration ? req.durationMs : -1;

    return {
      // _id is non-standard but widely accepted by HAR viewers for correlation
      _id: req.id || String(idx),
      startedDateTime: req.ts ? new Date(req.ts).toISOString() : new Date().toISOString(),
      time: totalTime,
      request: {
        method: req.method || "GET",
        url: req.url || "",
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: headersToHar(req.reqHeaders),
        queryString: urlToQuery(req.url),
        headersSize: -1,
        bodySize: postData ? reqBodySize : -1,
        ...(postData ? { postData } : {}),
      },
      response: {
        status,
        statusText: statusText(status),
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: headersToHar(req.resHeaders),
        content: {
          size: resBodySize,
          // compression: unknown at capture time → omit (spec allows omission)
          mimeType: resMime.split(";")[0].trim(),
          ...(req.resBody && !S.isBinaryContentType(req.resHeaders)
            ? { text: String(req.resBody) }
            : {}),
        },
        redirectURL: "",
        headersSize: -1,
        bodySize: resBodySize > 0 ? resBodySize : -1,
      },
      cache: {},
      // HAR 1.2 §4.4.9: send + wait + receive must sum to time (or all -1)
      timings: {
        send: hasDuration ? 0 : -1,
        wait: waitMs,
        receive: hasDuration ? 0 : -1,
      },
    };
  }

  function buildHar(requests) {
    const entries = requests
      .filter((r) => r && r.url)
      .map((r, i) => buildEntry(r, i));
    return {
      log: {
        version: "1.2",
        creator: { name: "Hyper RB", version: "4.0.0", comment: "har-exporter script" },
        browser: { name: "Chrome Extension", version: "0", comment: "Hyper RB capture" },
        pages: [],
        entries,
      },
    };
  }

  const SCRIPT = {
    id: 21,
    slug: "har-exporter",
    name: "HAR Exporter",
    description: "Exporta requests capturadas como HTTP Archive (HAR 1.2) para uso em DevTools, Postman, etc.",
    icon: "📡",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }
      const har = buildHar(ctx.requests);
      const json = JSON.stringify(har, null, 2);
      const filename = `hyper-rb-${Date.now()}.har`;
      const count = har.log.entries.length;

      return {
        ok: true,
        summary: `${count} entradas HAR 1.2 geradas`,
        artifact: { filename, mime: "application/json", content: json },
        render(mountEl) {
          const totalReqBytes = har.log.entries.reduce((a, e) => a + (e.request.bodySize > 0 ? e.request.bodySize : 0), 0);
          const totalResBytes = har.log.entries.reduce((a, e) => a + (e.response.content.size > 0 ? e.response.content.size : 0), 0);
          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">HAR Exporter 1.2</div>
                  <div class="hyper-rb-section-sub">
                    ${S.escapeHtml(count)} entradas · req ${S.escapeHtml(S.formatBytes(totalReqBytes))} · res ${S.escapeHtml(S.formatBytes(totalResBytes))}
                  </div>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="hyper-rb-btn copy-har">📋 Copiar JSON</button>
                  <button class="hyper-rb-btn hyper-rb-btn-primary dl-har">⬇ Baixar .har</button>
                </div>
              </div>
              <pre class="hyper-rb-pre" style="max-height:400px;overflow:auto"><code>${S.escapeHtml(json.slice(0, 6000))}${json.length > 6000 ? "\n…(truncado)" : ""}</code></pre>
            </div>`;
          mountEl.querySelector(".dl-har")?.addEventListener("click", () => {
            S.downloadBlob(filename, "application/json", json);
          });
          mountEl.querySelector(".copy-har")?.addEventListener("click", async () => {
            const btn = mountEl.querySelector(".copy-har");
            const orig = btn ? btn.textContent : "";
            const ok = await S.copyToClipboard(json);
            if (btn) {
              btn.textContent = ok ? "✓ Copiado" : "✗ Falhou";
              setTimeout(() => { btn.textContent = orig; }, 1500);
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
