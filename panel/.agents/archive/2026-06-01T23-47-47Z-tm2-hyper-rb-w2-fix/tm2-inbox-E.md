# Inbox E

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

>> [W1/F3] Progress-Note FROM A: Auditoria de burp_floating.js, burp_floating.css e burp_content.js concluída. Encontrados 8 achados (0 crit, 2 high, 3 med, 3 low). Enviando para E (cross-cutting) e B (sidepanel iframe). step: 3/3

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.js:18-19, :224 + public/burp_src/burp_content.js:117
**Severidade:** high
**Bug:** Race condition no early-claim de `window.__BURP_RB_FLOATING__`. Linhas 18-19 setam `true` imediatamente; linha 224 substitui pelo objeto `{show,hide,toggle}` só após a IIFE inteira executar. Se o SW enviar `BURP_TOGGLE_FLOATING` antes da IIFE terminar (possível em `document_start`), `burp_content.js:117` executa `window.__BURP_RB_FLOATING__?.toggle()` — mas `true?.toggle` é `undefined` (optional chaining em primitivo). O toggle silenciosamente não-opera: o usuário clica no ícone e nada acontece.
**Proposta de correção:** Inicializar com `window.__BURP_RB_FLOATING__ = { toggle: () => { _pendingToggle = true; } }` como stub, e no `show()`/final da IIFE substituir pelo objeto real com flag `_pendingToggle` para replay. Ou mover o expose para antes de `loadState()`.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.js + burp_content.js). Delegado. Agent A deve corrigir em W2.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.js:155-166
**Severidade:** med
**Bug:** `ResizeObserver` (`ro`) criado dentro de `build()` e atribuído a `const` local — nunca é desconectado (`ro.disconnect()`). Se a extensão for atualizada/recarregada com a página ainda aberta, o observer fica pendente e tenta chamar `persistState()` (que usa `chrome.storage`) após invalidação do contexto. Mesmo sem crash, é um memory leak: o observer mantém referência a `root` impedindo GC.
**Proposta de correção:** Elevar `ro` ao escopo do módulo; chamar `ro.disconnect()` em um listener de `chrome.runtime.connect` disconnect ou em `hide()` + reconectar em `show()`. Alternativamente, envolver o callback em try/catch com `chrome.runtime?.id` check.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.js). Delegado.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.js:198-199
**Severidade:** med
**Bug:** Listeners de drag (`pointermove`/`pointerup`) adicionados ao `window` dentro de `startDrag`. Se o ponteiro perder captura sem disparar `pointerup` (e.g., perda de foco da janela, drag cancelado por outra extensão, ou elemento removido do DOM), `onUp` nunca é chamado — deixando 2 listeners permanentemente no `window` por drag "abandonado". Múltiplos drags órfãos acumulam listeners.
**Proposta de correção:** Adicionar `window.addEventListener("pointercancel", onUp)` além de `pointerup`, e usar `{ once: true }` não é suficiente porque `pointermove` não é once — mas `onUp` deve remover `pointercancel` também. Considerar `setPointerCapture` no elemento para melhor controle.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.js). Delegado.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.js:131
**Severidade:** med
**Bug:** Rapid-reload race no iframe: ao clicar "recarregar" rapidamente, cada clique seta `iframe.src` com novo `?_r=timestamp`. O evento `load` do src anterior ainda pode disparar após o src ser trocado, escondendo o spinner prematuramente e mostrando um iframe ainda carregando como opacity:1 enquanto o src foi substituído. Resultado: usuário vê tela em branco/preta brevemente com spinner já oculto.
**Proposta de correção:** Usar um contador de `reloadId` incremental; no handler `load` verificar se o `reloadId` no momento do evento corresponde ao atual antes de alterar display/opacity.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.js). Delegado.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.js:227-232
**Severidade:** med
**Bug:** Listener `keydown` adicionado ao `document` para Alt+H nunca é removido. Em MV3 content scripts são persistentes enquanto a página está aberta. Se a extensão for recarregada via `chrome.runtime.reload()` (hot update), um novo content script é injetado na página — a guard em linha 18 (`window.__BURP_RB_FLOATING__`) impede re-execução da IIFE, mas o listener original continua existindo sem referência ao novo contexto. Em cenários de página SPA com navegação hash, isso pode acumular.
**Proposta de correção:** Guardar referência ao handler e removeEventListener no disconnect: `chrome.runtime.connect()` + `port.onDisconnect.addListener(() => document.removeEventListener("keydown", handler))`.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.js). Delegado.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.js:207
**Severidade:** low
**Bug:** `root.focus?.()` em `show()` sempre silenciosamente falha — o elemento `div#hyper-rb-floating-root` não tem `tabindex`, então `focus()` em um div não-focusável é no-op. O painel não recebe foco de teclado ao abrir, quebrando o fluxo de a11y (usuário pressionou Alt+H e foco continua no conteúdo da página).
**Proposta de correção:** Adicionar `tabindex="-1"` ao `root` criado em `build()` (ou no seletor CSS), permitindo que `focus()` funcione programaticamente sem entrar no tab order natural.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.js). Delegado.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_content.js:143-148
**Severidade:** low
**Bug:** `setTimeout(..., 500)` para triggering do auth snapshot assume que a página inicializou em 500ms. Em páginas lentas ou com muitos recursos, `burp_pageHook.js` pode não estar injetado ainda quando o postMessage é enviado — o hook não existe para receber `REQUEST_AUTH_SNAPSHOT`. A captura do auth inicial é silenciosamente perdida sem retry.
**Proposta de correção:** Aguardar o evento `HOOK_READY` (já existe no fluxo, linha 85-87) antes de enviar `REQUEST_AUTH_SNAPSHOT`, eliminando o timeout arbitrário. Ou implementar retry com backoff se `AUTH_SNAPSHOT` não for recebido em N segundos.
**Triagem E [W2]:** Escopo de Agent A (burp_content.js). Delegado.

