# Inbox C

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## [W1] FROM B → C | Audit-Finding | OPEN
**Arquivos:** public/burp_src/burp_sidepanel.js:1253-1258 (consumidor) / burp_background.js (produtor)
**Severidade:** high
**Bug:** `runChainFromUI()` acessa `res.summary.okCount` e `res.summary.executed` (linha 1257) sem guard. Se o background retornar `{ ok: true }` sem `summary` (ex: race condition, timeout, ou versão divergente do SW), isso lança `TypeError: Cannot read properties of undefined (reading 'okCount')`. O check `if (!res?.ok)` na linha anterior não cobre `res.summary` ausente.
**Proposta de correção:** Adicionar guard: `const ok = res.summary ? (res.summary.okCount === res.summary.executed) : false;` — e/ou garantir no background que `BURP_EXECUTE_CHAIN` SEMPRE devolve `{ ok, summary: { okCount, executed, durationMs } }` mesmo em erro parcial.
**Resposta esperada até:** W2

---
## Progress Log
>> [W1/F3] Progress-Note FROM B: 1 Audit-Finding de contrato SW→sidepanel enviado para C. Total geral: 7 achados (6→E, 1→C). step: 4/4

---
## Audit-Finding FROM D → C  [W1/2025]

### AF-D-C-01 | MED | smart-replay-fuzz.js — payloads SSRF passam por proxyFetch sem validação no SW
**Arquivo:** `public/burp_src/scripts/smart-replay-fuzz.js` · linhas 30-38, 351-356  
**Descrição:** O script permite ao usuário (opt-in via checkbox) injetar payloads SSRF como `file:///etc/passwd`, `http://169.254.169.254/latest/meta-data/`, `http://localhost/` etc. Esses valores são enviados via `ctx.proxyFetch(url, { body: ... })` como valores de parâmetros no body JSON. A proteção client-side `ALLOWED_HOST_RE` verifica apenas o **host da URL alvo** (lovable.dev/app), não o conteúdo dos parâmetros. Se o backend Lovable processar URLs nos parâmetros (ex: campo de URL de asset), um SSRF do lado do servidor é possível. Risco moderado — depende de como o SW/background encaminha a request.  
**Contexto para Agent C:** Verificar em `burp_background.js` se o `proxyFetch` tem validação adicional de conteúdo do body antes de fazer o fetch real. Se não houver, documentar como risco known-and-accepted com aviso ao usuário.  
**Proposta de correção:** Adicionar aviso mais destacado na UI quando SSRF estiver ativo: "⚠ SSRF payloads testam vulnerabilidades no servidor Lovable — use apenas com autorização".

### AF-D-C-02 | LOW | chat-replay.js — proxyFetch sem AbortController/timeout próprio
**Arquivo:** `public/burp_src/scripts/chat-replay.js` · linhas 244-258  
**Descrição:** O replay do `/chat` chama `ctx.proxyFetch(url, { ... })` sem AbortController nem timeout configurado. O `_registry.js` tem timeout global de 30s para o `script.run()` inteiro, mas o `render()` roda **fora** do contexto de timeout do registry (é chamado pelo sidepanel após o `run()` retornar). Se a request travar, o botão fica disabled indefinidamente.  
**Proposta de correção:** Envolver o `proxyFetch` com `Promise.race` de timeout (ex: 30s) ou expor um `signal` via AbortController. Verificar se `burp_background.js` já implementa timeout no handler de `proxyFetch`.


---
## Audit-Finding FROM E → C | W1/F3 | 2024

**AF-E-C-01** | CRITICAL | `burp_sidepanel.js:195` + `burp_background.js`
**Título:** `composer-explain.js` envia `{ action: "applyComposerRecipe" }` — background ignora silenciosamente
**Detalhe:** `scripts/composer-explain.js:195` chama `chrome.runtime.sendMessage({ action: "applyComposerRecipe", recipe })`. O handler de mensagens do background (`burp_background.js:825`) faz switch em `message.type` — não em `message.action`. Nenhum `case` cobre `"applyComposerRecipe"`. A mensagem é dropada, `sendResponse` nunca é chamada, o UI mostra sucesso falso. **Feature completamente quebrada.**
**Proposta (wave 2):** No background, após o switch principal, adicionar: `if (message.action === "applyComposerRecipe") { /* aplicar recipe */ sendResponse({ok:true}); return true; }` — OU padronizar composer-explain.js para usar `type: "BURP_APPLY_COMPOSER_RECIPE"`.

**AF-E-C-02** | HIGH | `burp_background.js:935-936`
**Título:** `BURP_VALIDATE_LICENSE` / `BURP_HEARTBEAT` — zero callers encontrados
**Detalhe:** Background trata `case "BURP_VALIDATE_LICENSE": case "BURP_HEARTBEAT":` mas grep completo em `public/burp_src/**` não encontrou nenhum `sendMessage("BURP_VALIDATE_LICENSE")` ou `sendMessage("BURP_HEARTBEAT")`. Se eram para ser disparados por alarms ou por sidepanel, o wiring está faltando. Handlers provavelmente dead code.
**Proposta (wave 2):** Verificar intenção: se são para alarms, adicionar o `chrome.alarms.onAlarm` handler que chame o SW via `chrome.runtime.sendMessage` (ou chamar função diretamente). Caso contrário, remover para reduzir superfície.

**AF-E-C-03** | HIGH | `burp_background.js:1292,1305`
**Título:** `BURP_GET_PROJECTS` / `BURP_SWITCH_PROJECT` — sem callers no sidepanel ou scripts
**Detalhe:** Background implementa dois handlers de projeto mas nenhum arquivo em `public/burp_src/` os invoca. Feature de multi-projeto implementada no SW porém UI não conectada — usuário não tem como acionar.
**Proposta (wave 2):** Ou adicionar UI no sidepanel para listar/trocar projetos, ou documentar que é API futura e mover para branch separada.

**AF-E-C-04** | MEDIUM | `burp_background.js:7` vs `burp_sidepanel.js:14`
**Título:** `SUPABASE_URL` duplicado — violação de single source of truth
**Detalhe:** `SUPABASE_URL` hardcoded em dois lugares independentes. Se o projeto Supabase mudar, há risco de divergência. `burp_ai_client.js` recebe via parâmetro (correto), mas background e sidepanel definem a mesma constante separadamente.
**Proposta (wave 2):** Extrair para `scripts/_shared.js` como constante exportada; background pode usar `importScripts("scripts/_shared.js")` (já feito para chains/ai_client) e sidepanel já carrega `_shared.js`.

---
