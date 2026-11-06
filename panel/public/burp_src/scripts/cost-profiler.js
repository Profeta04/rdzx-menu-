// ============================================================
// Hyper RB · Script #5 · cost-profiler
// Perfil de Custo/Latência — agrupa requests por endpoint canônico,
// calcula bytes, latência (avg/p50/p95/p99) e tokens estimados.
// v4.2.0:
//   - Custo agregado por modelo AI (OpenAI/Anthropic pricing)
//   - Detecção de modelo nos request/response bodies
//   - Alertas de drift de latência (primeira vs segunda metade)
//   - Error rate por endpoint
//   - avgReqBytes na tabela HTML (estava só no CSV)
// ============================================================
(function registerCostProfiler() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB · cost-profiler] HYPER_RB_SHARED ausente");
    return;
  }

  const pathTemplate = S.normalizePath;

  function percentile(sortedArr, p) {
    if (!sortedArr.length) return 0;
    const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
    return sortedArr[idx];
  }

  const _enc = typeof TextEncoder === "function" ? new TextEncoder() : null;
  function bodyLen(s) {
    if (!s || typeof s !== "string") return 0;
    if (_enc) { try { return _enc.encode(s).length; } catch {} }
    return s.length;
  }

  function estimateTokens(text) {
    if (!text || typeof text !== "string") return 0;
    const chunks = text.split(/[\s\t\r\n]+/).filter(Boolean);
    let tokens = 0;
    for (const chunk of chunks) {
      if (!chunk) continue;
      const len = chunk.length;
      if (/^[A-Za-z0-9_]+$/.test(chunk)) {
        tokens += Math.max(1, Math.ceil(len / 4));
      } else if (/^[0-9a-fA-F]+$/.test(chunk) && len > 8) {
        tokens += Math.max(1, Math.ceil(len / 3));
      } else {
        for (let i = 0; i < chunk.length; ) {
          const cp = chunk.codePointAt(i);
          if (cp > 0x10000) { tokens += 2; i += 2; }
          else if (cp > 0x007F) { tokens += 1; i += 1; }
          else { tokens += Math.max(1, Math.ceil(1 / 4)); i += 1; }
        }
        tokens = Math.max(tokens, Math.ceil(len / 4));
      }
      const punctMatches = chunk.match(/[^\w\s]/g);
      if (punctMatches) tokens += punctMatches.length;
    }
    return Math.max(1, Math.round(tokens));
  }

  // ── MELHORIA: Detecção de modelo AI + tabela de preços ─────
  // Preços em USD por 1M tokens (input/output) — Junho 2025
  const MODEL_PRICING = {
    "gpt-4o":              { input: 2.50,  output: 10.00 },
    "gpt-4o-mini":         { input: 0.15,  output: 0.60  },
    "gpt-4-turbo":         { input: 10.00, output: 30.00 },
    "gpt-4":               { input: 30.00, output: 60.00 },
    "gpt-3.5-turbo":       { input: 0.50,  output: 1.50  },
    "o1":                  { input: 15.00, output: 60.00 },
    "o1-mini":             { input: 3.00,  output: 12.00 },
    "o3-mini":             { input: 1.10,  output: 4.40  },
    "claude-3-5-sonnet":   { input: 3.00,  output: 15.00 },
    "claude-3-5-haiku":    { input: 0.80,  output: 4.00  },
    "claude-3-opus":       { input: 15.00, output: 75.00 },
    "claude-3-sonnet":     { input: 3.00,  output: 15.00 },
    "claude-3-haiku":      { input: 0.25,  output: 1.25  },
    "claude-opus-4":       { input: 15.00, output: 75.00 },
    "claude-sonnet-4":     { input: 3.00,  output: 15.00 },
  };

  function detectModel(reqBody, resBody) {
    const blobs = [reqBody, resBody].filter((x) => typeof x === "string");
    for (const blob of blobs) {
      // OpenAI: "model": "gpt-4o"
      const m1 = blob.match(/"model"\s*:\s*"([^"]+)"/);
      if (m1) {
        const raw = m1[1].toLowerCase();
        for (const key of Object.keys(MODEL_PRICING)) {
          if (raw.includes(key)) return key;
        }
        return raw; // return even if no pricing available
      }
      // Anthropic path: /v1/messages with claude in URL handled by host
    }
    return null;
  }

  function estimateCostUSD(model, reqTokens, resTokens) {
    const p = MODEL_PRICING[model];
    if (!p) return null;
    return (reqTokens / 1e6) * p.input + (resTokens / 1e6) * p.output;
  }

  // ── MELHORIA: Drift de latência ─────────────────────────────
  // Compara p95 da primeira metade dos requests vs segunda metade.
  // Se segunda > primeira * 1.5 → drift detectado.
  const DRIFT_THRESHOLD = 1.5;

  function csvCell(v) {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildProfile(requests) {
    const groups = new Map();
    const sorted = [...requests].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    for (const r of sorted) {
      if (!r || !r.host) continue;
      const key = `${r.host}|${(r.method || "GET").toUpperCase()}|${pathTemplate(r.pathname || "/")}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key, host: r.host,
          method: (r.method || "GET").toUpperCase(),
          pathTemplate: pathTemplate(r.pathname || "/"),
          count: 0, errorCount: 0,
          totalReqBytes: 0, totalResBytes: 0, totalBytes: 0,
          totalReqTokens: 0, totalResTokens: 0,
          latencies: [], latenciesFirst: [], latenciesSecond: [],
          statuses: new Set(),
          models: new Map(), // model → {reqTok, resTok, count}
          _requests: [],
        };
        groups.set(key, g);
      }
      g._requests.push(r);
    }

    // Second pass: assign first/second half for drift
    for (const g of groups.values()) {
      const half = Math.ceil(g._requests.length / 2);
      g._requests.forEach((r, idx) => {
        const reqB = bodyLen(r.reqBody);
        const resB = bodyLen(r.resBody);
        g.count++;
        g.totalReqBytes += reqB;
        g.totalResBytes += resB;
        g.totalBytes += reqB + resB;
        const rt = estimateTokens(r.reqBody);
        const rst = estimateTokens(r.resBody);
        g.totalReqTokens += rt;
        g.totalResTokens += rst;
        if (typeof r.durationMs === "number" && isFinite(r.durationMs)) {
          g.latencies.push(r.durationMs);
          if (idx < half) g.latenciesFirst.push(r.durationMs);
          else g.latenciesSecond.push(r.durationMs);
        }
        if (typeof r.status === "number") {
          g.statuses.add(r.status);
          if (r.status >= 400) g.errorCount++;
        }
        // Model detection
        const model = detectModel(r.reqBody, r.resBody);
        if (model) {
          if (!g.models.has(model)) g.models.set(model, { reqTok: 0, resTok: 0, count: 0 });
          const m = g.models.get(model);
          m.reqTok += rt; m.resTok += rst; m.count++;
        }
      });
    }

    const rows = [];
    for (const g of groups.values()) {
      const lats = g.latencies.slice().sort((a, b) => a - b);
      const latsF = g.latenciesFirst.slice().sort((a, b) => a - b);
      const latsS = g.latenciesSecond.slice().sort((a, b) => a - b);
      const sum = lats.reduce((a, b) => a + b, 0);
      const p95First = percentile(latsF, 95);
      const p95Second = percentile(latsS, 95);
      const hasDrift = latsF.length >= 2 && latsS.length >= 2 && p95Second > p95First * DRIFT_THRESHOLD;

      // Aggregate cost per model
      let totalCostUSD = null;
      const modelBreakdown = [];
      for (const [model, m] of g.models.entries()) {
        const cost = estimateCostUSD(model, m.reqTok, m.resTok);
        if (cost != null) {
          if (totalCostUSD === null) totalCostUSD = 0;
          totalCostUSD += cost;
        }
        modelBreakdown.push({ model, ...m, costUSD: cost });
      }

      rows.push({
        host: g.host,
        method: g.method,
        pathTemplate: g.pathTemplate,
        count: g.count,
        errorCount: g.errorCount,
        errorRate: g.count ? Math.round((g.errorCount / g.count) * 100) : 0,
        totalBytes: g.totalBytes,
        avgBytes: Math.round(g.totalBytes / g.count),
        avgReqBytes: Math.round(g.totalReqBytes / g.count),
        totalMs: Math.round(sum),
        avgMs: lats.length ? Math.round(sum / lats.length) : 0,
        p50Ms: Math.round(percentile(lats, 50)),
        p95Ms: Math.round(percentile(lats, 95)),
        p99Ms: Math.round(percentile(lats, 99)),
        p95First, p95Second, hasDrift,
        estTokensReq: g.totalReqTokens,
        estTokensRes: g.totalResTokens,
        estTokens: g.totalReqTokens + g.totalResTokens,
        statuses: Array.from(g.statuses).sort((a, b) => a - b).join(","),
        totalCostUSD,
        modelBreakdown,
      });
    }
    return rows;
  }

  function svgBarChart(title, items, valueKey, formatter, color) {
    const W = 320, H = 220, padL = 140, padR = 12, padT = 28, padB = 12;
    const max = items.reduce((m, it) => Math.max(m, it[valueKey]), 0) || 1;
    const innerW = W - padL - padR;
    const rowH = items.length ? (H - padT - padB) / items.length : 0;
    const barH = Math.max(6, rowH - 4);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">`;
    svg += `<text x="8" y="18" fill="rgba(255,255,255,0.75)" font-size="11" font-weight="800" style="text-transform:uppercase;letter-spacing:0.08em">${S.escapeHtml(title)}</text>`;
    items.forEach((it, i) => {
      const y = padT + i * rowH;
      const w = Math.max(2, (it[valueKey] / max) * innerW);
      const label = `${it.method} ${it.pathTemplate}`;
      const truncLabel = label.length > 22 ? label.slice(0, 21) + "…" : label;
      svg += `<text x="${padL - 6}" y="${y + barH / 2 + 3}" fill="rgba(255,255,255,0.55)" font-size="9" text-anchor="end" font-family="ui-monospace,SFMono-Regular,monospace">${S.escapeHtml(truncLabel)}</text>`;
      svg += `<rect x="${padL}" y="${y + 2}" width="${w}" height="${barH}" fill="${color}" rx="2" opacity="0.85"><title>${S.escapeHtml(label)} — ${S.escapeHtml(formatter(it[valueKey]))}</title></rect>`;
      svg += `<text x="${padL + w + 4}" y="${y + barH / 2 + 3}" fill="rgba(255,255,255,0.7)" font-size="9" font-family="ui-monospace,SFMono-Regular,monospace">${S.escapeHtml(formatter(it[valueKey]))}</text>`;
    });
    svg += `</svg>`;
    return svg;
  }

  function fmtUSD(v) {
    if (v == null) return "—";
    if (v < 0.0001) return `$${(v * 1e6).toFixed(2)}µ`;
    if (v < 0.01) return `$${(v * 1000).toFixed(3)}m`;
    return `$${v.toFixed(4)}`;
  }

  function buildModelSummary(rows) {
    // Aggregate across all endpoints by model
    const agg = new Map();
    for (const row of rows) {
      for (const mb of row.modelBreakdown) {
        if (!agg.has(mb.model)) agg.set(mb.model, { model: mb.model, reqTok: 0, resTok: 0, count: 0, costUSD: 0 });
        const a = agg.get(mb.model);
        a.reqTok += mb.reqTok; a.resTok += mb.resTok; a.count += mb.count;
        if (mb.costUSD != null) a.costUSD += mb.costUSD;
      }
    }
    if (!agg.size) return "";
    const modelRows = [...agg.values()].sort((a, b) => (b.costUSD || 0) - (a.costUSD || 0));
    return `
      <div style="background:rgba(18,18,20,0.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:auto;">
        <div style="padding:10px 12px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.65);border-bottom:1px solid rgba(255,255,255,.06)">
          💰 Custo Estimado por Modelo AI
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead style="position:sticky;top:0;background:rgba(0,0,0,.6)">
            <tr>
              <th style="padding:7px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);text-align:left">Modelo</th>
              <th style="padding:7px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);text-align:right">Req. Tokens</th>
              <th style="padding:7px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);text-align:right">Res. Tokens</th>
              <th style="padding:7px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);text-align:right">Chamadas</th>
              <th style="padding:7px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);text-align:right">Custo USD (est.)</th>
            </tr>
          </thead>
          <tbody>
            ${modelRows.map((m) => `
              <tr style="border-top:1px solid rgba(255,255,255,.04)">
                <td style="padding:6px 10px;font-family:ui-monospace,monospace;color:#bf00ff;font-weight:700">${S.escapeHtml(m.model)}</td>
                <td style="padding:6px 10px;text-align:right;font-family:ui-monospace,monospace">${m.reqTok.toLocaleString()}</td>
                <td style="padding:6px 10px;text-align:right;font-family:ui-monospace,monospace">${m.resTok.toLocaleString()}</td>
                <td style="padding:6px 10px;text-align:right">${m.count}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:700;color:${m.costUSD > 0.01 ? "#ffd27f" : "#7ce6b5"}">${S.escapeHtml(fmtUSD(m.costUSD || null))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function buildHTML(rows) {
    if (!rows.length) {
      return `<div class="hyper-rb-error" style="padding:16px;color:rgba(255,255,255,0.7)">Nenhum endpoint agrupado encontrado.</div>`;
    }
    const topBytes = rows.slice().sort((a, b) => b.totalBytes - a.totalBytes).slice(0, 10);
    const topMs    = rows.slice().sort((a, b) => b.totalMs - a.totalMs).slice(0, 10);
    const topTokens= rows.slice().sort((a, b) => b.estTokens - a.estTokens).slice(0, 10);

    const driftRows = rows.filter((r) => r.hasDrift);

    const tableRows = rows
      .slice()
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .map((r) => `
        <tr>
          <td style="padding:6px 8px;font-family:ui-monospace,monospace;font-size:10px;color:rgba(255,255,255,0.5)">${S.escapeHtml(r.host)}</td>
          <td style="padding:6px 8px;font-weight:800;font-size:10px;color:#bf00ff">${S.escapeHtml(r.method)}</td>
          <td style="padding:6px 8px;font-family:ui-monospace,monospace;font-size:10px;color:rgba(255,255,255,0.85)">${S.escapeHtml(r.pathTemplate)}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px">${r.count}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:${r.errorRate > 10 ? "#ff9aac" : r.errorRate > 0 ? "#ffd27f" : "rgba(255,255,255,.5)"}">${r.errorRate}%</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;font-family:ui-monospace,monospace">${S.escapeHtml(S.formatBytes(r.totalBytes))}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;font-family:ui-monospace,monospace" title="Avg req bytes: ${S.escapeHtml(S.formatBytes(r.avgReqBytes))}">${S.escapeHtml(S.formatBytes(r.avgBytes))}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;font-family:ui-monospace,monospace">${S.escapeHtml(S.formatMs(r.avgMs))}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;font-family:ui-monospace,monospace">${S.escapeHtml(S.formatMs(r.p95Ms))}${r.hasDrift ? ' <span title="Drift de latência detectado (p95 segunda metade > 1.5× primeira)" style="color:#ff9aac">⚠</span>' : ""}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;font-family:ui-monospace,monospace">${S.escapeHtml(S.formatMs(r.p99Ms))}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;font-family:ui-monospace,monospace" title="req: ${r.estTokensReq.toLocaleString()} · res: ${r.estTokensRes.toLocaleString()}">${r.estTokens.toLocaleString()}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:${r.totalCostUSD != null && r.totalCostUSD > 0.01 ? "#ffd27f" : "rgba(255,255,255,.5)"}">${S.escapeHtml(fmtUSD(r.totalCostUSD))}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:rgba(255,255,255,0.5)">${S.escapeHtml(r.statuses)}</td>
        </tr>
      `).join("");

    return `
      <div style="display:flex;flex-direction:column;gap:16px;padding:12px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="dl-csv" style="padding:8px 14px;border-radius:10px;background:rgba(191,0,255,0.15);border:1px solid rgba(191,0,255,0.35);color:#fff;font-weight:800;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer">Baixar CSV</button>
          <span style="font-size:10px;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;letter-spacing:0.08em">${rows.length} endpoints agrupados</span>
          ${driftRows.length ? `<span style="font-size:10px;color:#ff9aac;font-weight:700">⚠ ${driftRows.length} endpoint(s) com drift de latência</span>` : ""}
        </div>
        ${buildModelSummary(rows)}
        ${driftRows.length ? `
          <div style="background:rgba(255,60,60,.07);border:1px solid rgba(255,100,100,.2);border-radius:10px;padding:10px 12px;font-size:10px;">
            <div style="font-weight:900;color:#ff9aac;margin-bottom:6px;">⚠ Drift de Latência Detectado</div>
            ${driftRows.map((r) => `<div style="margin:3px 0;color:rgba(255,255,255,.7)">${S.escapeHtml(r.method)} ${S.escapeHtml(r.pathTemplate)} — p95 1ª metade: ${S.escapeHtml(S.formatMs(r.p95First))} → 2ª metade: <strong style="color:#ffd27f">${S.escapeHtml(S.formatMs(r.p95Second))}</strong></div>`).join("")}
          </div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
          <div style="background:rgba(18,18,20,0.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:8px">${svgBarChart("Top 10 · Bytes", topBytes, "totalBytes", (v) => S.formatBytes(v), "#bf00ff")}</div>
          <div style="background:rgba(18,18,20,0.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:8px">${svgBarChart("Top 10 · Tempo Total", topMs, "totalMs", (v) => S.formatMs(v), "#7a00cc")}</div>
          <div style="background:rgba(18,18,20,0.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:8px">${svgBarChart("Top 10 · Tokens (est)", topTokens, "estTokens", (v) => v.toLocaleString(), "#4a0080")}</div>
        </div>
        <div style="background:rgba(18,18,20,0.7);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:auto;max-height:420px">
          <table style="width:100%;border-collapse:collapse;font-size:10px">
            <thead style="position:sticky;top:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px)">
              <tr style="text-align:left">
                <th style="padding:8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Host</th>
                <th style="padding:8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">M</th>
                <th style="padding:8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Path</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">N</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Err%</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Bytes</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)" title="hover = avg req bytes">Avg↕</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Avg</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">P95</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">P99</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)" title="Hover para req/res">Tokens↕</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Custo</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5)">Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildCSV(rows) {
    const header = ["host","method","pathTemplate","count","errorCount","errorRate","totalBytes","avgBytes","avgReqBytes","totalMs","avgMs","p50Ms","p95Ms","p99Ms","hasDrift","p95First","p95Second","estTokensReq","estTokensRes","estTokens","totalCostUSD","statuses"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(header.map((k) => csvCell(r[k])).join(","));
    }
    return lines.join("\r\n");
  }

  const SCRIPT = {
    id: 5,
    slug: "cost-profiler",
    name: "Perfil Custo/Latência",
    description: "Bytes, latência (avg/p95/p99), tokens estimados, custo USD por modelo AI, drift de latência e error rate por endpoint.",
    icon: "💸",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx || !ctx.requests || !ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }
      const rows = buildProfile(ctx.requests);
      if (!rows.length) {
        return { ok: false, error: "Nenhum endpoint válido (faltam hosts)." };
      }
      const totalBytes = rows.reduce((a, b) => a + b.totalBytes, 0);
      const totalMs = rows.reduce((a, b) => a + b.totalMs, 0);
      const totalTokens = rows.reduce((a, b) => a + b.estTokens, 0);
      const totalCost = rows.reduce((a, b) => a + (b.totalCostUSD || 0), 0);
      const driftCount = rows.filter((r) => r.hasDrift).length;
      const csv = buildCSV(rows);

      return {
        ok: true,
        summary: `${rows.length} endpoints · ${S.formatBytes(totalBytes)} · ${S.formatMs(totalMs)} · ~${totalTokens.toLocaleString()} tokens · ${fmtUSD(totalCost || null)} · ${driftCount} drift(s)`,
        render(mountEl) {
          mountEl.innerHTML = buildHTML(rows);
          const csvBtn = mountEl.querySelector(".dl-csv");
          if (csvBtn) {
            csvBtn.addEventListener("click", () => {
              S.downloadBlob("hyper-rb-cost-profile.csv", "text/csv;charset=utf-8", csv);
            });
          }
        },
        artifact: { filename: "hyper-rb-cost-profile.csv", mime: "text/csv", content: csv },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