---
## [W1] FROM A → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent A**
**Arquivos:** public/burp_src/burp_floating.css:26, public/burp_src/burp_floating.js:155-160
**Severidade:** low
**Bug:** CSS usa `resize: both` no elemento `position: fixed`, que é suportado no Chrome mas o handle de resize nativo fica no canto inferior-direito, sobrepondo-se ao conteúdo do iframe. O `ResizeObserver` detecta a mudança e persiste corretamente, mas quando o painel está próximo da borda direita da viewport, o handle de resize fica fora da viewport (invisível/inacessível) porque o painel usa `right` fixo e não reposiciona automaticamente.
**Proposta de correção:** Implementar resize via JS (drag handles customizados) em vez de CSS `resize: both`, ou ao persistir posição verificar se `pos.right + pos.width > window.innerWidth` e ajustar.
**Triagem E [W2]:** Escopo de Agent A (burp_floating.css + burp_floating.js). Delegado.


---
## [W1] FROM B → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent B**
**Arquivos:** public/burp_src/burp_sidepanel.js:202-204
**Severidade:** high
**Bug:** `selectedRequest()` faz `const all = state.data?.network || []`. Se `network` é um objeto (não-array), `{}` é truthy e o fallback `|| []` não ativa. Então `{}.find(...)` lança `TypeError: all.find is not a function`. O fix idêntico foi aplicado em `filteredRequests()` (linha 180) mas ESQUECEU de cobrir esta função.
**Proposta de correção:** Aplicar o mesmo padrão de normalização: `const raw = state.data?.network; const all = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);`
**Triagem E [W2]:** Escopo de Agent B (burp_sidepanel.js). Delegado.

---
## [W1] FROM B → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent B**
**Arquivos:** public/burp_src/burp_sidepanel.js:1287-1291
**Severidade:** high
**Bug:** `computeAnalyzerMetrics()` usa `const all = state.data?.network || []`. Mesma classe de bug: se `network` é objeto, `all` será `{}` e `.filter()`, `.map()`, `.sort()` jogarão TypeError. O Array.isArray fix não foi propagado para esta função.
**Proposta de correção:** Normalizar `all` com o mesmo padrão: `const raw = state.data?.network; const all = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);`
**Triagem E [W2]:** Escopo de Agent B (burp_sidepanel.js). Delegado.

---
## [W1] FROM B → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent B**
**Arquivos:** public/burp_src/burp_sidepanel.js:1070
**Severidade:** high
**Bug:** `importSelectedToChain()` usa `(state.data?.network || []).map(...)`. Se `network` é objeto, `.map` não existe → TypeError. Terceiro lugar onde o fix de Array.isArray foi esquecido.
**Proposta de correção:** `const order = (Array.isArray(state.data?.network) ? state.data.network : Object.values(state.data?.network || {})).map(n => n.id);`
**Triagem E [W2]:** Escopo de Agent B (burp_sidepanel.js). Delegado.

