---
name: parallel-audit-edit
description: SEMPRE que invocada, dispara EXATAMENTE 3 sub-agentes sêniores (A, B, C) que auditam E editam JUNTOS em paralelo, comunicando-se via inbox-files dedicados (um por agente). Use quando o usuário invocar "parallel-audit-edit", pedir "subagentes que editam/auditam", "audite e edite", ou refactors/auditorias/bugfixes que se beneficiam de revisão cruzada com 3 perspectivas.
---

# Parallel Audit & Edit (Inbox Mode)

## Regra absoluta

Sempre que esta skill for invocada, o agente principal (Orchestrator) DEVE orquestrar EXATAMENTE 3 sub-agentes sêniores (A, B, C) que **auditam e editam em paralelo, na mesma wave**, conversando entre si por **inbox-files dedicados**. Nada de pipeline serial "3 auditam, depois 3 editam". Cada agente faz as duas coisas no mesmo turno.

Papéis fixos (cada um audita E edita):
- **Agent A** — Dono do núcleo da mudança pedida pelo usuário.
- **Agent B** — Dono das áreas adjacentes / integrações / testes.
- **Agent C** — Dono de cross-cutting (segurança, RLS, design system, performance).

Os 3 são iguais em poder: cada um audita qualquer arquivo, edita os arquivos do seu próprio escopo, e **delega edições fora do seu escopo via mensagem no inbox do dono**. O Orchestrator coordena, particiona escopo, drena inboxes e fecha a tarefa.

## Arquivos de coordenação

Exatamente 4 arquivos, sempre nesses caminhos fixos (sem variantes por tarefa):

- `.agents/shared/pae-plan.md` — plano + contrato de escopo + status global (escrito só pelo Orchestrator).
- `.agents/shared/pae-inbox-A.md` — mensagens endereçadas a A.
- `.agents/shared/pae-inbox-B.md` — mensagens endereçadas a B.
- `.agents/shared/pae-inbox-C.md` — mensagens endereçadas a C.

**Cada agente só escreve nos inbox-files dos OUTROS dois** (nunca no próprio, exceto flip de status — ver abaixo) e nos arquivos de código do seu próprio escopo. O Orchestrator pode escrever em qualquer inbox e no plan. Essa partição elimina race de escrita mesmo com 3 spawns simultâneos.

## Formato de mensagem de inbox (obrigatório)

Append-only, separada por `---`:

```
---
## [W<wave>] FROM <autor> → <destinatário> | <tipo> | <status>
**Arquivos:** path/to/file.ts, ...
**Conteúdo:** <1–6 linhas: o quê + por quê + ação esperada>
**Resposta esperada até:** W<wave+1>
```

- `<autor>`: `A` / `B` / `C` / `Orchestrator`.
- `<tipo>`: `Edit-Request` (peça pra editar algo do escopo dele) | `Audit-Finding` (achado/risco) | `Question` (bloqueante) | `Challenge` (discordância) | `Hotfix-Notice` (já editei o arquivo dele por bug crítico) | `ACK` (resposta) | `Reject` (recusa fundamentada).
- `<status>`: `OPEN` | `DONE` | `WONTFIX`. Autor cria como `OPEN`. Destinatário, ao processar, anexa nova mensagem `ACK`/`Reject` no inbox do remetente E muda a linha da mensagem original no próprio inbox de `OPEN` para `DONE`/`WONTFIX` (única auto-escrita permitida no próprio inbox).

## Procedimento do Orchestrator

1. **Setup (uma vez):**
   - Sobrescrever `.agents/shared/pae-plan.md` com: objetivo, **contrato de escopo disjunto** (lista de arquivos/áreas de A, B, C — sem sobreposição), resumo das regras, `Status: In Progress`, `Wave: 0`.
   - Sobrescrever os 3 inboxes com cabeçalho vazio: `# Inbox <X>\n(append-only — entradas mais novas embaixo)`.
   - Em tarefa marcada `[complexa]`, anexar em cada inbox uma `Question` inicial pedindo abordagem proposta (Wave 0 = Round 0 de discussão; agentes só auditam + respondem, ainda não editam código).
2. **Loop de waves (1..N):**
   - **Spawn paralelo** de A, B, C **na mesma mensagem do orquestrador** (3 `spawn_agent` simultâneos). Cada um recebe seu id e o protocolo abaixo.
   - Aguardar as 3 notificações de término.
   - **Review ativo:** `code--view` em todos os arquivos tocados na wave (declarados nos relatórios) + nos 3 inboxes. Anexar em `pae-plan.md` um bloco `## Wave N — Review` com: arquivos inspecionados, diff conceitual real, contagem de `OPEN` por inbox, decisão (próxima wave OU patch direto OU fim).
   - **Drenar:** responder via inbox do autor qualquer `Question`/`Challenge` `OPEN` endereçada ao Orchestrator antes da próxima wave.
   - **Patch direto opcional:** ≤5 linhas e sem mudança de comportamento; cap 1 por wave; registrar no plan.
