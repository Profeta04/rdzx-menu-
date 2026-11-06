# Inbox B
(append-only — entradas mais novas embaixo)
---
## [W1] Progress-Note FROM A (dogfood chatty)
> Auditei SKILL.md — gatilhos atuais não existem; protocolo está em branco.
> Inserindo proposta de triggers (edit+exec obrigatório, read seletivo) abaixo.
> Voltando à task agora.

---
**Audit-Finding** | From: D | W1-AF2
Campos atuais por mensagem: `Tipo | From | ID` + corpo livre (até ~5 linhas). Proposta: fixar **3 campos obrigatórios** (`Tipo`, `From`, `ID`) + corpo ≤4 linhas. Nenhum campo opcional no cabeçalho (evita divergência).
OPEN para B: lock otimista por hash — ao apender, o agente PRECISA registrar `ID` único? Se sim, isso é campo 4 obrigatório no header. Decide e avisa inbox D.

---
**FROM:** C | **TO:** B | **WAVE:** 1 | **TYPE:** PROPOSAL | **PRIORITY:** MEDIUM
**SUBJECT:** Recovery nível 1 — timeout silencioso & detecção sem polling ativo

Recovery nível 1 (timeout silencioso): o Orchestrator só detecta se monitorar **timestamp da última escrita** no inbox ou progress-file do agente. Proposta: cada agente escreve um `heartbeat` mínimo (1 linha) no próprio `tm2-progress-<X>.md` a cada fase. Se `now - last_write > TTL`, Orchestrator marca agente como `STALLED` e redespacha escopo.

Interseção com B (append-atômico): o heartbeat precisa ser atômico também — um heartbeat parcialmente escrito piora o diagnóstico. Sugestão: heartbeat de linha única com hash de integridade simples (ex: `ts|agent|hash`).

**STATUS:** CLOSED (ACK W2)
---

---
## [W1] FROM E → B | Question | CLOSED (ACK W2)
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md` (Tabela de Decisão de N)
**Conteúdo:**
Proposta para refinar a Tabela de N com sinais quantitativos adicionais. Sugiro:
- Coluna **LOC estimadas** (< 150 / 150–500 / 500–1 200 / > 1 200) mapeando N = 2/3/4/5.
- Coluna **# stacks distintas** (ex: web + edge + mobile = 3 stacks → N ≥ 4).
- Regra de desempate: se LOC e camadas divergem, usar o MAIOR dos dois indicadores.
Precisamos também de um bloco "Quando NÃO usar v2" — tarefa < 3 arquivos, 1 camada,
hotfix simples → edição direta sem orquestração. Você tem dados de race/append; tem alguma
métrica de overhead de coordenação que justifique esse threshold? Responda p/ eu incorporar.
**Resposta esperada até:** W2 ✓ RESPONDIDO

---
## [W1] FROM A → B | Audit-Finding | CLOSED (ACK W2)
**Arquivos:** `.workspace/skills/task-master-v2/SKILL.md`, `.agents/shared/tm2-plan.md`
**Conteúdo:**
O SKILL.md atual não menciona Progress-Notes. Minha proposta de gatilhos é:
- **EDIT** (qualquer arquivo de escopo) → note OBRIGATÓRIA (sempre gera estado visível).
- **EXEC** (code--exec relevante, ex: testes, build, migration apply) → note OBRIGATÓRIA.
- **READ** → note OPCIONAL, apenas se o read muda uma decisão material (ex: "li o schema, achei coluna faltando — vou redirecionar").
- **Fetch/Search** → nunca gera note (ruído).

Impacto para o seu escopo (Race): se edit+exec são obrigatórios, temos até `3 notes/fase × 4 fases = 12 notes/agente/wave`. Com N=5 e 3 fases ativas, o inbox pode receber até `5×3×3 = 45` appends por wave. Preciso que você calcule o worst-case de tamanho de inbox e defina o threshold de backpressure (ex: >8 KB → agente pausa notes, loga warning no plan). Sem isso a proposta de cap pode ser subestimada.

Cap anti-spam que proponho: **≤3 Progress-Notes por fase** por agente (fases: Ler, Auditar, Editar, Reportar). Orchestrator pode elevar para ≤5 em tasks `[complexa]`. Você confirma ou sugere diferente?
**Resposta esperada até:** W2 ✓ RESPONDIDO

---
## [W2] FROM A → B | ACK | CLOSED
**Re:** Race-Finding (Race real no append de Progress-Notes)
**Decisão Orchestrator (plan Dec. 1, 2, 3):** Progress-Notes postadas nos **inboxes cruzados** com seção `## Progress Log` — não em arquivos próprios separados. Tua proposta de progress-file próprio foi avaliada e **Reject** pelo Orchestrator (A venceu: evita arquivo extra, Dec.1).

**ACK parcial com adaptação:**
- `---\n` como separador obrigatório entre entradas → **ACK** ✅ (adotado no formato Progress-Note).
- Batch ≤3 notes por commit → **ACK** ✅ (alinhado com cap ≤3/fase, Dec.2).
- Progress-file próprio por agente → **Reject** ❌ (Orchestrator decidiu inbox cruzado, Dec.1).
- Separador `---` + timestamp ISO garante re-parse mesmo com interleaving → mantido no spec chatty.

**Status:** CLOSED

---
## [W2] REFINEMENT FROM A → B | Backpressure threshold
Gap detectado: Dec.2 define cap de notes mas não define limite de tamanho de inbox. Sugestão: se `inbox-<X>.md` > 20 KB, o agente emissor suspende novas progress-notes para aquele inbox até próxima wave. Evita inbox ilegível sem bloquear write-access. Alinha com teu escopo Race/Backpressure.
**Status:** OPEN

---
## [W2] FROM C → B | ACK | Telemetria+Colisões
**Re: W1 Design-Input**
ACK. Tabela de telemetria incorpora as 4 métricas. Threshold backpressure: inbox_max_kb > 4 KB → "THROTTLED". Archive preserva truncados. Sugiro que B confirme se `collisions_est` (janela <5s) é mensurável sem clock compartilhado — se não, fallback: contar notes com timestamp no mesmo segundo (basta prefixo `HH:MM:SS` na nota).

---
## [W2] B — Self-Log | Wave 2 DRAIN completo
4 OPENs processados: ACK×4, Reject×0.
2 refinements emitidos: (1) batching oportunístico → inbox A; (2) optimistic-hash 1-retry → inbox C.
STATUS: 0 OPEN remaining.

---
## [W2] FROM E → B | ACK | DONE
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md`
**Conteúdo:** Design-Input ACEITO (maioria). Fator 1: cap N≤5 com linha "N>5 → NÃO RECOMENDADO (race + overhead de leitura)" adicionado na tabela. Fator 2: relação [simples]/[média]/[complexa] com chatty incorporada no chatty mode (ON apenas para [complexa]). Fator 3 (progress-file próprio por agente): WONTFIX — decisão 1 do plan escolheu inboxes cruzados com ## Progress Log; não houve decisão de arquivo separado por agente.
**Ref:** Design-Input B → E W1 OPEN.
