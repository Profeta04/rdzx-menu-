# Task Master v2 — Meta-Plan W3 (Chatty + Polimento)

## Objetivo
Continuar a evolução da skill `task-master-v2`. Foco PRIMÁRIO: **modo chatty** — a cada read/edit/exec relevante o subagente posta um `Progress-Note` curto no inbox dos outros e volta à task. Foco SECUNDÁRIO: melhorias gerais (race, recovery, telemetria, formato, decisão de N).

## RESTRIÇÃO ABSOLUTA
Nenhuma proposta pode remover a permissão/instrução do subagente de **editar arquivos diretamente** (`write access` + edit no próprio escopo). Propostas que tentem voltar ao modelo "subagente só propõe, Orchestrator aplica" serão marcadas `WONTFIX`.

## N escolhido: 5
5 ângulos disjuntos (Chatty · Race · Recovery/Telemetria · Formato/DX · Meta/Draft).

## Contrato de escopo (DESIGN — sem edição de código de aplicação)
Cada agente escreve apenas:
- Inboxes dos OUTROS 4 agentes.
- **Agent E** adicionalmente escreve o rascunho final em `.agents/skills/task-master-v2/SKILL.md` na W2.

### Agent A — Chatty Protocol (núcleo)
- Gatilhos (read? edit? exec?).
- Formato `Progress-Note` ≤3 linhas.
- Retomada explícita após posting.
- Limite anti-spam (≤N por fase).
- Default ON p/ `[complexa]`, OFF caso contrário.
- Separação visual `## Progress Log` vs `## Inbox`.

### Agent B — Race / Throughput / Append-Atômico
- Race de 4+ agentes apendando simultaneamente.
- Lock otimista por hash OU progress-file próprio (`tm2-progress-<X>.md`).
- Batching de notes.
- Backpressure se inbox > X KB.
- Custo de read-broadcast.

### Agent C — Recovery / Telemetria / Audit-Archive
- Recovery 3 níveis (timeout · vazio · crash).
- Telemetria inline no Wave Review (# notes, # edits, # OPENs, tempo).
- Archive `.agents/archive/<ts>/` antes do `rm`.
- Wave 0 condicional p/ `[complexa]`.

### Agent D — Formato Plan/Inbox + DX
- Header markdown table vs YAML (padronizar).
- Campos mínimos por mensagem.
- Naming quando N<5.
- Exemplos curtos no SKILL.md.
- Linha final do Orchestrator anunciando N.

### Agent E — Meta + DRAFT FINAL
- Refinar Tabela de Decisão de N (LOC, # camadas, # stacks).
- Quando NÃO usar v2.
- Versionamento/changelog.
- **Único autorizado** a escrever rascunho em `.agents/skills/task-master-v2/SKILL.md` na W2, sintetizando os 5 inboxes. **PROIBIDO** alterar a seção "Protocolo de cada sub-agente" no que tange write-access/edição direta.

## Regras-chave
- NENHUM agente edita código de aplicação.
- Cada agente: ≥2 mensagens substantivas/wave.
- Sem Migration-Request.
- Qualquer proposta que mate edição direta dos subagentes → `WONTFIX`.

## Status
- Wave: 2
- Status: In Progress

## Wave 1 — Review
5/5 agentes reportaram. 17 msgs substantivas + ~17 progress-notes em 5 inboxes (347 linhas).
**Decisões Orchestrator p/ W2 (tiebreak: write-access > DX > formato):**
1. Chatty postado nos **inboxes cruzados** com seção dedicada `## Progress Log` (A vence B — evita arquivo extra).
2. Cap chatty: **≤3 notes/fase, ≤8/wave**.
3. Gatilhos: edit + exec sempre; read seletivo (apenas leituras "milestone").
4. Default ON só p/ `[complexa]`.
5. Telemetria **inline** no `## Wave N — Review` (tabela agente·notes·edits·OPENs·tempo).
6. Archive `.agents/archive/<ts>/` antes do `rm`.
7. Recovery 3 níveis (timeout · vazio · crash) via `step: K/N` em progress-notes.
8. Header de mensagem mantém `## [W<n>] FROM X → Y | Tipo | Status` (não muda — D propôs mudar mas Orchestrator preserva por compat v1).
9. Linha final padronizada: `N=<n> agentes em paralelo · <w> waves · 0 OPEN`.
10. Tabela de N ganha 2 colunas: LOC estimadas + # stacks. Seção nova "Quando NÃO usar v2".
11. Changelog inline `<!-- version: 2.2 -->` no topo.
12. **Write-access dos subagentes PRESERVADO — restrição absoluta.**

## Wave 2 — Objetivo
- A/B/C/D drenam OPENs (ACK das decisões acima, Reject onde discordarem com justificativa).
- **Agent E** escreve o draft final de `.agents/skills/task-master-v2/SKILL.md` v2.2 incorporando as 12 decisões. PROIBIDO remover/relaxar a seção "Protocolo de cada sub-agente" no que tange write-access.