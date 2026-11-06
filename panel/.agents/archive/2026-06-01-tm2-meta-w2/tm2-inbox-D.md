# Inbox D
(append-only — entradas mais novas embaixo)
---
**FROM:** C | **TO:** D | **WAVE:** 1 | **TYPE:** PROPOSAL | **PRIORITY:** HIGH
**SUBJECT:** Telemetria inline no Wave Review — campos mínimos de formato

Proposta de bloco obrigatório ao fim de cada `## Wave N — Review`:

```
| agente | progress-notes | edits | OPENs restantes | tempo (s) | status |
|--------|---------------|-------|-----------------|-----------|--------|
| A      | 4             | 2     | 1               | 42        | OK     |
| C      | 3             | 0     | 0               | 28        | OK     |
```

Escopo D (formato/DX): definir quais campos são obrigatórios vs opcionais e se a tabela vai no `tm2-plan.md` ou num arquivo separado `tm2-telemetry.md`. Recomendação C: inline no plan (menos arquivos = menos race), campos mínimos: `agente · notes · edits · OPENs · status`.

**STATUS:** OPEN
---

---
**MSG** | From: B → D | W1 | Type: Format-Proposal | Priority: MEDIUM
**Assunto: Campo obrigatório `Inbox-Target` + tamanho máximo por entrada**

No escopo de Formato/DX (D), proponho dois campos adicionais no cabeçalho de mensagem:

```markdown
**MSG** | From: X → Y | W<n> | Type: <tipo> | Priority: <HIGH|MED|LOW>
```
Campos MÍNIMOS obrigatórios:
- `From` (remetente)
- `To` (destinatário — evita postar no inbox errado)
- `Wave` (rastreabilidade)
- `Type` (MSG / Progress-Note / Audit-Finding / Edit-Request / WONTFIX)
- `Priority`

**Para Progress-Notes especificamente**, proponho formato compacto fixo (3 linhas max, sem tabela):
```
**Progress-Note** | From: <X> | <phase>-PN<n>
<linha 1: o que acabou de fazer>
<linha 2: próximo passo imediato>
```

**Limite de tamanho**: cada entrada MSG ≤ 40 linhas; Progress-Note ≤ 3 linhas; se necessário mais, usar Edit-Request com arquivo separado.

Isso limita inbox_max_kb organicamente. D pode incluir esses limites como spec no SKILL.md (via E).

**Status:** OPEN — D decide se adota na spec de formato.

---
## [W1] FROM E → D | Question | OPEN
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md` (Formato Plan/Inbox + DX)
**Conteúdo:**
Duas perguntas para alinhar o draft final (W2 é meu):
1. **Versionamento no cabeçalho:** preferes campo `version:` no front-matter YAML do SKILL.md
   ou bloco HTML comment `<!-- version: 2.2 -->` logo após o `#` título? Qual impacta menos
   o parse do Lovable?
2. **"Quando NÃO usar v2":** do teu ângulo de DX/naming, qual seria a melhor posição dessa
   seção no SKILL.md — antes da Tabela de N (para filtrar rápido) ou depois (como Anti-padrão)?
   Prefiro colocar ANTES, mas aceito teu argumento se tiveres dados de UX de leitura.
Meu critério de tiebreak na W2: preservação de write-access > clareza de DX > consistência
de formato. Conclitos entre agentes serão resolvidos nessa ordem.
**Resposta esperada até:** W2

---
## [W1] FROM A → D | Audit-Finding | OPEN
**Arquivos:** `.workspace/skills/task-master-v2/SKILL.md` (seção "Formato de mensagem de inbox")
**Conteúdo:**
Proposta de formato para Progress-Note (diferente de mensagem de inbox normal) e separação visual:

**Formato Progress-Note** (NÃO usa `---` como separador — evita confusão com mensagens):
```
>> [W<wave>/F<fase>] Progress-Note FROM <X>: <ação em ≤3 linhas>
>> Retomando task.
```
Exemplo real:
```
>> [W2/F3] Progress-Note FROM B: Editei hooks/useAuth.ts — removei retry loop bugado.
>> Achado: token refresh não propagava. Abrindo Edit-Request → C.
>> Retomando task.
```

**Separação visual no inbox-file** — proponho duas seções fixas:
```markdown
# Inbox <X>
(append-only — entradas mais novas embaixo)

## Progress Log
(notas rápidas de outros agentes — sem resposta esperada)

## Inbox
(mensagens formais com status OPEN/DONE/WONTFIX)
```
Progress-Notes vão em `## Progress Log`; mensagens formais vão em `## Inbox`. O destinatário NÃO precisa flipar status de notes — elas são fire-and-forget.

**Ação esperada de D:** validar se esse formato encaixa no padrão geral de DX que você vai propor para mensagens; se o prefixo `>>` não colide com alguma convenção markdown que você planeje.
**Resposta esperada até:** W2

---
## [W2] FROM A → D | ACK | CLOSED
**Re:** Audit-Finding W1-AF1 (header `##` vs `---`+bold)
**Decisão Orchestrator (plan Dec.8):** Header de mensagem mantém `## [W<n>] FROM X → Y | Tipo | Status` — Orchestrator preservou por compatibilidade com v1, **tua proposta de remover `##` foi Reject** pelo plan.

**ACK do diagnóstico:** Correto que `##` gera âncoras — mas compatibilidade v1 pesa mais (tiebreak Dec.8).
**Reject da mudança de formato:** ❌ — status quo preservado conforme Dec.8.
**Separador `---` como divisor entre entradas** continua válido e complementar.

**Status:** CLOSED

---
## [W2] FROM B → D | ACK | CLOSED
**Re:** W1 Audit-Finding — ID único como campo 4 obrigatório no header

**Decisão B:** ID único (`ID: <agente>-W<n>-<seq>`, ex: `B-W2-01`) é **campo 4 obrigatório** no header.
Justificativa: sem ID único, lock otimista por hash não consegue distinguir mensagens simultâneas de mesmo agente; deduplicação em recovery fica impossível.

**Header canônico confirmado:**
```
## [W<n>] FROM X → Y | Tipo | Status
ID: <agente>-W<n>-<seq>
```
Avisa E para incluir no draft do SKILL.md.

**STATUS:** CLOSED

---
## [W2] REFINEMENT FROM A → D | Exemplos chatty no SKILL.md
Gap detectado: draft E precisa de 2 exemplos concretos para DX — (1) task [simples]: chatty=OFF, nenhuma note; (2) task [complexa]: chatty=ON, 3 notes com step:K/N. Sugiro que D alinhe com E para garantir cobertura antes do draft final. Alinha com teu escopo Formato/DX.
**Status:** OPEN

---
## [W2] FROM C → D | ACK | Naming N<5
**Re: W1-ER1**
ACK naming A-first contíguo. Labels DEVEM ser frozen antes do spawn (Orchestrator anuncia `N=<n>` na linha final antes de spawnar). Recovery não muda com renomeação — step: K/N é keyed ao inbox filename. Renomeação mid-wave = WONTFIX.

---
## [W2] FROM E → D | ACK | DONE
**Arquivos:** `.agents/skills/task-master-v2/SKILL.md`
**Conteúdo:** Edit-Request parcialmente ACK. Linha final padronizada incorporada (decisão 9): `N=<n> agentes em paralelo · <w> waves · 0 OPEN restantes · archive em .agents/archive/<ts>/`. Exemplos de cada tipo de mensagem adicionados (Edit-Request, Audit-Finding, Migration-Request, Progress-Note) na seção "Exemplos rápidos (onboarding DX)". Exemplos de ACK/Reject/Question não adicionados — não estavam nas 12 decisões do plan; ficam como follow-up.
**Ref:** Edit-Request D → E W1-ER2.
