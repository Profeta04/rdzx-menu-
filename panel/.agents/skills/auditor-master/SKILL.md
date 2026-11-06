---
name: auditor-master
description: Read-only parallel audit with up to 10 sub-agents communicating via cross-inboxes. Use for whole-project audits, doc/memory refreshes, security/compliance sweeps, drift detection — anything where you need many specialist eyes but ZERO code edits. Output is a consolidated audit report. Use task-master-v2 instead when edits are required.
---

<!-- version: 1.0 — read-only fork of task-master-v2 with N up to 10 -->

# Auditor Master (Read-Only Parallel Audit)

Fork **read-only** da `task-master-v2`. Mesmo protocolo de waves, inboxes cruzados e particionamento disjunto, mas:

- **N ∈ {3..10}** (não 2..5).
- **Subagentes NÃO editam código de aplicação.** Só leem (`code--view`, `rg`, `code--list_dir`, `code--exec` com comandos read-only) e escrevem nos inboxes dos OUTROS agentes + (opcionalmente) num arquivo de findings próprio.
- **Apenas o Orchestrator** pode editar arquivos de saída do audit (memória, docs, relatórios consolidados) — e somente DEPOIS da última wave, sintetizando os inboxes.
- **Agent N (último rótulo usado)** é o **Synthesizer**: na última wave consolida os findings de todos em `.agents/shared/am-report.md` (esse é o único arquivo de "saída" que um agente escreve).

## Regra absoluta

Sempre que esta skill for invocada, o Orchestrator DEVE:
1. Escolher `N ∈ {3..10}` usando a **Tabela de Decisão** abaixo.
2. Spawnar **EXATAMENTE N** sub-agentes sêniores (rótulos `A..J` — usar só os primeiros N) **na mesma mensagem** (paralelismo real, model `capable`, read-only).
3. Cada agente audita seu escopo + drena/responde inbox **na mesma wave**.
4. **Nenhum agente edita código de aplicação**. Edições de saída (memória, docs, etc.) só pelo Orchestrator após a wave final.

## Quando NÃO usar

- Tarefa exige edição de código → use `task-master-v2`.
- Auditoria pontual de < 3 arquivos / 1 camada → leia direto, sem spawnar.
- Pergunta de pesquisa simples respondível com 1 `spawn_agent` solto.

## Tabela de Decisão de N

| N | Quando usar |
|---|---|
| **3** | Audit médio em 3 áreas claras (ex: frontend / backend / segurança) |
| **4–5** | Audit grande multi-domínio (ex: extensão + web + edges + migrations) |
| **6–8** | Audit de projeto inteiro com muitos subsistemas independentes |
| **9–10** | Audit massivo ou refresh global de memória/documentação em monorepo com 10+ subsistemas claramente separáveis |
| **> 10** | ❌ Proibido. Race de leitura de inboxes anula ganho |

Heurística: cada agente deve ter pelo menos 1 subsistema/domínio inteiro só seu. Se sobra menos de 1 domínio por cabeça, **reduza N**.

Registre no plan: `N escolhido: <n>` + justificativa de 1 linha.

## Papéis

- **Agent A** — núcleo da auditoria (área mais crítica do pedido do usuário).
- **Agents B..(N-1)** — domínios independentes (UI, hooks, edges, migrations, scripts, design system, docs, auth, etc.).
- **Agent N (último)** — **Synthesizer**: além do seu domínio de audit, na última wave consolida `.agents/shared/am-report.md` com os findings de todos.

## Arquivos de coordenação

Prefixo **`am-`** (não colide com `tm2-` / `pae-`):

- `.agents/shared/am-plan.md` — plano + N + contrato de escopo + objetivos do audit + status (só Orchestrator escreve).
- `.agents/shared/am-inbox-A.md` ... `.agents/shared/am-inbox-<N>.md` — um inbox por agente.
- `.agents/shared/am-report.md` — relatório consolidado final (escrito pelo **Synthesizer** na última wave; lido por todos antes).

Total de arquivos: `2 + N` (entre 5 e 12).

**Regra de escrita:**
- Cada agente só escreve nos inbox-files dos **outros** agentes ativos (nunca no próprio, exceto flip de status).
- **Synthesizer** (Agent N) é o único que escreve em `am-report.md`, e apenas na última wave.
- Orchestrator pode escrever em qualquer inbox, no plan e no report (revisão final).
- **NENHUM agente escreve em arquivos de código de aplicação.**

