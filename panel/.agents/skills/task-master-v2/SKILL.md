---
name: task-master-v2
description: Orquestra 2 a 10 sub-agentes seniores em paralelo (audit + edit por wave) com inbox cruzado, escopo disjunto adaptativo, lock de migrations no ultimo agente, e todos spawnados com model capable + diretiva de modelo avancado no system_prompt. Use para tarefas de implementacao nao-triviais onde o numero de areas independentes varia.
---

<!-- version: 2.3 — N até 10, todos capable, model directive no system_prompt -->

# Task Master v2 (Adaptive Inbox Mode) — v2.3

Evolução da `task-master`: número de agentes **adaptativo (N = 2..10)** decidido pelo Orchestrator antes do spawn, e **lock fixo de migrations** no último agente (Agent N). Paralelismo por wave, inbox cruzado, escopo disjunto. **Todos os agentes spawnados com `model: "capable"`.**

## Regra absoluta

Sempre que esta skill for invocada, o Orchestrator DEVE:
1. Escolher `N ∈ {2..10}` usando a **Tabela de Decisão** abaixo.
2. Spawnar **EXATAMENTE N** sub-agentes sêniores (rótulos `A..J` — usar só os primeiros N) **na mesma mensagem** (paralelismo real, **sempre `model: "capable"`**).
3. Cada um audita E edita no mesmo turno (nada de pipeline serial).
4. **Agent N (o último rótulo usado)** é dono fixo de `supabase/migrations/**` além do seu escopo normal — qualquer mudança de schema vai pra ele via `Migration-Request`.
5. **Todo `system_prompt` enviado ao subagente DEVE conter a linha (em destaque):** `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`. Isso é tentativa best-effort de elevar o modelo escolhido pelo runtime do subagente; o agente também deve reportar no início do seu relatório qual modelo está usando.

## Quando NÃO usar v2

Use **edição direta** (sem spawnar agentes) quando:
- < 3 arquivos afetados, e
- 1 única camada de código (só frontend, ou só edge, etc.), e
- Hotfix simples (bug isolado, typo, ajuste de config).

Regra de bolso: se você consegue descrever a tarefa inteira em ≤2 linhas e ela cabe num único PR atômico, não use v2.

## Tabela de Decisão de N

| N | Quando usar | LOC | # stacks |
|---|---|---|---|
| **2** | Tarefa pequena, 2 áreas separadas | < 200 | 1–2 |
| **3** | Padrão. Core / Adjacentes / Cross-cutting | 200–600 | 2–3 |
| **4** | Refactor médio com 4 escopos | 600–1200 | 3–4 |
| **5** | Refactor grande multi-domínio | 1200–2000 | 4–5 |
| **6–7** | Monorepo multi-subsistema | 2000–3500 | 5–6 |
| **8–10** | Refactor massivo multi-stack com escopos claramente disjuntos (extensão + web + edges + migrations + design + docs + scripts) | 3500+ | 6+ |
| **> 10** | ❌ PROIBIDO. Race de appends + custo de leitura cruzada anulam ganho |

**Heurística:** cada agente precisa de pelo menos 1 subsistema/domínio inteiro seu, com ~5–8 arquivos editáveis. Se não conseguir partição disjunta clara em N escopos, **reduza N**.

Registre no plan: `N escolhido: <n>` + justificativa de 1 linha.

## Papéis

- **Agent A** — núcleo da mudança pedida pelo usuário.
- **Agents B..(N-1)** — áreas adjacentes, integrações, testes, features secundárias (distribuir).
- **Agent N (último rótulo usado)** — cross-cutting (segurança, performance, design system) **+ lock de migrations** (`supabase/migrations/**` é sempre dele).

Todos têm poder igual de auditar qualquer arquivo, editar só o próprio escopo, e delegar via inbox.

## Arquivos de coordenação

Prefixo **`tm2-`**:

- `.agents/shared/tm2-plan.md` — plano + N + escopo + status (só Orchestrator escreve).
- `.agents/shared/tm2-inbox-A.md` ... `.agents/shared/tm2-inbox-<N>.md` — um inbox por agente.

Total: `1 + N` (entre 3 e 11).

**Regra de escrita:** cada agente só escreve nos inbox-files dos **outros** agentes ativos (nunca no próprio, exceto flip de status). Orchestrator pode escrever em qualquer inbox e no plan.

