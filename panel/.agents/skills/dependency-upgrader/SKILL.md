---
name: dependency-upgrader
description: "Upgrade isolado de dependências por runtime (npm, edge function imports, extensão MV3) com 1 agente dono do lockfile e teste de regressão por camada. Use quando o pedido é 'atualizar deps', 'rodar npm audit', 'subir React/Vite/Supabase client', 'corrigir CVE'. Cap em patch+minor por wave; major exige flag explícita."
---

<!-- version: 1.0 — upgrade isolado com lock em lockfile -->

# Dependency Upgrader (Isolated Per-Runtime Upgrade)

Upgrade de dependências com **lock duro** no lockfile (`package.json`/`bun.lockb`/`package-lock.json`). Apenas Agent A mexe em deps; outros validam consumers por camada.

## Quando usar

- "Atualizar dependências."
- CVE em pacote (output de `npm audit` ou `dependency_scan`).
- Bump de React/Vite/Tailwind/Supabase client.
- Refresh de Deno imports nas edge functions.

## Quando NÃO usar

- Adicionar pacote novo → `bun add` direto.
- Remover pacote → idem.
- Migration de framework (React 18→19 major sem prep) → conversa de planejamento primeiro.

## N e papéis (N=3)

Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (Lockfile Owner, LOCK)** — único com permissão em `package.json` e lockfile. Roda `code--dependency_scan`, decide bumps, executa `bun update <pkg>` ou edição direta. Cap **patch + minor** por wave; major só com flag `MAJOR=true` no plan.
- **Agent B (Web Consumers)** — `src/**` ajusta breaking changes de libs do frontend (React, react-query, shadcn, motion, etc.).
- **Agent C (Edge Consumers)** — `supabase/functions/**`. Ajusta imports Deno (`https://deno.land/x/...`, `npm:` specifiers) e breaking changes de SDKs server-side.

Extensão MV3 normalmente não tem deps npm (vanilla JS); se houver, B cobre.

## Waves

- **W1 (Scan & Plan):** SPAWN só A. Roda `code--dependency_scan` + lista bumps propostos em `du-bumps.md`. Sem code change ainda.
- **W2 (Bump):** SPAWN A novamente. A aplica bumps + regen lockfile. B e C ficam de fora.
- **W3 (Adapt):** SPAWN B + C em paralelo. Ajustam consumers para breaking changes.
- **W4 (Audit final):** A roda `dependency_scan` de novo, confirma CVE residual, escreve `du-report.md`.

## Arquivos de coordenação

Prefixo **`du-`**: `du-plan.md`, `du-inbox-A..C.md`, `du-bumps.md`, `du-report.md`.

## Regras invioláveis

1. **Só Agent A** edita `package.json`/lockfile.
2. **Patch+minor por wave.** Major bloqueado salvo flag `MAJOR=true` no plan.
3. **Sem update às cegas** — A justifica cada bump no `du-bumps.md`.
4. **Sem força de pino arbitrário** — manter ranges existentes (`^`, `~`).
5. **Edges Deno:** A documenta nova URL/versão dos imports `https://deno.land/x/...` no `du-bumps.md`.
6. **Testes existentes** continuam passando após W3; se quebrar, B/C corrige ou A reverte.
7. **CVE residual** documentado no `du-report.md` (não silenciar).

## Encerramento

`Dependency Upgrader · N=3 · <n> bumps (patch+minor) · CVE: <n→m> · consumers ajustados · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ B ou C tocar lockfile.
- ❌ Major sem flag.
- ❌ Bumpar tudo sem justificar.
- ❌ Silenciar CVE residual.
- ❌ Forçar pino exato em libs com range.
- ❌ Pular W4 (audit final).