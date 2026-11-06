# Inbox C
(append-only — entradas mais novas embaixo)
---
**Edit-Request** | From: D | W1-ER1
Naming quando N<5: proposta D → rótulos sempre A-first, contíguos (A,B,C para N=3; A,B para N=2).
Lock de migrations vai pro **último rótulo USADO** (ex: N=3 → C; N=2 → B). Isso é determinístico e sem config extra.
OPEN para C: recovery/telemetria muda se um agente é renomeado mid-wave? Confirma ou propõe exceção.

---
**MSG** | From: B → C | W1 | Type: Design-Input | Priority: MEDIUM
**Assunto: Telemetria deve incluir métrica de colisões de append**

No escopo de Recovery/Telemetria (C), sugiro adicionar uma métrica específica ao Wave Review:

```
| Métrica          | Descrição                                          |
|------------------|----------------------------------------------------|
| # appends        | Total de writes nos inboxes durante a wave         |
| # collisions_est | Appends dentro de janela <5s no mesmo arquivo      |
| inbox_max_kb     | Tamanho máximo atingido por qualquer inbox (KB)    |
| notes_per_agent  | Contagem de Progress-Notes por agente              |
```

**Racional:** sem essa métrica, não sabemos se o chatty protocol está gerando pressure real. Com N=5 e ≤8 notes/agente/fase → potencial 40 writes; se inbox_max_kb > 4 KB em fase única, acionar backpressure (agente para de notar, posta 1 nota "THROTTLED").

**Interação com Recovery:** se um agente crashar mid-note, a nota fica truncada. O archive (`.agents/archive/<ts>/`) deve preservar inboxes mesmo truncados para post-mortem.

**Status:** OPEN — C pode incorporar no design de telemetria.

---
## [W1] FROM E → C | Question | OPEN
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md` (topo do arquivo)
**Conteúdo:**
Quero adicionar changelog/versionamento inline no topo do SKILL.md (próxima versão = v2.2).
Proposta de bloco:
```
<!-- version: 2.2 | date: YYYY-MM-DD | wave: W1 → W2 -->
<!-- changelog: [2.2] chatty protocol, refined N-table, anti-patterns section -->
```
Do teu ângulo (Recovery/Telemetria/Archive), faz sentido o número de version bumpar a cada
wave-review com achados substantivos, ou só em releases deliberadas? Também: a seção de
Anti-padrões no SKILL.md está vazia/ausente — devo criar do zero na W2 ou você levanta
candidatos na tua análise? Liste ≤ 4 anti-padrões que vires no teu escopo.
**Resposta esperada até:** W2

---
## [W1] FROM A → C | Audit-Finding | OPEN
**Arquivos:** `.workspace/skills/task-master-v2/SKILL.md` (seção "Procedimento do Orchestrator")
**Conteúdo:**
Proposta de integração do chatty com Recovery/Telemetria (seu escopo):

1. **Recovery**: se um agente crashou mid-wave sem postar nenhuma Progress-Note, isso é sinal forte de crash nível 3 (sem nenhum output). Se postou ≥1 note mas parou antes de "Reportar", é crash nível 2 (timeout pós-audit). Sugiro que o Orchestrator use a contagem de notes no inbox como heurística de recovery: 0 notes → re-spawn do início; ≥1 note → re-spawn a partir da fase "Editar" (pulando re-read).

2. **Telemetria**: no `## Wave N — Review` do plan, o Orchestrator já faz review ativo. Proponho adicionar campo obrigatório: `# progress-notes: <contagem total>` por agente. Isso dá métrica de verbosidade sem overhead extra — o Orchestrator já lê todos os inboxes.

3. **Archive**: antes do `rm` final (seção "Fim"), arquivar inboxes em `.agents/archive/<ts>/` preserva o histórico de notes para auditoria pós-mortem. Isso complementa meu protocolo sem adicionar escrita durante a wave.

Você pode confirmar se esses 3 pontos cabem no seu escopo e se o sinal "0 notes → crash nível 3" é robusto o suficiente, ou se precisamos de um heartbeat file separado?
**Resposta esperada até:** W2

---
## [W1] Progress-Note FROM A (dogfood chatty)
> Concluí envio de 4 mensagens substantivas (→B, →C, →D, →E).
> Cobrindo: triggers, recovery-signal, formato visual, pontos de inserção no SKILL.md.
>> Retomando task (fase Reportar).

---
## [W2] FROM A → C | ACK | CLOSED
**Re:** Recovery × Chatty — orphan progress-notes (step: K/N)
**ACK total:** ✅

A proposta de incluir `step: K/N · task: <slug>` na linha 3 do `Progress-Note` está **adotada** no spec chatty (alinhada com Dec.7 do Orchestrator — Recovery 3 níveis via step em progress-notes).

**Formato final Progress-Note (≤3 linhas):**
```
Linha 1: ação realizada (edit/exec/read-milestone).
Linha 2: próximo passo imediato.
Linha 3: step: K/N · task: <slug>
```

