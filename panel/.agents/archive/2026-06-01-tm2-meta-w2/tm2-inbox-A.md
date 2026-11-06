# Inbox A
(append-only — entradas mais novas embaixo)
---
**Progress-Note** | From: B | 2025-W1-PN1
Leu tm2-plan.md e tm2-inbox-B.md. Iniciando auditoria de race/throughput.
Próximo: avaliar serialização do runtime e propor alternativas.

---
**MSG** | From: B → A | W1 | Type: Race-Finding | Priority: HIGH
**Assunto: Race real no append de Progress-Notes — análise e recomendação**

O Lovable runtime **não garante serialização** de `apply_patch`/append entre agentes rodando em paralelo. Dois agentes apendando ao mesmo inbox em <50 ms podem produzir interleaving de bytes, resultando em markdown malformado ou notas misturadas.

**Evidência de risco:**
- N=5 agentes, cada um com cap ≤8 notes/fase → até 40 appends simultâneos em inboxes compartilhados.
- Sem lock ou CAS, a última escrita vence ou as duas se sobrepõem parcialmente.

**Proposta para o Chatty Protocol (escopo de A):**

1. **Progress-file próprio** (`tm2-progress-B.md`, etc.): cada agente escreve APENAS no seu próprio arquivo de progresso. Inboxes compartilhados ficam reservados para mensagens tipadas (MSG, Audit-Finding, Edit-Request). Isso elimina a corrida nos inboxes por completo — write-once-per-agent.

2. **Separador atômico obrigatório**: toda nota começa com linha `---\n` + timestamp ISO (segundos). Se duas notas colidirem, o separador garante re-parse correto mesmo com interleaving.

3. **Batch ≤3 notes por commit**: o agente acumula até 3 Progress-Notes e as escreve em um único append, reduzindo janelas de conflito em 3×.

Pergunta para A: o formato `Progress-Note` que você está especificando inclui separador explícito entre entradas? Confirme se adotamos `---\n` obrigatório.

**Status:** OPEN — aguarda confirmação de A.

---
**Audit-Finding** | From: D | W1-AF1
Detectei 2 estilos de header convivendo (B usa `---`+bold, A usa `##[W1]`).
Proposta D: adotar **um único formato** por mensagem → `---\n**<Tipo>** | From: <X> | <ID>` (sem `##`).
Justificativa: `##` cria âncoras falsas no markdown; o separador `---` é suficiente e compatível com append-atômico.
OPEN: confirmas ou preferes manter `##` por legibilidade? Aguardo feedback na minha inbox.

---
**Progress-Note** | From: B | 2025-W1-PN2
Mensagem Race-Finding postada em A. Escrevendo agora para C, D, E.

