# TM2 Plan — Hyper RB Scripts Audit + Bugfix + Melhorias

## Objetivo
Auditar TODOS os 25 scripts/runtime files da extensão **Hyper RB** (`public/burp_src/**`), corrigir bugs (3 confirmados via screenshots) e implementar melhorias funcionais. Cada agente conserta + melhora SEU escopo na mesma wave.

## Bugs confirmados pelo usuário (prioridade MÁXIMA — fixar na W1)
1. **composer-explain.js / `/explain <reqId>`** → "Falha na IA: Request não encontrada". Lookup de reqId no storage está quebrado. Owner: **A** (script) + **J** (runtime glue se for handler/background).
2. **chat-replay.js** → entradas listadas como "21:24:05 · (sem body)". Body não está sendo capturado/persistido para chat requests. Owner: **B** (script) + **J** (provavelmente burp_pageHook.js / burp_background.js não estão clonando o body antes do consume).
3. **smart-replay-fuzz.js** → "Body não-JSON. Smart fuzz suporta apenas requests JSON." Restrição forte demais — deve suportar form-encoded, query-string e text. Owner: **B**.

## N escolhido: 10
**Justificativa:** 25 scripts + 7 runtime files (~12700 LOC) divididos em domínios claramente disjuntos (3 scripts/agente + 1 agente runtime). 10 agentes capable em paralelo é o sweet spot pela Tabela de Decisão (refactor massivo multi-stack, >3500 LOC).

## Chatty: on
Tarefa [complexa].

## Contrato de escopo (DISJUNTO)

| Agent | Escopo (PROIBIDO tocar fora) |
|-------|------------------------------|
| **A** | `public/burp_src/scripts/composer-explain.js`, `ai-prompt-lens.js`, `error-miner.js` — **bug #1** |
| **B** | `public/burp_src/scripts/chat-replay.js`, `replay-mutate.js`, `smart-replay-fuzz.js` — **bugs #2, #3** |
| **C** | `public/burp_src/scripts/cartographer.js`, `dep-graph.js`, `action-classifier.js` |
| **D** | `public/burp_src/scripts/payload-diff.js`, `drift-monitor.js`, `dedup-detector.js` |
| **E** | `public/burp_src/scripts/sse-decoder.js`, `ws-correlator.js`, `e2e-decryptor.js` |
| **F** | `public/burp_src/scripts/header-probe.js`, `token-lifecycle.js`, `cost-profiler.js` |
| **G** | `public/burp_src/scripts/response-schema.js`, `openapi-exporter.js`, `postman-export.js` |
| **H** | `public/burp_src/scripts/curl-exporter.js`, `har-exporter.js`, `_shared.js` |
| **I** | `public/burp_src/scripts/_registry.js`, `public/burp_src/burp_chains.js`, `public/burp_src/burp_ai_client.js` (orquestração + AI client) |
| **J** | **Cross-cutting + runtime owner** + lock de migrations: `public/burp_src/burp_background.js`, `burp_sidepanel.js`, `burp_pageHook.js`, `burp_content.js`, `burp_floating.js`, `burp_sidepanel.html`, `burp_sidepanel.css`, `burp_floating.css`, `manifest.json`. **Root-cause owner dos 3 bugs no lado runtime** (request store / body capture). `supabase/migrations/**` reservado (não esperado tocar). |

**Reservado ao Orchestrator:** `extension/**` (HyperBuild PRO — produto separado, NÃO confundir), `src/**` (admin web), `supabase/functions/**`.

## Diretrizes funcionais (melhorias permitidas)
- Cada agente pode propor 2–4 melhorias funcionais no seu escopo (perf, UX, robustez, novos campos exportados, melhor handling de erros, etc.) E IMPLEMENTAR direto.
- Manter compatibilidade com `_registry.js` (assinaturas dos scripts).
- Manter compatibilidade com handlers do `burp_background.js` (mensagens chrome.runtime).
- Bumpar `BURP_VERSION` em `src/components/burp/BurpLovable.tsx` é responsabilidade do Orchestrator no final (Edit-Request → Orchestrator).
- **EXTENSION SYNC RULE**: Hyper RB tem seu próprio fluxo de release — NÃO sincronizar com `extension/**` (essa pasta é da HyperBuild PRO).

## Status
- Wave: 0
- Status: In Progress
