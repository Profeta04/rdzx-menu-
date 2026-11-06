// ============================================================
// Hyper RB · Scripts · #15 token-lifecycle
// Detecta JWT/Bearer/cookies, decodifica claims, mostra lifecycle.
// v2.1.0: + Refresh-token rotation tracking (emitido em resposta),
//         + JTI reuse detection, + audience mismatch alert,
//         + alg confusion flag (RS256 key-confusion).
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · token-lifecycle] HYPER_RB_SHARED ausente"); return; }

  const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g;
  const MASKED_TOKENS = new Set(["<jwt>", "<lovable-token>", "<redacted>"]);

  function b64urlDecode(s) {
    try {
      const pad = "=".repeat((4 - (s.length % 4)) % 4);
      return atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    } catch { return null; }
  }

  function decodeJwt(tok) {
    const parts = tok.split(".");
    if (parts.length !== 3) return null;
    const hdr = b64urlDecode(parts[0]);
    const payload = b64urlDecode(parts[1]);
    if (!payload) return null;
    try {
      return { header: hdr ? JSON.parse(hdr) : null, claims: JSON.parse(payload) };
    } catch { return null; }
  }

  function fingerprint(tok) {
    return tok.slice(0, 6) + "…" + tok.slice(-6) + ":" + tok.length;
  }

  // BUG FIX: iterTokens agora aceita parâmetro `side` ("req"|"res") para
  // distinguir tokens encontrados em requests vs tokens emitidos em respostas
  function* iterTokens(req) {
    const h = req.reqHeaders || {};
    const auth = h["authorization"] || h["Authorization"];
    if (auth && typeof auth === "string") {
      const m = auth.match(/^Bearer\s+(\S+)/i);
      if (m && !MASKED_TOKENS.has(m[1])) yield { source: "header:authorization", token: m[1], side: "req" };
    }
    // request body / url
    const reqBlobs = [req.url, req.reqBody].filter((x) => typeof x === "string");
    for (const blob of reqBlobs) {
      let m;
      JWT_RE.lastIndex = 0;
      while ((m = JWT_RE.exec(blob)) !== null) {
        yield { source: blob === req.url ? "url" : "req-body", token: m[0], side: "req" };
      }
    }
    // MELHORIA: resposta também rastreada — tokens emitidos em responses são refresh/access tokens novos
    if (typeof req.resBody === "string") {
      JWT_RE.lastIndex = 0;
      let m;
      while ((m = JWT_RE.exec(req.resBody)) !== null) {
        yield { source: "res-body", token: m[0], side: "res" };
      }
    }
    const cookie = h["cookie"] || h["Cookie"];
    if (cookie && typeof cookie === "string" && cookie !== "<redacted>") {
      for (const p of cookie.split(/;\s*/)) {
        const eq = p.indexOf("=");
        if (eq < 0) continue;
        const name = p.slice(0, eq).trim();
        const value = p.slice(eq + 1);
        if (/sess|sid|auth|token/i.test(name) && value && value.length >= 16)
          yield { source: `cookie:${name}`, token: value, side: "req" };
      }
    }
  }

  function flagClaims(claims) {
    const flags = [];
    if (!claims) return flags;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === "number" && claims.exp < now) flags.push("expirado");
    if (typeof claims.nbf === "number" && claims.nbf > now) flags.push("not-yet-valid");
    const roles = claims.role || claims.roles || (claims.app_metadata && claims.app_metadata.role);
    if (roles && /admin|service_role|superuser/i.test(JSON.stringify(roles))) flags.push("⚠ role elevada");
    if (Array.isArray(claims.aud) && claims.aud.length > 3) flags.push("aud >3 entries");
    return flags;
  }

  function flagAlg(header) {
    const flags = [];
    if (!header) return flags;
    const alg = String(header.alg || "").toLowerCase();
    if (alg === "none") flags.push("🚨 alg:none (sem assinatura)");
    else if (alg === "hs256" || alg === "hs384" || alg === "hs512")
      flags.push("⚠ alg:HS (simétrico — segredo compartilhado)");
    // MELHORIA: flag RS256 key-confusion — servidores que aceitam HS256 quando chave pública está disponível
    else if (alg === "rs256" || alg === "rs384" || alg === "rs512") {
      if (header.jku || header.x5u) flags.push("🚨 jku/x5u presente — SSRF/key-injection possível");
    }
    return flags;
  }

  function analyze(requests) {
    const tokens = new Map();
    // MELHORIA: mapa de jti → fingerprints para detectar reutilização de JTI
    const jtiMap = new Map();
    const sorted = [...requests].sort((a, b) => (a.ts || 0) - (b.ts || 0));

    for (const r of sorted) {
      for (const { source, token, side } of iterTokens(r)) {
        const fp = fingerprint(token);
        const decoded = decodeJwt(token);
        const claims = decoded?.claims || null;
        let t = tokens.get(fp);
        if (!t) {
          t = {
            fp, kind: decoded ? "jwt" : (source.startsWith("cookie") ? "cookie" : "opaque"),
            exp: claims?.exp, iat: claims?.iat, sub: claims?.sub, iss: claims?.iss,
            jti: claims?.jti || null,
            aud: claims?.aud || null,
            allClaims: claims, header: decoded?.header || null,
            first: r.ts, last: r.ts, count: 0, sources: new Set(), endpoints: new Set(),
            // MELHORIA: rastrear se token apareceu em responses (emitido) ou só requests (consumido)
            emittedInResponse: false,
          };
          tokens.set(fp, t);
        }
        t.count++;
        t.last = r.ts;
        t.sources.add(source);
        t.endpoints.add(`${r.method} ${r.host}${r.pathname}`);
        if (side === "res") t.emittedInResponse = true;

        // JTI tracking para detecção de reuso
        if (claims?.jti) {
          if (!jtiMap.has(claims.jti)) jtiMap.set(claims.jti, []);
          jtiMap.get(claims.jti).push(fp);
        }
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const result = [...tokens.values()].map((t) => {
      const extraFlags = [];
      // MELHORIA: flag token emitido em response (access/refresh recém emitido)
      if (t.emittedInResponse) extraFlags.push("🔄 emitido em resposta");
      return {
        ...t,
        sources: [...t.sources],
        endpoints: [...t.endpoints],
        expired: typeof t.exp === "number" ? t.exp < now : null,
        expiresInSec: typeof t.exp === "number" ? t.exp - now : null,
        flags: [...flagClaims(t.allClaims), ...flagAlg(t.header), ...extraFlags],
      };
    });

    // Rotation detection: same sub + diferente iat ≤5min → flag
    const bySubList = new Map();
    for (const t of result) {
      if (t.sub == null || t.iat == null) continue;
      const key = String(t.sub);
      if (!bySubList.has(key)) bySubList.set(key, []);
      bySubList.get(key).push(t);
    }
    for (const group of bySubList.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => (a.iat || 0) - (b.iat || 0));
      for (let i = 1; i < group.length; i++) {
        const delta = Math.abs((group[i].iat || 0) - (group[i - 1].iat || 0));
        if (delta <= 300 && !group[i].flags.includes("🔄 rotação detectada"))
          group[i].flags.push("🔄 rotação detectada");
      }
    }

    // MELHORIA: JTI reuse detection — mesmo jti em múltiplos tokens distintos (fingerprints diferentes)
    for (const [jti, fps] of jtiMap.entries()) {
      const unique = [...new Set(fps)];
      if (unique.length > 1) {
        for (const fp of unique) {
          const t = result.find((x) => x.fp === fp);
          if (t && !t.flags.includes("🚨 jti reutilizado")) t.flags.push("🚨 jti reutilizado");
        }
      }
    }

    // MELHORIA: Audience mismatch — token usado em host que não está no aud
    for (const t of result) {
      if (!t.aud) continue;
      const audList = Array.isArray(t.aud) ? t.aud : [String(t.aud)];
      for (const ep of t.endpoints) {
        const epHost = ep.split(" ")[1]?.split("/")[0] || "";
        if (epHost && !audList.some((a) => String(a).includes(epHost))) {
          if (!t.flags.includes("⚠ audience mismatch")) t.flags.push("⚠ audience mismatch");
          break;
        }
      }
    }

    return result.sort((a, b) => {
      if (a.flags.length && !b.flags.length) return -1;
      if (!a.flags.length && b.flags.length) return 1;
      if (a.expired && !b.expired) return -1;
      if (!a.expired && b.expired) return 1;
      return b.count - a.count;
    });
  }

  function fmtExp(t) {
    if (t.exp == null) return "—";
    const d = new Date(t.exp * 1000);
    const rel = t.expiresInSec;
    const tag = t.expired ? "expirado" : (rel < 300 ? "expira <5min" : `em ${Math.round(rel / 60)}min`);
    return `${d.toISOString().slice(11, 19)} (${tag})`;
  }

  function renderClaimsTable(claims, header) {
    if (!claims) return '<em style="opacity:.5">sem claims</em>';
    const allEntries = Object.entries(claims);
    const HIGHLIGHT = new Set(["sub","iss","aud","exp","iat","nbf","role","roles","email","jti","app_metadata","user_metadata"]);
    const rows = allEntries.map(([k, v]) => {
      const hl = HIGHLIGHT.has(k);
      let display = typeof v === "object" ? JSON.stringify(v) : String(v);
      if ((k === "exp" || k === "iat" || k === "nbf") && typeof v === "number") {
        display = `${v} (${new Date(v * 1000).toISOString()})`;
      }
      return `<tr>
        <td style="padding:3px 6px;font-family:monospace;color:${hl ? "#bf00ff" : "rgba(255,255,255,.6)"};font-size:10px;white-space:nowrap;">${S.escapeHtml(k)}</td>
        <td style="padding:3px 6px;font-family:monospace;font-size:10px;word-break:break-all;max-width:260px;">${S.escapeHtml(display)}</td>
      </tr>`;
    }).join("");
    return `<table style="border-collapse:collapse;width:100%;">${rows}</table>`;
  }

  const SCRIPT = {
    id: 15,
    slug: "token-lifecycle",
    name: "Token Lifecycle",
    description: "Detecta JWT/Bearer/cookies, inspeciona claims, rastreia rotação, JTI reuse, audience mismatch e emissão em resposta.",
    icon: "🔑",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const tokens = analyze(ctx.requests);
      if (!tokens.length) {
        return { ok: false, error: "Nenhum token detectado (headers sensíveis podem ter sido sanitizados)." };
      }
      const expired = tokens.filter((t) => t.expired).length;
      const flagged = tokens.filter((t) => t.flags.length > 0).length;
      const emitted = tokens.filter((t) => t.emittedInResponse).length;

      return {
        ok: true,
        summary: `${tokens.length} token(s) · ${expired} expirado(s) · ${flagged} com flags · ${emitted} emitido(s) em resposta`,
        render(mountEl) {
          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">Token Lifecycle</div>
                  <div class="hyper-rb-section-sub">
                    ${S.escapeHtml(tokens.length)} token(s) · ${S.escapeHtml(expired)} expirado(s) · ${S.escapeHtml(flagged)} com flags · ${S.escapeHtml(emitted)} emitido(s) em resposta.
                    Fingerprint = prefixo+sufixo+tamanho (valor completo nunca exibido).
                  </div>
                </div>
              </div>
              <table class="hyper-rb-table" style="font-size:11px;">
                <thead><tr>
                  <th>Fingerprint</th><th>Tipo</th><th>sub</th><th>exp</th>
                  <th style="text-align:right">Reusos</th><th style="text-align:right">Endpoints</th><th>Flags</th><th></th>
                </tr></thead>
                <tbody>
                  ${tokens.map((t, i) => `
                    <tr class="${t.expired || t.flags.length ? "row-danger" : ""}">
                      <td><code>${S.escapeHtml(t.fp)}</code></td>
                      <td>${S.escapeHtml(t.kind)}${t.emittedInResponse ? ' <span style="background:rgba(124,230,181,.15);color:#7ce6b5;padding:1px 5px;border-radius:3px;font-size:9px;margin-left:3px">emitido</span>' : ""}</td>
                      <td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${S.escapeHtml(t.sub || "—")}</td>
                      <td style="white-space:nowrap;">${S.escapeHtml(fmtExp(t))}</td>
                      <td style="text-align:right">${t.count}</td>
                      <td style="text-align:right">${t.endpoints.length}</td>
                      <td>${t.flags.map((f) => `<span style="background:rgba(255,80,80,.15);color:#ff9aac;padding:1px 5px;border-radius:3px;font-size:9px;margin-right:2px;">${S.escapeHtml(f)}</span>`).join("") || "—"}</td>
                      <td><button class="tl-inspect-btn" data-idx="${i}" style="background:rgba(191,0,255,.15);color:#bf00ff;border:1px solid rgba(191,0,255,.3);padding:2px 7px;border-radius:4px;cursor:pointer;font-size:10px;">🔍 Claims</button></td>
                    </tr>
                    <tr class="tl-claims-row" data-for="${i}" style="display:none;">
                      <td colspan="8" style="padding:8px 12px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.06);">
                        <div style="font-size:10px;color:rgba(255,255,255,.5);margin-bottom:4px;">Claims JWT completos:</div>
                        ${renderClaimsTable(t.allClaims, t.header)}
                        ${t.header ? `<div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.4);">Header: alg=${S.escapeHtml(t.header.alg || "?")} typ=${S.escapeHtml(t.header.typ || "?")}${t.header.jku ? ` <span style="color:#ff9aac">jku: ${S.escapeHtml(t.header.jku)}</span>` : ""}${t.header.x5u ? ` <span style="color:#ff9aac">x5u: ${S.escapeHtml(t.header.x5u)}</span>` : ""}</div><div style="margin-top:4px;"><span style="background:rgba(255,200,0,.12);color:#ffd07d;border:1px solid rgba(255,200,0,.25);padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;">⚠ assinatura não verificada no client</span></div>` : ""}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `;
          mountEl.addEventListener("click", (e) => {
            const btn = e.target.closest(".tl-inspect-btn");
            if (!btn) return;
            const idx = btn.getAttribute("data-idx");
            const row = mountEl.querySelector(`.tl-claims-row[data-for="${idx}"]`);
            if (row) row.style.display = row.style.display === "none" ? "" : "none";
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