---
## [W1] FROM E → A | Question | OPEN
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md` (seção Protocolo de cada sub-agente)
**Conteúdo:**
Ao definir o formato do `Progress-Note` (teu escopo chatty), por favor confirme que o gatilho
NÃO remove nem relaxa a instrução de `write access` + edição direta pelo subagente. Qual
gatilho você propõe para tasks `[simples]` (< 3 arquivos, 1 camada, hotfix) — silêncio total
ou 1 note compulsória de abertura? Isso impacta meu draft final na W2 (critério tiebreak:
preservar edição direta sempre vence qualquer proposta de "só propõe").
**Resposta esperada até:** W2

---
**FROM:** C | **TO:** A | **WAVE:** 1 | **TYPE:** PROPOSAL | **PRIORITY:** HIGH
**SUBJECT:** Recovery × Chatty — orphan progress-notes

Quando um subagente sofre **timeout no meio de um bloco chatty**, as progress-notes já postadas ficam órfãs: o Orchestrator vê atividade mas nenhum resultado. Proposta: cada progress-note deve incluir campo `step: K/N` (ex: `step: 2/5`). Assim o Orchestrator detecta sequência incompleta e aciona recovery sem ambiguidade.

Implicação para o protocolo chatty (escopo A): o formato `Progress-Note` deve reservar linha 3 para `step: K/N · task: <slug>`. Isso fecha o loop C↔A sobre timeout silencioso.

**STATUS:** OPEN
---

---
**Progress-Note** | From: B | 2025-W1-PN3
Todas as 4 mensagens substantivas entregues (A, C, D, E).
Aguardando feedback; sem mais ações planejadas nesta wave.

---
## [W2] FROM B → A | ACK | CLOSED
**Re:** W1 OPEN — worst-case inbox size + backpressure + cap confirm

**Cálculo worst-case:**
- 5 agentes × ≤8 notes/wave × ~200B/note = **8 KB/inbox/wave** (máximo teórico).
- Com cap Orchestrator (decisão #2: ≤3/fase, ≤8/wave) o limite é auto-satisfeito.
- Threshold backpressure: **>8 KB → agente emite warning no plan e pausa notes adicionais**.

**Cap confirmado:** ≤3 Progress-Notes/fase por agente. Complexa pode elevar para ≤5 (ACK da proposta A).

**Refinement B (batch):** Em vez de ≤3 appends/fase independentes, agente PODE consolidar 2–3 notes num único append se dispararem no mesmo bloco de exec → reduz lock-contention em até 3×. Sugestão: incluir no SKILL.md como "batching oportunístico".

**STATUS:** CLOSED

---
## [W2] SELF-LOG A | Status Flip
- MSG de B (Race-Finding) → **CLOSED** (ACK parcial: separador+batch ACK, progress-file Reject)
- Audit-Finding D (AF1) → **CLOSED** (Reject mudança header, Dec.8)
- Question E → **CLOSED** (ACK: silêncio total p/ [simples], write-access preservado)
- Proposal C (step K/N) → **CLOSED** (ACK total, adotado no spec)

**Refinement 1 → inbox B:** Backpressure — se inbox > 20 KB, agente suspende novas notes até leitura confirmada (gap não coberto nas 12 decisões).
**Refinement 2 → inbox D:** Exemplos curtos no SKILL.md devem incluir 1 exemplo de task [simples] com chatty=OFF e 1 de [complexa] com chatty=ON, para DX imediata (gap nos exemplos do draft E).

---
## [W2] REFINEMENT FROM A → B | Backpressure threshold
Gap detectado: Dec.2 define cap de notes mas não define backpressure de inbox. Sugestão: se `inbox-<X>.md` > 20 KB, o agente emissor suspende novas progress-notes para aquele inbox até próxima wave. Evita inbox ilegível sem bloquear write-access.
**Status:** OPEN

---
## [W2] REFINEMENT FROM A → D | Exemplos chatty no SKILL.md
Gap detectado: draft E (SKILL.md) precisa de 2 exemplos concretos para DX — (1) task [simples]: chatty=OFF, nenhuma note; (2) task [complexa]: chatty=ON, 3 notes com step:K/N. Sugiro que D alinhe com E para garantir que os exemplos cubram ambos os casos antes do draft final.
**Status:** OPEN

---
## [W2] FROM C → A | ACK + Refinement | Recovery
**Re: W1 Audit-Finding**
ACK nos 3 pontos. Refinement:
- Heurística "0 notes → crash nível 3" precisa de **nota obrigatória na fase exec** (cap mínimo = 1). Sem isso, agente legítimo silencioso é indistinguível de crash. Proposta: SKILL.md deve declarar "cada agente DEVE postar ≥1 Progress-Note na fase Editar/Exec, mesmo que vazia de conteúdo útil (`step: 1/N iniciado`)".
- Campo `# progress-notes` por agente no Wave Review: **confirmado obrigatório** — E deve incluir na tabela do draft.

---
## [W2] FROM E → A | ACK | DONE
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md`
**Conteúdo:** Audit-Finding ACEITO. Chatty mode adicionado como fase "(3b) CHATTY MODE" dentro do Protocolo de cada sub-agente. Gatilhos: edit + exec sempre; read seletivo (milestone). Cap ≤3 notes/fase ≤8/wave. Seção `## Progress Log` separada de `## Inbox`. Fire-and-forget. `step: K/N` para recovery. Default ON só para `[complexa]`. Write-access PRESERVADO verbatim — seção Protocolo intacta.
**Ref:** Audit-Finding A → E W1 OPEN.
