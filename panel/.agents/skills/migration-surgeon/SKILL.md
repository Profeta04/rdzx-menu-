---
name: migration-surgeon
description: "Skill para mudanças de schema arriscadas no Supabase (rename de coluna, split de tabela, mudança de enum, backfill, RLS rework, novas RPCs). Garante ordem obrigatória migration → types → consumers → edges com lock duro de quem toca migrations. Use quando o pedido envolve alterar estrutura de banco já em produção (migrate column, alter table, novo enum, mover dados, mudar policy)."
---

<!-- version: 1.0 — fork especializado de task-master-v2 com lock duro em migrations -->

# Migration Surgeon (Schema Change Pipeline)

Fork de `task-master-v2` para **mudanças de schema arriscadas** onde a ordem importa: migration primeiro, depois types regenerados, depois consumers, depois edges, e por último um rollback plan validado. O agente sênior `Agent A` tem **lock exclusivo absoluto** sobre `supabase/migrations/**` e `supabase/config.toml`.

## Quando usar

- Rename / drop / split de coluna ou tabela em uso.
- Adicionar/alterar enum (`app_role`, status, etc.).
- Backfill de dados (UPDATE em massa via migration).
- Rework de RLS policies ou GRANTs em tabela com tráfego.
- Nova RPC / função `SECURITY DEFINER` que muda contrato.
- Mudar tipo de coluna (timestamp → timestamptz, jsonb shape, etc.).

## Quando NÃO usar

- Tabela nova isolada sem consumers → `task-master-v2` ou migração direta.
- Só ajustar consumers sem tocar schema → `task-master-v2`.
- Hotfix de policy óbvio em 1 arquivo → migração direta.

## N e papéis

`N ∈ {2..4}`. Default **4**. Sempre `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (Migration Owner, LOCK)** — ÚNICO com permissão em `supabase/migrations/**` e `supabase/config.toml`. Escreve a migration completa (DDL + GRANTs + RLS + backfill). Roda `supabase--linter` no final. Anexa rollback SQL em `ms-rollback.md`.
- **Agent B (Types & Consumers)** — após Agent A terminar W1: ajusta `src/**` (hooks, components, lib) que referenciam tabela/coluna alterada. Aguarda `types.ts` regenerar (automático).
- **Agent C (Edge Functions)** — paralelo a B na W2: ajusta `supabase/functions/**` que tocam a tabela. **NÃO** edita migrations.
- **Agent D (Synthesizer / QA)** — wave final: roda `supabase--linter` + `supabase--read_query` em queries-canário, valida que rollback funciona conceitualmente, escreve `ms-report.md` com diff de schema + lista de consumers ajustados + plano de rollback.

Reduzir N: N=2 (A+D apenas) só se schema não tem consumers; N=3 colapsa B+C num agente full-stack.

## Arquivos de coordenação

Prefixo **`ms-`**:
- `.agents/shared/ms-plan.md`
- `.agents/shared/ms-inbox-A..D.md`
- `.agents/shared/ms-rollback.md` (apenas Agent A escreve; lido por D)
- `.agents/shared/ms-report.md` (apenas Agent D escreve na wave final)

## Ordem obrigatória de waves

1. **W1 (Schema only):** SPAWN APENAS Agent A. B/C/D ainda não rodam. A entrega migration aplicada + `ms-rollback.md` + lista de breaking changes nos inboxes de B/C.
2. **W2 (Code adapt):** Orchestrator confirma `types.ts` regenerado (lê `src/integrations/supabase/types.ts`). SPAWN paralelo de B + C. Agent A pode entrar novamente para hotfixes de migration se C/B reportarem schema gap (via `Migration-Request` no inbox de A).
3. **W3 (QA & sign-off):** SPAWN apenas Agent D. Lê tudo, roda linter, escreve report.

Mínimo 3 waves. Cross-wave parallel proibido (B e C nunca rodam antes de A terminar W1).

## Regras invioláveis

1. **Lock de migrations:** só Agent A escreve em `supabase/migrations/**` ou `supabase/config.toml`. Qualquer outro agente: `Migration-Request → A`.
2. **Sem skip da W1:** B e C JAMAIS spawnados antes de A entregar.
3. **GRANTs obrigatórios:** toda `CREATE TABLE public.*` na migration tem `GRANT` + RLS + policy na MESMA migration (regra do projeto).
4. **Rollback obrigatório:** A escreve `ms-rollback.md` antes de fechar W1. Sem rollback = wave rejeitada.
5. **Backfill em batch:** updates > 10k linhas → batch com `WHERE id BETWEEN` documentado no rollback.
6. **Sem `ALTER DATABASE postgres`** (regra do projeto).
7. **Linter clean** antes de D fechar.

## Encerramento

`Migration Surgeon · N=<n> · schema change <descrição> · rollback documentado · consumers atualizados · report em ms-report.md · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Spawnar B/C antes de A terminar W1.
- ❌ Outro agente editar migrations.
- ❌ Migration sem GRANT / RLS / rollback.
- ❌ Backfill grande sem batch.
- ❌ Fechar sem `supabase--linter` clean.