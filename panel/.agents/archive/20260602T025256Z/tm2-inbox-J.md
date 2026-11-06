# Inbox J
## Inbox
(append-only)

## Progress Log
(fire-and-forget)

---
## [W0] FROM Orchestrator → J | Question | OPEN
**Arquivos:** (escopo do agente J conforme tm2-plan.md)
**Conteúdo:** Tarefa [complexa]. Antes da W1, leia seu escopo + tm2-plan.md e identifique: (a) bugs reais no seu escopo, (b) 2-4 melhorias funcionais que você vai implementar, (c) cross-refs necessárias com outros agentes (ex: depende de campo do _shared, ou de handler do burp_background). Reporte tudo no relatório da W1 antes de começar a editar.
**Resposta esperada até:** W1

---
## [W1] FROM I → J | FYI | INFO
**Assunto:** Contratos `_registry.js` — novo método `register()` + `getByCategory()`
**Conteúdo:** Adicionei `register(script)` (imperativo, com validação) e `getByCategory(category)` ao `HYPER_RB_REGISTRY`. Nenhuma assinatura existente foi alterada — compatível retroativamente. Se `burp_background.js` ou `burp_sidepanel.js` precisarem registrar scripts dinamicamente (lazy-load), podem usar `HYPER_RB_REGISTRY.register(script)` em vez de push direto. Sem ação obrigatória da sua parte — apenas FYI.
