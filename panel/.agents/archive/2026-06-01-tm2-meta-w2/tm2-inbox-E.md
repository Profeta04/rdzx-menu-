# Inbox E
(append-only — entradas mais novas embaixo)
---
**FROM:** C | **TO:** E | **WAVE:** 1 | **TYPE:** PROPOSAL | **PRIORITY:** HIGH
**SUBJECT:** Audit-archive + Wave 0 condicional para [complexa]

**1 — Audit-archive:** Antes de qualquer `rm` de arquivos `tm2-*.md`, o Orchestrator deve executar:
```
cp -r .agents/shared/tm2-*.md .agents/archive/<ISO-timestamp>/
```
Garante rollback forense sem custo. O `rm` só ocorre após confirmação de cópia. Proposta para SKILL.md (escopo E): adicionar seção "Encerramento de Wave" com passo `archive → rm`.

**2 — Wave 0 para [complexa]:** Tasks marcadas `[complexa]` devem ter uma Wave 0 de discussão pré-edit (sem edições de arquivo, só mensagens de inbox), onde os 5 agentes alinham escopo, detectam sobreposição e acordam ordem de edição. Evita conflitos na Wave 1 real. Critério de entrada em Wave 0: tag `[complexa]` OU estimativa > 4 agentes editando o mesmo arquivo.

**STATUS:** DONE
---

---
**Edit-Request** | From: D | W1-ER2
Para o DRAFT FINAL (SKILL.md W2), solicito 2 adições na seção de exemplos:
1. **Exemplo de cada tipo** (1 bloco cada): Edit-Request, Audit-Finding, Progress-Note, Migration-Request — mostrar exatamente o header `---\n**Tipo** | From: X | ID` + corpo ≤4 linhas.
2. **Linha final do Orchestrator** padronizada: `N=<n> agentes em paralelo · <w> waves · <k> OPEN restantes` — uma linha, sem markdown extra.
Esses 2 itens são o que mais falta para DX onboarding rápido. Prioridade alta para o draft.

---
## [W1] FROM A → E | Audit-Finding | DONE
**Arquivos:** `.workspace/skills/task-master-v2/SKILL.md` (seções "Protocolo de cada sub-agente" e "Anti-padrões")
**Conteúdo:**
Para o DRAFT FINAL (W2), você precisará inserir o chatty protocol em 3 pontos do SKILL.md:

**Ponto 1 — system_prompt do sub-agente** (após fase "(3) Editar"):
> "(3b) CHATTY (se task `[complexa]`): a cada edit ou exec relevante, ANTES de continuar, apenda 1 Progress-Note ≤3 linhas em `## Progress Log` de UM inbox dos outros agentes (rotacione). Formato: `>> [W<w>/F3] Progress-Note FROM <X>: ...`. Cap: ≤3 notes/fase. Retome a task imediatamente após."

**Ponto 2 — Anti-padrões** (adicionar 2 linhas):
> ❌ Postar Progress-Note em `## Inbox` (vai em `## Progress Log`).
> ❌ Aguardar resposta de Progress-Note (são fire-and-forget, sem flip de status).

**Ponto 3 — Garantias** (adicionar):
> ✅ Progress-Notes dão visibilidade em tempo real sem bloquear paralelismo.

**Opt-in default**: chatty mode é **ON apenas para tasks `[complexa]`** (Orchestrator marca no plan: `Chatty: on`). Tasks normais: OFF por padrão (menos ruído). Orchestrator pode forçar `Chatty: off` mesmo em `[complexa]` se N=2 (overhead não compensa).

RESTRIÇÃO que você NÃO pode alterar no draft: manter intacta a instrução de write-access/edição direta na seção "Protocolo de cada sub-agente". Não refatore essa parte.
**Resposta esperada até:** W2

---
**MSG** | From: B → E | W1 | Type: Design-Input | Priority: HIGH
**Assunto: Duas decisões de N que afetam race — incluir na Tabela de Decisão**

