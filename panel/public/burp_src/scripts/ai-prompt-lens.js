// ============================================================
// Hyper RB · Script #17 · ai-prompt-lens  (v2 — Security+)
// Filtra requests de chat/IA, extrai prompts, estima tokens,
// detecta prompt-injection (ampliado), anomalia de volume/lat,
// host blocklist. Análise via IA com PII scrubbing completo.
// ============================================================
(function registerAiPromptLens() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) { console.error("[Hyper RB · ai-prompt-lens] HYPER_RB_SHARED ausente"); return; }

  const AI_PATH_RE = /(chat|completions?|messages?|generate|prompt|ai|llm|composer)/i;
  const AI_HOST_RE = /(lovable\.dev|supabase\.co|openai|anthropic|groq|gemini|googleapis)/i;

  // ── Prompt Injection Detection (ampliado v2) ────────────────────
  const INJECTION_PATTERNS = [
    // --- Classic overrides ---
    { re: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|directives?)/i, label: "ignore-previous",    risk: "alto"  },
    { re: /\bforget\s+(all\s+)?(previous|what|your)\b/i,                                             label: "forget",             risk: "alto"  },
    { re: /\b(you are|act as|pretend|roleplay|simulate)\b.{0,60}\b(jailbreak|DAN|evil|no\s+filter)/i,label: "role-jailbreak",     risk: "alto"  },
    { re: /\bdo\s+not\s+(follow|obey|comply|adhere)\s+to\b/i,                                        label: "disobey-directive",  risk: "alto"  },
    { re: /bypass\s+(safety|filter|restriction|alignment|guardrail)/i,                               label: "bypass-safety",      risk: "alto"  },
    { re: /output\s+(your\s+)?(system\s+prompt|instructions|training\s+data)/i,                     label: "exfil-sysPrompt",    risk: "alto"  },
    { re: /tell\s+me\s+(your|the)\s+(secret|passw|key|token)/i,                                     label: "secret-extraction",  risk: "alto"  },
    { re: /\bDAN\b|\bDo\s+Anything\s+Now\b/,                                                        label: "DAN",                risk: "alto"  },
    { re: /\bGPT-?4?\s+without\s+restrictions?\b/i,                                                 label: "unrestricted-mode",  risk: "alto"  },
    // --- System tag injections ---
    { re: /\bsystem\s*:/i,                                                                           label: "system-tag",         risk: "médio" },
    { re: /<\s*(system|SYSTEM|SYS)\s*>/,                                                             label: "xml-system-tag",     risk: "médio" },
    { re: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,                                       label: "special-tokens",     risk: "médio" },
    // --- Exfiltration patterns ---
    { re: /\brepeat\s+(after\s+me|the\s+above|everything)\b/i,                                     label: "repeat-exfil",       risk: "médio" },
    { re: /\btranslate\s+.*\bprevious\s+(prompt|instruction)/i,                                    label: "translate-exfil",    risk: "médio" },
    { re: /```(prompt|injection|jailbreak)/i,                                                       label: "code-injection-tag", risk: "médio" },
    // --- Indirect / tool-call injection (v2 NEW) ---
    { re: /https?:\/\/(webhook\.site|requestbin|canarytokens|ngrok|pipedream|hookbin|interactsh|oastify|burpcollaborator)/i, label: "exfil-url",        risk: "alto"  },
    { re: /\b(curl|wget|fetch|import\s+urllib|requests\.get)\b.{0,80}http/i,                       label: "tool-exfil",         risk: "alto"  },
    { re: /\bsend\s+(the|this|your).{0,40}\b(to|via)\b.{0,40}http/i,                              label: "data-exfil-http",    risk: "alto"  },
    // --- Base64-encoded bypass (v2 NEW) ---
    { re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/,                                                         label: "base64-payload",     risk: "médio" },
    // --- Unicode homoglyph bypass (v2 NEW) ---
    { re: /[\u0430\u0435\u043e\u0440\u0441\u0443\u0445]{3,}/,                                     label: "homoglyph-cyrillic", risk: "médio" },
    // --- Markdown exfiltration (v2 NEW) ---
    { re: /!\[.*\]\(https?:\/\/[^)]{10,}\)/,                                                       label: "md-img-exfil",       risk: "alto"  },
    { re: /\[.*\]\(javascript:/i,                                                                  label: "md-js-link",         risk: "alto"  },
    // --- Multi-language override triggers (v2 NEW) ---
    { re: /(ignora|ignorez|ignoriere|ignorer)\s+(les?\s+)?(instructions?|règles?|regeln)/i,        label: "multilang-override", risk: "médio" },
    // --- Prompt leakage via XML/HTML comment (v2 NEW) ---
    { re: /<!--[\s\S]{0,200}(instructions?|system|prompt)[\s\S]{0,200}-->/i,                      label: "html-comment-inj",   risk: "médio" },
    // --- Excessive system context manip (v2 NEW) ---
    { re: /\bnew\s+conversation\b|\breset\s+(context|memory|session)\b/i,                         label: "context-reset",      risk: "médio" },
  ];

  const RISK_ORDER = { "alto": 2, "médio": 1, "baixo": 0 };

  function detectInjection(text) {
    if (!text || typeof text !== "string") return [];
    const findings = [];
    const seen = new Set();
    for (const p of INJECTION_PATTERNS) {
      if (p.re.test(text) && !seen.has(p.label)) {
        findings.push({ label: p.label, risk: p.risk });
        seen.add(p.label);
      }
    }
    return findings;
  }

  function maxRisk(findings) {
    if (!findings.length) return null;
    return findings.reduce((best, f) => RISK_ORDER[f.risk] > RISK_ORDER[best.risk] ? f : best, findings[0]).risk;
  }

  function isAiRequest(r) {
    const host = r.host || "";
    const path = r.pathname || "";
    if (!host && !path) return false;
    // Block known exfil hosts from analysis
    if (S.isHostBlocked && S.isHostBlocked(host)) return false;
    return AI_HOST_RE.test(host) && AI_PATH_RE.test(path);
  }

  function extractPrompt(body) {
    if (!body) return "";
    let obj = body;
    if (typeof body === "string") {
      try { obj = JSON.parse(body); } catch { return body.slice(0, 500); }
    }
    if (!obj || typeof obj !== "object") return "";
    const keys = ["mensagem", "message", "prompt", "input", "query", "text", "content"];
    for (const k of keys) {
      if (typeof obj[k] === "string" && obj[k].trim()) return obj[k];
    }
    if (Array.isArray(obj.messages)) {
      return obj.messages.map((m) => (typeof m === "string" ? m : m?.content || "")).filter(Boolean).join("\n");
    }
    if (Array.isArray(obj.contents)) {
      return obj.contents.map((c) => c?.parts?.map?.((p) => p?.text).join(" ") || "").filter(Boolean).join("\n");
    }
    return "";
  }

  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  function truncate(s, n) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function extractResponseSnippet(r) {
    const body = r.resBody || "";
    if (!body) return "";
    if (typeof body === "string") return truncate(body, 200);
    try { return truncate(JSON.stringify(body), 200); } catch { return ""; }
  }

  // Full PII scrub before any AI egress
  function sanitizeForAI(text, maxLen) {
    const max = maxLen || 240;
    if (!text) return "";
    return (S.scrubPII ? S.scrubPII(text) : text).slice(0, max);
  }

  function callWithTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "timeout" }), ms)),
    ]);
  }

  // ── Volume/Latency Anomaly Detector ────────────────────────────
  function detectAnomalies(rows) {
    const alerts = [];
    if (!rows.length) return alerts;

    // Volume spike: >5 requests to same endpoint in <60s
    const endpointMap = new Map();
    for (const r of rows) {
      const ep = r.endpoint;
      if (!endpointMap.has(ep)) endpointMap.set(ep, []);
      endpointMap.get(ep).push(r.when);
    }
    for (const [ep, times] of endpointMap.entries()) {
      const sorted = times.filter(Boolean).sort((a, b) => a - b);
      if (sorted.length >= 5) {
        const windowMs = sorted[sorted.length - 1] - sorted[0];
        if (windowMs > 0 && windowMs < 60000) {
          alerts.push({ type: "volume-spike", endpoint: ep, count: sorted.length, windowSec: Math.round(windowMs / 1000) });
        }
      }
    }

    // Token exhaustion: single request >8000 estimated tokens
    for (const r of rows) {
      if (r.tokens > 8000) alerts.push({ type: "token-exhaustion", endpoint: r.endpoint, tokens: r.tokens });
    }

    // High injection density: >30% of requests flagged
    const injRatio = rows.filter((r) => r.injections.length > 0).length / rows.length;
    if (injRatio > 0.3 && rows.length >= 3) {
      alerts.push({ type: "high-injection-density", ratio: Math.round(injRatio * 100) });
    }

    return alerts;
  }

  const SCRIPT = {
    id: 17,
    slug: "ai-prompt-lens",
    name: "AI Prompt Lens",
    description: "Filtra requests de IA, extrai prompts, detecta prompt-injection (v2), anomalias de volume, host blocklist.",
    icon: "🔍",
    needsAI: true,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const aiReqs = (ctx.requests || []).filter(isAiRequest);
      if (!aiReqs.length) {
        return {
          ok: true,
          summary: "Nenhuma request de IA detectada.",
          render(mountEl) {
            mountEl.innerHTML = `<div style="color:rgba(255,255,255,.5);font-style:italic;padding:12px;">Nenhuma request para endpoints de chat/IA foi capturada.</div>`;
          },
        };
      }

      const rows = aiReqs.map((r) => {
        const prompt = extractPrompt(r.reqBody);
        const tokens = estimateTokens(prompt);
        const injections = detectInjection(prompt);
        const injRisk = maxRisk(injections);
        return {
          id: r.id,
          when: r.ts || 0,
          endpoint: `${r.method} ${r.host}${r.pathname}`,
          prompt,
          tokens,
          status: r.status || 0,
          response: extractResponseSnippet(r),
          injections,
          injRisk,
        };
      }).sort((a, b) => {
        const ra = RISK_ORDER[a.injRisk] || 0;
        const rb = RISK_ORDER[b.injRisk] || 0;
        if (rb !== ra) return rb - ra;
        return b.tokens - a.tokens;
      });

      const totalTokens = rows.reduce((s, r) => s + r.tokens, 0);
      const injectionCount = rows.filter((r) => r.injections.length > 0).length;
      const anomalies = detectAnomalies(rows);

      return {
        ok: true,
        summary: `${rows.length} requests de IA · ~${totalTokens} tokens · ${injectionCount} suspeita(s) · ${anomalies.length} anomalia(s)`,
        render(mountEl) {
          const anomalyHtml = anomalies.length ? `
            <div style="background:rgba(255,60,60,.08);border:1px solid rgba(255,60,60,.25);border-radius:8px;padding:8px 12px;font-size:11px;display:flex;flex-direction:column;gap:4px;">
              <strong style="color:#ff9aac;">⚠ ${anomalies.length} anomalia(s) detectada(s):</strong>
              ${anomalies.map((a) => {
                if (a.type === "volume-spike") return `<span>📈 Volume spike: <code>${S.escapeHtml(a.endpoint)}</code> — ${a.count}× em ${a.windowSec}s</span>`;
                if (a.type === "token-exhaustion") return `<span>🪙 Token exhaustion: <code>${S.escapeHtml(a.endpoint)}</code> — ~${a.tokens} tokens</span>`;
                if (a.type === "high-injection-density") return `<span>💉 Alta densidade de injection: ${a.ratio}% das requests suspeitas</span>`;
                return "";
              }).join("")}
            </div>` : "";

          mountEl.innerHTML = `
            <div class="hyper-rb-apl">
              <div class="apl-summary">
                <strong>${rows.length}</strong> requests de IA ·
                <strong>~${totalTokens.toLocaleString()}</strong> tokens estimados
                ${injectionCount > 0 ? `· <span style="color:#ff9aac;font-weight:700;">⚠ ${injectionCount} suspeita(s) de prompt injection</span>` : ""}
                <select class="apl-risk-filter" title="Filtrar por risco"><option value="all">Todos os riscos</option><option value="alto">⚠ Alto</option><option value="médio">Médio</option><option value="none">Limpos</option></select>
                <button class="apl-analyze" type="button">Analisar com IA</button>
              </div>
              ${anomalyHtml}
              <div class="apl-ai-out"></div>
              <table class="apl-table">
                <thead><tr><th>Endpoint</th><th>Prompt</th><th>Tokens</th><th>Status</th><th>Injection?</th></tr></thead>
                <tbody>
                  ${rows.map((r) => {
                    const riskColor = r.injRisk === "alto" ? "#ff6b6b" : r.injRisk === "médio" ? "#ffd27f" : "";
                    const riskBadge = r.injections.length > 0
                      ? `<span style="background:rgba(255,80,80,.12);color:${riskColor};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid rgba(255,80,80,.2);">${r.injRisk?.toUpperCase()} · ${r.injections.map((i) => i.label).slice(0, 3).join(", ")}</span>`
                      : `<span style="color:rgba(255,255,255,.3);font-size:10px;">—</span>`;
                    return `
                      <tr data-risk="${r.injRisk || 'none'}" ${r.injRisk === "alto" ? 'style="background:rgba(255,60,60,.04);"' : ""}>
                        <td><code>${S.escapeHtml(truncate(r.endpoint, 60))}</code></td>
                        <td class="apl-prompt"><span>${S.escapeHtml(truncate(r.prompt, 180))}</span><button class="apl-copy-prompt" data-prompt="${S.escapeHtml(r.prompt)}" title="Copiar prompt" style="margin-left:4px;background:none;border:none;cursor:pointer;opacity:.5;font-size:10px;">📋</button></td>
                        <td class="apl-num">${r.tokens}</td>
                        <td class="apl-num">${S.escapeHtml(String(r.status))}</td>
                        <td>${riskBadge}</td>
                      </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
            <style>
              .hyper-rb-apl{display:flex;flex-direction:column;gap:10px;font-size:12px;}
              .apl-summary{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:rgba(191,0,255,.08);border:1px solid rgba(191,0,255,.25);border-radius:8px;padding:8px 12px;color:#fff;}
              .apl-summary button{margin-left:auto;background:rgba(191,0,255,.2);color:#fff;border:1px solid rgba(191,0,255,.4);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;}
              .apl-summary button:hover:not(:disabled){background:rgba(191,0,255,.35);}
              .apl-summary button:disabled{opacity:.5;cursor:not-allowed;}
              .apl-ai-out{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;color:#fff;min-height:0;max-height:280px;overflow:auto;display:none;line-height:1.5;}
              .apl-ai-out.show{display:block;}
              .apl-table{width:100%;border-collapse:collapse;background:rgba(0,0,0,.3);border-radius:8px;overflow:hidden;}
              .apl-table th,.apl-table td{padding:6px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);color:#fff;vertical-align:top;}
              .apl-table th{background:rgba(191,0,255,.15);font-weight:600;}
              .apl-table code{font-family:monospace;font-size:11px;color:#bf00ff;}
              .apl-prompt{max-width:240px;word-break:break-word;white-space:pre-wrap;}
              .apl-num{text-align:right;font-variant-numeric:tabular-nums;}
              .apl-risk-filter{background:rgba(18,18,20,.8);color:#fff;border:1px solid rgba(191,0,255,.3);padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer;}
            </style>
          `;

          const btn = mountEl.querySelector(".apl-analyze");
          const out = mountEl.querySelector(".apl-ai-out");

          // Improvement: risk filter
          const riskFilter = mountEl.querySelector(".apl-risk-filter");
          if (riskFilter) {
            riskFilter.addEventListener("change", () => {
              const val = riskFilter.value;
              mountEl.querySelectorAll(".apl-table tbody tr[data-risk]").forEach((row) => {
                const r = row.getAttribute("data-risk") || "none";
                row.style.display = (val === "all" || r === val) ? "" : "none";
              });
            });
          }
          // Improvement: copy individual prompt
          mountEl.querySelector(".apl-table")?.addEventListener("click", (e) => {
            const cpBtn = e.target.closest(".apl-copy-prompt");
            if (!cpBtn) return;
            const txt = cpBtn.getAttribute("data-prompt") || "";
            if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).catch(() => {});
            else { const ta = Object.assign(document.createElement("textarea"),{value:txt,style:"position:fixed;opacity:0"}); document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
            const orig = cpBtn.textContent; cpBtn.textContent = "✓"; setTimeout(()=>{ cpBtn.textContent = orig; }, 1200);
          });

          btn.addEventListener("click", async () => {
            btn.disabled = true;
            out.classList.add("show");
            out.textContent = "Consultando IA…";

            // Full PII scrub before egress — never send raw prompts
            const aggregate = rows.slice(0, 25).map((r) => ({
              endpoint: r.endpoint,
              tokens: r.tokens,
              status: r.status,
              prompt_snippet: sanitizeForAI(r.prompt, 240),
              injection_risk: r.injRisk || "none",
              injection_patterns: r.injections.map((i) => i.label),
            }));

            try {
              const res = await callWithTimeout(
                ctx.callAI("analyze_network_traffic", {
                  focus: "ai_prompt_optimization",
                  total_requests: rows.length,
                  total_tokens_estimated: totalTokens,
                  injection_suspects: injectionCount,
                  anomalies: anomalies.length,
                  samples: aggregate,
                }),
                25000
              );
              if (!res.ok) {
                const code = res.error_code ? ` [${res.error_code}]` : "";
                out.innerHTML = `<span style="color:#ff5577;">Falha na IA${S.escapeHtml(code)}: ${S.escapeHtml(res.error || "erro")}</span>`;
                return;
              }
              const text = typeof res.data === "string"
                ? res.data
                : (res.data?.markdown || res.data?.content || JSON.stringify(res.data, null, 2));
              out.innerHTML = S.escapeHtml(text).replace(/\n/g, "<br/>");
            } catch (e) {
              out.innerHTML = `<span style="color:#ff5577;">Erro: ${S.escapeHtml(String(e?.message || e))}</span>`;
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