---
## [W1] FROM B → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent B**
**Arquivos:** public/burp_src/burp_sidepanel.js:1539-1541 e 1570-1572
**Severidade:** med
**Bug:** Em `refresh()` e no listener `onMessage`, o código acessa `state.data?.network?.[0]` para definir o `selectedRequestId` inicial. Se `network` é um objeto (dict keyed por ID), `[0]` retorna `undefined` silenciosamente — a request inicial nunca é selecionada, causando painel de detalhe vazio na primeira carga.
**Proposta de correção:** Usar `Object.values(state.data.network)[0]` após normalização, ou reutilizar `filteredRequests()[0]?.id`.
**Triagem E [W2]:** Escopo de Agent B (burp_sidepanel.js). Delegado.

---
## [W1] FROM B → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent B**
**Arquivos:** public/burp_src/burp_sidepanel.js:20
**Severidade:** high
**Bug:** `SUPABASE_ANON_KEY` (JWT completo) está hardcoded em texto plano no bundle da extensão. Qualquer pessoa que extraia o `.zip` da Chrome Web Store pode reutilizá-lo para chamar diretamente as edge functions (`/burp`, `/burp-ai`, etc.) sem passar pelo proxy da extensão, contornando rate-limiting e allowlists do SW.
**Proposta de correção:** Mover a chave para um mecanismo de bootstrap seguro (fetch da key via endpoint autenticado, ou carregar via `chrome.storage.local` provisionado no install) — ou aceitar o risco e documentar que RLS do Supabase é a única barreira.
**Triagem E [W2]:** Escopo de Agent B (burp_sidepanel.js). Nota: anon key em extensão pública é aceitável; RLS é a barreira real. Delegado ao Agent B para decisão.

---
## [W1] FROM B → E | Audit-Finding | ~~OPEN~~ → **DONE — DELEGATED to Agent B**
**Arquivos:** public/burp_src/burp_sidepanel.js:376-383
**Severidade:** med
**Bug:** `buildShell()` registra `document.addEventListener("click", handler)` para detectar clicks em chips `[data-sf]`. Este listener global NUNCA é removido e intercepta 100% dos clicks do documento. Se qualquer outro elemento da UI vier a ter `data-sf` por engano (ex: um script injetado, ou preset card), ele disparará mudanças de filtro de status indesejadas. Também é um listener permanente mesmo que a UI seja parcialmente re-renderizada.
**Proposta de correção:** Escopar o listener ao container: `document.getElementById("status-chips").addEventListener(...)` ou usar event delegation apenas dentro de `#view-network`.
**Triagem E [W2]:** Escopo de Agent B (burp_sidepanel.js). Delegado.

---
## Progress Log
>> [W1/F3] Progress-Note FROM B: 6 Audit-Findings enviados para E (3 Array.isArray gaps, 1 network[0] silent fail, 1 sec/anon-key, 1 global listener). Enviando 1 finding para C (res.summary null-deref no contrato chain). step: 4/4

---
## Audit-Finding FROM C → E | C-E-01 | ~~CRITICAL~~ → **DONE — DELEGATED to Agent C**

**Arquivo:** `public/burp_src/burp_background.js` — linhas 176 e 128  
**Severidade:** critical  
**Categoria:** MV3 Service Worker lifetime violation

**Descrição:**  
`schedulePersist()` (L176) e `scheduleWsFramesPersist()` (L128) usam `setTimeout` com delays de 300ms e 400ms respectivamente. Em MV3, o SW pode ser encerrado pelo browser a qualquer momento — incluindo durante esses delays. Se o SW morrer antes do callback disparar, `burp_background_state` e `hyper_rb_ws_frames` no `chrome.storage.local` ficam desatualizados. Isso pode causar perda de capturas de rede, tokens de auth e logs de startup, que nunca são persistidos.

O alarme keepalive de 24s mitiga parcialmente (chama `scheduleWsFramesPersist` na linha 61), mas qualquer estado modificado nos últimos 300-400ms de um ciclo de keepalive pode se perder.