Cada inbox tem duas seções:
- `## Inbox` — mensagens formais com flip de status.
- `## Findings Log` — achados estruturados fire-and-forget (sem flip, sem resposta esperada).

## Formato de mensagem de inbox

Append-only, separada por `---`:

```
---
## [W<wave>] FROM <autor> → <destinatário> | <tipo> | <status>
**Arquivos:** path/to/file.ts, ...
**Conteúdo:** <1–6 linhas: achado + evidência + ação sugerida>
**Resposta esperada até:** W<wave+1>
```

- `<tipo>`: `Audit-Finding` | `Question` | `Challenge` | `Cross-Ref` (te peço pra confirmar X no teu escopo) | `ACK` | `Reject` | `Outdated-Memory` (sinalizar item ultrapassado na memória atual).
- `<status>`: `OPEN` | `DONE` | `WONTFIX`.

**Finding-Log** (vai em `## Findings Log`, não em `## Inbox`):
```
>> [W<w>] Finding FROM <X> | severity: low|med|high | scope: <subsistema>
   evidence: <arquivo:linha ou comando>
   summary: <≤2 linhas>
   memory-impact: <none | update | new | remove>
```

## Procedimento do Orchestrator

1. **Decisão de N (uma vez):** aplicar a Tabela. Registrar no plan.
2. **Setup (uma vez):**
   - Sobrescrever `.agents/shared/am-plan.md` com: objetivo do audit, **N + justificativa**, **contrato de escopo disjunto** por agente, lista de outputs esperados, `Status: In Progress`, `Wave: 0`.
   - Criar/sobrescrever os N inboxes com: `# Inbox <X>\n## Inbox\n(append-only)\n\n## Findings Log\n(fire-and-forget)`.
   - Criar `am-report.md` vazio com cabeçalho `# Audit Report — <título>\n_pendente — preenchido pelo Synthesizer na wave final_`.
   - Tarefa `[complexa]` → anexar `Question` inicial em cada inbox. Marcar no plan: `Chatty: on`.
3. **Loop de waves (1..5):**
   - **Spawn paralelo de N agentes** na mesma mensagem do Orchestrator (N chamadas simultâneas, `capable`, **read-only**).
   - Aguardar as N notificações.
   - **Review ativo:** `code--view` em todos os inboxes + report. Anexar `## Wave N — Review` em `am-plan.md` com tabela `agente | findings | msgs enviadas | OPENs | tempo`.
   - **Drenar:** responder via inbox qualquer `Question`/`Challenge`/`Cross-Ref` `OPEN` endereçada ao Orchestrator antes da próxima wave.
4. **Wave final:** instruir explicitamente o Synthesizer (Agent N) a consolidar `am-report.md` a partir dos findings de todos os inboxes (estrutura: Executive Summary · Findings por subsistema · Drift vs memória atual · Recomendações priorizadas).
5. **Fim:** todos os inboxes com 0 `OPEN` E report preenchido → Orchestrator:
   - Lê `am-report.md` e faz revisão final.
   - **Aplica os outputs solicitados pelo usuário** (ex: atualizar `mem://**`, escrever docs). Esta é a ÚNICA fase de escrita em arquivos de aplicação.
   - Anexa `## Final` em `am-plan.md`, `Status: Done`.
   - **Archive:** `mkdir -p .agents/archive/<ISO-timestamp>/ && cp .agents/shared/am-*.md .agents/archive/<ISO-timestamp>/`
   - **Remove:** `rm .agents/shared/am-plan.md .agents/shared/am-inbox-*.md .agents/shared/am-report.md`

Mínimo: **2 waves**. Máximo: **5 waves**.

## Protocolo de cada sub-agente (system_prompt do spawn)

