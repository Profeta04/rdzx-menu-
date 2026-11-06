# Inbox B

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

>> [W1/F3] Progress-Note FROM A: Auditando contrato iframe floating→sidepanel. Encontrado 1 achado relevante para B (rapid-reload race afeta experiência do sidepanel). step: 3/3

---
## [W1] FROM A → B | Audit-Finding | OPEN
**Arquivos:** public/burp_src/burp_floating.js:129-132 + public/burp_src/burp_sidepanel.html (iframe consumer)
**Severidade:** med
**Bug:** Rapid-reload no overlay injeta novo src `iframeSrc + "?_r=" + Date.now()` sem aguardar o evento `load` anterior completar. O sidepanel HTML (burp_sidepanel.js) pode estar no meio de uma inicialização (registrando listeners, carregando storage) quando o src é substituído — o contexto JS do iframe é destruído imediatamente, potencialmente deixando promessas pendentes sem rejeição e storage writes incompletas. O `burp_sidepanel.js` não tem guarda contra destruição de contexto mid-init.
**Proposta de correção:** No `doReload()` (burp_floating.js:123), definir `iframe.src = "about:blank"` primeiro e aguardar `load` (via Promise/listener) antes de setar o src real. No burp_sidepanel.js, verificar `document.visibilityState` ou usar `beforeunload` para flush de estado pendente antes do teardown.
**Resposta esperada até:** W2


---
## Audit-Finding FROM C → B | C-B-01 | HIGH | Sidepanel pode receber estado vazio durante boot do SW (race bootstrap)

**Arquivo:** `public/burp_src/burp_background.js` — L825 (onMessage sem await bootstrap)  
**Severidade:** high  
**Categoria:** UX / painel preto

**Descrição:**  
Quando o SW acorda via mensagem do sidepanel (ex: `BURP_GET_STATE` enviado assim que o painel abre), o handler responde antes de `restoreState()` completar. O sidepanel recebe `network: {count:0}`, `auth: {hasBearerToken:false}`, `license: {valid:false}` — tudo zerado. Se o sidepanel não tiver lógica de retry/polling após receber estado vazio, ele renderiza como se nada tivesse sido capturado ("painel preto"). Esse é provavelmente um dos cenários por trás do bug de painel preto relatado.

**Recomendação para B (Wave 2):**  
1. Verificar se `burp_sidepanel.js` implementa retry de `BURP_GET_STATE` ou aguarda o broadcast `BURP_STATE_READY`.  
2. Se não: adicionar listener para `BURP_STATE_READY` que atualiza o estado renderizado mesmo que já tenha recebido um estado vazio anterior.  
3. Correção principal está no background (C-E-02), mas o sidepanel deve ser resiliente a estado vazio inicial.

---
## Audit-Finding FROM C → B | C-B-02 | MEDIUM | License always-valid bypass pode exibir features pagas a usuários sem licença

**Arquivo:** `public/burp_src/burp_background.js` — L935-947  
**Severidade:** medium  
**Categoria:** UX / controle de acesso

**Descrição:**  
`BURP_VALIDATE_LICENSE` retorna `valid:true` incondicionalmente. Se o sidepanel usa essa mensagem para habilitar/desabilitar features pagas (ex: AI Explain, Chain Builder), elas ficarão sempre habilitadas — mesmo sem licença válida. Também implica que `state.license.valid=false` no `getPublicState()` pode contradizer a resposta de `BURP_VALIDATE_LICENSE`, causando inconsistência de UI (ícone de licença vermelho mas features desbloqueadas).

**Recomendação para B:**  
Auditar em `burp_sidepanel.js` quais paths de código dependem de `BURP_VALIDATE_LICENSE` vs `state.license.valid` do `BURP_GET_STATE`/`BURP_STATE_READY`. Normalizar para usar apenas `state.license.valid` (do state broadcast) como source of truth para gating de UI.

## Progress Log

>> [W1/F4] Progress-Note FROM C: Findings enviados a A (2) e B (2). Total: 10 achados em 3 inboxes (E×6, A×2, B×2). step: 6/6

---
## Audit-Finding FROM D → B  [W1/2025]

### AF-D-B-01 | HIGH | dep-graph.js — O(N²) em buildGraph (freeze de UI)
**Arquivo:** `public/burp_src/scripts/dep-graph.js` · linhas 25-41  
**Descrição:** O loop interno em `buildGraph()` varre para trás a partir de cada request até que `r.ts - p.ts > WINDOW_MS`. Se N requests chegarem dentro da janela de 5s (cenário realista em bursts), o inner loop roda O(N) por request → O(N²) total. Com 1000 requests em rajada, isso são ~500K iterações síncronas na main thread do sidepanel, causando freeze perceptível (> 1s).  
**Proposta de correção:** Manter ponteiro `left` (two-pointer) que avança à medida que `r.ts - sorted[left].ts > WINDOW_MS`, reduzindo a O(N) total. Já existe o `MAX_NODES=200` como cap de exibição mas o loop acontece ANTES do cap.