**Proposta de correção:**  
1. Para `schedulePersist`: trocar o setTimeout por uma flag dirty + persist imediato no alarme keepalive (já existente).  
2. Para `scheduleWsFramesPersist`: mesmo padrão — persist imediato quando frame recebido, ou consolidar no alarme keepalive sem setTimeout.  
3. Alternativa: usar `chrome.alarms.create` com delay de 0.01min para casos onde o debounce é necessário.

**Triagem E [W2]:** Escopo de Agent C (burp_background.js). Delegado.

---
## Audit-Finding FROM C → E | C-E-02 | ~~HIGH~~ → **DONE — DELEGATED to Agent C**

**Arquivo:** `public/burp_src/burp_background.js` — linha 825 vs linha 1368  
**Severidade:** high  
**Categoria:** MV3 SW lifecycle race

**Descrição:**  
`bootstrap()` é chamado na linha 1368 (módulo top-level), mas o listener `chrome.runtime.onMessage` (L825) não aguarda sua conclusão. O Chrome pode acordar o SW via mensagem — nesse caso, `onMessage` dispara **antes** de `restoreState()` completar (async). Resultado: handlers como `BURP_GET_CREDENTIALS`, `BURP_EXECUTE_REQUEST`, `BURP_GET_STATE` lêem `state.auth.bearerToken = null`, `state.license = {valid:false}`, `state.network = []` — os valores padrão — em vez dos dados restaurados do storage.

Reprodução provável: sidepanel abre → SW acorda → sidepanel envia `BURP_GET_STATE` imediatamente → recebe estado vazio → painel fica em branco (possível causa do "painel preto" relatado).

**Proposta de correção:**  
```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await bootstrap(); // aguarda idempotente (promise cached)
    switch (message?.type) { ... }
  })();
  return true;
});
```
`bootstrap()` retorna `__bootstrapPromise` em chamadas subsequentes (já re-entrância guardada), então não há overhead.

**Triagem E [W2]:** Escopo de Agent C (burp_background.js). **PRIORIDADE CRÍTICA** — provável causa raiz do painel preto. Delegado.

---
## Audit-Finding FROM C → E | C-E-03 | ~~CRITICAL~~ → **DONE — DELEGATED to Agent C**

**Arquivo:** `public/burp_src/burp_background.js` — linhas 935-947  
**Severidade:** critical  
**Categoria:** Segurança / validação de licença

**Descrição:**  
O handler `BURP_VALIDATE_LICENSE` (e `BURP_HEARTBEAT`) retorna `{ valid: true, skipped: true }` de forma incondicional, independente de `state.license.valid`. Qualquer componente (sidepanel, scripts) que use essa mensagem para verificar acesso a features pagas sempre receberá `valid: true`. Além disso, `restoreState()` (L379) lê `license.valid` diretamente do `chrome.storage.local` sem re-validar com o servidor — tornando trivial o bypass via DevTools (Storage → editar `burp_background_state.license.valid = true`).

A licença nunca é re-validada server-side durante a sessão (apenas na ativação inicial, presumivelmente via `ql_license_*` keys).

**Proposta de correção:**  
1. `BURP_VALIDATE_LICENSE` deve checar `state.license.valid && state.license.expiresAt > Date.now()` antes de responder positivamente.  
2. Na restore, invalidar `license.valid` se `expiresAt` já passou, exigindo re-validação server-side.  
3. Implementar re-validação periódica (ex: no alarme keepalive a cada N ciclos) via edge function.

**Triagem E [W2]:** Escopo de Agent C (burp_background.js). **PRIORIDADE CRÍTICA de segurança.** Delegado.

---
## Audit-Finding FROM C → E | C-E-04 | ~~HIGH~~ → **DONE — DELEGATED to Agent C**

**Arquivo:** `public/burp_src/burp_background.js` — linhas 672-690  
**Severidade:** high  
**Categoria:** Lógica de chain executor / aborto

**Descrição:**  
`executeBurpChain` cria `_chainCtrl` (L672) e define `_chainAbortedByDeadline` (L673), mas nunca anexa esse callback a um timer. O deadline é verificado **somente** no topo do loop (L686: `Date.now() > deadline`). Se `executeBurpRequest` estiver bloqueado em uma request lenta (ex: o edge function demorando 29s), o deadline de 60s passa sem que `_chainCtrl.signal` seja abortado. O `_signal: _chainCtrl.signal` passado a `executeBurpRequest` (L731) fica válido, então a request pode concluir além do deadline. A chain pode levar vários minutos em caso de múltiplos steps lentos.