3. **Fim:** quando todos os 3 inboxes têm zero `OPEN` E nenhum agente reportou novos achados na última wave → escrever `## Final` em `pae-plan.md` com resumo, marcar `Status: Done`, executar `rm .agents/shared/pae-plan.md .agents/shared/pae-inbox-A.md .agents/shared/pae-inbox-B.md .agents/shared/pae-inbox-C.md`.

Mínimo: **2 waves de implementação** (W1 = todos auditam+editam seu escopo, W2 = drenam inbox + verificam cross-edits). Máximo: **5 waves**; passou disso, Orchestrator fecha escopo e converte pendências em follow-up.

## Protocolo de cada sub-agente (system_prompt do spawn)

> "Você é Agent <X> (sênior, write access) da skill parallel-audit-edit em modo INBOX PARALELO. Outros 2 agentes rodam AGORA em paralelo — não os espere e nunca toque nos arquivos do escopo deles. Sua wave tem 4 fases, nessa ordem:
>
> **(1) Ler contexto:** `code--view` em `.agents/shared/pae-plan.md` e `.agents/shared/pae-inbox-<X>.md`. Liste todas as entradas `OPEN` endereçadas a você.
>
> **(2) Auditar:** leia os arquivos do seu escopo (definidos no plan) + qualquer arquivo cross-cutting relevante (read-only). Identifique bugs, riscos, melhorias.
>
> **(3) Editar:** aplique mudanças **APENAS em arquivos do seu próprio escopo** + escreva mensagens nos 2 inbox-files dos OUTROS agentes. Para cada achado que toca arquivo de outro agente: **NÃO edite** — anexe `Edit-Request` ou `Audit-Finding` no inbox dele. Exceção única: bug crítico (crash em produção, vazamento de segredo, RLS quebrada) → edite e anexe `Hotfix-Notice` no inbox do dono. Para cada `OPEN` recebida: execute se aceitar, anexe `ACK` no inbox do remetente, e mude o status da mensagem original no SEU inbox de `OPEN` para `DONE`/`WONTFIX` (única auto-escrita permitida).
>
> **(4) Reportar:** resposta final ao Orchestrator é UM bloco markdown ≤25 linhas com: `**Arquivos editados:** ...`, `**Mensagens enviadas:** N→A, M→B, K→C`, `**OPEN remanescentes no meu inbox:** ...`, `**Riscos para próxima wave:** ...`. Não cole código nem diffs grandes.
>
> **Regras de segurança de escrita (violar quebra o paralelismo):** NUNCA escreva em `pae-inbox-<X>.md` (seu próprio) exceto para flipar status de mensagens existentes. NUNCA escreva em `pae-plan.md`. NUNCA edite código fora do seu escopo do plan, exceto hotfix justificado."

`task` informa: id (`A`/`B`/`C`), número da wave, objetivo ("audite + implemente seu escopo + drene inbox").

## Particionamento de escopo (Orchestrator)

Para edição paralela segura, no `pae-plan.md` o Orchestrator DEVE listar arquivos/áreas em conjuntos **disjuntos**:
- Zero sobreposição entre A, B, C.
- Arquivos globais de cola (`src/index.css`, `tailwind.config.ts`, `src/App.tsx`, migrations) ficam reservados ao **Orchestrator**; agentes pedem via `Edit-Request → Orchestrator`.
- Sem partição natural em 3? Divida por camada (A=UI, B=hooks/serviços, C=edge functions+segurança) ou por feature.
- Mudança de escopo no meio: só Orchestrator, registrada no plan ANTES da próxima wave.

## Anti-padrões
- ❌ Fazer a tarefa sozinho sem spawnar A/B/C.
- ❌ Spawnar serialmente (um esperando o outro). Esta skill exige paralelismo por wave.
- ❌ Pipeline "3 auditam, depois 3 editam". Cada agente audita E edita na mesma wave.
- ❌ Agente editar fora do seu escopo sem `Edit-Request` aceito ou `Hotfix-Notice`.
- ❌ Agente escrever no próprio inbox (exceto flip de status).
- ❌ Agente escrever em `pae-plan.md`.
- ❌ Sobreposição de arquivos entre escopos.
- ❌ Orchestrator pular `## Wave N — Review` com `code--view` real.
- ❌ Fechar a tarefa sem `rm` dos 4 arquivos de coordenação.

## Garantias e limites
- ✅ Particionamento disjunto + cada agente só escreve nos inboxes dos OUTROS = zero race mesmo em paralelo.
- ✅ Inbox-files preservam auditoria/edit-requests sem inflar transcript central.
- ✅ 3 spawns em paralelo por wave reduzem drasticamente latência vs. modo serial.
- ❌ Teto 5 waves. Cada relatório ≤25 linhas; cada mensagem de inbox ≤6 linhas.
- ❌ Não usar para tarefa trivial de 1 arquivo (overkill).

## Encerramento
Resposta final ao usuário: 1–2 frases. Mencione que A, B, C trabalharam em paralelo com inbox cruzado e que os arquivos de coordenação foram removidos. Não narre waves.
