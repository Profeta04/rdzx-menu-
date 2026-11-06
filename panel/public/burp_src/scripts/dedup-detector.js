// ============================================================
// Hyper RB · Scripts · #16 dedup-detector
// Detecta requests duplicadas / redundantes (mesmo method+url+body
// num intervalo curto) — sinaliza desperdício de chamadas.
// Sem IA, sem rede.
//
// BUG FIXES (Wave 1 · Agent B):
//   - S.esc() → S.escapeHtml() (S.esc não existe, causava TypeError)
//   - title → name  (registry exige 'name')
//   - run() era síncrono e retornava {html,data} em vez de
//     {ok, summary, render} — incompatível com renderScriptsTab
//   - Timestamps: usava .startedAt (campo raw), mas after sanitize
//     o campo correto é .ts  (epoch ms numérico)
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · dedup-detector] HYPER_RB_SHARED ausente"); return; }

  const WINDOW_MS = 10000; // 10s — requests dentro deste intervalo são candidatas

  function bodyHash(s) {
    if (!s) return "\u2205";
    let h = 0;
    for (let i = 0; i < Math.min(s.length, 4096); i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return String(h >>> 0);
  }

  function keyOf(req) {
    const host = req.host || "";
    // Use pathname normalizada para agrupar /api/project/123 e /api/project/456
    const path = S.normalizePath(req.pathname || req.url || "");
    return `${(req.method || "GET").toUpperCase()} ${host}${path} #${bodyHash(req.reqBody || "")}`;
  }

  function analyze(requests) {
    const groups = new Map();
    for (const r of requests) {
      const k = keyOf(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }

    const dupes = [];
    for (const [k, list] of groups) {
      if (list.length < 2) continue;
      // .ts é o campo epoch-ms produzido por _shared.sanitize()
      list.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      let bursts = 0;
      for (let i = 1; i < list.length; i++) {
        const dt = (list[i].ts || 0) - (list[i - 1].ts || 0);
        if (dt >= 0 && dt <= WINDOW_MS) bursts++;
      }
      const span = (list[list.length - 1].ts || 0) - (list[0].ts || 0);
      dupes.push({
        key: k,
        count: list.length,
        bursts,
        spanMs: span,
        firstTs: list[0].ts,
        lastTs: list[list.length - 1].ts,
        sampleId: list[0].id,
      });
    }

    dupes.sort((a, b) => (b.bursts - a.bursts) || (b.count - a.count));
    return {
      generatedAt: Date.now(),
      totalRequests: requests.length,
      totalGroups: groups.size,
      duplicatedGroups: dupes.length,
      groups: dupes,
    };
  }

  function renderReport(report, mountEl) {
    const esc = S.escapeHtml;
    if (!report.groups.length) {
      mountEl.innerHTML = `
        <div style="padding:24px;text-align:center;color:rgba(255,255,255,.55);font-size:13px;">
          ✅ Nenhuma request duplicada detectada (janela ${WINDOW_MS / 1000}s · ${report.totalRequests} request(s) analisada(s)).
        </div>`;
      return;
    }

    // Top-3 endpoints by burst count
    const top3 = report.groups.slice(0, 3);
    const top3Html = top3.map((g, i) => {
      const medal = ["🥇","🥈","🥉"][i] || "";
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,184,77,${0.06 - i*0.015});border:1px solid rgba(255,184,77,${0.2 - i*0.05});border-radius:8px">
        <span style="font-size:16px">${medal}</span>
        <div style="flex:1;min-width:0">
          <div style="font-family:ui-monospace,monospace;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.85)">${esc(g.key)}</div>
          <div style="font-size:10px;color:rgba(255,184,77,.8);margin-top:2px">${g.count}× total · ${g.bursts} em rajada</div>
        </div>
      </div>`;
    }).join("");

    const rows = report.groups.map((g) => `
      <tr>
        <td style="font-family:ui-monospace,monospace;font-size:10px;word-break:break-all;max-width:320px">${esc(g.key)}</td>
        <td style="text-align:right;font-weight:700">${g.count}</td>
        <td style="text-align:center">${g.bursts > 0
          ? `<span style="background:rgba(255,190,85,.16);color:#ffe6bb;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700">${g.bursts} em rajada</span>`
          : "<span style='opacity:.4'>—</span>"
        }</td>
        <td style="text-align:right;font-family:ui-monospace,monospace;font-size:10px">${(g.spanMs / 1000).toFixed(1)}s</td>
      </tr>
    `).join("");

    mountEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-size:11px;color:rgba(255,255,255,.6)">
            <b style="color:#ffb84d">${esc(report.duplicatedGroups)}</b> grupos duplicados de
            <b>${esc(report.totalGroups)}</b> (${esc(report.totalRequests)} requests · janela ${WINDOW_MS / 1000}s)
          </span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:4px">${top3Html}</div>
        <div style="background:rgba(18,18,20,.7);border:1px solid rgba(255,255,255,.06);border-radius:8px;overflow:auto;max-height:480px">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead style="position:sticky;top:0;background:rgba(0,0,0,.7)">
              <tr style="text-align:left">
                <th style="padding:8px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)">Endpoint + body hash</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)">#</th>
                <th style="padding:8px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)">Rajada</th>
                <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)">Span</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  const SCRIPT = {
    id: 16,
    slug: "dedup-detector",
    name: "Dedup Detector",
    description: "Detecta requests duplicadas/redundantes em janela de 10s e sinaliza rajadas desnecessárias.",
    icon: "\uD83D\uDD04",
    needsAI: false,
    needsNetwork: false,
    minRequests: 2,

    async run(ctx) {
      const requests = (ctx && ctx.requests) || [];
      if (requests.length < 2) {
        return { ok: false, error: "Capture pelo menos 2 requests antes de executar." };
      }
      const report = analyze(requests);
      const summary = report.duplicatedGroups
        ? `${report.duplicatedGroups} grupo(s) duplicado(s) de ${report.totalGroups}`
        : `Sem duplicatas detectadas (${report.totalGroups} grupo(s))`;

      return {
        ok: true,
        summary,
        render(mountEl) {
          renderReport(report, mountEl);
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