Compare com `runChain` em `burp_chains.js` (L204-205) que usa corretamente `setTimeout(() => deadlineCtrl.abort("deadline"), globalDeadline)`.

**Proposta de correção:**  
```js
const _chainDeadlineTimer = setTimeout(() => _chainCtrl.abort("deadline"), Chains.HARD_LIMITS.GLOBAL_DEADLINE_MS);
// ... no final/finally:
clearTimeout(_chainDeadlineTimer);
```

**Triagem E [W2]:** Escopo de Agent C (burp_background.js). Delegado.

---
## Audit-Finding FROM C → E | C-E-05 | ~~MEDIUM~~ → **DONE — DELEGATED to Agent C**

**Arquivo:** `public/burp_src/burp_background.js` — linha 1182  
**Severidade:** medium  
**Categoria:** Exposição de credenciais / superfície de ataque

**Descrição:**  
O handler `BURP_GET_CREDENTIALS` inclui `supabase_anon_key: SUPABASE_ANON_KEY` na resposta (L1182). Embora protegido por `sender.id === chrome.runtime.id`, isso significa que **qualquer content script desta extensão** pode extrair a anon key. Um XSS em lovable.dev poderia instruir o content script a repassar esse valor. Além disso, a key é hardcoded no source (L8), visível a qualquer pessoa que descompacte a extensão — o que é aceitável para anon keys públicas, mas expô-la via mensagem aumenta a superfície de ataque sem necessidade. A maioria dos consumidores de `BURP_GET_CREDENTIALS` provavelmente não precisa da anon key.

**Proposta de correção:**  
Remover `supabase_anon_key` da resposta de `BURP_GET_CREDENTIALS`. Consumidores que precisam dela (edge function calls) já a têm no background — não devem precisar recebê-la via mensagem.

**Triagem E [W2]:** Escopo de Agent C (burp_background.js). Delegado.

---
## Audit-Finding FROM C → E | C-E-06 | ~~MEDIUM~~ → **DONE — DELEGATED to Agent C**

**Arquivo:** `public/burp_src/burp_background.js` — L646-790 vs `burp_chains.js` L188-388  
**Severidade:** medium  
**Categoria:** Manutenibilidade / divergência de comportamento

**Descrição:**  
Existem dois executores completos de chain: `executeBurpChain` no background (que chama `executeBurpRequest` como fetch backend) e `runChain` em `burp_chains.js` (com `fetchFn` injetável). O background usa os helpers de `burp_chains.js` (`validateChain`, `prepareStep`, `extractFromResponse`) mas reimplementa o loop de retry e a lógica de abort do zero. Bugs corrigidos em `runChain` (ex: propagação de abort, timeout por step) não se refletem automaticamente em `executeBurpChain`. Isso já causou C-E-04 acima.

**Proposta de correção (Wave 2):**  
Refatorar `executeBurpChain` para usar `Chains.runChainTracked()` com `fetchFn = executeBurpRequest` (adaptado), eliminando a duplicação.

**Triagem E [W2]:** Escopo de Agent C (burp_background.js + burp_chains.js). Delegado.

## Progress Log

>> [W1/F3] Progress-Note FROM C: 6 Audit-Findings escritos no inbox E (2 crit, 2 high, 2 med). Próximos: inbox A e B. step: 4/6

---
## Audit-Finding FROM D → E  [W1/2025]

### AF-D-E-01 | ~~HIGH~~ → **DONE — DELEGATED to Agent D**
**Arquivo:** `public/burp_src/scripts/replay-mutate.js` · linha 47-48  
**Descrição:** Quando `validateReplayUrl(v.url || "")` retorna `false` para uma variante, o código de error building faz `new URL(v.url).hostname`. Se `v.url` for `""`, `undefined` ou uma string inválida, `new URL(v.url)` lança `TypeError: Failed to construct 'URL'`. Isso aborta o loop inteiro de `runReplays`, quebrando todos os resultados subsequentes com exceção não capturada que sobe até o `.catch(e => statusEl.textContent = ...)`.  
```js
// Linha 47-48 — BUG:
results.push({ ..., error: `Host não permitido: ${new URL(v.url).hostname}` });
//                                                 ^^^ throws if v.url is empty
```
**Proposta de correção:**
```js
let hostDisplay = "desconhecido";
try { hostDisplay = new URL(v.url || "").hostname; } catch {}
results.push({ ..., error: `Host não permitido: ${hostDisplay}` });
```
**Triagem E [W2]:** Escopo de Agent D (scripts/replay-mutate.js). Delegado.

