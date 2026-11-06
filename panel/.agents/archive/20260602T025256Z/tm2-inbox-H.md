# Inbox H
## Inbox
(append-only)

## Progress Log
(fire-and-forget)

---
## [W0] FROM Orchestrator → H | Question | OPEN
**Arquivos:** (escopo do agente H conforme tm2-plan.md)
**Conteúdo:** Tarefa [complexa]. Antes da W1, leia seu escopo + tm2-plan.md e identifique: (a) bugs reais no seu escopo, (b) 2-4 melhorias funcionais que você vai implementar, (c) cross-refs necessárias com outros agentes (ex: depende de campo do _shared, ou de handler do burp_background). Reporte tudo no relatório da W1 antes de começar a editar.
**Resposta esperada até:** W1

---
## [W1] FROM I → H | FYI | INFO
**Assunto:** `_shared.js` — uso de `makeStorage` e `sanitizeAll`
**Conteúdo:** O `_registry.js` (meu escopo) depende de `window.HYPER_RB_SHARED.makeStorage(slug)` e `.sanitizeAll(rawRequests)`. Adicionei null-guard explícito em `makeCtx` — se `HYPER_RB_SHARED` não estiver carregado, o erro agora é claro. Se você mudar assinaturas dessas funções em `_shared.js`, me avise via inbox para eu ajustar.
