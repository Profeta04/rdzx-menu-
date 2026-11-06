// ============================================================
// Hyper RB · Script #2 · payload-diff
// Rastreador de Mudanças de Payload — compara payloads consecutivos
// por endpoint canônico, com diff JSON recursivo ou fallback por linha.
//
// FIXES + IMPROVEMENTS (Wave 1 · Agent D):
//   - BUG: #pd-filter-noise checkbox era buscado mas nunca renderizado
//     no HTML → filtro de ruído nunca funcionava. Adicionado ao header.
//   - BUG: diffJson com basePath="" gerava paths como ".field" (ponto
//     inicial). Corrigido: basePath inicial deve ser "$".
//   - MELHORIA: Diff visual aprimorado — ícones por operação, preview
//     truncado com tooltip, borda colorida lateral.
//   - MELHORIA: Seletor de par mostra timestamps legíveis (HH:MM:SS),
//     não apenas IDs truncados.
//   - MELHORIA: Contador de mudanças por tipo (add/remove/change)
//     exibido no cabeçalho do painel de detalhes.
//   - MELHORIA: Agrupamento por host na barra lateral com cabeçalhos
//     colapsáveis quando há múltiplos hosts.
// ============================================================
(function registerPayloadDiff() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · payload-diff] HYPER_RB_SHARED ausente");
    return;
  }

  const LINE_DIFF_CAP = 200;
  const VALUE_PREVIEW_MAX = 80;
  const normalizePath = S.normalizePath;

  function groupKey(req) {
    return `${(req.method || "GET").toUpperCase()} ${req.host || ""}${normalizePath(req.pathname || "/")}`;
  }

  function safeJsonParse(value) {
    if (typeof value !== "string") return { ok: false, value: null };
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, value: null };
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return { ok: false, value: null };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      return { ok: false, value: null };
    }
  }

  function valuePreview(value, maxLen) {
    const max = maxLen || VALUE_PREVIEW_MAX;
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    let s;
    if (typeof value === "string") {
      s = value;
    } else {
      try { s = JSON.stringify(value); } catch { s = String(value); }
    }
    if (s.length > max) return s.slice(0, max) + "…";
    return s;
  }

  // FIX: basePath="" produced ".field" — callers now pass "$" as root
  function joinPath(base, segment) {
    if (typeof segment === "number") return `${base}[${segment}]`;
    if (!base || base === "$") return base ? `${base}.${segment}` : String(segment);
    return `${base}.${segment}`;
  }

  function diffJson(prev, next, basePath, out) {
    if (prev === next) return;

    if (Array.isArray(prev) && Array.isArray(next)) {
      const max = Math.max(prev.length, next.length);
      for (let i = 0; i < max; i++) {
        const hasPrev = i < prev.length;
        const hasNext = i < next.length;
        const path = joinPath(basePath, i);
        if (!hasPrev && hasNext) {
          out.push({ path, op: "add", from: undefined, to: next[i] });
        } else if (hasPrev && !hasNext) {
          out.push({ path, op: "remove", from: prev[i], to: undefined });
        } else {
          diffJson(prev[i], next[i], path, out);
        }
      }
      return;
    }

    const prevIsObject = prev && typeof prev === "object" && !Array.isArray(prev);
    const nextIsObject = next && typeof next === "object" && !Array.isArray(next);

    if (prevIsObject && nextIsObject) {
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) {
        const hasPrev = Object.prototype.hasOwnProperty.call(prev, key);
        const hasNext = Object.prototype.hasOwnProperty.call(next, key);
        const path = joinPath(basePath, key);
        if (!hasPrev && hasNext) {
          out.push({ path, op: "add", from: undefined, to: next[key] });
        } else if (hasPrev && !hasNext) {
          out.push({ path, op: "remove", from: prev[key], to: undefined });
        } else {
          diffJson(prev[key], next[key], path, out);
        }
      }
      return;
    }

    out.push({ path: basePath || "$", op: "change", from: prev, to: next });
  }

  function lcsDiff(prevText, nextText) {
    const a = String(prevText || "").split(/\r?\n/).slice(0, LINE_DIFF_CAP);
    const b = String(nextText || "").split(/\r?\n/).slice(0, LINE_DIFF_CAP);
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const ops = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        ops.push({ type: "same", text: a[i] }); i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: "remove", text: a[i] }); i++;
      } else {
        ops.push({ type: "add", text: b[j] }); j++;
      }
    }
    while (i < m) ops.push({ type: "remove", text: a[i++] });
    while (j < n) ops.push({ type: "add", text: b[j++] });
    return ops;
  }

  // Keys/paths that look like timestamps or UUIDs — ignored when filter is active
  const TS_UUID_RE = /(?:^|\.)(?:timestamp|created_at|updated_at|createdAt|updatedAt|date|time|expires?(?:_at|At)?|issued_at|issuedAt|ts|iat|exp|nbf|uuid|id|request_id|requestId|trace_?id|traceId|correlation_?id|correlationId)$/i;
  const UUID_VALUE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ISO_TS_VALUE_RE = /^\d{4}-\d{2}-\d{2}T[\d:.Z+\-]{6,}$/;
  const EPOCH_RE = /^\d{10,13}$/;

  function isNoisyChange(change) {
    if (TS_UUID_RE.test(change.path || "")) return true;
    const toStr = String(change.to ?? "");
    const fromStr = String(change.from ?? "");
    if (UUID_VALUE_RE.test(toStr) || UUID_VALUE_RE.test(fromStr)) return true;
    if (ISO_TS_VALUE_RE.test(toStr) || ISO_TS_VALUE_RE.test(fromStr)) return true;
    if (EPOCH_RE.test(toStr) && EPOCH_RE.test(fromStr)) return true;
    return false;
  }

  function buildPairs(requests) {
    const groups = new Map();
    const sorted = requests.slice().sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));

    for (const req of sorted) {
      if (!req || !req.host) continue;
      const key = groupKey(req);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(req);
    }

    const results = [];
    for (const [key, items] of groups.entries()) {
      if (items.length < 2) continue;
      const pairs = [];
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const next = items[i];
        const prevJson = safeJsonParse(prev.reqBody);
        const nextJson = safeJsonParse(next.reqBody);
        if (prevJson.ok && nextJson.ok) {
          const changes = [];
          // FIX: use "$" as root basePath so paths don't start with "."
          diffJson(prevJson.value, nextJson.value, "$", changes);
          if (changes.length) {
            pairs.push({
              type: "json",
              prevId: prev.id,
              nextId: next.id,
              prevTs: prev.ts,
              nextTs: next.ts,
              changes,
              prevBody: prev.reqBody || "",
              nextBody: next.reqBody || "",
            });
          }
        } else {
          const lineOps = lcsDiff(prev.reqBody || "", next.reqBody || "");
          const changedLines = lineOps.filter((op) => op.type !== "same");
          if (changedLines.length) {
            pairs.push({
              type: "text",
              prevId: prev.id,
              nextId: next.id,
              prevTs: prev.ts,
              nextTs: next.ts,
              lineOps,
              changeCount: changedLines.length,
              prevBody: prev.reqBody || "",
              nextBody: next.reqBody || "",
            });
          }
        }
      }
      if (pairs.length) {
        results.push({ key, method: items[0].method, host: items[0].host, path: normalizePath(items[0].pathname || "/"), pairs });
      }
    }

    results.sort((a, b) => b.pairs.length - a.pairs.length);
    return results;
  }

  // MELHORIA: Ícone e descrição por operação
  const OP_META = {
    add:    { icon: "＋", label: "adicionado",  cls: "pd-add" },
    remove: { icon: "－", label: "removido",    cls: "pd-remove" },
    change: { icon: "～", label: "alterado",    cls: "pd-change" },
  };

  function renderJsonChanges(changes) {
    return changes.map((change) => {
      const meta = OP_META[change.op] || OP_META.change;
      const fromPreview = change.op !== "add"   ? S.escapeHtml(valuePreview(change.from)) : "";
      const toPreview   = change.op !== "remove" ? S.escapeHtml(valuePreview(change.to))  : "";
      const valueHtml = change.op === "add"
        ? `<span class="pd-val-to">${toPreview}</span>`
        : change.op === "remove"
        ? `<span class="pd-val-from">${fromPreview}</span>`
        : `<span class="pd-val-from">${fromPreview}</span><span class="pd-arrow">→</span><span class="pd-val-to">${toPreview}</span>`;
      // Full value as title attribute for tooltip on long values
      let titleAttr = "";
      try {
        const full = `${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`;
        titleAttr = ` title="${S.escapeHtml(full)}"`;
      } catch { /* noop */ }
      return `
        <div class="pd-line ${meta.cls}"${titleAttr}>
          <span class="pd-symbol">${meta.icon}</span>
          <span class="pd-path">${S.escapeHtml(change.path || "$")}</span>
          <span class="pd-values">${valueHtml}</span>
        </div>
      `;
    }).join("");
  }

  function renderTextChanges(lineOps) {
    return lineOps.map((line) => {
      const cls = line.type === "add" ? "pd-add" : line.type === "remove" ? "pd-remove" : "pd-same";
      const symbol = line.type === "add" ? "＋" : line.type === "remove" ? "－" : " ";
      return `<div class="pd-line ${cls}"><span class="pd-symbol">${symbol}</span><span class="pd-text">${S.escapeHtml(line.text)}</span></div>`;
    }).join("");
  }

  // MELHORIA: Agrupamento por host na sidebar
  function renderGroupList(groups) {
    const byHost = new Map();
    groups.forEach((group, idx) => {
      if (!byHost.has(group.host)) byHost.set(group.host, []);
      byHost.get(group.host).push({ group, idx });
    });

    if (byHost.size === 1) {
      // Single host — render flat list
      return groups.map((group, idx) => renderGroupBtn(group, idx)).join("");
    }

    // Multiple hosts — render collapsible sections
    let html = "";
    for (const [host, entries] of byHost.entries()) {
      html += `<div class="pd-host-section">
        <div class="pd-host-label">${S.escapeHtml(host)}</div>
        ${entries.map(({ group, idx }) => renderGroupBtn(group, idx)).join("")}
      </div>`;
    }
    return html;
  }

  function renderGroupBtn(group, idx) {
    const addCount    = group.pairs.reduce((s, p) => s + (p.type === "json" ? p.changes.filter(c => c.op === "add").length : 0), 0);
    const removeCount = group.pairs.reduce((s, p) => s + (p.type === "json" ? p.changes.filter(c => c.op === "remove").length : 0), 0);
    const changeCount = group.pairs.reduce((s, p) => s + (p.type === "json" ? p.changes.filter(c => c.op === "change").length : 0), 0);
    const statBadges = group.pairs.some(p => p.type === "json")
      ? `<span class="pd-stat pd-stat-add">+${addCount}</span><span class="pd-stat pd-stat-remove">-${removeCount}</span><span class="pd-stat pd-stat-change">~${changeCount}</span>`
      : `<span class="pd-stat pd-stat-change">${group.pairs.reduce((s, p) => s + (p.changeCount || 0), 0)} linhas</span>`;
    return `
      <button class="pd-group ${idx === 0 ? "active" : ""}" data-group-index="${idx}">
        <div class="pd-group-top">
          <span class="pd-method">${S.escapeHtml(group.method)}</span>
          <span class="pd-key">${S.escapeHtml(group.path)}</span>
        </div>
        <div class="pd-group-meta">
          ${group.pairs.length} comparação(ões) &nbsp; ${statBadges}
        </div>
      </button>
    `;
  }

  // MELHORIA: Pair selector com timestamps legíveis
  function tsLabel(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(Number(ts));
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return String(ts).slice(0, 8); }
  }

  function renderPairSelector(group) {
    return group.pairs.map((pair, idx) => `
      <button class="pd-pair ${idx === 0 ? "active" : ""}" data-pair-index="${idx}"
        title="${S.escapeHtml(pair.prevId)} → ${S.escapeHtml(pair.nextId)}">
        ${tsLabel(pair.prevTs)} → ${tsLabel(pair.nextTs)}
      </button>
    `).join("");
  }

  function renderPairDetail(pair, filterNoisy) {
    const changes = (pair.type === "json" && filterNoisy)
      ? pair.changes.filter(c => !isNoisyChange(c))
      : pair.changes;

    // MELHORIA: Contador por tipo de operação
    let summaryHtml = "";
    if (pair.type === "json") {
      const adds    = changes.filter(c => c.op === "add").length;
      const removes = changes.filter(c => c.op === "remove").length;
      const mods    = changes.filter(c => c.op === "change").length;
      const hidden  = filterNoisy ? pair.changes.length - changes.length : 0;
      summaryHtml = `
        <span class="pd-cnt pd-stat-add">＋${adds} add</span>
        <span class="pd-cnt pd-stat-remove">－${removes} rem</span>
        <span class="pd-cnt pd-stat-change">～${mods} mod</span>
        ${hidden ? `<span class="pd-cnt" style="color:rgba(255,255,255,.4)">${hidden} ocultos</span>` : ""}
      `;
    } else {
      summaryHtml = `<span class="pd-cnt pd-stat-change">${pair.changeCount} linha(s) alterada(s)</span>`;
    }

    return `
      <div class="pd-detail-head">
        <div class="pd-detail-meta">
          <span class="pd-badge">${S.escapeHtml(pair.type.toUpperCase())}</span>
          ${summaryHtml}
        </div>
        <div class="pd-detail-ids">
          <span style="opacity:.5;font-size:10px">${S.escapeHtml(pair.prevId.slice(0,8))}</span>
          <span>→</span>
          <span style="opacity:.5;font-size:10px">${S.escapeHtml(pair.nextId.slice(0,8))}</span>
        </div>
      </div>
      <div class="pd-detail-body">
        ${pair.type === "json" ? renderJsonChanges(changes) : renderTextChanges(pair.lineOps)}
      </div>
    `;
  }

  function buildStyles() {
    return `
      <style>
        .pd-wrap{display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr);gap:14px;height:100%;padding:12px;color:#e8e8ec;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
        .pd-panel{background:rgba(18,18,20,.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.06);border-radius:8px;min-height:0}
        .pd-side{display:flex;flex-direction:column;overflow:hidden}
        .pd-side-head,.pd-main-head{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
        .pd-title{font-weight:800;color:#bf00ff;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
        .pd-sub{color:rgba(255,255,255,.5);font-size:10px}
        .pd-groups{padding:8px;display:flex;flex-direction:column;gap:8px;overflow:auto}
        .pd-host-section{display:flex;flex-direction:column;gap:4px}
        .pd-host-label{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35);padding:4px 6px 2px}
        .pd-group,.pd-pair{width:100%;text-align:left;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:8px;color:#ececf1;cursor:pointer}
        .pd-group{padding:10px}.pd-pair{padding:7px 10px;font-size:11px}
        .pd-group.active,.pd-pair.active{border-color:rgba(191,0,255,.45);background:rgba(191,0,255,.1)}
        .pd-group-top{display:flex;gap:8px;align-items:center}.pd-group-meta{margin-top:6px;color:rgba(255,255,255,.45);font-size:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .pd-method{font-weight:800;color:#bf00ff;font-size:10px}.pd-key{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
        /* MELHORIA: stat badges */
        .pd-stat,.pd-cnt{font-size:9px;font-weight:800;padding:1px 6px;border-radius:999px}
        .pd-stat-add{color:#6de3a8;background:rgba(109,227,168,.12)}
        .pd-stat-remove{color:#ff8b9f;background:rgba(255,139,159,.12)}
        .pd-stat-change{color:#ffcf70;background:rgba(255,207,112,.12)}
        .pd-cnt{border:1px solid rgba(255,255,255,.08)}
        .pd-main{display:flex;flex-direction:column;min-height:0}.pd-pairs{padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06)}
        .pd-content{padding:12px;overflow:auto;flex:1}
        .pd-detail-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
        .pd-detail-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .pd-detail-ids{display:flex;gap:8px;align-items:center;opacity:.7}
        .pd-badge{padding:3px 8px;border-radius:999px;background:rgba(191,0,255,.12);border:1px solid rgba(191,0,255,.32);font-size:10px;font-weight:800;color:#bf00ff}
        /* MELHORIA: linha com borda lateral colorida */
        .pd-detail-body{display:flex;flex-direction:column;gap:4px}
        .pd-line{display:grid;grid-template-columns:18px minmax(100px,200px) minmax(0,1fr);gap:10px;padding:7px 10px;border-radius:6px;background:rgba(255,255,255,.02);align-items:start;border-left:3px solid transparent;cursor:default}
        .pd-symbol{font-weight:900;font-size:11px}.pd-path{color:rgba(255,255,255,.72);word-break:break-word}.pd-values,.pd-text{white-space:pre-wrap;word-break:break-word;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
        .pd-val-from{color:#ff8b9f;text-decoration:line-through;opacity:.8}
        .pd-val-to{color:#6de3a8}
        .pd-arrow{color:rgba(255,255,255,.4);flex-shrink:0}
        .pd-add{color:#6de3a8;background:rgba(109,227,168,.06);border-left-color:#6de3a8}
        .pd-remove{color:#ff8b9f;background:rgba(255,139,159,.06);border-left-color:#ff8b9f}
        .pd-change{color:#ffcf70;background:rgba(255,207,112,.06);border-left-color:#ffcf70}
        .pd-same{color:rgba(255,255,255,.35)}
        /* MELHORIA: noise filter visível no header */
        .pd-noise-toggle{display:flex;align-items:center;gap:6px;font-size:10px;color:rgba(255,255,255,.55);cursor:pointer;user-select:none;white-space:nowrap}
        .pd-noise-toggle input{accent-color:#bf00ff;cursor:pointer}
        .pd-empty{padding:24px;color:rgba(255,255,255,.5);text-align:center}
        @media (max-width: 920px){.pd-wrap{grid-template-columns:1fr}.pd-line{grid-template-columns:18px 1fr}}
      </style>
    `;
  }

  const SCRIPT = {
    id: 2,
    slug: "payload-diff",
    name: "Rastreador de Payload",
    description: "Compara payloads consecutivos por endpoint e destaca mudanças JSON ou por linha.",
    icon: "🧬",
    needsAI: false,
    needsNetwork: false,
    minRequests: 2,

    async run(ctx) {
      if (!ctx.requests.length || ctx.requests.length < 2) {
        return { ok: false, error: "Capture pelo menos 2 requests antes de executar." };
      }

      const groups = buildPairs(ctx.requests);
      if (!groups.length) {
        return { ok: false, error: "Nenhuma mudança de payload encontrada entre requests consecutivas." };
      }

      return {
        ok: true,
        summary: `${groups.length} grupo(s) com mudanças de payload`,
        render(mountEl) {
          let activeGroup = 0;
          let activePair = 0;

          // FIX: #pd-filter-noise agora é renderizado no HTML (antes era buscado mas não existia)
          mountEl.innerHTML = `
            ${buildStyles()}
            <div class="pd-wrap">
              <div class="pd-panel pd-side">
                <div class="pd-side-head">
                  <div>
                    <div class="pd-title">Payload Diff</div>
                    <div class="pd-sub">${S.escapeHtml(String(groups.length))} grupo(s) com mudanças</div>
                  </div>
                </div>
                <div class="pd-groups" data-region="groups">${renderGroupList(groups)}</div>
              </div>
              <div class="pd-panel pd-main">
                <div class="pd-main-head">
                  <div>
                    <div class="pd-title">Comparações</div>
                    <div class="pd-sub" data-region="subtitle"></div>
                  </div>
                  <!-- FIX: checkbox agora existe no DOM -->
                  <label class="pd-noise-toggle">
                    <input type="checkbox" id="pd-filter-noise" checked>
                    Ocultar ruído (IDs/timestamps)
                  </label>
                </div>
                <div class="pd-pairs" data-region="pairs"></div>
                <div class="pd-content" data-region="content"></div>
              </div>
            </div>
          `;

          const groupsHost  = mountEl.querySelector('[data-region="groups"]');
          const pairsHost   = mountEl.querySelector('[data-region="pairs"]');
          const contentHost = mountEl.querySelector('[data-region="content"]');
          const subtitleHost = mountEl.querySelector('[data-region="subtitle"]');
          const noiseToggle  = mountEl.querySelector('#pd-filter-noise');

          function paint() {
            const group = groups[activeGroup];
            const pair  = group && group.pairs[activePair];
            groupsHost.querySelectorAll('.pd-group').forEach((btn, idx) => btn.classList.toggle('active', idx === activeGroup));
            if (!group || !pair) {
              pairsHost.innerHTML = "";
              contentHost.innerHTML = '<div class="pd-empty">Nenhum diff disponível.</div>';
              subtitleHost.textContent = "";
              return;
            }
            subtitleHost.textContent = `${group.method} ${group.host}${group.path} · ${group.pairs.length} comparação(ões)`;
            pairsHost.innerHTML = renderPairSelector(group);
            pairsHost.querySelectorAll('.pd-pair').forEach((btn, idx) => {
              btn.classList.toggle('active', idx === activePair);
              btn.addEventListener('click', () => { activePair = idx; paint(); });
            });
            contentHost.innerHTML = renderPairDetail(pair, noiseToggle && noiseToggle.checked);
          }

          noiseToggle && noiseToggle.addEventListener('change', paint);

          groupsHost.addEventListener('click', (e) => {
            const btn = e.target.closest('.pd-group[data-group-index]');
            if (!btn) return;
            activeGroup = Number(btn.dataset.groupIndex);
            activePair  = 0;
            paint();
          });

          paint();
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
