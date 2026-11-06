---
name: docs-sync-master
description: "Refresh coordenado de documentação após release (README, RESELLER_API.md, public/llms.txt, changelog, mem://) lendo direto o código, não outros docs, para evitar eco. Use depois de releases grandes ou quando o usuário pede 'atualizar docs', 'refresh memory', 'sincronizar README com o código', 'documentar API atual'."
---

<!-- version: 1.0 — leitura ampla + escrita seletiva com anti-eco -->

# Docs Sync Master (Post-Release Doc Refresh)

Skill para refresh de documentação após features/refactors grandes. Anti-padrão central: **anti-eco** — cada agente lê o código real, nunca outro doc, para evitar propagação de informação desatualizada.

## Quando usar

- Depois de release grande (3+ features novas).
- "Refresh memory." / "Atualizar README." / "Documentar API atual."
- Após `feature-factory` ou `migration-surgeon`.
- Quando memória `mem://` está visivelmente drifted.

## Quando NÃO usar

- Pequeno typo em doc → edição direta.
- Doc inicial em projeto novo → escrita única, sem swarm.
- "Como fazer X?" → resposta direta, não doc.

## N e papéis

`N ∈ {3..5}`. Default **5**. Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

- **Agent A (README)** — `README.md` raiz. Lê `package.json`, `src/App.tsx`, scripts, estrutura de pastas.
- **Agent B (Reseller API)** — `RESELLER_API.md`. Lê `supabase/functions/reseller-*` direto, não a doc anterior.
- **Agent C (LLMS)** — `public/llms.txt`. Lê `src/pages/**` e edges principais.
- **Agent D (Memory)** — propõe updates em `mem://**` lendo `src/`, `supabase/`, `public/`. **PROPÕE em `dsm-mem-proposal.md`** — aplicação só pelo Orchestrator na wave final.
- **Agent E (Synthesizer & Changelog)** — escreve `CHANGELOG.md` (ou `dsm-release-notes.md` em `/mnt/documents/`) lendo git diffs conceituais e relatórios dos outros. Cross-checa divergências entre A/B/C/D.

## Waves

- **W1 (Read & Draft):** SPAWN paralelo de A, B, C, D, E. Cada um lê código + escreve sua doc.
- **W2 (Cross-check):** SPAWN paralelo de mesmos N. Cada um lê doc de outro agente e abre `Audit-Finding` se achar divergência com código.
- **W3 (Sign-off):** Orchestrator aplica `mem://` proposals de Agent D após validar, registra final.

## Arquivos de coordenação

Prefixo **`dsm-`**: `dsm-plan.md`, `dsm-inbox-A..E.md`, `dsm-mem-proposal.md` (D escreve, Orchestrator aplica).

## Regras invioláveis

1. **Anti-eco:** cada agente lê CÓDIGO, não outros docs como fonte primária.
2. **Memory:** D apenas PROPÕE; aplicação em `mem://` exclusiva do Orchestrator.
3. **Sem inventar:** se algo não está claro no código, marca como `TODO: confirm` em vez de chutar.
4. **Versões reais:** contagens (tabelas, edges, scripts) batem com `code--exec` real (ex: `ls supabase/functions/ | wc -l`).
5. **Mascarar Supabase:** nomes-usuário usam "Lovable Cloud" / "backend functions" / "auth"; nomes-código mantêm `supabase`, `edge function`, etc.

## Encerramento

`Docs Sync Master · N=<n> · README+RESELLER+LLMS+mem atualizados · X divergências corrigidas · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Agente lendo outra doc como fonte primária.
- ❌ Agente D aplicando `mem://` direto.
- ❌ Chutar contagem/versão sem `ls`/`wc -l`.
- ❌ Mencionar "Supabase dashboard" para usuário.
- ❌ Pular wave de cross-check.