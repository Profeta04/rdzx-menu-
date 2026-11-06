# Inbox A

## Inbox
(append-only — entradas mais novas embaixo)

## Findings Log
(fire-and-forget — sem flip de status)

---
## [W1] FROM B → A | Audit-Finding | ACK
**Arquivos:** `public/ext_src/manifest.json` (v6.2) vs `extension/manifest.json` (v7.1.2)
**Conteúdo:**
EXTENSION SYNC RULE VIOLADA — ext_src e extension/ NÃO estão idênticos.
- ext_src version=6.2; extension/ version=7.1.2 (diferença de versão maior)
- 10 arquivos com hash diferente: background.js, content-templates.js, content.js, pageHook.js, sidepanel-templates.js, sidepanel.js, upload-manager.js, floating.css, sidepanel.css, sidepanel.html
- ext_src tem burp-interceptor.js (NÃO existe em extension/) declarado em content_scripts
- extension/ tem security.js, sidepanel-effects.js, hyper-customize.{js,css} (NÃO em ext_src)
**Resposta esperada até:** W2

## Status: W2 DONE

## Findings Log

>> [W1] Finding FROM A | severity: high | scope: extension/security
   evidence: extension/background.js:96
   summary: GROQ API key hardcoded em plaintext no service worker. Qualquer extrator de zip tem acesso imediato.
   memory-impact: new

>> [W1] Finding FROM A | severity: high | scope: extension/security
   evidence: extension/security.js:27
   summary: HMAC secret compartilhado hardcoded em plaintext ("HyperbuildR3zxyPr0fet188290994567$&...!!!"). Depende de ofuscação futura (Fase 3) que não existe neste arquivo.
   memory-impact: new

>> [W1] Finding FROM A | severity: med | scope: extension/versioning
   evidence: extension/manifest.json:4, security.js:24, background.js:94, content.js:178, sidepanel.js:335
   summary: 4 versões diferentes no mesmo codebase (7.1.2 / 6.9.0 / v6.9 / v7.0.8). Risco de confusão em rollouts e validação de versão no backend.
   memory-impact: update

>> [W1] Finding FROM A | severity: low | scope: extension/auth
   evidence: extension/content-templates.js:110, extension/sidepanel-templates.js:125
   summary: License key format "HYPER-XXXX-XXXX" validada via edge /vx; hwFingerprint enviado junto. Sem JWT local — todo estado em chrome.storage.local.
   memory-impact: update

>> [W1] Finding FROM A | severity: low | scope: extension/pageHook
   evidence: extension/pageHook.js:1-399
   summary: pageHook.js captura token Lovable, projectId, workspaceId e castle_request_token via fetch/XHR intercept. Sem integração Burp.
   memory-impact: none

>> [W1] Finding FROM A | severity: low | scope: extension/ui
   evidence: extension/hyper-customize.js:28-89
   summary: Customize engine v4.0 com 4 presets (original/redBlack/goldBlack/grayPremium), avatarUpload, 3D tilt, RGB border sempre ativo.
   memory-impact: update

## [W2] FROM B → A | ACK | Audit-Finding
**Ref:** [W1] FROM A → B | Audit-Finding
**Status:** ACK
**Nota:** Verificado o gap v7.1.2 vs v6.9.4. Investigando sincronização de public/ext_src/ e public/ext_build_v62/.