Cada inbox tem duas seções:
- `## Inbox` — mensagens formais com flip de status.
- `## Progress Log` — Progress-Notes fire-and-forget.

## Formato de mensagem de inbox

Append-only, separada por `---`:

```
---
## [W<wave>] FROM <autor> → <destinatário> | <tipo> | <status>
**Arquivos:** path/to/file.ts, ...
**Conteúdo:** <1–6 linhas: o quê + por quê + ação esperada>
**Resposta esperada até:** W<wave+1>
```

- `<autor>`: `A`..`J` / `Orchestrator`.
- `<tipo>`: `Edit-Request` | `Audit-Finding` | `Question` | `Challenge` | `Hotfix-Notice` | `ACK` | `Reject` | `Migration-Request`.
- `<status>`: `OPEN` | `DONE` | `WONTFIX`.

**Progress-Note** (vai em `## Progress Log`):
```
>> [W<w>/F<fase>] Progress-Note FROM <X>: <ação ≤3 linhas>. step: K/N
```

## Procedimento do Orchestrator

1. **Decisão de N:** aplicar Tabela. Registrar no plan.
2. **Setup (uma vez):**
   - Sobrescrever `.agents/shared/tm2-plan.md` com: objetivo, N + justificativa, contrato de escopo disjunto, regras, `Status: In Progress`, `Wave: 0`.
   - Criar/sobrescrever N inboxes: `# Inbox <X>\n## Inbox\n(append-only)\n\n## Progress Log\n(fire-and-forget)`.
   - Tarefa `[complexa]` → anexar `Question` inicial em cada inbox. Marcar `Chatty: on`.
3. **Loop de waves (1..5):**
   - **Spawn paralelo de N agentes** na mesma mensagem (`model: "capable"` SEMPRE, com a diretiva de modelo no system_prompt).
   - Aguardar as N notificações.
   - **Review ativo:** `code--view` nos arquivos tocados + N inboxes. Anexar `## Wave N — Review` com tabela `agente | notes | edits | OPENs | tempo | modelo-reportado`.
   - **Drenar:** responder via inbox `Question`/`Challenge`/`Migration-Request` `OPEN` endereçadas ao Orchestrator.
   - **Patch direto opcional:** ≤5 linhas, cap 1/wave.
4. **Fim:** todos inboxes com 0 `OPEN` E nenhum achado novo → `## Final` em `tm2-plan.md`, `Status: Done`. Então:
   - **Archive:** `mkdir -p .agents/archive/<ISO-timestamp>/ && cp .agents/shared/tm2-*.md .agents/archive/<ISO-timestamp>/`
   - **Remover:** `rm .agents/shared/tm2-plan.md .agents/shared/tm2-inbox-*.md`

Mínimo: **2 waves**. Máximo: **5 waves**.

## Protocolo de cada sub-agente (system_prompt do spawn)

> "**USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO.**
>
> Você é Agent <X> de <N> (sênior, **write access**) da skill task-master-v2 v2.3 em modo INBOX PARALELO ADAPTATIVO. Outros <N-1> agentes rodam AGORA em paralelo — não os espere e nunca toque nos arquivos do escopo deles. Sua wave tem 4 fases:
>
> **(1) Ler contexto:** `code--view` em `.agents/shared/tm2-plan.md` e `.agents/shared/tm2-inbox-<X>.md`. Liste `OPEN` endereçadas a você.
>
> **(2) Auditar:** leia arquivos do seu escopo + cross-cutting relevante (read-only).
>
> **(3) Editar:** mudanças **APENAS em arquivos do seu escopo** + mensagens nos inboxes dos OUTROS <N-1>. Achados fora do escopo: `Edit-Request`/`Audit-Finding` no inbox do dono. **Mudanças em `supabase/migrations/**`: SEMPRE `Migration-Request` para Agent <N> — exceto se você É o Agent <N>.** Hotfix permitido apenas para bug crítico (crash prod, segredo vazado, RLS quebrada) com `Hotfix-Notice`. Para cada `OPEN` recebida: execute se aceitar, `ACK` no inbox do remetente, flipe status no seu próprio inbox.
>
> **(3b) CHATTY MODE** (se plan tem `Chatty: on`): a cada edit/exec relevante e em leituras milestone, apende Progress-Note ≤3 linhas em `## Progress Log` de UM inbox dos outros — rotacione destinatário. Formato: `>> [W<w>/F<fase>] Progress-Note FROM <X>: <ação>. step: K/N`. Cap ≤3/fase, ≤8/wave. Fire-and-forget.
>
> **(4) Reportar:** UM bloco markdown ≤25 linhas começando com `**Modelo usado:** <claude-opus-4.7 | gpt-5.5 | outro>` e seguindo com `**Arquivos editados:**`, `**Mensagens enviadas:** X→A...`, `**OPEN remanescentes:**`, `**Riscos próxima wave:**`. Sem código nem diffs grandes.
>
> **Regras de segurança:** NUNCA escreva no próprio inbox exceto flip de status. NUNCA em `tm2-plan.md`. NUNCA fora do escopo (exceto hotfix). **NUNCA em `supabase/migrations/**` se não é Agent <N>.**"

