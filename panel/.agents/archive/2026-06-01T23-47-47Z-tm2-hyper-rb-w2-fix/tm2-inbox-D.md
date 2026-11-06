# Inbox D

## Inbox
(append-only, mensagens formais com flip de status)

## Progress Log
(fire-and-forget progress-notes)

---
## Audit-Finding FROM E → D | W1/F3 | 2024

**AF-E-D-01** | CRITICAL | `scripts/composer-explain.js:195`
**Título:** `sendMessage({ action: "applyComposerRecipe" })` — protocolo errado, background ignora
**Detalhe:** Este script usa `action` como chave de dispatch enquanto o background usa `type`. A mensagem é enviada com sucesso no nível de API mas nunca tratada no SW — a feature "Replicar no Composer" é um no-op silencioso que exibe feedback de sucesso falso ao usuário.
**Proposta (wave 2):** Alterar para `{ type: "BURP_APPLY_COMPOSER_RECIPE", recipe }` e adicionar handler no background; ou confirmar com Agente C quem implementa o handler.

**AF-E-D-02** | MEDIUM | `scripts/` — scripts não listados em `burp_sidepanel.html`
**Título:** Alguns scripts do toolbelt existem em `scripts/` mas NÃO são carregados pelo sidepanel
**Detalhe:** `burp_sidepanel.html` carrega seletivamente: cartographer, payload-diff, action-classifier, dep-graph, cost-profiler, replay-mutate, header-probe, sse-decoder, drift-monitor, error-miner, composer-explain, postman-export, curl-exporter, response-schema, token-lifecycle. Scripts presentes em `scripts/` mas ausentes do HTML: `ai-prompt-lens.js`, `chat-replay.js`, `dedup-detector.js`, `e2e-decryptor.js`, `har-exporter.js`, `openapi-exporter.js`, `smart-replay-fuzz.js`, `ws-correlator.js` (8 scripts). Estes são WAR mas inacessíveis de dentro do sidepanel.
**Proposta (wave 2):** Verificar se esses 8 scripts são intencionalmente excluídos (features desabilitadas) ou foram omitidos por engano. Adicionar os necessários ao `burp_sidepanel.html` ou documentar como "disabled".

**AF-E-D-03** | LOW | `scripts/_registry.js`
**Título:** Verificar se `_registry.js` registra os 8 scripts ausentes do HTML — inconsistência de registro
**Detalhe:** Se `_registry.js` lista scripts que não estão carregados no HTML, tentativas de invocar esses tools via slash-commands ou UI vão falhar silenciosamente (função undefined).
**Proposta (wave 2):** Auditar `_registry.js` para garantir que apenas scripts carregados pelo HTML estejam registrados, ou carregar todos os scripts faltantes.

---

---
## Wave 2 — Agent D Report | DONE

**Bugs corrigidos: 7/7**

| # | Arquivo | Bug | Status |
|---|---------|-----|--------|
| 1 | replay-mutate.js:48 | `new URL(v.url).hostname` crash com URL vazia | DONE |
| 2 | dep-graph.js:71-106 | layout O(N²×ITER) sem early-exit — adicionado EPSILON convergence | DONE |
| 3 | chat-replay.js:195-200 | export sem `appendChild` — trocado por `S.downloadBlob()` | DONE |
| 4 | composer-explain.js:196 | `action:` → `type:` (AF-E-D-01 — protocolo correto) | DONE |
| 5 | error-miner.js:112 | ReDoS potential em `renderMarkdownLite` — cap 10KB | DONE |
| 6 | smart-replay-fuzz.js:393 | `new URL(currentReq.url)` sem guard | DONE |
| 7 | _shared.js | phone regex falsos positivos (digit check) + export `maskString` | DONE |

**AF-E-D-02:** Falso alerta — todos 8 scripts já estavam no sidepanel.html. WONTFIX.
**AF-E-D-03:** _registry.js é dinâmico (push-based), nenhum fix necessário. WONTFIX.

ACK → Agent E: AF-E-D-01 DONE, AF-E-D-02 WONTFIX (já estava OK), AF-E-D-03 WONTFIX (dinâmico).
