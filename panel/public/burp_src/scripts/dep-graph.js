// ============================================================
// Hyper RB · Script #4 · dep-graph
// Grafo de dependências (janela deslizante configurável) com layout force-directed.
//
// W1 · Agent C changes:
//   FIX: nodeKey inclui host → sem colapso de endpoints iguais de hosts distintos
//   FIX: edges órfãos (cujo nó foi removido pelo cap MAX_NODES) eram silenciosamente
//        incluídos quando idx.get() retornava undefined — now filtered at edge-build
//   IMPROVEMENT: SVG labels para os nós de maior count (top-N visíveis)
//   IMPROVEMENT: legenda de cores por host
//   IMPROVEMENT: botão "Exportar grafo.json"
//   IMPROVEMENT: janela de tempo configurável (2s / 5s / 10s / 30s)
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[dep-graph] HYPER_RB_SHARED ausente"); return; }

  const DEFAULT_WINDOW_MS = 5000;
  const MAX_NODES = 200;
  const ITER = 100;
  const LABEL_TOP_N = 15; // show labels for the top-N nodes by count

  const normalizePath = S.normalizePath;

  function buildGraph(requests, windowMs) {
    const sorted = requests.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
    // FIX: include host so cross-host same-path nodes stay distinct
    const nodeKey = (r) => `${r.host || "?"} ${r.method} ${normalizePath(r.pathname || "/")}`;
    const nodes = new Map(); // key -> {key, host, method, path, count, degree}
    const edges = new Map(); // "a||b" -> {a, b, weight}

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      if (!r || !r.host || !r.method) continue;
      const k = nodeKey(r);
      const n = nodes.get(k) || { key: k, host: r.host || "?", method: String(r.method).toUpperCase(), path: normalizePath(r.pathname || "/"), count: 0, degree: 0 };
      n.count++;
      nodes.set(k, n);
      for (let j = i - 1; j >= 0; j--) {
        const p = sorted[j];
        if (((r.ts || 0) - (p.ts || 0)) > windowMs) break;
        if (!p || !p.host || !p.method) continue;
        const pk = nodeKey(p);
        if (pk === k) continue;
        const ek = `${pk}||${k}`;
        const e = edges.get(ek) || { a: pk, b: k, weight: 0 };
        e.weight++;
        edges.set(ek, e);
      }
    }

    // Cap to MAX_NODES by count
    let nodeArr = Array.from(nodes.values()).sort((a, b) => b.count - a.count).slice(0, MAX_NODES);
    const keep = new Set(nodeArr.map((n) => n.key));
    // FIX: filter edges BEFORE computing degrees so orphan edges aren't counted
    const edgeArr = Array.from(edges.values()).filter((e) => keep.has(e.a) && keep.has(e.b));
    for (const e of edgeArr) {
      const a = nodes.get(e.a); const b = nodes.get(e.b);
      if (a) a.degree++;
      if (b) b.degree++;
    }
    return { nodes: nodeArr, edges: edgeArr };
  }

  function hashColor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  function layout(graph, w, h) {
    const N = graph.nodes.length;
    if (!N) return [];
    const area = w * h;
    const k = Math.sqrt(area / N);
    const pos = graph.nodes.map(() => ({ x: Math.random() * w, y: Math.random() * h, dx: 0, dy: 0 }));
    const idx = new Map(graph.nodes.map((n, i) => [n.key, i]));
    let t = w / 10;
    const cool = t / ITER;
    const EPSILON = 0.5;

    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < N; i++) { pos[i].dx = 0; pos[i].dy = 0; }
      // repulsion
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pos[i].x - pos[j].x;
          const dy = pos[i].y - pos[j].y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = (k * k) / d2;
          const fx = dx * f, fy = dy * f;
          pos[i].dx += fx; pos[i].dy += fy;
          pos[j].dx -= fx; pos[j].dy -= fy;
        }
      }
      // attraction
      for (const e of graph.edges) {
        const i = idx.get(e.a), j = idx.get(e.b);
        if (i == null || j == null) continue;
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = (d * d) / k;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        pos[i].dx -= fx; pos[i].dy -= fy;
        pos[j].dx += fx; pos[j].dy += fy;
      }
      // move + early-exit
      let maxDisp = 0;
      for (let i = 0; i < N; i++) {
        const d = Math.sqrt(pos[i].dx * pos[i].dx + pos[i].dy * pos[i].dy) + 0.01;
        const disp = Math.min(d, t);
        if (disp > maxDisp) maxDisp = disp;
        pos[i].x += (pos[i].dx / d) * disp;
        pos[i].y += (pos[i].dy / d) * disp;
        pos[i].x = Math.max(20, Math.min(w - 20, pos[i].x));
        pos[i].y = Math.max(20, Math.min(h - 20, pos[i].y));
      }
      t = Math.max(1, t - cool);
      if (maxDisp < EPSILON) break;
    }
    return pos;
  }

  // IMPROVEMENT: build legend HTML for unique hosts
  function buildLegend(nodes) {
    const hosts = [...new Set(nodes.map((n) => n.host))].sort();
    return hosts.map((host) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;opacity:.8;">
        <svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="${hashColor(host)}"/></svg>
        ${S.escapeHtml(host)}
      </span>`
    ).join("");
  }

  function renderGraph(graph, windowMs, mountEl) {
    const W = 720, H = 460;
    mountEl.innerHTML = `<div class="hyper-rb-loading">Calculando layout…</div>`;
    const run = () => {
      const pos = layout(graph, W, H);
      const idx = new Map(graph.nodes.map((n, i) => [n.key, i]));
      const maxW = graph.edges.reduce((m, e) => Math.max(m, e.weight), 1);

      const edgesSvg = graph.edges.map((e) => {
        const a = pos[idx.get(e.a)], b = pos[idx.get(e.b)];
        if (!a || !b) return "";
        const op = 0.2 + 0.6 * (e.weight / maxW);
        return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="rgba(191,0,255,${op.toFixed(2)})" stroke-width="${Math.min(3, 0.5 + e.weight / maxW * 2.5).toFixed(2)}"/>`;
      }).join("");

      // IMPROVEMENT: show labels for top-N nodes
      const topKeys = new Set(
        [...graph.nodes].sort((a, b) => b.count - a.count).slice(0, LABEL_TOP_N).map((n) => n.key)
      );

      const nodesSvg = graph.nodes.map((n, i) => {
        const p = pos[i]; if (!p) return "";
        const r = 4 + Math.min(10, Math.log2(1 + n.count) * 2);
        const c = hashColor(n.host || "?");
        const labelText = `${n.method} ${n.path}`;
        const label = topKeys.has(n.key)
          ? `<text x="${p.x.toFixed(1)}" y="${(p.y - r - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="rgba(230,230,234,0.75)" font-family="ui-monospace,monospace" pointer-events="none">${S.escapeHtml(labelText.length > 24 ? labelText.slice(0, 22) + "…" : labelText)}</text>`
          : "";
        return `<g class="hyper-rb-node" data-key="${S.escapeHtml(n.key)}">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <title>${S.escapeHtml(n.key)} · ${n.count}× · degree ${n.degree}</title>
          ${label}
        </g>`;
      }).join("");

      // IMPROVEMENT: legend
      const legend = buildLegend(graph.nodes);

      mountEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:11px;color:rgba(255,255,255,0.6);">
              ${graph.nodes.length} nós · ${graph.edges.length} arestas · janela ${windowMs}ms
            </span>
            <button id="dg-export-btn" style="padding:5px 10px;background:#3a3a40;color:#e6e6ea;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">Exportar grafo.json</button>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;padding:4px 0;">${legend}</div>
          <div style="background:rgba(18,18,20,0.7);border:1px solid rgba(191,0,255,0.3);border-radius:8px;overflow:hidden;">
            <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;">
              ${edgesSvg}${nodesSvg}
            </svg>
          </div>
        </div>`;

      // IMPROVEMENT: export button
      mountEl.querySelector("#dg-export-btn")?.addEventListener("click", () => {
        const exportData = {
          windowMs,
          nodes: graph.nodes.map((n) => ({ key: n.key, host: n.host, method: n.method, path: n.path, count: n.count, degree: n.degree })),
          edges: graph.edges.map((e) => ({ source: e.a, target: e.b, weight: e.weight })),
        };
        S.downloadBlob("hyper-rb-grafo.json", "application/json", JSON.stringify(exportData, null, 2));
      });
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 500 });
    else setTimeout(run, 0);
  }

  const SCRIPT = {
    id: 4,
    slug: "dep-graph",
    name: "Grafo de Dependências",
    description: "Inferência de dependências entre requests via janela deslizante configurável (2s–30s).",
    icon: "🕸️",
    needsAI: false,
    needsNetwork: false,
    minRequests: 5,

    async run(ctx) {
      if (!ctx.requests || ctx.requests.length < 5) {
        return { ok: false, error: "Capture pelo menos 5 requests antes." };
      }

      // IMPROVEMENT: render with window selector
      return {
        ok: true,
        summary: `${ctx.requests.length} requests · grafo calculado com janela selecionável`,
        render(mountEl) {
          const WINDOWS = [
            { label: "2s", ms: 2000 },
            { label: "5s", ms: 5000 },
            { label: "10s", ms: 10000 },
            { label: "30s", ms: 30000 },
          ];
          let currentWindow = DEFAULT_WINDOW_MS;

          const container = document.createElement("div");
          container.style.cssText = "display:flex;flex-direction:column;gap:10px;";

          const toolbar = document.createElement("div");
          toolbar.style.cssText = "display:flex;gap:8px;align-items:center;";
          toolbar.innerHTML = `<span style="font-size:11px;color:rgba(255,255,255,.6);">Janela:</span>` +
            WINDOWS.map((w) =>
              `<button data-win="${w.ms}" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(191,0,255,${w.ms === currentWindow ? ".6" : ".2"});background:${w.ms === currentWindow ? "rgba(191,0,255,.2)" : "rgba(255,255,255,.04)"};color:#e6e6ea;font-size:11px;font-weight:700;cursor:pointer;">${w.label}</button>`
            ).join("");

          const graphContainer = document.createElement("div");

          container.appendChild(toolbar);
          container.appendChild(graphContainer);
          mountEl.appendChild(container);

          function rebuild(windowMs) {
            currentWindow = windowMs;
            // Update button styles
            toolbar.querySelectorAll("button[data-win]").forEach((btn) => {
              const active = Number(btn.dataset.win) === windowMs;
              btn.style.border = `1px solid rgba(191,0,255,${active ? ".6" : ".2"})`;
              btn.style.background = active ? "rgba(191,0,255,.2)" : "rgba(255,255,255,.04)";
            });
            const graph = buildGraph(ctx.requests, windowMs);
            if (!graph.nodes.length) {
              graphContainer.innerHTML = `<div style="padding:24px;text-align:center;color:rgba(255,255,255,.5);">Sem nós válidos para janela ${windowMs}ms.</div>`;
              return;
            }
            renderGraph(graph, windowMs, graphContainer);
            // Update summary
            const summaryEl = mountEl.closest("[data-script-summary]");
            if (summaryEl) summaryEl.textContent = `${graph.nodes.length} nós · ${graph.edges.length} arestas`;
          }

          toolbar.querySelectorAll("button[data-win]").forEach((btn) => {
            btn.addEventListener("click", () => rebuild(Number(btn.dataset.win)));
          });

          rebuild(currentWindow);
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