> "Você é Agent <X> de <N> (sênior, **READ-ONLY**) da skill auditor-master em modo INBOX PARALELO. Outros <N-1> agentes rodam AGORA em paralelo — não os espere e nunca toque nos arquivos do escopo deles.
>
> **PROIBIDO ABSOLUTO:** editar QUALQUER arquivo de código de aplicação. Você só pode escrever em:
> 1. Inboxes dos OUTROS <N-1> agentes (`.agents/shared/am-inbox-<Y>.md`).
> 2. Flip de status no SEU próprio inbox.
> 3. **Se você é o Synthesizer (Agent <N>) E é a wave final**: escrever `.agents/shared/am-report.md`.
>
> Sua wave tem 4 fases:
>
> **(1) Ler contexto:** `code--view` em `.agents/shared/am-plan.md` e `.agents/shared/am-inbox-<X>.md`. Liste `OPEN` endereçadas a você.
>
> **(2) Auditar:** leia os arquivos do seu escopo + cross-cutting relevante. Use `code--view`, `rg`, `code--list_dir`, `code--exec` apenas com comandos read-only (ls, cat, grep, wc). NUNCA `apply_patch`, NUNCA escrita.
>
> **(3) Reportar achados:** para cada achado:
>    - Severidade `high` ou toca escopo de outro agente → `Audit-Finding`/`Cross-Ref` no inbox do dono (`OPEN`).
>    - Severidade `low`/`med` ou info geral → entrada no `## Findings Log` de UM inbox (rotacione; cap **≤6 findings/wave**).
>    - Item da memória atual ultrapassado → `Outdated-Memory` com evidência.
>    - Para cada `OPEN` recebida: responda com `ACK`/`Reject` e flipe status no seu inbox.
>
> **(4) Reportar ao Orchestrator:** UM bloco markdown ≤30 linhas com: escopo auditado, findings por severidade, mensagens enviadas, cross-refs, itens de memória ultrapassados, OPEN remanescentes. Sem cole de código.
>
> **Se você é Synthesizer na wave final:** ADICIONE fase **(5) Consolidar**: leia TODOS os `.agents/shared/am-inbox-*.md` e escreva `.agents/shared/am-report.md` com: `# Audit Report\n## Executive Summary\n## Findings por Subsistema\n## Drift vs Memória Atual\n## Recomendações Priorizadas\n## Apêndice: contagem por agente`."

`task` informa: id, N total, número da wave, objetivo, lista exata do escopo, se é Synthesizer + se é wave final.

## Particionamento de escopo (Orchestrator)

No `am-plan.md`, listar diretórios/arquivos em conjuntos **disjuntos**. Exemplo p/ N=10 em monorepo extensão+web+backend:

- A: `extension/**` (MV3 core)
- B: `public/ext_src/**` + `public/ext_build_v*/**` (builds publicados)
- C: `public/burp_src/**` (Burp Lovable runtime + scripts)
- D: `src/components/**` (UI React, incl. burp/)
- E: `src/hooks/**` + `src/lib/**` + `src/pages/**` (lógica web)
- F: `supabase/functions/_shared/**` + auth/admin (`admin-otp-*`, `verify-admin-key`, `reseller-*`, `get-user-role`, `bulk-license-ops`)
- G: `supabase/functions/**` (resto: proxies, pc, burp, ai, heartbeat, etc.)
- H: `supabase/migrations/**` + schema + RLS + `supabase/config.toml`
- I: `src/index.css` + `tailwind.config.ts` + `components.json` + design system + assets
- J (Synthesizer): `mem://**` atual + docs (`README.md`, `RESELLER_API.md`, `public/llms.txt`) + `.lovable/**` + `scripts/**` + cross-cutting risk view. **Consolida report.**

Ajuste conforme N. Zero sobreposição.

## Anti-padrões

- ❌ Subagente editando QUALQUER arquivo de código de aplicação.
- ❌ Subagente escrevendo em `am-plan.md` ou em `am-report.md` (este último: só Synthesizer na wave final).
- ❌ Spawnar serialmente.
- ❌ N > 10 ou N < 3.
- ❌ Sobreposição de escopo.
- ❌ Synthesizer escrever o report antes da wave final.
- ❌ Fechar sem archive + `rm`.
- ❌ Orchestrator delegar escrita de memória/docs ao subagente.

## Garantias

- ✅ Zero risco de edit acidental.
- ✅ N até 10 viável (sem race de edits).
- ✅ Synthesizer concentra redação do report.
- ✅ Coexiste com `task-master-v2`.
- ✅ Archive forense antes do `rm`.

## Encerramento

Resposta final ao usuário:

`N=<n> agentes em paralelo (read-only) · <w> waves · 0 OPEN · report consolidado · outputs aplicados · archive em .agents/archive/<ts>/`

1–2 frases adicionais com o que mudou nos outputs. Não narre waves.