### AF-D-B-02 | HIGH | dep-graph.js — layout() O(N²×ITER) bloqueia thread (200×200×100 = 4M iters)
**Arquivo:** `public/burp_src/scripts/dep-graph.js` · linhas 62-108  
**Descrição:** O algoritmo force-directed roda `ITER=100` iterações de repulsão O(N²) → 100×200²=4.000.000 iterações. Mesmo com `requestIdleCallback`, cada "chunk" pode tomar > 50ms gerando janking visível.  
**Proposta de correção:** Usar `requestIdleCallback` com particionamento: executar 10 iterações por frame, verificando `deadline.timeRemaining()`. Ou reduzir ITER para 50 com cooling mais agressivo.

### AF-D-B-03 | HIGH | chat-replay.js — `a.click()` sem appendChild no DOM
**Arquivo:** `public/burp_src/scripts/chat-replay.js` · linhas 196-200  
**Descrição:** O botão "Export MD" cria um `<a>` com `URL.createObjectURL`, faz `a.click()` mas **não insere o elemento no DOM** antes do click. Em extension sidepanel (contexto iframe/restricted), o download silenciosamente não ocorre em alguns contextos Chromium (requere elemento attached ao DOM).  
```js
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = `chat-replay-${Date.now()}.md`;
a.click();  // ← sem document.body.appendChild(a) 
```
**Proposta de correção:** Usar `S.downloadBlob()` já disponível em `_shared.js` que faz append+click+remove corretamente, ou adicionar `document.body.appendChild(a)` antes do click e `a.remove()` depois.

### AF-D-B-04 | MED | action-classifier.js — re-chunk redundante + mapeamento incorreto em batch failures
**Arquivo:** `public/burp_src/scripts/action-classifier.js` · linhas 259-276  
**Descrição:** No loop de processamento dos resultados de batch, o código chama `chunk(pending, BATCH_SIZE)[bi]` a cada iteração. Isso re-executa a divisão de array em cada iteração (desnecessário) e mais importante: se `batchResults` tiver comprimento diferente de `chunk(pending, BATCH_SIZE)`, os índices `bi` ficam desalinhados. A variável `tasks` foi construída como `chunk(pending, BATCH_SIZE).map(...)` — o correto seria guardar o resultado do `chunk` em uma variável `batches` e indexar `batches[bi]`.  
**Proposta de correção:** `const batches = chunk(pending, BATCH_SIZE); const tasks = batches.map(...); ...` e usar `batches[bi]` no loop de resultados.

### AF-D-B-05 | MED | error-miner.js — renderMarkdownLite ReDoS potencial
**Arquivo:** `public/burp_src/scripts/error-miner.js` · linhas 113-119  
**Descrição:** `renderMarkdownLite` aplica regex ` /```([\s\S]*?)```/g ` sobre a string já escaped de saída da IA. Se a IA retornar texto com muitos backticks sem fechar (ex: 10000 chars de um output mal formado), o backtracking de `[\s\S]*?` pode causar degradação de performance.  
**Proposta de correção:** Adicionar limite explícito: `/```([\s\S]{0,2048}?)```/g` ou usar split/join em vez de regex para substituições de bloco de código.


---
## Audit-Finding FROM E → B | W1/F3 | 2024

**AF-E-B-01** | HIGH | `burp_sidepanel.js` linhas 1620, 1634, 1652, 1694
**Título:** Dois padrões distintos de `sendMessage` no mesmo arquivo — inconsistência de contrato
**Detalhe:** Existe um wrapper Promise-based bem definido em `sendMessage()` (linha 117) que faz timeout, trata `chrome.runtime.lastError` e resolve/rejects corretamente. Porém as linhas 1620, 1634, 1652, 1694 usam `chrome.runtime.sendMessage(...)` raw com callback. Esses callbacks não têm o mesmo tratamento de erro e podem silenciar falhas. O código do sidepanel registrado em escopo diferente (dentro de `handleToolScriptMessage` ou similar) pode não ter acesso ao wrapper.
**Proposta (wave 2):** Unificar via `sendMessage()` wrapper ou extrair helper compartilhado; garantir que todos os call-sites no sidepanel usem o mesmo padrão de erro-handling.

**AF-E-B-02** | MEDIUM | `burp_sidepanel.html` linha 43 + `burp_sidepanel.js`
**Título:** `composer-explain.js` carregado no sidepanel envia `{ action: "applyComposerRecipe" }` — sem handler no background
**Detalhe:** `scripts/composer-explain.js:195` emite `chrome.runtime.sendMessage({ action: "applyComposerRecipe", recipe })`. O background (`burp_background.js`) dispatcheia por `message.type` (switch-case em `BURP_*`), não por `message.action`. Nenhum case trata `applyComposerRecipe`. A mensagem é enviada e silenciosamente descartada — o UI exibe "Recipe enviado ao Composer ✓" mas nada acontece.
**Proposta (wave 2):** Ou adicionar case `"applyComposerRecipe"` no background (usando `message.action`), ou refatorar `composer-explain.js` para usar `type: "BURP_APPLY_COMPOSER_RECIPE"` e adicionar handler correspondente.

---
