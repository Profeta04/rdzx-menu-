// ============================================================
// Hyper RB \u00b7 Script #19 \u00b7 e2e-decryptor
// Decode JWT/base64 + decrypt AES-GCM/AES-CBC com chaves
// fornecidas pelo usu\u00e1rio. Vault local em chrome.storage.local.
// ZERO egresso de rede. Key material nunca sai do client.
// ============================================================
(function registerE2EDecryptor() {
  "use strict";

  const S = window.HYPER_RB_SHARED;
  if (!S) {
    console.error("[Hyper RB \u00b7 e2e-decryptor] HYPER_RB_SHARED ausente");
    return;
  }

  const VAULT_KEY = "vault_v1";

  // ---- modais inline (substitui alert/confirm bloqueados em extens\u00e3o) ----
  function flashMessage(mountEl, text, kind) {
    let bar = mountEl.querySelector(".e2e-flash");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "e2e-flash";
      bar.setAttribute("role", "status");
      mountEl.prepend(bar);
    }
    bar.dataset.kind = kind || "info";
    bar.textContent = text;
    bar.style.display = "block";
    clearTimeout(bar._t);
    bar._t = setTimeout(() => { bar.style.display = "none"; }, 3500);
  }

  function inlineConfirm(mountEl, text) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "e2e-modal-overlay";
      overlay.innerHTML = `
        <div class="e2e-modal" role="dialog" aria-modal="true">
          <div class="e2e-modal-text"></div>
          <div class="e2e-modal-actions">
            <button class="e2e-modal-cancel" type="button">Cancelar</button>
            <button class="e2e-modal-ok" type="button">Confirmar</button>
          </div>
        </div>`;
      overlay.querySelector(".e2e-modal-text").textContent = text;
      const close = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector(".e2e-modal-cancel").addEventListener("click", () => close(false));
      overlay.querySelector(".e2e-modal-ok").addEventListener("click", () => close(true));
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
      mountEl.appendChild(overlay);
    });
  }

  // ---- utils ----
  function fromBase64(str) {
    try {
      const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
      const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
      const bin = atob(s + pad);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch { return null; }
  }
  function fromHex(hex) {
    const clean = String(hex).replace(/[^0-9a-f]/gi, "");
    if (clean.length % 2) return null;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToText(bytes) {
    try { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
    catch { return ""; }
  }

  // ---- detect\u00e7\u00e3o de camadas ----
  function detectJwt(str) {
    const m = String(str).match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/);
    return m ? m[0] : null;
  }
  function detectBearer(headers) {
    const auth = (headers && (headers.authorization || headers.Authorization)) || "";
    const m = String(auth).match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
  }
  function detectBase64(str) {
    const s = String(str);
    if (s.length < 16) return null;
    if (!/^[A-Za-z0-9+/=_-]+$/.test(s)) return null;
    const decoded = fromBase64(s);
    if (!decoded) return null;
    const text = bytesToText(decoded);
    // Heur\u00edstica: pelo menos 50% chars print\u00e1veis
    const printable = (text.match(/[\x20-\x7e]/g) || []).length;
    if (printable / text.length < 0.5) return null;
    return text;
  }

  function analyzeRequest(r) {
    const layers = [];
    const bearer = detectBearer(r.reqHeaders);
    if (bearer) {
      const jwt = detectJwt(bearer);
      if (jwt) layers.push({ type: "jwt", source: "Authorization", token: jwt });
      else if (detectBase64(bearer)) layers.push({ type: "base64", source: "Authorization", value: bearer });
      else layers.push({ type: "opaque", source: "Authorization", value: bearer.slice(0, 40) + "\u2026" });
    }
    const body = r.reqBody || "";
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const jwtInBody = detectJwt(bodyStr);
    if (jwtInBody) layers.push({ type: "jwt", source: "body", token: jwtInBody });
    return layers;
  }

  // ---- JWT decode ----
  function decodeJwt(token) {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const headerBytes = fromBase64(parts[0]);
    const payloadBytes = fromBase64(parts[1]);
    if (!headerBytes || !payloadBytes) return null;
    try {
      const header = JSON.parse(bytesToText(headerBytes));
      const payload = JSON.parse(bytesToText(payloadBytes));
      return { header, payload, expired: payload.exp ? (payload.exp * 1000 < Date.now()) : null };
    } catch { return null; }
  }

  // ---- AES decrypt ----
  async function aesDecrypt(alg, keyBytes, ivBytes, cipherBytes) {
    const algSpec = alg === "AES-CBC"
      ? { name: "AES-CBC", iv: ivBytes }
      : { name: "AES-GCM", iv: ivBytes };
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: algSpec.name }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(algSpec, key, cipherBytes);
    return bytesToText(new Uint8Array(plain));
  }

  function parseKeyMaterial(material, encoding) {
    if (encoding === "hex") return fromHex(material);
    return fromBase64(material);
  }

  // ---- vault ----
  async function loadVault(ctx) {
    const v = await ctx.storage.get(VAULT_KEY);
    return Array.isArray(v) ? v : [];
  }
  async function saveVault(ctx, vault) {
    await ctx.storage.set(VAULT_KEY, vault);
  }

  const SCRIPT = {
    id: 19,
    slug: "e2e-decryptor",
    name: "E2E Decryptor",
    description: "Decode JWT/base64 e decrypt AES-GCM/CBC. Vault local, sem egresso de rede.",
    icon: "\ud83d\udd13",
    needsAI: false,
    needsNetwork: false,
    minRequests: 1,

    async run(ctx) {
      const reqs = ctx.requests || [];
      const analyzed = reqs.map((r) => ({ req: r, layers: analyzeRequest(r) })).filter((x) => x.layers.length);

      return {
        ok: true,
        summary: `${analyzed.length} de ${reqs.length} requests com camadas detect\u00e1veis`,
        render(mountEl) {
          mountEl.innerHTML = `
            <div class="hyper-rb-e2e">
              <div class="e2e-warn">
                <strong>\u26a0 Uso \u00e9tico:</strong> Use apenas em payloads dos quais voc\u00ea tem permiss\u00e3o para decifrar.
                Chaves ficam <strong>somente neste navegador</strong>, nunca s\u00e3o enviadas para o servidor.
              </div>

              <div class="e2e-tabs">
                <button class="e2e-tab active" data-tab="detected">Camadas detectadas (${analyzed.length})</button>
                <button class="e2e-tab" data-tab="vault">Key Vault</button>
              </div>

              <div class="e2e-panel" data-panel="detected">
                ${analyzed.length === 0
                  ? `<div class="e2e-empty">Nenhuma camada encriptada/codificada detectada nas requests.</div>`
                  : `<div class="e2e-list">${analyzed.map((x, i) => `
                    <div class="e2e-card" data-idx="${i}">
                      <div class="e2e-card-head"><code>${S.escapeHtml(x.req.method)} ${S.escapeHtml((x.req.host || "") + (x.req.pathname || ""))}</code></div>
                      <div class="e2e-layers">${x.layers.map((l, li) => `
                        <div class="e2e-layer" data-li="${li}">
                          <span class="e2e-badge e2e-badge-${l.type}">${l.type}</span>
                          <span class="e2e-source">${S.escapeHtml(l.source)}</span>
                          <button class="e2e-action" data-action="decode" data-i="${i}" data-l="${li}">Decode</button>
                        </div>
                      `).join("")}</div>
                      <div class="e2e-out"></div>
                    </div>
                  `).join("")}</div>`
                }
              </div>

              <div class="e2e-panel" data-panel="vault" style="display:none;">
                <div class="e2e-vault-form">
                  <input class="e2e-kid" type="text" placeholder="kid (apelido)" />
                  <select class="e2e-alg">
                    <option value="AES-GCM">AES-GCM</option>
                    <option value="AES-CBC">AES-CBC</option>
                  </select>
                  <select class="e2e-enc">
                    <option value="base64">key/iv em base64</option>
                    <option value="hex">key/iv em hex</option>
                  </select>
                  <input class="e2e-key" type="text" placeholder="key (128/192/256 bits)" />
                  <input class="e2e-iv" type="text" placeholder="iv/nonce" />
                  <button class="e2e-add" type="button">Adicionar chave</button>
                </div>
                <div class="e2e-vault-list"></div>
                <button class="e2e-clear" type="button">Apagar todas as chaves</button>
                <div class="e2e-decrypt-form">
                  <h4>Decrypt manual</h4>
                  <textarea class="e2e-cipher" placeholder="ciphertext (base64)" rows="3"></textarea>
                  <select class="e2e-key-pick"></select>
                  <button class="e2e-decrypt" type="button">Decrypt</button>
                  <div class="e2e-decrypt-out"></div>
                </div>
              </div>
            </div>
            <style>
              .hyper-rb-e2e { display:flex; flex-direction:column; gap:10px; font-size:12px; color:#fff; }
              .e2e-warn { background:rgba(255,180,0,.1); border:1px solid rgba(255,180,0,.35); border-radius:8px; padding:8px 12px; font-size:11px; line-height:1.5; }
              .e2e-tabs { display:flex; gap:4px; border-bottom:1px solid rgba(255,255,255,.1); }
              .e2e-tab { background:transparent; color:rgba(255,255,255,.6); border:none; padding:8px 12px; cursor:pointer; border-bottom:2px solid transparent; }
              .e2e-tab.active { color:#bf00ff; border-bottom-color:#bf00ff; }
              .e2e-panel { padding:6px 2px; }
              .e2e-empty { color:rgba(255,255,255,.5); font-style:italic; padding:12px; }
              .e2e-list, .e2e-vault-list { display:flex; flex-direction:column; gap:8px; }
              .e2e-card { background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:10px; }
              .e2e-card-head { font-family:monospace; font-size:11px; color:#bf00ff; margin-bottom:6px; word-break:break-all; }
              .e2e-layer { display:flex; gap:8px; align-items:center; padding:4px 0; }
              .e2e-badge { padding:2px 6px; border-radius:4px; font-size:10px; text-transform:uppercase; }
              .e2e-badge-jwt { background:rgba(115,255,184,.15); color:#73ffb8; }
              .e2e-badge-base64 { background:rgba(191,0,255,.15); color:#bf00ff; }
              .e2e-badge-opaque { background:rgba(255,255,255,.08); color:rgba(255,255,255,.7); }
              .e2e-source { font-family:monospace; font-size:11px; color:rgba(255,255,255,.7); }
              .e2e-action, .e2e-add, .e2e-clear, .e2e-decrypt { background:rgba(191,0,255,.2); color:#fff; border:1px solid rgba(191,0,255,.4); padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:auto; }
              .e2e-action:hover, .e2e-add:hover, .e2e-decrypt:hover { background:rgba(191,0,255,.35); }
              .e2e-clear { background:rgba(255,85,119,.15); border-color:rgba(255,85,119,.4); color:#ff7799; margin-left:0; margin-top:8px; }
              .e2e-out, .e2e-decrypt-out { margin-top:6px; padding:8px; background:rgba(0,0,0,.4); border-radius:6px; font-family:monospace; font-size:11px; white-space:pre-wrap; word-break:break-all; max-height:240px; overflow:auto; }
              .e2e-out:empty, .e2e-decrypt-out:empty { display:none; }
              .e2e-vault-form, .e2e-decrypt-form { display:flex; flex-direction:column; gap:6px; background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.06); border-radius:8px; padding:10px; margin-bottom:8px; }
              .e2e-vault-form input, .e2e-vault-form select, .e2e-decrypt-form textarea, .e2e-decrypt-form select { background:rgba(0,0,0,.4); color:#fff; border:1px solid rgba(255,255,255,.12); padding:6px 8px; border-radius:4px; font-family:monospace; font-size:11px; }
              .e2e-decrypt-form h4 { margin:0 0 4px; color:#bf00ff; font-size:12px; }
              .e2e-vault-item { display:flex; gap:8px; align-items:center; padding:6px 8px; background:rgba(18,18,20,.5); border-radius:4px; }
              .e2e-vault-item .kid { font-weight:bold; color:#bf00ff; }
              .e2e-vault-item .alg { font-size:10px; color:rgba(255,255,255,.6); }
              .e2e-vault-item button { margin-left:auto; background:rgba(255,85,119,.15); color:#ff7799; border:1px solid rgba(255,85,119,.3); padding:3px 8px; border-radius:4px; cursor:pointer; font-size:10px; }
              .e2e-error { color:#ff5577; }
              .e2e-ok { color:#73ffb8; }
              .e2e-flash { padding:8px 12px; border-radius:6px; font-size:11px; margin-bottom:4px; display:none; }
              .e2e-flash[data-kind="error"] { background:rgba(255,85,119,.15); color:#ff8fa4; border:1px solid rgba(255,85,119,.35); }
              .e2e-flash[data-kind="ok"] { background:rgba(115,255,184,.12); color:#73ffb8; border:1px solid rgba(115,255,184,.3); }
              .e2e-flash[data-kind="info"] { background:rgba(191,0,255,.12); color:#e8c5ff; border:1px solid rgba(191,0,255,.3); }
              .e2e-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:99999; }
              .e2e-modal { background:rgba(18,18,20,.95); border:1px solid rgba(191,0,255,.4); border-radius:10px; padding:18px 20px; min-width:280px; max-width:90vw; color:#fff; box-shadow:0 12px 48px rgba(0,0,0,.6); }
              .e2e-modal-text { font-size:13px; line-height:1.45; margin-bottom:14px; }
              .e2e-modal-actions { display:flex; justify-content:flex-end; gap:8px; }
              .e2e-modal-cancel { background:rgba(255,255,255,.07); color:#fff; border:1px solid rgba(255,255,255,.15); padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; }
              .e2e-modal-ok { background:rgba(255,85,119,.18); color:#ff8fa4; border:1px solid rgba(255,85,119,.4); padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:700; }
            </style>
          `;

          // tabs
          mountEl.querySelectorAll(".e2e-tab").forEach((t) => {
            t.addEventListener("click", () => {
              mountEl.querySelectorAll(".e2e-tab").forEach((x) => x.classList.toggle("active", x === t));
              mountEl.querySelectorAll(".e2e-panel").forEach((p) => {
                p.style.display = (p.dataset.panel === t.dataset.tab) ? "" : "none";
              });
            });
          });

          // decode actions
          mountEl.querySelectorAll('.e2e-action[data-action="decode"]').forEach((btn) => {
            btn.addEventListener("click", () => {
              const i = parseInt(btn.dataset.i, 10);
              const li = parseInt(btn.dataset.l, 10);
              const layer = analyzed[i].layers[li];
              const card = mountEl.querySelector(`.e2e-card[data-idx="${i}"]`);
              const outEl = card.querySelector(".e2e-out");

              if (layer.type === "jwt") {
                const decoded = decodeJwt(layer.token);
                if (!decoded) {
                  outEl.innerHTML = `<span class="e2e-error">JWT malformado.</span>`;
                  return;
                }
                const expWarn = decoded.expired === true ? `<div class="e2e-error">\u26a0 Token EXPIRADO</div>` : "";
                outEl.innerHTML = `${expWarn}<strong>header</strong>\n${S.escapeHtml(JSON.stringify(decoded.header, null, 2))}\n\n<strong>payload</strong>\n${S.escapeHtml(JSON.stringify(decoded.payload, null, 2))}`;
              } else if (layer.type === "base64") {
                const decoded = detectBase64(layer.value);
                outEl.textContent = decoded || "(falha ao decodificar)";
              } else {
                outEl.innerHTML = `<span class="e2e-error">Token opaco. Sem chave compat\u00edvel no vault para decrypt.</span>`;
              }
            });
          });

          // vault rendering
          const vaultListEl = mountEl.querySelector(".e2e-vault-list");
          const keyPickEl = mountEl.querySelector(".e2e-key-pick");

          async function renderVault() {
            const vault = await loadVault(ctx);
            vaultListEl.innerHTML = vault.length
              ? vault.map((k, i) => `
                <div class="e2e-vault-item">
                  <span class="kid">${S.escapeHtml(k.kid)}</span>
                  <span class="alg">${S.escapeHtml(k.alg)} \u00b7 ${S.escapeHtml(k.encoding)}</span>
                  <button data-rm="${i}">Remover</button>
                </div>`).join("")
              : `<div class="e2e-empty">Vault vazio.</div>`;
            keyPickEl.innerHTML = vault.length
              ? vault.map((k, i) => `<option value="${i}">${S.escapeHtml(k.kid)} (${S.escapeHtml(k.alg)})</option>`).join("")
              : `<option value="">(nenhuma chave)</option>`;

            vaultListEl.querySelectorAll("button[data-rm]").forEach((b) => {
              b.addEventListener("click", async () => {
                const idx = parseInt(b.dataset.rm, 10);
                const v = await loadVault(ctx);
                v.splice(idx, 1);
                await saveVault(ctx, v);
                renderVault();
              });
            });
          }
          renderVault();

          mountEl.querySelector(".e2e-add").addEventListener("click", async () => {
            const kid = mountEl.querySelector(".e2e-kid").value.trim();
            const alg = mountEl.querySelector(".e2e-alg").value;
            const encoding = mountEl.querySelector(".e2e-enc").value;
            const key = mountEl.querySelector(".e2e-key").value.trim();
            const iv = mountEl.querySelector(".e2e-iv").value.trim();
            if (!kid || !key || !iv) return flashMessage(mountEl, "Preencha kid, key e iv.", "error");
            const vault = await loadVault(ctx);
            vault.push({ kid, alg, encoding, key, iv });
            await saveVault(ctx, vault);
            mountEl.querySelector(".e2e-kid").value = "";
            mountEl.querySelector(".e2e-key").value = "";
            mountEl.querySelector(".e2e-iv").value = "";
            renderVault();
            flashMessage(mountEl, `Chave \"${kid}\" adicionada ao vault.`, "ok");
          });

          mountEl.querySelector(".e2e-clear").addEventListener("click", async () => {
            const ok = await inlineConfirm(mountEl, "Apagar TODAS as chaves do vault? Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.");
            if (!ok) return;
            await saveVault(ctx, []);
            renderVault();
            flashMessage(mountEl, "Vault apagado.", "ok");
          });

          mountEl.querySelector(".e2e-decrypt").addEventListener("click", async () => {
            const out = mountEl.querySelector(".e2e-decrypt-out");
            const cipherText = mountEl.querySelector(".e2e-cipher").value.trim();
            const pick = mountEl.querySelector(".e2e-key-pick").value;
            const vault = await loadVault(ctx);
            const k = vault[parseInt(pick, 10)];
            if (!cipherText || !k) {
              out.innerHTML = `<span class="e2e-error">Selecione uma chave e forne\u00e7a o ciphertext.</span>`;
              return;
            }
            try {
              const keyBytes = parseKeyMaterial(k.key, k.encoding);
              const ivBytes = parseKeyMaterial(k.iv, k.encoding);
              const cipherBytes = fromBase64(cipherText);
              if (!keyBytes || !ivBytes || !cipherBytes) throw new Error("decode falhou (key/iv/cipher)");
              const plain = await aesDecrypt(k.alg, keyBytes, ivBytes, cipherBytes);
              out.innerHTML = `<span class="e2e-ok">\u2713 Plaintext:</span>\n` + S.escapeHtml(plain);
            } catch (e) {
              out.innerHTML = `<span class="e2e-error">Decrypt falhou: ${S.escapeHtml(String(e?.message || e))}</span>`;
            }
          });
        },
      };
    },
  };

  window.HYPER_RB_SCRIPTS = window.HYPER_RB_SCRIPTS || [];
  window.HYPER_RB_SCRIPTS.push(SCRIPT);
})();