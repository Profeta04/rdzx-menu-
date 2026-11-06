# Inbox A

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## Audit-Finding FROM E → A | 2025-W1 | INFO

**Subject:** CSP da página hospedeira pode bloquear iframe `chrome-extension://`

**Finding:** `burp_floating.js` cria um `<iframe>` com `src = chrome.runtime.getURL('burp_sidepanel.html')`. A página hospedeira `lovable.dev` pode ter uma CSP `frame-src` que não inclui `chrome-extension:`. Isso é um vetor provável do "painel preto" reportado.

**Recomendação (escopo A):**
- Verificar se o iframe está sendo criado com `sandbox` attribute inadequado ou sem `allow-scripts allow-same-origin`.
- Considerar montar o painel via `chrome.windows.create` ou `chrome.sidePanel` como alternativa ao iframe injetado na página — contorna CSP do host por completo.
- Se mantiver iframe: checar no DevTools → Network se o frame carrega ou é bloqueado (CSP violation no console da página).

**Status:** INFO — para considerar no fix do bug visual.