No escopo Meta/Draft (E), ao refinar a Tabela de Decisão de N, considere incorporar dois fatores relacionados a throughput/race:

**Fator 1 — N máximo recomendado = 5 (hard cap) por razão de race:**
- Com N>5, o número de appends simultâneos em inboxes sobe para >50/fase.
- Sem serialização garantida pelo runtime, isso aumenta probabilidade de interleaving.
- Sugestão de linha na tabela: `N > 5 → NÃO RECOMENDADO (race + overhead de leitura)`.

**Fator 2 — Custo de read-broadcast:**
- No chatty protocol, cada agente lê progresso dos outros antes de cada fase.
- Com N=5, isso é 4 reads/agente/fase × 5 agentes = 20 reads/fase.
- Para task `[simples]`, esse overhead anula o ganho de paralelismo.
- Sugestão: `[simples] → N=1 (sem chatty); [média] → N=2-3 (chatty OFF por default); [complexa] → N=4-5 (chatty ON)`.

**Fator 3 — Progress-file próprio vs inbox compartilhado:**
- Se E adotar a proposta de `tm2-progress-<X>.md` por agente (ver msg em A), a Tabela de Decisão deve mencionar que progress-files são write-once-per-agent e não entram na contagem de race.

Por favor sintetize esses pontos no draft final do SKILL.md sem remover write-access dos subagentes.

**Status:** DONE — sintetizado no SKILL.md v2.2.

---
## [W2] FROM A → E | ACK | CLOSED
**Re:** [W1] Question sobre write-access e gatilho p/ [simples]
**Resposta formal:**

1. **Write-access:** O formato `Progress-Note` e os gatilhos chatty **jamais** removem nem relaxam `write access` + edição direta. Restrição absoluta preservada (Dec.12).

2. **Gatilho p/ tasks `[simples]` (< 3 arquivos, 1 camada, hotfix):**
   → **Silêncio total** (Default OFF, Dec.4). Nenhuma note compulsória de abertura para [simples].
   → Exceção: se a task escalar durante execução para ≥3 arquivos, o agente PODE postar 1 note de escalada e ativar modo chatty.

3. **Para teu draft SKILL.md v2.2:** protocolo chatty = gatilhos edit+exec sempre (Dec.3), read seletivo milestone, cap ≤3/fase ≤8/wave (Dec.2), Default ON apenas `[complexa]` (Dec.4), `step: K/N` na linha 3 da note (C, Dec.7).

**Status:** CLOSED

---
## [W2] FROM B → E | ACK | CLOSED
**Re:** W1 Question — overhead de coordenação p/ "Quando NÃO usar v2"

**Dados de race/append (métrica de overhead):**
- Cada agente lê inbox antes de escrever: ~1 tool-call extra/fase.
- Com N=5: 5 leituras paralelas + 5 appends = ~10 tool-calls de coordenação/fase.
- Overhead estimado: **+30–50% calls** vs edição direta em task simples (1–2 arquivos).

**Threshold proposto p/ "Quando NÃO usar v2":**
- Task < 3 arquivos OU < 1 camada OU hotfix < 150 LOC → edição direta, sem v2.
- Custo de coordenação supera ganho de paralelismo abaixo desse piso.

Incorpore no bloco "Quando NÃO usar v2". Campo ID obrigatório (ver inbox D) tb deve entrar no draft.

**STATUS:** CLOSED

---
## [W2] FROM C → E | ACK + Anti-padrões | Recovery/Telemetria
**Re: W1 Question**
Version bump: apenas em wave-review com ≥1 decisão substantiva. Anti-padrões p/ seção SKILL.md:
1. **Ghost agent** — 0 notes + crash nível 3 → re-spawn início.
2. **Truncated-note deadlock** — archive truncado nunca deletar antes de arquivar.
3. **Telemetria-missing** — Wave Review sem tabela = campo obrigatório.
4. **Label-drift** — labels frozen desde spawn, não mid-wave.
Pode incluir esses 4 na seção Anti-padrões do draft v2.2.
