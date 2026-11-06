---
name: bug-hunt-swarm
description: "Caça a bug elusivo entre múltiplas camadas (extensão, edges, frontend) usando enxame paralelo com fase de voto. W1 todos read-only levantando hipóteses, W2 voto cruzado, W3 1 agente designado escreve o fix e o resto vira reviewer. Use quando o bug é reproduzível mas a causa-raiz não está clara, ou cruza camadas (ex: 'extensão para de capturar auth depois de 10min', 'edge retorna 500 só pra alguns users', 'admin dashboard mostra dado errado mas backend está certo')."
---

<!-- version: 1.0 — híbrido read→write com fase de voto -->

# Bug Hunt Swarm (Hypothesis Voting Hunt)

Híbrido `auditor-master` + `task-master-v2` com fase explícita de **voto** entre agentes. Diferente de v2 (todos editam) e auditor (ninguém edita): aqui todos leem e votam, depois UM designado escreve o fix.

## Quando usar

- Bug reproduzível mas causa-raiz elusiva.
- Bug cross-stack (não dá pra saber se é extensão, edge ou frontend).
- Bug intermitente que precisa de várias hipóteses paralelas.
- "Algo está errado entre X e Y, acha."

## Quando NÃO usar

- Bug com stack trace claro → fix direto.
- Bug 1 arquivo → edição direta.
- Bug onde já se sabe a causa → `task-master-v2`.

## N e fluxo

`N ∈ {5..8}`. Default **6**. Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

## Waves obrigatórias

### W1 — Hunt (READ-ONLY, todos N)
Cada agente recebe escopo distinto (extensão MV3, edges auth, edges proxy, frontend admin, hooks/lib, design/css, migrations, scripts). Lê logs, network requests, código, console errors. Cada um escreve até 3 hipóteses em `bh-hypotheses.md` com formato:

```
## HYP-<X><n> | by <agent> | confidence: low|med|high
**Camada:** <onde>
**Mecanismo:** <1-3 linhas explicando como o bug acontece>
**Evidência:** <arquivo:linha | log | network>
**Fix proposto:** <1-2 linhas>
```

### W2 — Vote (READ-ONLY, todos N)
Cada agente lê `bh-hypotheses.md` inteiro e vota em até 3 hipóteses (não as próprias). Vota com:

```
>> VOTE FROM <X> → HYP-<Y><n> | weight: 1|2|3 | rationale: <1 linha>
```

Hipótese vencedora = soma de weights. Empate → Orchestrator decide pela `confidence` reportada.

### W3 — Fix (WRITE, designado + reviewers)
Orchestrator designa **1 agente** (o autor da hipótese vencedora) para escrever o fix. Os outros N-1 viram **reviewers read-only** que validam o patch via inbox `Audit-Finding`/`Challenge`. Designado tem 1 wave para fixar; reviewers respondem na próxima.

### W4 — Sign-off (opcional, se reviewers acharem problema)
Designado patcha conforme reviews. Fecha quando todos os reviewers respondem `ACK`.

## Arquivos de coordenação

Prefixo **`bh-`**: `bh-plan.md`, `bh-inbox-A..H.md`, `bh-hypotheses.md` (escrita compartilhada — única exceção, append-only com prefixo `## HYP-` por agente).

## Regras invioláveis

1. **W1 e W2 read-only absoluto.** Nenhum patch antes da W3.
2. **Voto em outras hipóteses, não nas próprias.**
3. **Designado único na W3.** Sem fix paralelo.
4. **Migrations:** se fix exige schema, designado **não** edita migrations — abre `Migration-Request` e Orchestrator redireciona para `migration-surgeon`.
5. **Teste do bug:** designado escreve teste que reproduz o bug ANTES do fix (red→green).

## Encerramento

`Bug Hunt Swarm · N=<n> · <m> hipóteses · vencedora HYP-<X><n> · fix por Agent <X> · teste red→green · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Pular fase de voto.
- ❌ Mais de 1 agente fixando.
- ❌ Fix sem teste reproduzindo o bug.
- ❌ Votar na própria hipótese.
- ❌ W1 com edits.