---
name: test-coverage-blitz
description: "Blitz de cobertura de teste por camada (Vitest unit, Vitest component, Playwright e2e, edge function tests) com meta quantitativa por agente e relatório de coverage antes/depois. Use quando o pedido é 'subir cobertura', 'cobrir esse módulo com testes', 'preparar release com testes', 'red→green em bug antigo sem teste', ou após uma feature factory sem coverage suficiente."
---

<!-- version: 1.0 — fork de task-master-v2 com coverage report obrigatório -->

# Test Coverage Blitz (Layered Coverage Wave)

Skill para campanhas de cobertura de teste com **meta quantitativa por camada**. Cada agente escreve testes só da sua camada e mede coverage delta antes/depois.

## Quando usar

- "Subir cobertura do projeto."
- "Cobrir módulo X com testes."
- Preparar release de produção sem suite consolidada.
- Pós-`feature-factory` se coverage ficou < meta.
- Pós-`bug-hunt-swarm` para garantir teste de regressão.

## Quando NÃO usar

- Escrever 1 teste pontual → direto.
- Refactor de testes existentes → `task-master-v2`.
- TDD de feature nova → `feature-factory` (Agent E já escreve).

## N e papéis

`N ∈ {4..6}`. Default **5**. Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (Vitest Unit)** — `src/lib/**`, `src/hooks/**` (pure logic). Vitest puro, sem render.
- **Agent B (Vitest Component)** — `src/components/**` com `@testing-library/react`. Render + interaction.
- **Agent C (Playwright E2E)** — `e2e/**` ou `playwright/**`. Smoke + fluxos críticos (login, listar licenças, etc.).
- **Agent D (Edge Function Tests)** — `supabase/functions/**/test.ts` ou `tests/edge/**`. Vitest com mocks de Deno serve / supabase client.
- **Agent E (Synthesizer & Coverage)** — roda `bunx vitest run --coverage` antes e depois. Escreve `tcb-report.md` com tabela `camada | linhas antes | linhas depois | delta | gap remanescente`.

## Waves

- **W1 (Baseline):** Orchestrator + Agent E rodam coverage atual. Salvam em `tcb-baseline.md`.
- **W2 (Write):** SPAWN paralelo de A, B, C, D. Cada um escreve testes da sua camada com meta acordada.
- **W3 (Measure):** Agent E remede coverage, compara, identifica gaps.
- **W4 (Plug gaps, opcional):** SPAWN agentes designados para fechar gaps remanescentes prioritários.

## Arquivos de coordenação

Prefixo **`tcb-`**: `tcb-plan.md`, `tcb-inbox-A..E.md`, `tcb-baseline.md`, `tcb-report.md`.

## Setup obrigatório

Se projeto não tem Vitest configurado, Orchestrator aplica setup (`vitest.config.ts`, `src/test/setup.ts`, `tsconfig` types) **antes** de spawnar. Vide knowledge `frontend-testing-setup`.

## Critérios de aceite por camada

| Agente | Meta padrão |
|---|---|
| A (unit) | ≥80% lib + hooks puros |
| B (component) | ≥60% componentes críticos (admin + auth) |
| C (e2e) | ≥5 fluxos smoke verdes |
| D (edge) | ≥1 happy + ≥1 error path por edge crítica |

Ajustar no `tcb-plan.md` por contexto.

## Regras invioláveis

1. **Sem teste flaky:** se teste passa só às vezes, agente refatora ou remove.
2. **Sem teste tautológico** (`expect(true).toBe(true)`).
3. **Mocks razoáveis:** edge tests mockam Deno + supabase client, não bypassam validação.
4. **Cobertura medida:** wave fechada sem `tcb-report.md` com números reais = falha.
5. **Sem desabilitar testes existentes** para subir cobertura artificialmente.
6. **Não toca código de produção** salvo refactor mínimo de testabilidade (≤5 linhas, justificado no inbox).

## Encerramento

`Test Coverage Blitz · N=<n> · coverage <antes>% → <depois>% · <m> testes novos · report em tcb-report.md · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Teste tautológico.
- ❌ Teste flaky aceito.
- ❌ Skipar/desabilitar testes para subir métrica.
- ❌ Edge test bypassando HMAC/auth real.
- ❌ Editar prod sem justificar.
- ❌ Fechar sem coverage antes/depois.