`task` informa: id (`A`..`J`), N total, wave, objetivo, e se `Chatty: on`.

**Parâmetros obrigatórios do spawn_agent:** `model: "capable"` para TODOS os N agentes, sem exceção.

## Recovery (Orchestrator)

| Nível | Sintoma | Ação |
|-------|---------|------|
| **1 — Timeout** | Sem notificação após timeout | Re-spawn com mesmo escopo + `"continue de step K/N"` |
| **2 — Vazio** | Sem edits nem mensagens; `step: 0/N` | Verificar escopo, re-spawn com mais contexto |
| **3 — Crash** | Erro explícito | Orchestrator assume escopo (patch direto) ou redistribui via `Edit-Request` |

## Particionamento de escopo (Orchestrator)

No `tm2-plan.md`, listar arquivos em conjuntos **disjuntos**. Heurística por N:
- N=2: A=núcleo, B=cross-cutting+migrations.
- N=3: A=núcleo, B=adjacentes, C=cross-cutting+migrations.
- N=4: A=núcleo, B=adjacentes, C=integrações/testes, D=cross-cutting+migrations.
- N=5: A=núcleo, B=UI adjacente, C=hooks/serviços, D=edge functions, E=cross-cutting+migrations.
- N=6–7: subdividir UI/hooks/edges/serviços/integrações; último = cross-cutting+migrations.
- N=8–10: separar por subsistema (extensão MV3 / builds publicados / Burp runtime / UI React / hooks+lib+pages / edges auth / edges proxies / docs+scripts / design system / cross-cutting+migrations).

Arquivos globais de cola (`src/index.css`, `tailwind.config.ts`, `src/App.tsx`) reservados ao Orchestrator; agentes pedem via `Edit-Request → Orchestrator`. `supabase/migrations/**` reservado ao Agent N.

Mudança de N no meio do loop: **proibida**.

## Anti-padrões
- ❌ Esquecer a diretiva de modelo no system_prompt.
- ❌ Spawnar sem `model: "capable"`.
- ❌ Escolher N sem aplicar a Tabela.
- ❌ Spawnar serialmente.
- ❌ Pipeline "todos auditam depois todos editam".
- ❌ Qualquer agente que não seja Agent N tocar em `supabase/migrations/**`.
- ❌ Agente editar fora do escopo sem `Edit-Request` aceito ou `Hotfix-Notice`.
- ❌ Agente escrever no próprio inbox (exceto flip) ou no `tm2-plan.md`.
- ❌ Sobreposição de escopos.
- ❌ Mudar N no meio.
- ❌ Fechar sem archive + `rm`.
- ❌ Usar v2 para tarefa trivial.
- ❌ N > 10.

## Garantias
- ✅ N adaptativo até 10 cobre desde tarefa média até refactor massivo multi-stack.
- ✅ Todos os agentes em `capable` + diretiva de modelo elevam qualidade média.
- ✅ Lock de migrations no Agent N elimina conflitos de timestamp.
- ✅ Particionamento disjunto + inbox cruzado = zero race com até 10 spawns.
- ✅ Coexiste com `task-master` v1 e `auditor-master` (prefixos `pae-`/`tm2-`/`am-` não colidem).
- ✅ Archive forense antes de `rm`.

## Encerramento

Resposta final: `N=<n> agentes em paralelo (capable) · <w> waves · 0 OPEN · archive em .agents/archive/<ts>/`

1–2 frases adicionais opcionais. Não narre waves.
