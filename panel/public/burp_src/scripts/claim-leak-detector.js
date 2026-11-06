// ============================================================
// Hyper RB · Script #25 · claim-leak-detector
// Varre requests capturadas em busca de claims de privilégio
// vazadas: JWTs com is_admin/role=admin, respostas JSON com
// flags admin/internal/debug expostas ao cliente.
// ============================================================
(function registerClaimLeakDetector() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · claim-leak-detector] HYPER_RB_SHARED ausente");
    return;
  }

  // Chaves consideradas indício de vazamento quando aparecem com
  // valor "verdadeiro" / role privilegiada. Lowercase para match.
  const SENSITIVE_KEYS = new Set([
    "is_admin", "isadmin",
    "is_staff", "isstaff",
    "is_superuser", "issuperuser",
    "is_internal", "isinternal",
    "admin", "staff", "superuser", "root",
    "role", "roles",
    "user_role", "userrole",
    "permissions", "permission",
    "scopes", "scope",
    "debug", "debug_mode", "debugmode",
    "feature_flags", "featureflags",
    "app_metadata", "user_metadata",
    "internal", "internal_only",
  ]);

  const PRIV_ROLE_RE = /\b(admin|superuser|staff|root|owner|internal|debug)\b/i;

  const MAX_BODY_BYTES = 64 * 1024;     // teto de body por request (perf)
  const MAX_REQUESTS_SCAN = 200;        // teto duro de requests a varrer

  function isTruthyAdminValue(v) {
    if (v === true || v === 1 || v === "1" || v === "true" || v === "yes") return true;
    if (typeof v === "string" && PRIV_ROLE_RE.test(v)) return true;
    if (Array.isArray(v)) return v.some((x) => isTruthyAdminValue(x));
    return false;
  }

  function base64UrlDecode(s) {
    try {
      let str = String(s).replace(/-/g, "+").replace(/_/g, "/");
      while (str.length % 4) str += "=";
      return atob(str);
    } catch { return ""; }
  }

  function parseJwt(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const payloadStr = base64UrlDecode(parts[1]);
    if (!payloadStr) return null;
    try { return JSON.parse(payloadStr); } catch { return null; }
  }

  function extractJwts(text) {
    if (!text || typeof text !== "string") return [];
    const re = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/g;
    return text.match(re) || [];
  }

  // walk recursivo num objeto procurando chaves sensíveis com valor "admin-ish"
  function findClaimHits(obj, pathPrefix, hits, depth) {
    if (depth > 6 || obj == null) return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length && i < 50; i++) {
        findClaimHits(obj[i], `${pathPrefix}[${i}]`, hits, depth + 1);
      }
      return;
    }
    if (typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      const path = pathPrefix ? `${pathPrefix}.${k}` : k;
      const lk = String(k).toLowerCase();
      if (SENSITIVE_KEYS.has(lk) && isTruthyAdminValue(v)) {
        hits.push({ path, key: k, value: summarize(v), severity: severityFor(lk, v) });
      }
      if (v && typeof v === "object") findClaimHits(v, path, hits, depth + 1);
    }
  }

  function severityFor(lk, v) {
    if (lk === "is_admin" || lk === "is_superuser" || lk === "is_staff") return "high";
    if ((lk === "role" || lk === "roles") && isTruthyAdminValue(v)) return "high";
    if (lk === "permissions" || lk === "scopes") return "medium";
    if (lk === "debug" || lk === "debug_mode" || lk === "internal") return "medium";
    return "low";
  }

  function summarize(v) {
    if (v === null) return "null";
    if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
    if (typeof v === "object") {
      try { const s = JSON.stringify(v); return s.length > 80 ? s.slice(0, 80) + "…" : s; }
      catch { return "[object]"; }
    }
    return String(v);
  }

  function scanText(text, sourceLabel, requestRef, findings) {
    if (!text) return;
    const trimmed = text.length > MAX_BODY_BYTES ? text.slice(0, MAX_BODY_BYTES) : text;

    // 1. JWTs embutidos
    const jwts = extractJwts(trimmed);
    for (const jwt of jwts.slice(0, 5)) {
      const payload = parseJwt(jwt);
      if (!payload) continue;
      const hits = [];
      findClaimHits(payload, "jwt", hits, 0);
      for (const h of hits) {
        findings.push({
          source: `${sourceLabel} · JWT`,
          request: requestRef,
          path: h.path,
          key: h.key,
          value: h.value,
          severity: h.severity,
          jwtPreview: jwt.slice(0, 20) + "…" + jwt.slice(-8),
        });
      }
    }

    // 2. JSON cru com claims sensíveis
    try {
      const parsed = JSON.parse(trimmed);
      const hits = [];
      findClaimHits(parsed, "", hits, 0);
      for (const h of hits) {
        findings.push({
          source: sourceLabel,
          request: requestRef,
          path: h.path,
          key: h.key,
          value: h.value,
          severity: h.severity,
        });
      }
    } catch { /* não é JSON — ignorar */ }
  }

  async function scanRequest(ctx, req, findings) {
    const ref = `${req.method} ${req.host}${req.pathname || "/"}`;
    // Headers redacted no ctx, mas Set-Cookie e response body via getRawRequest
    try {
      const raw = await ctx.getRawRequest(req.id);
      if (raw && raw.ok) {
        const reqHeaders = (raw.raw && raw.raw.requestHeaders) || raw.requestHeaders || {};
        const resHeaders = (raw.raw && raw.raw.responseHeaders) || raw.responseHeaders || {};
        const reqBody = (raw.raw && raw.raw.requestBody) || raw.requestBody || "";
        const resBody = (raw.raw && raw.raw.responseBody) || raw.responseBody || "";

        // Authorization / Cookie em request headers — JWTs
        for (const [k, v] of Object.entries(reqHeaders)) {
          const lk = String(k).toLowerCase();
          if (lk === "authorization" || lk === "cookie" || lk === "x-auth-token") {
            scanText(String(v || ""), `req.header[${k}]`, ref, findings);
          }
        }
        // Set-Cookie em response headers
        for (const [k, v] of Object.entries(resHeaders)) {
          if (String(k).toLowerCase() === "set-cookie") {
            scanText(String(v || ""), `res.header[set-cookie]`, ref, findings);
          }
        }
        if (reqBody) scanText(String(reqBody), "request body", ref, findings);
        if (resBody) scanText(String(resBody), "response body", ref, findings);
      }
    } catch { /* skip silencioso */ }
  }

  const SEV_COLOR = { high: "#ff9aac", medium: "#ffd27f", low: "rgba(255,255,255,.55)" };
  const SEV_BG = { high: "rgba(255,60,60,.14)", medium: "rgba(255,180,0,.08)", low: "rgba(255,255,255,.03)" };
  const SEV_RANK = { high: 0, medium: 1, low: 2 };

  const SCRIPT = {
    id: 25,
    slug: "claim-leak-detector",
    name: "Detector de Vazamento de Claim",
    description: "Varre JWTs e respostas JSON em busca de claims privilegiadas (is_admin, role=admin, debug, internal) expostas ao cliente. Sem rede — leitura sobre o buffer capturado.",
    icon: "🔓",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const reqs = Array.isArray(ctx.requests) ? ctx.requests : [];
      if (!reqs.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes de executar." };
      }

      const slice = reqs.slice(0, MAX_REQUESTS_SCAN);
      const findings = [];
      // sequencial para não saturar SW com getRawRequest paralelo
      for (const req of slice) {
        await scanRequest(ctx, req, findings);
      }

      findings.sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]));

      const counts = { high: 0, medium: 0, low: 0 };
      for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;

      const summary = findings.length === 0
        ? `Nenhum vazamento de claim detectado em ${slice.length} request(s).`
        : `${findings.length} achado(s) · ${counts.high} alto · ${counts.medium} médio · ${counts.low} baixo · ${slice.length} request(s) varridas`;

      return {
        ok: true,
        summary,
        render(mountEl) {
          if (!findings.length) {
            mountEl.innerHTML = `<div style="padding:16px;color:#7ce6b5;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace">✅ ${S.escapeHtml(summary)}</div>`;
            return;
          }
          mountEl.innerHTML = `
            <style>
              .cld-wrap{display:flex;flex-direction:column;gap:10px;padding:12px;color:#ececf1;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
              .cld-summary{padding:10px 12px;background:rgba(18,18,20,.7);border:1px solid rgba(255,255,255,.06);border-radius:8px}
              .cld-pill{display:inline-block;padding:1px 8px;border-radius:4px;font-weight:900;font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin-right:6px}
              .cld-tools{display:flex;gap:8px;align-items:center;margin-top:8px}
              .cld-tools select{padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.04);color:#ececf1;border:1px solid rgba(255,255,255,.08);font-size:11px}
              .cld-btn{padding:6px 10px;border:none;border-radius:6px;background:#bf00ff;color:#0a0a0c;font-weight:900;cursor:pointer;font-size:11px}
              .cld-table{width:100%;border-collapse:collapse}
              .cld-table th,.cld-table td{padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;font-size:11px;vertical-align:top}
              .cld-table th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.52)}
              .cld-row-high{background:${SEV_BG.high}}
              .cld-row-medium{background:${SEV_BG.medium}}
              .cld-row-low{background:${SEV_BG.low}}
              .cld-val{font-family:ui-monospace,monospace;color:#fff}
              .cld-src{color:rgba(255,255,255,.6);font-size:10px}
            </style>
            <div class="cld-wrap">
              <div class="cld-summary">
                <span class="cld-pill" style="background:${SEV_BG.high};color:${SEV_COLOR.high}">HIGH · ${counts.high}</span>
                <span class="cld-pill" style="background:${SEV_BG.medium};color:${SEV_COLOR.medium}">MED · ${counts.medium}</span>
                <span class="cld-pill" style="background:${SEV_BG.low};color:${SEV_COLOR.low}">LOW · ${counts.low}</span>
                <span style="color:rgba(255,255,255,.55)">${S.escapeHtml(slice.length)} request(s) varridas</span>
                <div class="cld-tools">
                  <select data-role="filter">
                    <option value="all">Todos</option>
                    <option value="high">Só HIGH</option>
                    <option value="medium">HIGH + MED</option>
                  </select>
                  <button class="cld-btn" data-action="export">Baixar JSON</button>
                </div>
              </div>
              <table class="cld-table" data-role="table">
                <thead><tr><th>Sev</th><th>Request</th><th>Origem</th><th>Path</th><th>Valor</th></tr></thead>
                <tbody data-role="tbody"></tbody>
              </table>
            </div>`;

          const tbody = mountEl.querySelector('[data-role="tbody"]');
          const filter = mountEl.querySelector('[data-role="filter"]');
          const exportBtn = mountEl.querySelector('[data-action="export"]');

          function render(filterKind) {
            const visible = findings.filter((f) => {
              if (filterKind === "high") return f.severity === "high";
              if (filterKind === "medium") return f.severity !== "low";
              return true;
            });
            tbody.innerHTML = visible.map((f) => `
              <tr class="cld-row-${S.escapeHtml(f.severity)}">
                <td><span class="cld-pill" style="background:${SEV_BG[f.severity]};color:${SEV_COLOR[f.severity]}">${S.escapeHtml(f.severity)}</span></td>
                <td>${S.escapeHtml(f.request)}</td>
                <td class="cld-src">${S.escapeHtml(f.source)}${f.jwtPreview ? `<br><span style="opacity:.6">${S.escapeHtml(f.jwtPreview)}</span>` : ""}</td>
                <td><code>${S.escapeHtml(f.path)}</code></td>
                <td class="cld-val">${S.escapeHtml(f.value)}</td>
              </tr>`).join("");
          }
          render("all");
          filter.addEventListener("change", () => render(filter.value));
          exportBtn.addEventListener("click", () => {
            S.downloadBlob("hyper-rb-claim-leaks.json", "application/json", JSON.stringify({
              generated_at: new Date().toISOString(),
              scanned_requests: slice.length,
              counts,
              findings,
            }, null, 2));
          });
        },
        artifact: {
          filename: "hyper-rb-claim-leaks.json",
          mime: "application/json",
          content: JSON.stringify({ counts, findings }),
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();