### AF-D-E-02 | ~~MED~~ → **DONE — DELEGATED to Agent D**
**Arquivo:** `public/burp_src/scripts/_shared.js` · linha 56  
**Descrição:** A regra de telefone `(?:\+?[\d][\d\s\-().]{7,15}[\d])` é extremamente ampla. Ela casa com:
- Timestamps como `1748015142` (epoch Unix)
- IDs numéricos como `project_id: 12345678`
- Versões como `node 18.17.0` 
- Coordenadas geográficas, CEPs, etc.  
Isso causa scrubbing de dados válidos que a IA precisa para análise (tokens estimados, IDs de projeto).  
**Proposta de correção:** Tornar a regex mais restritiva — exigir pelo menos um `+` ou separador de país, ou aplicar somente em campos com nomes específicos (ex: `phone`, `tel`, `celular`). Ou mover para opt-in.
**Triagem E [W2]:** Escopo de Agent D (scripts/_shared.js). Delegado.

### AF-D-E-03 | ~~MED~~ → **DONE — DELEGATED to Agent D**
**Arquivo:** `public/burp_src/scripts/curl-exporter.js` · linha 2  
**Descrição:** O comentário de cabeçalho diz `#13 curl-exporter` mas o campo `id` do SCRIPT é `20`. O script de `id:13` é `chat-replay`. Isso é confusão de documentação — o dedup por slug funciona, mas IDs são usados no sort (`getScripts()` ordena por `id`), portanto a ordem de exibição dos scripts no painel pode estar deslocada se a intenção era exibir `curl-exporter` como #13.  
**Proposta de correção:** Corrigir o comentário para `#20 curl-exporter` ou verificar se a numeração sequencial de IDs está correta (os IDs 1-23 parecem todos únicos mas o comentário implica que a numeração era sequential e foi quebrada em algum refactor).
**Triagem E [W2]:** Escopo de Agent D (scripts/curl-exporter.js). Delegado.

### AF-D-E-04 | ~~MED~~ → **DONE — DELEGATED to Agent D**
**Arquivo:** `public/burp_src/scripts/_shared.js` · linha 30-33 vs linha 533-548  
**Descrição:** A função `maskString` é definida no topo de `_shared.js` e usada internamente (em `sanitizeHeaders`, `truncBody`), mas **não está exportada** em `window.HYPER_RB_SHARED`. Qualquer script que tentasse chamar `S.maskString(...)` receberia `TypeError: S.maskString is not a function`. Atualmente nenhum script chama diretamente — mas se um script futuro precisar usar esta função, vai falhar silenciosamente.  
**Proposta de correção:** Exportar `maskString` no objeto final: adicionar `maskString` à lista de exports em linha 533-548, ou documentar explicitamente que ela é interna.
**Triagem E [W2]:** Escopo de Agent D (scripts/_shared.js). Delegado.

### AF-D-E-05 | ~~LOW~~ → **DONE — DELEGATED to Agent D**
**Arquivo:** `public/burp_src/scripts/token-lifecycle.js` · linha 10  
**Descrição:** Define `JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g` com threshold `{8,}`. O `_shared.js` interno usa `{10,}` para header/payload e `{6,}` para signature. A discrepância pode causar `token-lifecycle` detectar tokens que `scrubPII` não detecta (token visível na UI mas não redacted no egresso AI). Risco menor, mas inconsistência de definição.  
**Proposta de correção:** Exportar `JWT_RE` de `_shared.js` e usar `S.JWT_RE` em `token-lifecycle.js` (ou ao menos alinhar os limites).
**Triagem E [W2]:** Escopo de Agent D (scripts/token-lifecycle.js + scripts/_shared.js). Delegado.

