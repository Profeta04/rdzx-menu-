---
name: perf-strike
description: "Ataque coordenado de performance com critérios quantitativos (LCP, TTFB, bundle KB, edge p95, renders evitados). Agentes paralelos cobrem bundle/code-split, React render, edge cold start + queries, assets e analytics. Use quando o pedido é melhorar performance medida (app lento, bundle grande, edge p95 alto, dashboard que trava com muitos itens, LCP ruim no Lighthouse)."
---

<!-- version: 1.0 — fork de task-master-v2 com métricas antes/depois -->

# Perf Strike (Quantitative Performance Wave)

Skill para ataques de performance com **critérios de aceite quantitativos**. Cada agente entra com checklist próprio e mede antes/depois.

## Quando usar

- "App lento." / "Dashboard trava." / "Bundle grande."
- LCP/TTFB ruim no Lighthouse.
- Edge function com p95 alto nos logs.
- Lista no admin que demora com N>100.
- Cold start de edge function novo.

## Quando NÃO usar

- Bug funcional → `bug-hunt-swarm` ou v2.
- Refactor de design → `design-system-refactor`.
- "Sentimento" de lentidão sem reprodução → primeiro instrumente.

## N e papéis

`N ∈ {3..5}`. Default **5**. Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (Bundle & Code-split)** — `vite.config.ts`, dynamic imports, lazy routes, manualChunks, tree-shake. Alvo: KB de bundle inicial.
- **Agent B (React Render)** — `memo`, `useMemo`, `useCallback`, virtualização (`@tanstack/virtual` se aplicável), react-query `staleTime`/`gcTime`, eliminar renders em cascata. Alvo: número de renders por interação.
- **Agent C (Edge Functions)** — cold start (top-level imports), queries N+1, índices ausentes (propor migration via Agent E se for o caso), `EXPLAIN ANALYZE` em queries lentas. Alvo: p95 de edge.
- **Agent D (Assets)** — imagens (formato WebP/AVIF, dimensões), fontes (subset, preload, font-display:swap), ícones inlined, SRI. Alvo: KB de assets + LCP.
- **Agent E (Synthesizer & Migrations)** — único com permissão em `supabase/migrations/**` (novos índices). Roda `analytics--read_project_analytics` antes/depois. Escreve `ps-report.md` com tabela `métrica | antes | depois | delta`.

## Waves

- **W1 (Baseline):** Orchestrator captura métricas iniciais (Lighthouse mock, bundle size via `du -sh dist/`, edge logs). Registra em `ps-baseline.md`.
- **W2 (Strike):** SPAWN paralelo dos N agentes. Cada um aplica fixes do checklist próprio.
- **W3 (Measure):** Orchestrator + Agent E remede e comparam.
- **W4 (opcional):** se métrica regrediu em alguma camada, agente responsável corrige.

## Arquivos de coordenação

Prefixo **`ps-`**: `ps-plan.md`, `ps-inbox-A..E.md`, `ps-baseline.md`, `ps-report.md`.

## Critérios de aceite por agente

| Agente | Métrica | Alvo padrão |
|---|---|---|
| A | Bundle inicial (gzip) | -20% ou ≤ 250 KB |
| B | Renders por interação chave | -50% |
| C | Edge p95 | -30% ou ≤ 500ms |
| D | LCP | -30% ou ≤ 2.5s |
| E | — | Report completo |

Ajustar por contexto; registrar metas no `ps-plan.md`.

## Regras invioláveis

1. **Sem fix sem baseline.** W1 obrigatório.
2. **Sem critério qualitativo.** Tudo medido.
3. **Lock migrations:** só Agent E adiciona índices.
4. **Sem regressão funcional.** Se teste quebrar, reverter o fix do agente.
5. **react-query:** nunca remover `queryKey` ou quebrar invalidações em nome de perf.

## Encerramento

`Perf Strike · N=<n> · bundle -X% · renders -Y% · edge p95 -Zms · LCP -Wms · report em ps-report.md · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Skipar baseline.
- ❌ "Ficou mais rápido na minha máquina" sem número.
- ❌ Memoizar tudo às cegas (cria leak).
- ❌ Remover RLS/auth por perf.
- ❌ Adicionar índice sem migration formal via Agent E.