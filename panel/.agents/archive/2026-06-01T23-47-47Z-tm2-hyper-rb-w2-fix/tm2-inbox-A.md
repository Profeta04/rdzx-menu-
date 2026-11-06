# Inbox A

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## Audit-Finding FROM C → A | C-A-01 | MEDIUM | burp_pageHook.js — WebSocket instanceof check quebrado após monkey-patch

**Arquivo:** `public/burp_src/burp_pageHook.js` — linhas 219-294  
**Severidade:** medium  
**Categoria:** Compatibilidade de página / hook WS

**Descrição:**  
`PatchedWebSocket` é uma função regular (não classe) que retorna `ws` (instância de `OriginalWebSocket`). Ao atribuir `window.WebSocket = PatchedWebSocket`, código de página que faz `socket instanceof WebSocket` recebe `false` porque `ws` é instância de `OriginalWebSocket`, não de `PatchedWebSocket`. Páginas Lovable que dependem dessa verificação podem ter comportamento inesperado. Adicionalmente, o flag anti-double-patch `__hyperRbPatched` é definido em `PatchedWebSocket` (L293) mas verificado em `OriginalWebSocket` (L219) — embora inofensivo dado o guard `window.__BURP_LOVABLE_PAGE__` no IIFE externo.

**Proposta de correção:**  
Converter `PatchedWebSocket` para `class PatchedWebSocket extends OriginalWebSocket` com `constructor` que faz o patching via `super(url, protocols)`, ou usar `Object.setPrototypeOf(ws, PatchedWebSocket.prototype)` após a criação para manter o instanceof chain.

---
## Audit-Finding FROM C → A | C-A-02 | LOW | burp_pageHook.js — setInterval de polling usa localStorage sem fallback de origem

**Arquivo:** `public/burp_src/burp_pageHook.js` — linhas 36-43 (getWorkspaceId) e 305-317  
**Severidade:** low  
**Categoria:** Robustez / fallback

**Descrição:**  
`getWorkspaceId()` lê `localStorage.getItem("lovable_workspace_id")`. Se a página estiver em contexto de iframe sandboxed (sem acesso a localStorage), o `try/catch` captura o erro silenciosamente e cai no regex de URL — o que é correto. Porém o polling de 2s continua por até MAX_POLL_ATTEMPTS=15 (30s) mesmo quando o workspaceId nunca será capturável nesse contexto. Impacto menor mas gera mensagens desnecessárias ao background via `captureAuth`.

**Proposta de correção:**  
Adicionar detecção de contexto sandboxed no início do polling e interromper mais cedo se tanto localStorage quanto URL regex falharem nas primeiras tentativas.

---
## Audit-Finding FROM D → A  [W1/2025]

### AF-D-A-01 | INFO | Scripts toolbelt — sem impacto direto no overlay/content
**De:** Agent D (scripts toolbelt audit)  
**Para:** Agent A (overlay/floating/content)  
**Descrição:** Auditei todos os 25 scripts do toolbelt. Nenhum deles referencia `window.HYPER_RB_FLOATING`, `burp_floating.js`, `burp_content.js` ou injetam CSS no page principal. Os scripts rodam 100% confinados ao sidepanel. Não há bugs de scripts que quebram o overlay.  
**Achado relevante para A:** O `_shared.js` exporta `downloadBlob` que usa `document.body.appendChild(a)` — isso é o `document` do sidepanel (não da page), o que é correto. Confirme que o `burp_floating.js` não tenta chamar `HYPER_RB_REGISTRY.runScript()` diretamente sem passar um contexto válido, pois isso quebraria o pipeline de ctx.


---
## Audit-Finding FROM E → A | W1/F3 | 2024

**AF-E-A-01** | MEDIUM | `burp_content.js`
**Título:** `KNOWN_PAGE_TYPES` não inclui `"AUTH_SNAPSHOT"` disparado via timeout path alternativo
**Detalhe:** `content.js` envia `window.postMessage({ source: "BURP_LOVABLE_CONTENT", type: "REQUEST_AUTH_SNAPSHOT" })` para que o pageHook responda com `AUTH_SNAPSHOT`. O conjunto `KNOWN_PAGE_TYPES` inclui `"AUTH_SNAPSHOT"` corretamente — ✅ OK. Porém o `window.addEventListener("message")` só aceita `event.source === window` — se o pageHook for carregado em frame distinto isso silencia sem log. **Baixo risco atual, mas frágil.**
**Proposta:** Adicionar `console.debug` quando `event.source !== window` para facilitar diagnóstico de painel preto em iframes.

**AF-E-A-02** | LOW | `burp_content.js` (cross-cutting: manifest `all_frames: false`)
**Título:** `burp_floating.js` injetado com `all_frames: false` — correto, mas `burp_content.js` tem guard `window !== window.top` que implica defesa contra `all_frames: true`
**Detalhe:** Manifest declara `all_frames: false` mas o content script tem código de defesa explícita contra sub-frames. O código de defesa é bom, mas o comentário inline diz "before the manifest all_frames fix takes effect" — sugere que houve um bug anterior onde `all_frames` era `true`. Confirmar que a intenção atual é mesmo `false` e limpar o comentário histórico.
**Proposta (wave 2):** Remover referência ao "all_frames fix" do comentário; manter guard de subframe pois é boa prática independente.

---
