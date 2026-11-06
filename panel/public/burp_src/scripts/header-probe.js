// ============================================================
// Hyper RB · Script #9 · header-probe
// Sonda de headers: reexecuta uma request com variações canônicas
// de headers e compara status, latência e hash da resposta.
// v4.2.0: Timing Oracle Detector + Security Headers Audit +
//         Host-Spoofing variants + drift de baseline.
// ============================================================
(function registerHeaderProbe() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · header-probe] HYPER_RB_SHARED ausente");
    return;
  }

  const MAX_VARIANTS = 8;
  const SLEEP_MS = 150;
  const BLOCKED_HEADERS = S.REPLAY_BLOCKED_HEADERS;
  const BODY_HASH_PREVIEW_SIZE = 512;

  // ── Timing Oracle: thresholds ───────────────────────────────
  const TIMING_SIGMA_MULTIPLIER = 2.0;
  const TIMING_MIN_DELTA_MS = 300;

  // ── Security Headers Audit ──────────────────────────────────
  // Headers de segurança que devem estar presentes nas respostas.
  // Cada entrada: { name, severity, hint }
  const SECURITY_HEADERS_EXPECTED = [
    { name: "content-security-policy",         severity: "high",   hint: "CSP ausente — XSS sem mitigação" },
    { name: "strict-transport-security",        severity: "high",   hint: "HSTS ausente — suscetível a downgrade HTTP" },
    { name: "x-frame-options",                  severity: "medium", hint: "Ausente — clickjacking possível (ou use CSP frame-ancestors)" },
    { name: "x-content-type-options",           severity: "medium", hint: "Ausente — MIME sniffing habilitado" },
    { name: "referrer-policy",                  severity: "low",    hint: "Ausente — Referer pode vazar dados sensíveis" },
    { name: "permissions-policy",               severity: "low",    hint: "Ausente — câmera/mic/geoloc sem restrição" },
    { name: "cross-origin-resource-policy",     severity: "low",    hint: "CORP ausente — recursos cross-origin sem restrição" },
    { name: "cross-origin-opener-policy",       severity: "low",    hint: "COOP ausente — window.opener exposto" },
    { name: "cross-origin-embedder-policy",     severity: "low",    hint: "COEP ausente — SharedArrayBuffer bloqueado em alguns browsers" },
  ];

  // Analisa headers de resposta em busca de security headers ausentes
  function auditSecurityHeaders(resHeaders) {
    if (!resHeaders || typeof resHeaders !== "object") return [];
    const present = new Set(Object.keys(resHeaders).map((k) => k.toLowerCase()));
    // Aceita x-frame-options OU content-security-policy com frame-ancestors
    const hasFrameAncestors = present.has("content-security-policy") &&
      String(resHeaders["content-security-policy"] || "").toLowerCase().includes("frame-ancestors");

    const missing = [];
    for (const spec of SECURITY_HEADERS_EXPECTED) {
      if (spec.name === "x-frame-options" && hasFrameAncestors) continue; // CSP frame-ancestors substitui
      if (!present.has(spec.name)) {
        missing.push({ ...spec });
      }
    }
    return missing;
  }

  function cloneHeaders(headers) {
    const next = {};
    for (const [key, value] of Object.entries(headers || {})) {
      if (BLOCKED_HEADERS.has(String(key).toLowerCase())) continue;
      next[key] = value;
    }
    return next;
  }

  function simpleHash(text) {
    const input = String(text || "").slice(0, BODY_HASH_PREVIEW_SIZE);
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function normalizeVariantHeaders(baseHeaders, patch) {
    const headers = cloneHeaders(baseHeaders);
    for (const [key, value] of Object.entries(patch || {})) {
      if (BLOCKED_HEADERS.has(String(key).toLowerCase())) continue;
      if (value == null || value === "") delete headers[key];
      else headers[key] = value;
    }
    return headers;
  }

  function getVariants(baseHeaders, requestUrl) {
    const base = cloneHeaders(baseHeaders);
    let originHost = "";
    try { originHost = new URL(requestUrl || "").host; } catch {}
    return [
      { label: "Chrome UA",        headers: normalizeVariantHeaders(base, { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36" }) },
      { label: "Safari UA",        headers: normalizeVariantHeaders(base, { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15" }) },
      { label: "Firefox UA",       headers: normalizeVariantHeaders(base, { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0" }) },
      { label: "Sem User-Agent",   headers: normalizeVariantHeaders(base, { "User-Agent": null }) },
      { label: "Sem Referer",      headers: normalizeVariantHeaders(base, { Referer: null }) },
      { label: "X-Real-IP",        headers: normalizeVariantHeaders(base, { "X-Real-IP": "203.0.113.42", "X-Forwarded-For": null }) },
      // BUG FIX: adicionadas variantes de Host Spoofing para detectar SSRF/cache-poisoning via Host override
      { label: "X-Forwarded-Host", headers: normalizeVariantHeaders(base, { "X-Forwarded-Host": originHost ? `evil.${originHost}` : "evil.example.com" }) },
      { label: "Origin Override",  headers: normalizeVariantHeaders(base, { "Origin": "https://evil.example.com" }) },
    ].slice(0, MAX_VARIANTS);
  }

  // ── Timing Oracle Detection ─────────────────────────────────
  function detectTimingAnomalies(results, baselineDurationMs) {
    const valid = results.filter((r) => r.ok && typeof r.durationMs === "number" && r.durationMs > 0);
    if (valid.length < 2) return new Set();

    const durations = valid.map((r) => r.durationMs);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length;
    const sigma = Math.sqrt(variance);
    const threshold = mean + TIMING_SIGMA_MULTIPLIER * sigma;

    const anomalies = new Set();
    for (const r of valid) {
      const deltaFromBaseline = Math.abs(r.durationMs - (baselineDurationMs || mean));
      if (r.durationMs > threshold && deltaFromBaseline >= TIMING_MIN_DELTA_MS) {
        anomalies.add(r.label);
      }
    }
    return anomalies;
  }

  async function runProbe(ctx, request) {
    let baseHeaders = request.reqHeaders || {};
    let baseBody = request.reqBody || null;
    let resHeaders = request.resHeaders || null;
    try {
      const raw = await ctx.getRawRequest(request.id);
      if (raw && raw.ok && raw.raw) {
        baseHeaders = raw.raw.requestHeaders || baseHeaders;
        baseBody = raw.raw.requestBody != null ? raw.raw.requestBody : baseBody;
        resHeaders = raw.raw.responseHeaders || resHeaders;
      }
    } catch {}
    const variants = getVariants(baseHeaders, request.url);
    const baseHash = simpleHash(request.resBody || "");
    const replayVariants = variants.map((v) => ({
      label: v.label,
      url: request.url,
      method: request.method,
      headers: v.headers,
      body: baseBody,
    }));

    const baselineDurationMs = typeof request.durationMs === "number" ? request.durationMs : 0;

    const raw = await S.runReplayVariants(ctx, replayVariants, { sleepMs: SLEEP_MS, cap: MAX_VARIANTS });
    const results = raw.map((r) => {
      const hash = simpleHash(r.bodyExcerpt || "");
      return {
        label: r.label,
        status: r.status,
        durationMs: r.ms,
        bodyHash: hash,
        hashChanged: hash !== baseHash,
        ok: r.ok,
        error: r.error || "",
      };
    });

    const timingAnomalies = detectTimingAnomalies(results, baselineDurationMs);
    // BUG FIX: adicionado audit de security headers usando resHeaders da request original
    const missingSecHeaders = auditSecurityHeaders(resHeaders);

    return { variants, results, baseHash, baselineDurationMs, timingAnomalies, missingSecHeaders };
  }

  function buildRequestOptionsList(requests) {
    return requests
      .filter((request) => request && request.url)
      .slice(0, 50)
      .map((request, index) => ({
        id: request.id,
        label: `${index + 1}. ${request.method} ${request.host}${request.pathname || "/"}`,
        request,
      }));
  }

  const SEVERITY_COLOR = { high: "#ff9aac", medium: "#ffd27f", low: "rgba(255,255,255,.45)" };
  const SEVERITY_BG    = { high: "rgba(255,60,60,.15)", medium: "rgba(255,180,0,.08)", low: "rgba(255,255,255,.04)" };

  const SCRIPT = {
    id: 9,
    slug: "header-probe",
    name: "Sonda de Headers",
    description: "Reexecuta uma request com variações canônicas de headers. Detecta impacto em status, hash, timing oracle e security headers ausentes na resposta.",
    icon: "🧪",
    needsAI: false,
    needsNetwork: true,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes de executar." };
      }

      const requestOptions = buildRequestOptionsList(ctx.requests);
      if (!requestOptions.length) {
        return { ok: false, error: "Nenhuma request válida foi encontrada para a sonda." };
      }

      return {
        ok: true,
        summary: `${requestOptions.length} request(s) disponíveis · ${MAX_VARIANTS} variantes · Timing Oracle + Security Headers Audit`,
        render(mountEl) {
          mountEl.innerHTML = `
            <style>
              .hp-wrap{display:flex;flex-direction:column;gap:12px;padding:12px;color:#ececf1;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
              .hp-panel{background:rgba(18,18,20,.7);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:12px}
              .hp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.hp-row select{min-width:280px;max-width:100%;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.04);color:#ececf1;border:1px solid rgba(255,255,255,.08)}
              .hp-btn{padding:8px 12px;border:none;border-radius:6px;background:#bf00ff;color:#0a0a0c;font-weight:900;cursor:pointer}
              .hp-btn[disabled]{opacity:.6;cursor:wait}
              .hp-hint{color:rgba(255,255,255,.55)}
              .hp-table-wrap{overflow:auto}.hp-table{width:100%;border-collapse:collapse}.hp-table th,.hp-table td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;font-size:11px}
              .hp-table th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.52)}
              .hp-ok{color:#7ce6b5}.hp-warn{color:#ffd27f}.hp-err{color:#ff9aac}.hp-hash-changed{font-weight:900}
              .hp-timing-oracle{background:rgba(255,60,60,.15);color:#ff9aac;font-weight:900;padding:1px 6px;border-radius:4px;font-size:10px;margin-left:4px;}
              .hp-timing-note{font-size:10px;color:rgba(255,200,0,.8);margin-top:8px;padding:6px 10px;background:rgba(255,180,0,.07);border:1px solid rgba(255,180,0,.2);border-radius:6px;}
              .hp-empty{padding:18px;color:rgba(255,255,255,.45)}
              .hp-base{color:rgba(255,255,255,.55);font-size:11px}
              .hp-sec-audit{margin-top:10px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.07)}
              .hp-sec-title{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.65)}
              .hp-sec-row{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;font-size:10px;border-top:1px solid rgba(255,255,255,.04)}
            </style>
            <div class="hp-wrap">
              <div class="hp-panel">
                <div class="hp-row">
                  <select data-role="request-select">${requestOptions.map((option, index) => `<option value="${S.escapeHtml(index)}">${S.escapeHtml(option.label)}</option>`).join("")}</select>
                  <button class="hp-btn" data-action="run">Executar</button>
                  <span class="hp-hint">${MAX_VARIANTS} variantes · 150ms entre replays · Timing Oracle + Security Audit</span>
                </div>
              </div>
              <div class="hp-panel">
                <div class="hp-base" data-role="meta">Selecione uma request e execute a sonda.</div>
                <div class="hp-table-wrap" data-role="results"><div class="hp-empty">Nenhuma execução ainda.</div></div>
                <div data-role="sec-audit"></div>
              </div>
            </div>`;

          const select = mountEl.querySelector('[data-role="request-select"]');
          const runButton = mountEl.querySelector('[data-action="run"]');
          const meta = mountEl.querySelector('[data-role="meta"]');
          const resultsRegion = mountEl.querySelector('[data-role="results"]');
          const secAuditRegion = mountEl.querySelector('[data-role="sec-audit"]');

          runButton?.addEventListener("click", async () => {
            const selected = requestOptions[Number(select?.value || 0)];
            if (!selected) return;
            runButton.disabled = true;
            meta.textContent = `Executando sonda para ${selected.request.method} ${selected.request.host}${selected.request.pathname || "/"}…`;
            resultsRegion.innerHTML = `<div class="hyper-rb-loading">Executando variantes de header…</div>`;
            secAuditRegion.innerHTML = "";
            try {
              const probe = await runProbe(ctx, selected.request);
              const hasAnomalies = probe.timingAnomalies.size > 0;

              meta.textContent = `Base hash ${probe.baseHash} · ${selected.request.method} ${selected.request.host}${selected.request.pathname || "/"}${probe.baselineDurationMs ? ` · baseline ${probe.baselineDurationMs}ms` : ""}`;

              resultsRegion.innerHTML = `
                <table class="hp-table">
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>Status</th>
                      <th>Latência</th>
                      <th>Hash</th>
                      <th>Delta</th>
                      <th>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${probe.results.map((result) => {
                      const isTimingAnomaly = probe.timingAnomalies.has(result.label);
                      return `
                        <tr>
                          <td>${S.escapeHtml(result.label)}${isTimingAnomaly ? `<span class="hp-timing-oracle" title="Latência estatisticamente anômala — possível timing oracle">⏱ oracle?</span>` : ""}</td>
                          <td class="${result.status >= 400 || !result.ok ? "hp-err" : "hp-ok"}">${S.escapeHtml(result.status || "—")}</td>
                          <td class="${isTimingAnomaly ? "hp-err" : ""}">${S.escapeHtml(S.formatMs(result.durationMs))}${isTimingAnomaly ? " ⚠" : ""}</td>
                          <td class="${result.hashChanged ? "hp-hash-changed hp-warn" : ""}">${S.escapeHtml(result.bodyHash)}</td>
                          <td class="${result.hashChanged ? "hp-warn" : "hp-ok"}">${result.hashChanged ? "mudou" : "igual"}</td>
                          <td>${S.escapeHtml(result.error || (isTimingAnomaly ? "Timing anômalo — investigar" : result.hashChanged ? "Resposta diferente" : "Sem alteração"))}</td>
                        </tr>`;
                    }).join("")}
                  </tbody>
                </table>
                ${hasAnomalies ? `<div class="hp-timing-note">⚠ <strong>Timing Oracle detectado</strong>: ${[...probe.timingAnomalies].map(l => `"${l}"`).join(", ")} apresenta latência > média + ${TIMING_SIGMA_MULTIPLIER}σ e delta ≥ ${TIMING_MIN_DELTA_MS}ms. Pode indicar diferenciação de código no servidor com base no header — investigar manualmente.</div>` : ""}
              `;

              // ── Security Headers Audit ──────────────────────────────
              if (probe.missingSecHeaders.length > 0) {
                secAuditRegion.innerHTML = `
                  <div class="hp-sec-audit">
                    <div class="hp-sec-title">🔒 Security Headers Ausentes (${probe.missingSecHeaders.length})</div>
                    ${probe.missingSecHeaders.map((h) => `
                      <div class="hp-sec-row" style="background:${SEVERITY_BG[h.severity] || "transparent"}">
                        <span style="color:${SEVERITY_COLOR[h.severity] || "#fff"};font-weight:700">${S.escapeHtml(h.name)}</span>
                        <span style="color:rgba(255,255,255,.55);text-align:right;max-width:55%">${S.escapeHtml(h.hint)}</span>
                      </div>`).join("")}
                  </div>`;
              } else {
                secAuditRegion.innerHTML = `<div style="margin-top:8px;font-size:10px;color:#7ce6b5;padding:6px 10px;background:rgba(124,230,181,.07);border:1px solid rgba(124,230,181,.2);border-radius:6px;">✅ Todos os security headers esperados estão presentes na resposta.</div>`;
              }
            } catch (error) {
              meta.textContent = `Falha ao executar a sonda.`;
              resultsRegion.innerHTML = `<div class="hyper-rb-error">${S.escapeHtml(error && error.message ? error.message : String(error))}</div>`;
            } finally {
              runButton.disabled = false;
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