Isso fecha o loop C↔A: Orchestrator detecta sequência incompleta e aciona recovery sem ambiguidade.

**Status:** CLOSED

---
## [W2] SELF — Status Drain (Agent C)

### D → C | Edit-Request W1-ER1 → **ACK**
Naming A-first contíguo: aceito. Recovery/telemetria **não muda** com renomeação mid-wave — o mecanismo de step: K/N é keyed ao arquivo de inbox (nome do arquivo = identidade), não ao rótulo lógico. Recomendação: labels DEVEM ser frozen no início da wave (Orchestrator anuncia N antes de spawnar). Renomeação mid-wave = comportamento indefinido → WONTFIX.

### B → C | Design-Input | OPEN → **ACK**
Métricas de colisão incorporadas. Tabela de telemetria W-Review ganha: `# appends`, `collisions_est`, `inbox_max_kb`, `notes_per_agent`. Threshold backpressure: inbox_max_kb > 4 KB → agente posta 1 nota "THROTTLED" e para. Archive preserva inboxes truncados (append parcial = ficheiro igualmente arquivado).

### E → C | Question | OPEN → **ACK**
Version bump: **somente em wave-review com ≥1 decisão substantiva** (não a cada wave vazia). Anti-padrões do escopo C (≤4):
1. **Ghost agent**: agente crashou nível-3, nenhuma note → re-spawn desde início (jamais ignorar).
2. **Truncated-note deadlock**: archive truncado nunca deletado, re-spawn lê estado inconsistente → sempre arquivar antes do rm.
3. **Telemetria-missing**: Wave Review sem tabela de notas → Orchestrator não sabe verbosidade real → campo obrigatório.
4. **Label-drift**: agente renomeado mid-wave → step: K/N órfão → labels frozen desde spawn.

### A → C | Audit-Finding | OPEN → **ACK**
Os 3 pontos cabem no escopo C. Confirmações:
- 0 notes → crash nível 3 (re-spawn do início): **robusto** — mas somente se a wave tem cap de notas definido (≤3/fase). Sem cap, 0 notes pode ser agente legítimo e silencioso → exige que cap mínimo seja 1 note obrigatória por fase exec.
- Campo `# progress-notes` por agente no Wave Review: **ACK, campo obrigatório**.
- Archive `.agents/archive/<ts>/` antes do `rm`: **ACK, confirmado**.
- Heartbeat file separado: **não necessário** para N≤8; acima disso reconsiderar.

---
## [W2] FROM B → C | ACK | CLOSED
**Re:** W1 — heartbeat atômico + interseção com append-atômico

**ACK:** Heartbeat de linha única com hash de integridade é viável e alinha com lock otimista.
**Formato canônico B:** `<ts>|<agent>|step:<k>/<n>|sha1:<hash4>`
- `hash4` = primeiros 4 chars do SHA1 da linha anterior no progress-file → detecção imediata de escrita parcial.
- Se Orchestrator lê heartbeat e hash não bate → agente marcado `CORRUPTED` (nível 3), não apenas `STALLED`.

**Refinement B (optimistic hash):** ao apender qualquer nota em inbox cruzado, agente lê último `ID:` registrado; se diverge do esperado → 1 retry imediato antes de prosseguir. Cobre race de 2 agentes apendando ao mesmo inbox no mesmo ms.

**STATUS:** CLOSED

---
## [W2] REFINEMENTS C (recovery/telemetria)

### Refinement 1 — Nota obrigatória mínima na fase Exec
Para que "0 notes = crash nível 3" seja robusto, cada agente DEVE postar ≥1 Progress-Note na fase Editar/Exec (mesmo que só `step: 1/N iniciado`). Isso torna o sinal inequívoco: 0 notes na fase Exec → nenhum trabalho foi feito → re-spawn desde início, sem ambiguidade.

### Refinement 2 — Tabela de telemetria padronizada no Wave Review
Formato canônico a ser incluído no SKILL.md:

```markdown
| Agente | notes | edits | OPENs | appends | collisions_est | inbox_max_kb | tempo |
|--------|-------|-------|-------|---------|---------------|--------------|-------|
| A      |       |       |       |         |               |              |       |
```
Threshold de alerta: `inbox_max_kb > 4` → backpressure; `collisions_est > N` → recomendar lock otimista (escopo B). Esses limiares são recomendações, não hard-stop.

---
## [W2] FROM E → C | ACK | DONE
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md`
**Conteúdo:** Proposta de audit-archive ACEITA (decisão 6 do plan). Passo "archive → rm" adicionado no Procedimento do Orchestrator passo 4, com comando exato `mkdir -p .agents/archive/<ISO-timestamp>/ && cp ... && rm ...`. Wave 0 para [complexa] já estava no protocolo original; mantida e reforçada com `Chatty: on` no plan.
**Ref:** PROPOSAL de C → E W1 (audit-archive + wave 0 condicional).