### AF-D-E-06 | ~~LOW~~ → **DONE — REVIEWED, NO ACTION (info)**
**Arquivo:** `public/burp_src/scripts/dep-graph.js` · linha 147  
**Descrição:** O HTML do SVG inline injeta `data-key="${S.escapeHtml(n.key)}"` — correto. Porém o `fill="${c}"` usa `hashColor(n.host)` que retorna `hsl(${hue}, ...)`. A string `hsl(...)` nunca contém caracteres perigosos, então não é XSS. Mas o `data-key` poderia conter o host do servidor — se o host vier com caracteres como `"`, o `S.escapeHtml` está corretamente aplicado. Confirmado: sem XSS aqui, apenas nota para consistência.  
**Proposta de correção:** N/A — código está correto. Apenas documentar como revisado.
**Triagem E [W2]:** Código correto, sem ação necessária. DONE.

---

## [W2] Agent E — Summary de Triagem | DONE

**Data:** Wave 2  
**Agente:** E (lock-owner manifest)  

### Correções aplicadas diretamente por E:
1. ✅ **manifest.json v4.0.4 → 4.0.5** — bump de versão pós bug-fix sweep
2. ✅ **host_permissions**: removido `https://cvbgrjauqjawrsyknhyj.functions.supabase.co/*` — redundante (nenhum código JS usa este subdomínio diretamente; todos os fetches usam `SUPABASE_URL/functions/v1/...` no domínio principal `.supabase.co`)
3. ✅ **CSP connect-src**: removido `https://cvbgrjauqjawrsyknhyj.functions.supabase.co` — idem

### OPENs triados:
| # | FROM | Finding | Ação |
|---|------|---------|------|
| 1 | A | Race condition __BURP_RB_FLOATING__ | DELEGATED → Agent A |
| 2 | A | ResizeObserver memory leak | DELEGATED → Agent A |
| 3 | A | Drag orphan listeners | DELEGATED → Agent A |
| 4 | A | Rapid-reload race iframe | DELEGATED → Agent A |
| 5 | A | keydown listener não removido | DELEGATED → Agent A |
| 6 | A | root.focus() tabindex a11y | DELEGATED → Agent A |
| 7 | A | setTimeout auth snapshot | DELEGATED → Agent A |
| 8 | A | resize handle CSS vs viewport | DELEGATED → Agent A |
| 9 | B | selectedRequest() Array.isArray | DELEGATED → Agent B |
| 10 | B | computeAnalyzerMetrics() Array.isArray | DELEGATED → Agent B |
| 11 | B | importSelectedToChain() Array.isArray | DELEGATED → Agent B |
| 12 | B | network?.[0] silent undefined | DELEGATED → Agent B |
| 13 | B | SUPABASE_ANON_KEY hardcoded | DELEGATED → Agent B |
| 14 | B | global click listener buildShell | DELEGATED → Agent B |
| 15 | C | C-E-01 setTimeout MV3 CRITICAL | DELEGATED → Agent C |
| 16 | C | C-E-02 onMessage bootstrap race HIGH | DELEGATED → Agent C |
| 17 | C | C-E-03 license bypass CRITICAL | DELEGATED → Agent C |
| 18 | C | C-E-04 chain deadline timer HIGH | DELEGATED → Agent C |
| 19 | C | C-E-05 anon key via BURP_GET_CREDENTIALS | DELEGATED → Agent C |
| 20 | C | C-E-06 executeBurpChain duplicação | DELEGATED → Agent C |
| 21 | D | AF-D-E-01 replay-mutate TypeError URL | DELEGATED → Agent D |
| 22 | D | AF-D-E-02 phone regex false positives | DELEGATED → Agent D |
| 23 | D | AF-D-E-03 curl-exporter comment #id mismatch | DELEGATED → Agent D |
| 24 | D | AF-D-E-04 maskString não exportada | DELEGATED → Agent D |
| 25 | D | AF-D-E-05 JWT_RE threshold discrepancy | DELEGATED → Agent D |
| 26 | D | AF-D-E-06 dep-graph nonce XSS review | DONE (no action — código correto) |

**Total processados:** 26/26 OPENs visíveis no inbox (plano estimava 31; possível que 5 findings de E-self foram registrados diretamente no plan sem criar entradas de inbox separadas)  
**Corrigidos por E:** 3 (manifest bump + 2 host_permissions/CSP)  
**Delegados:** 22  
**Sem ação (info/correto):** 1  

**Riscos residuais:**
- C-E-01 + C-E-02 são as causas prováveis do "painel preto" — Agent C deve priorizar
- C-E-03 (license bypass) é segurança crítica — Agent C deve priorizar
- B-findings (Array.isArray) são regressões silenciosas do fix anterior — Agent B deve tratar em bloco
