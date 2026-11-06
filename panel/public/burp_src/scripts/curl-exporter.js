// ============================================================
// Hyper RB · Scripts · #13 curl-exporter
// Exporta requests sanitizadas como comandos `curl` (bash).
// Sem IA, sem rede. Headers sanitizados, body via --data-raw.
// ============================================================
(function registerScript() {
  "use strict";
  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · curl-exporter] HYPER_RB_SHARED ausente"); return; }

  // bash single-quote escape: ' -> '\''
  // Also strips null bytes (\x00) that break bash strings.
  function shq(v) {
    const safe = String(v ?? "").replace(/\x00/g, "");
    return "'" + safe.replace(/'/g, "'\\''") + "'";
  }

  // Returns true if the string contains non-printable / binary characters
  // that would be unsafe inside a bash single-quoted --data-raw argument.
  function looksLikeBinary(str) {
    if (typeof str !== "string") return false;
    // Allow tab, newline, carriage-return; flag anything else below 0x20 or DEL (0x7F)
    return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str);
  }

  function toCurl(req) {
    if (!req || !req.url) return null;
    const lines = [];
    const method = String(req.method || "GET").toUpperCase();

    // -s (silent) + -L (follow redirects) + --compressed (accept gzip/br) are sane defaults
    lines.push(`curl -s -L --compressed -X ${method} ${shq(req.url)}`);

    const h = req.reqHeaders || {};
    for (const [k, v] of Object.entries(h)) {
      if (v == null) continue;
      lines.push(`  -H ${shq(`${k}: ${v}`)}`);
    }

    const hasBody = req.reqBody != null && req.reqBody !== "";
    const skipBodyMethods = method === "GET" || method === "HEAD";

    if (hasBody && !skipBodyMethods) {
      if (S.isBinaryContentType(h)) {
        lines.push(`  # body binário omitido (use --data-binary @arquivo)`);
      } else if (looksLikeBinary(req.reqBody)) {
        lines.push(`  # body contém bytes não-printáveis — omitido (use --data-binary @arquivo)`);
      } else {
        // For application/x-www-form-urlencoded, use --data-urlencode per field for readability.
        const ct = String(h["content-type"] || h["Content-Type"] || "").split(";")[0].trim().toLowerCase();
        if (ct === "application/x-www-form-urlencoded") {
          const parsed = S.parseBody(req.reqBody, ct);
          if (parsed.type === "form" && parsed.params && parsed.params.length > 0) {
            for (const { name, value } of parsed.params) {
              lines.push(`  --data-urlencode ${shq(`${name}=${value}`)}`);
            }
          } else {
            lines.push(`  --data-raw ${shq(req.reqBody)}`);
          }
        } else {
          lines.push(`  --data-raw ${shq(req.reqBody)}`);
        }
      }
    }

    return lines.join(" \\\n");
  }

  function buildScript(requests) {
    const ts = new Date().toISOString();
    const blocks = [];
    let ok = 0;
    for (const r of requests) {
      const c = toCurl(r);
      if (!c) continue;
      const label = `# [${ok + 1}] ${r.method} ${r.host || ""}${r.pathname || ""}`;
      blocks.push(`${label}\n${c}`);
      ok++;
    }
    const header = `#!/usr/bin/env bash
# Hyper RB · curl-exporter
# Generated: ${ts}
# Total: ${ok} request(s)
# Headers/bodies sanitizados (JWT/tokens redacted).
# Flags: -s (silent) -L (follow redirects) --compressed (gzip/br)
set -euo pipefail

`;
    return { script: header + blocks.join("\n\n") + "\n", count: ok };
  }

  const SCRIPT = {
    id: 20,
    slug: "curl-exporter",
    name: "cURL Exporter",
    description: "Exporta requests capturadas como comandos curl (.sh) sanitizados.",
    icon: "🌀",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      if (!ctx.requests.length) {
        return { ok: false, error: "Capture pelo menos 1 request antes." };
      }

      const { script, count } = buildScript(ctx.requests);
      const filename = `hyper-rb-curl-${Date.now()}.sh`;

      return {
        ok: true,
        summary: `${count} comando(s) curl gerado(s)`,
        artifact: { filename, mime: "text/x-shellscript", content: script },
        render(mountEl) {
          const preview = script.length > 4000 ? script.slice(0, 4000) + "\n…(truncado)" : script;

          mountEl.innerHTML = `
            <div class="hyper-rb-section">
              <div class="hyper-rb-section-head">
                <div>
                  <div class="hyper-rb-section-title">cURL Exporter</div>
                  <div class="hyper-rb-section-sub">
                    ${S.escapeHtml(count)} request(s) convertida(s) em curl.
                    Headers sensíveis redacted. Bodies binários/não-printáveis omitidos.
                    Flags: <code>-s -L --compressed</code> incluídas.
                  </div>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="hyper-rb-btn copy-curl">📋 Copiar</button>
                  <button class="hyper-rb-btn hyper-rb-btn-primary dl-curl">⬇ Baixar .sh</button>
                </div>
              </div>
              <pre class="hyper-rb-pre" style="max-height:480px;overflow:auto"><code>${S.escapeHtml(preview)}</code></pre>
            </div>
          `;

          mountEl.querySelector(".dl-curl")?.addEventListener("click", () => {
            S.downloadBlob(filename, "text/x-shellscript", script);
          });
          mountEl.querySelector(".copy-curl")?.addEventListener("click", async () => {
            const btn = mountEl.querySelector(".copy-curl");
            const orig = btn ? btn.textContent : "";
            const ok = await S.copyToClipboard(script);
            if (btn) {
              btn.textContent = ok ? "✓ Copiado" : "✗ Falhou";
              setTimeout(() => { btn.textContent = orig; }, 1500);
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();
