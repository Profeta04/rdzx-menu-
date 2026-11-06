---
name: red-team-vs-blue-team
description: "Dois agentes em oposição na mesma wave: Red caça bypass / escreve PoC de exploit em arquivo de teste, Blue lê o PoC via inbox e patcha sem expandir o diff. Loop até Red ficar sem ideias ou cap de 4 waves. Use para hardening de auth, validação de licença, HMAC, anti-replay, edges sensíveis, RLS — qualquer coisa onde 'tem certeza que não dá pra burlar?' é a pergunta principal."
---

<!-- version: 1.0 — padrão adversarial 2 agentes obrigatório -->

# Red Team vs Blue Team (Adversarial Hardening)

Padrão **adversarial** com EXATAMENTE 2 agentes em oposição. Difere de `security-hardener` (cooperativo): aqui Red **ataca**, Blue **defende**, e a wave só fecha quando Red não acha mais bypass.

## Quando usar

- Hardening de fluxo de auth / login admin / OTP.
- Validação de licença, device binding, sessão.
- HMAC + anti-replay em edges.
- RLS de tabela sensível (`licenses`, `user_roles`, `admin_otp_codes`).
- Edge function que recebe input do mundo (proxies, reseller API).
- Bypass de feature gating ou paywall.

## Quando NÃO usar

- Audit amplo cooperativo → `auditor-master`.
- Bug funcional → `bug-hunt-swarm`.
- Feature nova ainda em construção → finalizar antes.

## N e papéis (FIXO N=2)

- **Agent R (Red Team)** — atacante. Lê código + tenta achar bypass. Para cada hipótese de exploit, escreve **PoC executável** em arquivo de teste novo (`src/test/redteam-<timestamp>-<n>.test.ts` ou `supabase/functions/<fn>/redteam.test.ts`) + anexa `Audit-Finding` no inbox do Blue. PoC deve ser teste **que passa demonstrando o bypass** (red, no sentido "ataque sucedeu").
- **Agent B (Blue Team)** — defensor. Lê PoC do Red, patcha código de produção até teste do Red falhar (i.e., bypass não funciona mais). Cada patch ≤30 linhas. NÃO pode editar o arquivo de PoC do Red — só código de produção.

Ambos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.

## Waves

- **W1:** SPAWN R + B em paralelo. R escreve até 3 PoCs. B fixa o que conseguir nessa janela.
- **W2..W4:** R relê código pós-fix, tenta novo bypass; B patcha. Loop até R reportar `no-more-bypasses-found` OU cap de 4 waves.
- **W final:** Orchestrator roda os testes (`bunx vitest run` ou equivalente) e confirma: todos PoCs do Red devem **falhar** (= bypass bloqueado).

## Arquivos de coordenação

Prefixo **`rb-`**: `rb-plan.md`, `rb-inbox-R.md`, `rb-inbox-B.md`, `rb-poc-log.md` (R lista PoCs criados; B marca quais já bloqueou).

## Regras invioláveis

1. **Blue NUNCA edita PoC do Red.** Só código de produção.
2. **Red NUNCA edita código de produção.** Só arquivos de PoC/teste.
3. **Patch ≤30 linhas** por iteração do Blue.
4. **Sem mock-bypass:** PoC do Red precisa hitar código real, não simular.
5. **Cap 4 waves.** Se chegar a 4 e Red ainda achar bypass, Orchestrator escala para `security-hardener` ou pede review humano.
6. **Fechamento:** todos PoCs do Red devem rodar e **falhar** (asserções invertidas: agora esperam acesso negado).
7. **Sem desabilitar teste:** Blue não pode `skip`/comentar PoC.
8. **Lock migrations:** se Blue precisa de migration (ex: nova policy), abre `Migration-Request` para Orchestrator escalar.

## Encerramento

`Red vs Blue · <w> waves · <n> PoCs · <n> bloqueados · 0 bypass ativos · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Blue editar PoC.
- ❌ Red editar prod.
- ❌ Mockar bypass.
- ❌ Skipar teste do Red.
- ❌ Patch gigante "preventivo" do Blue.
- ❌ Ultrapassar 4 waves sem escalar.