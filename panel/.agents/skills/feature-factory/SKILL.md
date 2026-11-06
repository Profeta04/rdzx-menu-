---
name: feature-factory
description: "Pipeline para entregar feature nova ponta-a-ponta (schema → edge function → hook/types → UI → teste → docs) com dependências sequenciais entre waves. Use quando o pedido é uma feature inteira nova que exige novo banco + nova edge + novo componente + integração (ex: novo módulo no admin, novo endpoint reseller, novo fluxo de licença, nova aba do dashboard)."
---

<!-- version: 1.0 — fork de task-master-v2 com pipeline sequencial obrigatória -->

# Feature Factory (End-to-End Feature Pipeline)

Skill para **features novas full-stack** onde há dependências sequenciais entre camadas. Diferente do `task-master-v2` genérico que paraleliza tudo: aqui as waves seguem ordem **W1 schema → W2 edge+hook → W3 UI+test → W4 docs**.

## Quando usar

- "Novo módulo no admin com tabela + edge + UI."
- "Endpoint reseller novo com auth + handler + docs."
- "Nova aba do dashboard que precisa de migration + react-query hook + UI."
- "Fluxo novo de licença/billing/notificação ponta-a-ponta."

## Quando NÃO usar

- Feature só de UI (sem schema/edge) → `task-master-v2`.
- Schema-only → `migration-surgeon`.
- Refactor de feature existente → `task-master-v2`.

## N e papéis (Nb fixo = 6 por wave-set; alguns rodam em waves diferentes)

Sempre `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (Schema)** — `supabase/migrations/**`, RLS, GRANTs, RPCs. **Lock exclusivo** (mesma regra do migration-surgeon).
- **Agent B (Edge Function)** — `supabase/functions/<nova>/index.ts` + `_shared` se necessário.
- **Agent C (Hook & Types)** — `src/hooks/use-<feature>.ts`, types derivados, react-query setup.
- **Agent D (UI)** — componentes shadcn + página/aba do admin.
- **Agent E (Test)** — Vitest unit + Playwright e2e se aplicável.
- **Agent F (Docs & Memory)** — README, `RESELLER_API.md` (se reseller), `public/llms.txt`, `mem://` (propõe; aplicação só Orchestrator).

## Pipeline obrigatória

- **W1 (Schema):** SPAWN só A. Migration aplicada + types regenerados.
- **W2 (Edge + Hook):** SPAWN B + C em paralelo. C aguarda C `types.ts` atualizado (Orchestrator confirma).
- **W3 (UI + Test):** SPAWN D + E em paralelo. D consome hook de C, E testa B + D.
- **W4 (Docs):** SPAWN só F. Orchestrator aplica `mem://` no final.

Mínimo 4 waves. Cross-skip proibido.

## Arquivos de coordenação

Prefixo **`ff-`**: `ff-plan.md`, `ff-inbox-A..F.md`, `ff-feature-spec.md` (Orchestrator escreve no setup).

## Regras invioláveis

1. **Sequencial estrita:** W2 só spawn após W1 done; W3 só após W2; W4 só após W3.
2. **Lock migrations:** só Agent A.
3. **GRANTs + RLS** obrigatórios na migration de W1.
4. **Hook ANTES de UI:** D não pode importar tipo que C ainda não criou.
5. **Teste obrigatório:** E deve ter pelo menos 1 unit para B e 1 render para D.
6. **Edge function:** sempre `validateExtensionRequest` ou auth equivalente conforme padrão do projeto.
7. **Feature flag opcional** se houver risco — registrar em `ff-feature-spec.md`.

## Encerramento

`Feature Factory · 4 waves · A→B+C→D+E→F · feature <nome> entregue end-to-end · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Paralelizar W1+W2.
- ❌ UI sem hook pronto.
- ❌ Fechar sem teste mínimo.
- ❌ Esquecer GRANTs ou RLS.
- ❌ Aplicar `mem://` em qualquer wave que não W4.