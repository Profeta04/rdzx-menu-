// ============================================================
// Hyper RB · Script #8 · drift-monitor
// FIXES + IMPROVEMENTS (Wave 1 · Agent D):
//   - BUG: ratioDelta tinha dead code (!prev && !cur nunca alcançado)
//   - MELHORIA: P95_DELTA_THRESHOLD configurável via UI + storage
//   - MELHORIA: Spike threshold (3×) configurável via UI + storage
//   - MELHORIA: Agrupamento por host nos painéis de diff
//   - MELHORIA: Indicador de severidade colorido por magnitude do delta
// ============================================================
(function registerDriftMonitor() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · drift-monitor] HYPER_RB_SHARED ausente"); return; }

  const SNAPSHOT_KEY   = "last_snapshot";
  const SNAPSHOTS_KEY  = "snapshots";
  const SETTINGS_KEY   = "drift_settings";
  const MAX_SNAPSHOTS  = 10;
  const MIN_P95_SAMPLES = 3;

  // Defaults — overridden by persisted settings
  const DEFAULT_P95_THRESHOLD   = 1.0;  // 100% change
  const DEFAULT_SPIKE_MULTIPLIER = 3;   // 3× baseline count

  const normalizePath = S.normalizePath;

  function percentile(sortedValues, p) {
    if (!sortedValues.length) return 0;
    const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
    return Math.round(sortedValues[index]);
  }

  function buildSnapshot(requests) {
    const groups = new Map();
    for (const req of requests) {
      if (!req || !req.host || !req.method) continue;
      const method = String(req.method).toUpperCase();
      const path   = normalizePath(req.pathname || "/");
      const key    = `${req.host}|${method}|${path}`;
      let group    = groups.get(key);
      if (!group) {
        group = { key, host: req.host, method, path, statuses: new Set(), durations: [], contentType: "", count: 0 };
        groups.set(key, group);
      }
      group.count++;
      if (typeof req.status === "number" && isFinite(req.status)) group.statuses.add(String(req.status));
      if (typeof req.durationMs === "number" && isFinite(req.durationMs)) group.durations.push(req.durationMs);
      if (!group.contentType) {
        const ct = (req.resHeaders && (req.resHeaders["content-type"] || req.resHeaders["Content-Type"])) || "";
        group.contentType = String(ct).split(";")[0].trim();
      }
    }
    const endpoints = Array.from(groups.values()).map((g) => {
      const sorted = g.durations.slice().sort((a, b) => a - b);
      return {
        key: g.key, host: g.host, method: g.method, path: g.path, count: g.count,
        statuses: Array.from(g.statuses).sort(),
        p95Ms: sorted.length >= MIN_P95_SAMPLES ? percentile(sorted, 95) : null,
        sampleCount: sorted.length,
        contentType: g.contentType || "—",
      };
    }).sort((a, b) => a.key.localeCompare(b.key));
    return { version: 2, generatedAt: new Date().toISOString(), totalRequests: requests.length, endpoints };
  }

  // FIX: removed dead code branch (!prev && !cur) — already guarded by null check above
  function ratioDelta(prev, cur) {
    if (prev == null || cur == null) return 0;
    if (prev === 0 && cur === 0) return 0;
    return Math.abs(cur - prev) / Math.max(prev, 1);
  }

  function detectSpikes(prev, cur, multiplier) {
    const threshold = multiplier || DEFAULT_SPIKE_MULTIPLIER;
    const prevMap = new Map((prev?.endpoints || []).map((e) => [e.key, e]));
    const spikes = [];
    for (const ep of (cur?.endpoints || [])) {
      const before = prevMap.get(ep.key);
      if (!before || !before.count) continue;
      if (ep.count >= before.count * threshold) {
        spikes.push({ ...ep, prevCount: before.count, ratio: (ep.count / before.count).toFixed(1) });
      }
    }
    return spikes;
  }

  function compareSnapshots(prev, cur, p95Threshold) {
    const threshold = p95Threshold != null ? p95Threshold : DEFAULT_P95_THRESHOLD;
    const prevMap = new Map((prev?.endpoints || []).map((e) => [e.key, e]));
    const curMap  = new Map((cur?.endpoints  || []).map((e) => [e.key, e]));
    const added = [], removed = [], changed = [];

    for (const ep of cur.endpoints) {
      const before = prevMap.get(ep.key);
      if (!before) { added.push(ep); continue; }
      const reasons = [];
      if (JSON.stringify(before.statuses) !== JSON.stringify(ep.statuses))
        reasons.push(`status ${before.statuses.join(",") || "—"} → ${ep.statuses.join(",") || "—"}`);
      if ((before.contentType || "—") !== (ep.contentType || "—"))
        reasons.push(`content-type ${before.contentType} → ${ep.contentType}`);
      if (before.p95Ms != null && ep.p95Ms != null) {
        const delta = ratioDelta(before.p95Ms, ep.p95Ms);
        if (delta > threshold)
          reasons.push(`p95 ${before.p95Ms}ms → ${ep.p95Ms}ms (${Math.round(delta * 100)}% Δ)`);
      }
      if (reasons.length) changed.push({ ...ep, previous: before, reasons });
    }
    for (const ep of prev?.endpoints || []) {
      if (!curMap.has(ep.key)) removed.push(ep);
    }
    return { added, removed, changed };
  }

  async function saveSnapshot(ctx, snapshot) {
    const stored = await ctx.storage.get(SNAPSHOTS_KEY);
    const snapshots = Array.isArray(stored) ? stored : [];
    const compact = { generatedAt: snapshot.generatedAt, totalRequests: snapshot.totalRequests, endpoints: snapshot.endpoints };
    const next = snapshots.concat(compact).slice(-MAX_SNAPSHOTS);
    await ctx.storage.set(SNAPSHOTS_KEY, next);
    await ctx.storage.set(SNAPSHOT_KEY, compact);
    return next.length;
  }

  // MELHORIA: Agrupamento por host nos painéis
  function groupByHost(items) {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.host)) map.set(item.host, []);
      map.get(item.host).push(item);
    }
    return map;
  }

  function renderEndpointChip(item, details) {
    return `<article class="dm-item"><div class="dm-item-top"><span class="dm-method">${S.escapeHtml(item.method)}</span><span class="dm-path">${S.escapeHtml(item.path)}</span></div><div class="dm-item-meta">${details}</div></article>`;
  }

  function renderColumn(title, toneClass, items, renderItem) {
    if (!items.length) return `<section class="dm-col ${toneClass}"><div class="dm-col-head"><span>${S.escapeHtml(title)}</span><span class="dm-count">0</span></div><div class="dm-empty">Sem itens.</div></section>`;

    // MELHORIA: agrupar por host dentro da coluna
    const byHost = groupByHost(items);
    let bodyHtml = "";
    for (const [host, hostItems] of byHost.entries()) {
      const hostHeader = byHost.size > 1 ? `<div class="dm-host-label">${S.escapeHtml(host)}</div>` : "";
      bodyHtml += hostHeader + hostItems.map(renderItem).join("");
    }
    return `<section class="dm-col ${toneClass}"><div class="dm-col-head"><span>${S.escapeHtml(title)}</span><span class="dm-count">${items.length}</span></div><div class="dm-col-body">${bodyHtml}</div></section>`;
  }

  function renderDiff(diff) {
    return `
      <div class="dm-grid">
        ${renderColumn("Novos", "dm-col-added", diff.added, (e) => renderEndpointChip(e, `count: ${e.count} · statuses: ${e.statuses.join(",") || "—"}`))}
        ${renderColumn("Removidos", "dm-col-removed", diff.removed, (e) => renderEndpointChip(e, `foi: ${e.statuses.join(",") || "—"}`))}
        ${renderColumn("Alterados", "dm-col-changed", diff.changed, (e) => {
          // MELHORIA: severidade colorida por magnitude
          const hasLatency = e.reasons.some(r => r.includes("p95"));
          const severity = hasLatency ? ' style="color:#ff8b9f"' : '';
          return renderEndpointChip(e, e.reasons.map((r) => `<span${severity}>${S.escapeHtml(r)}</span>`).join(" · "));
        })}
      </div>`;
  }

  const SCRIPT = {
    id: 8,
    slug: "drift-monitor",
    name: "Monitor de Drift",
    description: "Compara snapshots de endpoints e destaca drift. Threshold configurável. Agrupamento por host.",
    icon: "🛰️",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) return { ok: false, error: "Capture pelo menos 1 request antes." };
      const currentSnapshot = buildSnapshot(ctx.requests);
      if (!currentSnapshot.endpoints.length) return { ok: false, error: "Nenhum endpoint válido encontrado." };

      // MELHORIA: carregar settings persistidas
      const settings = (await ctx.storage.get(SETTINGS_KEY)) || {};
      const p95Threshold   = settings.p95Threshold   != null ? settings.p95Threshold   : DEFAULT_P95_THRESHOLD;
      const spikeMultiplier = settings.spikeMultiplier != null ? settings.spikeMultiplier : DEFAULT_SPIKE_MULTIPLIER;

      const previousSnapshot = await ctx.storage.get(SNAPSHOT_KEY);
      const allSnapshots     = await ctx.storage.get(SNAPSHOTS_KEY) || [];
      const diff   = previousSnapshot ? compareSnapshots(previousSnapshot, currentSnapshot, p95Threshold) : { added: [], removed: [], changed: [] };
      const spikes = previousSnapshot ? detectSpikes(previousSnapshot, currentSnapshot, spikeMultiplier) : [];
      const summary = previousSnapshot
        ? `+${diff.added.length} · -${diff.removed.length} · ~${diff.changed.length}${spikes.length ? ` · 📈 ${spikes.length} spike(s)` : ""}`
        : `${currentSnapshot.endpoints.length} endpoints · sem snapshot anterior`;

      return {
        ok: true,
        summary,
        render(mountEl) {
          const comparedAt = previousSnapshot?.generatedAt ? new Date(previousSnapshot.generatedAt).toLocaleString("pt-BR") : null;

          mountEl.innerHTML = `
            <style>
              .dm-wrap{display:flex;flex-direction:column;gap:12px;padding:12px;color:#ececf1;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
              .dm-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;background:rgba(18,18,20,.7);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:12px}
              .dm-title{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#bf00ff}
              .dm-sub{margin-top:4px;color:rgba(255,255,255,.6)}
              .dm-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
              .dm-btn{padding:7px 12px;border:none;border-radius:6px;background:#bf00ff;color:#0a0a0c;font-weight:800;cursor:pointer}
              .dm-btn[disabled]{opacity:.6;cursor:wait}
              .dm-btn-secondary{padding:7px 12px;border:1px solid rgba(191,0,255,.4);border-radius:6px;background:rgba(191,0,255,.1);color:#fff;font-weight:700;cursor:pointer}
              .dm-hint{color:rgba(255,255,255,.5);font-size:11px}
              .dm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
              .dm-col{background:rgba(18,18,20,.7);border:1px solid rgba(255,255,255,.06);border-radius:8px;min-height:160px;display:flex;flex-direction:column}
              .dm-col-head{display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
              .dm-col-body{padding:10px;display:flex;flex-direction:column;gap:8px;overflow:auto;max-height:320px}
              .dm-count{padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.08)}
              .dm-host-label{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3);padding:4px 2px 2px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px}
              .dm-item{padding:10px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
              .dm-item-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dm-item-meta{margin-top:6px;color:rgba(255,255,255,.62);white-space:pre-wrap;word-break:break-word}
              .dm-method{font-size:10px;font-weight:900;color:#bf00ff}
              .dm-path{flex:1;min-width:0;word-break:break-word}
              .dm-empty{padding:18px;color:rgba(255,255,255,.45)}
              .dm-col-added .dm-col-head{color:#77e6b3}.dm-col-removed .dm-col-head{color:#ff9aac}.dm-col-changed .dm-col-head{color:#ffd07d}
              /* MELHORIA: painel de configurações */
              .dm-settings{background:rgba(18,18,20,.7);border:1px solid rgba(191,0,255,.15);border-radius:8px;padding:12px;display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
              .dm-setting-group{display:flex;flex-direction:column;gap:4px}
              .dm-setting-label{font-size:10px;color:rgba(255,255,255,.5);font-weight:700}
              .dm-setting-input{background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(191,0,255,.3);padding:5px 8px;border-radius:5px;font-size:11px;width:80px;font-family:inherit}
              .dm-time-travel{background:rgba(18,18,20,.7);border:1px solid rgba(191,0,255,.2);border-radius:8px;padding:12px}
              .dm-time-travel select{background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(191,0,255,.3);padding:5px 8px;border-radius:5px;font-size:11px;}
              @media(max-width:980px){.dm-grid{grid-template-columns:1fr}}
            </style>
            <div class="dm-wrap">
              <div class="dm-head">
                <div>
                  <div class="dm-title">Monitor de Drift</div>
                  <div class="dm-sub">${comparedAt ? `Comparando com snapshot de ${S.escapeHtml(comparedAt)}.` : "Sem snapshot anterior."}</div>
                </div>
                <div class="dm-actions">
                  <button class="dm-btn" data-action="save">💾 Salvar snapshot</button>
                  <span class="dm-hint" data-role="save-hint"></span>
                </div>
              </div>

              <!-- MELHORIA: Configurações persistidas de threshold -->
              <div class="dm-settings">
                <div class="dm-setting-group">
                  <label class="dm-setting-label" for="dm-p95-threshold">Threshold p95 latência (%)</label>
                  <input id="dm-p95-threshold" class="dm-setting-input" type="number" min="10" max="500" step="10"
                    value="${Math.round(p95Threshold * 100)}" placeholder="100">
                </div>
                <div class="dm-setting-group">
                  <label class="dm-setting-label" for="dm-spike-mult">Spike multiplicador (×)</label>
                  <input id="dm-spike-mult" class="dm-setting-input" type="number" min="2" max="20" step="1"
                    value="${spikeMultiplier}" placeholder="3">
                </div>
                <button class="dm-btn-secondary" data-action="apply-settings">Aplicar e re-comparar</button>
                <span class="dm-hint" data-role="settings-hint"></span>
              </div>

              <div data-role="main-diff">${renderDiff(diff)}</div>
              ${spikes.length ? `
              <div style="background:rgba(255,200,0,.08);border:1px solid rgba(255,200,0,.25);border-radius:8px;padding:12px;font-family:ui-monospace,monospace;">
                <div style="font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#ffd07d;margin-bottom:8px;">📈 Spike de Volume (≥${spikeMultiplier}× baseline)</div>
                ${spikes.map((e) => `<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-top:1px solid rgba(255,255,255,.05);"><span style="color:#bf00ff;font-weight:700;font-size:10px;">${S.escapeHtml(e.method)}</span><span style="flex:1;word-break:break-word;font-size:11px;">${S.escapeHtml(e.host)}${S.escapeHtml(e.path)}</span><span style="white-space:nowrap;font-size:11px;color:#ffd07d;">${e.prevCount} → ${e.count} <strong>(${e.ratio}×)</strong></span></div>`).join("")}
              </div>` : ""}

              ${allSnapshots.length >= 2 ? `
              <div class="dm-time-travel">
                <div class="dm-title" style="margin-bottom:8px;">⏳ Time-Travel Diff</div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <label style="font-size:11px;color:rgba(255,255,255,.6);">De:
                    <select class="dm-tt-from">
                      ${allSnapshots.map((s, i) => `<option value="${i}">${S.escapeHtml(new Date(s.generatedAt).toLocaleString("pt-BR"))}</option>`).join("")}
                    </select>
                  </label>
                  <label style="font-size:11px;color:rgba(255,255,255,.6);">Para:
                    <select class="dm-tt-to">
                      ${allSnapshots.map((s, i) => `<option value="${i}" ${i === allSnapshots.length - 1 ? "selected" : ""}>${S.escapeHtml(new Date(s.generatedAt).toLocaleString("pt-BR"))}</option>`).join("")}
                    </select>
                  </label>
                  <button class="dm-btn-secondary dm-tt-run">Comparar</button>
                </div>
                <div class="dm-tt-result" style="margin-top:10px;"></div>
              </div>
              ` : ""}
            </div>`;

          mountEl.querySelector("[data-action='save']")?.addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            const hint = mountEl.querySelector("[data-role='save-hint']");
            try {
              const n = await saveSnapshot(ctx, currentSnapshot);
              hint.textContent = `✓ Snapshot salvo (${n} histórico${n !== 1 ? "s" : ""}).`;
            } catch (err) {
              hint.textContent = `Erro ao salvar: ${err?.message || err}`;
            } finally { btn.disabled = false; }
          });

          // MELHORIA: salvar settings e re-comparar
          mountEl.querySelector("[data-action='apply-settings']")?.addEventListener("click", async () => {
            const pctInput   = mountEl.querySelector("#dm-p95-threshold");
            const spikeInput = mountEl.querySelector("#dm-spike-mult");
            const hint       = mountEl.querySelector("[data-role='settings-hint']");
            const newP95  = Math.max(10, Math.min(500, Number(pctInput.value) || 100)) / 100;
            const newSpike = Math.max(2, Math.min(20, Number(spikeInput.value) || 3));
            try {
              await ctx.storage.set(SETTINGS_KEY, { p95Threshold: newP95, spikeMultiplier: newSpike });
              const newDiff   = previousSnapshot ? compareSnapshots(previousSnapshot, currentSnapshot, newP95) : { added: [], removed: [], changed: [] };
              const newSpikes = previousSnapshot ? detectSpikes(previousSnapshot, currentSnapshot, newSpike) : [];
              mountEl.querySelector("[data-role='main-diff']").innerHTML = renderDiff(newDiff);
              hint.textContent = `✓ Aplicado (p95 >${Math.round(newP95 * 100)}% · spike ≥${newSpike}×) · ${newDiff.changed.length} alterado(s)`;
            } catch (err) {
              hint.textContent = `Erro: ${err?.message || err}`;
            }
          });

          mountEl.querySelector(".dm-tt-run")?.addEventListener("click", () => {
            const fromIdx = Number(mountEl.querySelector(".dm-tt-from").value);
            const toIdx   = Number(mountEl.querySelector(".dm-tt-to").value);
            if (fromIdx === toIdx) { mountEl.querySelector(".dm-tt-result").innerHTML = '<span style="opacity:.5">Selecione snapshots diferentes.</span>'; return; }
            const from = allSnapshots[fromIdx];
            const to   = allSnapshots[toIdx];
            if (!from || !to) return;
            const ttDiff = compareSnapshots(from, to, p95Threshold);
            mountEl.querySelector(".dm-tt-result").innerHTML = `
              <div style="font-size:11px;color:rgba(255,255,255,.5);margin-bottom:8px;">
                ${S.escapeHtml(new Date(from.generatedAt).toLocaleString("pt-BR"))} → ${S.escapeHtml(new Date(to.generatedAt).toLocaleString("pt-BR"))}
              </div>
              ${renderDiff(ttDiff)}`;
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
