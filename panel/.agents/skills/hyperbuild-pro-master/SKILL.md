---
name: hyperbuild-pro-master
description: "Orquestração full-stack focada no produto HyperBuild PRO (extensão MV3 + edges Supabase + admin web). Combina audit read-only, refactor multi-agente, hunt de bugs com voting, migration lock, perf, red/blue team de segurança, dependency upgrade, test coverage e docs sync — tudo num único fluxo waved. Use quando o pedido toca múltiplas camadas da HB PRO simultaneamente (ex: melhorar HB PRO, release candidate, auditar e corrigir e atualizar HB PRO, wave de manutenção, saneamento geral da extensão principal)."
---

<!-- version: 1.0 — fusão de auditor-master + task-master-v2 + skills aprovadas 2,4,5,6,7,8,9,10,12 -->

# HyperBuild PRO Master (Full-Stack Maintenance Orchestrator)

Mega-skill dedicada ao produto **HyperBuild PRO** (NÃO Hyper RB). Combina os 3 modos clássicos da casa:

1. **Auditor-master** → wave de leitura paralela (read-only).
2. **Task-master-v2** → wave(s) de edição paralela com escopo disjunto.
3. **Sub-skills embutidas** (heranças aprovadas):
   - `migration-surgeon` (lock de migrations no Agent N + ordem schema→code→hook→UI).
   - `feature-factory` (waves W1 schema, W2 edge+hook, W3 UI+test) — quando o objetivo inclui feature nova.
   - `bug-hunt-swarm` (W1 hunt read-only com voting → W2 fix designado).
   - `perf-strike` (alvo LCP/TTFB/bundle/edge p95).
   - `design-system-refactor` (tokens HSL, glass, neon `#bf00ff`).
   - `docs-sync-master` (README, llms.txt, RESELLER_API.md, mem://).
   - `red-team-vs-blue-team` (Red propõe PoC em inbox, Blue patcha — sem editar fora do diff).
   - `dependency-upgrader` (isolado, só Agent N toca lockfile).
   - `test-coverage-blitz` (Vitest + Playwright, por camada).

**ESCOPO FECHADO — apenas HyperBuild PRO:**
- `public/ext_build_v62/**` — **ÚNICA fonte de verdade** da extensão HB PRO. É o diretório que o admin dashboard (aba Build & Deploy) lê via `/ext_build_v62/manifest.json` + fetch de cada asset para gerar o ZIP "BAIXAR BUILD" / "BAIXAR OFUSCADO".
- `extension/**` e `public/ext_src/**` — **pastas legadas/desatualizadas**. NÃO editar, NÃO sincronizar, NÃO usar como referência. Se aparecer divergência, a versão correta é sempre a de `public/ext_build_v62/`.
- `supabase/functions/**` exceto `burp/**` e `_shared/lovable.ts` quando exclusivo do Burp (mas inclui `_shared/security.ts`, `_shared/proxy.ts`)
- `supabase/migrations/**`, `supabase/config.toml`
- `src/**` apenas o que serve HB PRO (admin dashboard, hooks de licença, build tab) — EXCLUI `src/components/burp/**` e `src/hooks/use-burp.ts`
- `mem://` + docs raiz (README, RESELLER_API, llms.txt)

Qualquer arquivo do **Hyper RB** (`public/burp_src/**`, `src/components/burp/**`, `supabase/functions/burp/**`) está **fora de escopo** e NÃO pode ser editado. Findings cruzados viram apenas nota no report final.

## Quando usar

- "Wave de manutenção da HB PRO"
- "Release candidate v7.x"
- "Saneamento full-stack da extensão principal"
- "Auditar + corrigir + atualizar HB PRO ponta-a-ponta"
- "Bump de versão / hotfix na extensão (sempre em `public/ext_build_v62/`)"
- "Hardening + perf + docs da HB PRO numa única passada"

## Quando NÃO usar

- Pedido toca Hyper RB → use `task-master-v2` ou `auditor-master`.
- Tarefa pequena 1–2 arquivos → edição direta.
- Só audit sem fix → `auditor-master`.
- Só refactor sem audit prévio → `task-master-v2`.
- Feature nova isolada sem manutenção → `task-master-v2` com tabela própria.

## Estrutura de waves (3 fases obrigatórias)

### FASE 1 — Audit Wave (read-only, herda `auditor-master`)
- N=`Na` ∈ {5..10}. Default **7**.
- Todos `model: "capable"`, **read-only absoluto**.
- Prefixo de arquivos: **`hbp-audit-`**.
- Synthesizer (Agent Na) consolida `.agents/shared/hbp-audit-report.md` com:
  - findings por subsistema
  - **bugs com voting** (cada agente vota; bug com ≥2 votos vira P0)
  - confirmação de que `public/ext_build_v62/` é a versão servida (cross-check com `src/pages/AdminDashboard.tsx` linhas ~2090–2240) — flag se algum agente tentou ler de `extension/` ou `public/ext_src/`
  - secrets/HMAC/RLS gaps (alimenta Fase 2 red-team)
  - perf hotspots (alimenta perf-strike)
  - deps desatualizadas com CVE (alimenta dependency-upgrader)
  - lacunas de teste por camada
  - drift de docs vs código

### FASE 2 — Fix & Improve Wave (write, herda `task-master-v2`)
- N=`Nb` ∈ {5..10}. Default **8**.
- Todos `model: "capable"` + diretiva `USE OBRIGATORIAMENTE O MODELO DE IA CLAUDE OPUS 4.7 OU GPT 5.5 E DIGA NO RESULT QUAL IA VOCÊ ESTÁ USANDO`.
- Prefixo: **`hbp-fix-`**.
- **Particionamento canônico (Nb=8):**
  - **A** — `public/ext_build_v62/**` runtime core (manifest, background.js, content.js, pageHook.js, hwFingerprint.js, upload-manager.js, security.js).
  - **B** — `public/ext_build_v62/**` UI layer (sidepanel.html/css/js, sidepanel-effects.js, sidepanel-templates.js, content-templates.js, floating.css, hyper-customize.*). **Sem espelhamento para outras pastas — `extension/` e `public/ext_src/` ficam intocados.**
  - **C** — `supabase/functions/**` HB PRO (vx, pc, cp, op, uf, dz, ai, heartbeat, gn/gp/gr/gu/gv, pp, get-*, reseller-*, admin-otp-*, verify-admin-key, bulk-license-ops, fraud-alerts).
  - **D** — `src/**` admin web (AdminDashboard, hooks, lib, pages, use-auth, use-admin-data) — sem tocar burp/**.
  - **E** — Design system + UI tokens (`src/index.css`, `tailwind.config.ts`, glass, neon HSL) + componentes shadcn afetados. **Red/Blue team de segurança**: este agente também roda Blue (patcha PoCs de Red sem expandir diff). Red é responsabilidade do Synthesizer da Fase 1 (PoCs já no audit-report).
  - **F** — Perf-strike: bundle splitting, React render, edges p95, assets, manifest CSP.
  - **G** — Test coverage + docs sync: `src/test/**`, `playwright*`, README, RESELLER_API.md, public/llms.txt, mem:// (proposta, aplicação só pelo Orchestrator).
  - **H (Agent N — LOCK)** — `supabase/migrations/**` + `supabase/config.toml` + `package.json`/lockfile (dependency-upgrader). **Único** com permissão nestes paths. Aplica ordem migration-surgeon: migration → types regen → consumers → rollback note.
- Reduzir N: colapsar G→F→E quando escopo menor; nunca colapsar H.
- Sempre 2 waves mínimas (W1 edita, W2 dreca inboxes + verifica cross-edits + valida sync extension/spelhos).

### FASE 3 — Synthesis & Apply (só Orchestrator)
- Sem spawn. Orchestrator:
  1. Lê `hbp-fix-inbox-*.md` e confirma que nenhum agente editou fora de `public/ext_build_v62/` no lado extensão. Roda `rg -n "ext_src|/extension/" .agents/shared/hbp-fix-*.md` — qualquer hit é violação.
  2. Aplica mudanças em `mem://**` propostas pelo Agent G.
  3. Bump de version: APENAS `public/ext_build_v62/manifest.json` (semver patch se só fix, minor se feature). NÃO tocar em `extension/manifest.json` nem `public/ext_src/manifest.json` (legados).
  4. Gera `hbp-release-notes.md` em `/mnt/documents/` listando: bugs P0/P1 fechados, features novas, migrations aplicadas, deps atualizadas, gaps remanescentes.
  5. Archive: `mkdir -p .agents/archive/<ts>/ && cp .agents/shared/hbp-*.md .agents/archive/<ts>/ && rm .agents/shared/hbp-*.md`.

## Arquivos de coordenação

Total: `2 + Na + Nb` durante o ciclo.

- Fase 1: `hbp-audit-plan.md`, `hbp-audit-inbox-A..<Na>.md`, `hbp-audit-report.md`.
- Fase 2: `hbp-fix-plan.md`, `hbp-fix-inbox-A..<Nb>.md`.
- Fase 3: `hbp-release-notes.md` em `/mnt/documents/` (artefato persistente).

Prefixo `hbp-` não colide com `pae-`/`tm2-`/`am-`.

## Regras invioláveis

1. **Escopo HB PRO apenas.** Tocar arquivo Hyper RB = falha imediata, registro em `Audit-Finding` para report.
2. **Fonte única:** TODA edição da extensão HB PRO acontece em `public/ext_build_v62/**`. NUNCA em `extension/**` ou `public/ext_src/**` — essas pastas são legadas e ignoradas pelo admin. Qualquer agente que editar fora de `public/ext_build_v62/` no lado extensão é falha imediata.
3. **Migration lock:** só Agent H (N) escreve em `supabase/migrations/**`, `supabase/config.toml`, `package.json`, lockfile. Todos os outros mandam `Migration-Request` / `Dep-Request`.
4. **Diretiva de modelo** no system_prompt de TODO subagente.
5. **Voting de bugs (Fase 1):** cada agente lista até 5 bugs candidatos no `## Findings Log` com `vote: <other-agent-id>` indicando concordância. Synthesizer agrega; ≥2 votos = P0.
6. **Red/Blue:** Red é o Synthesizer da Fase 1 (escreve PoCs em `hbp-audit-report.md` seção `## Red Team PoCs`). Blue é Agent E da Fase 2 (lê PoCs e patcha; cada patch ≤30 linhas; não pode tocar arquivos fora do PoC).
7. **Perf-strike (Agent F):** registrar antes/depois em `hbp-fix-inbox-G.md` (KB de bundle, p95 de edge se logs disponíveis, número de renders evitados).
8. **Docs/mem:** Agent G PROPÕE; aplicação de `mem://` é exclusiva do Orchestrator na Fase 3.
9. **Dependency-upgrader (Agent H):** só patch/minor por wave; nunca major sem flag explícita do usuário; rodar audit interno após bump (Orchestrator anota CVE residual no report).
10. **Test-coverage (parte do Agent G):** garantir teste para cada bug P0 fechado na Fase 2. Sem teste → bug não conta como fechado no release-notes.
11. **Archive antes de `rm`** — sempre.

## Procedimento do Orchestrator (resumo executivo)

1. Validar pedido = HB PRO (não Hyper RB). Caso contrário, redirecionar para skill apropriada.
2. Escolher `Na` e `Nb` (defaults 7/8). Registrar em ambos os plans.
3. **Fase 1:** spawn `Na` agentes read-only paralelos (1 mensagem). Aguardar. Drenar OPENs do Orchestrator. Wave 2 só se findings precisarem cross-ref. Synthesizer entrega report + Red PoCs.
4. **Fase 2:** ler report. Atualizar `hbp-fix-plan.md` com partição canônica + lista de bugs P0/P1 + PoCs Red por agente. Spawn `Nb` paralelos (1 mensagem, `capable`, diretiva de modelo). Mínimo 2 waves; máx 5.
5. Em cada review, rodar `diff -rq extension/ public/ext_src/` e exigir 0 differences antes de fechar.
6. **Fase 3:** synthesis + version bump + release notes + archive + rm.

## Protocolo de cada sub-agente (system_prompt)

Idêntico em estrutura ao do `task-master-v2`/`auditor-master`, com a diretiva de modelo no topo. Adicionar especificações:

- **Read-only agents (Fase 1):** "PROIBIDO editar qualquer código de aplicação. Só escreva em inboxes de outros agentes e (Synthesizer apenas) em `hbp-audit-report.md`. **PROIBIDO ABSOLUTAMENTE** tocar arquivos do Hyper RB (`public/burp_src/**`, `src/components/burp/**`, `supabase/functions/burp/**`). Vote em até 5 bugs candidatos no Findings Log com `vote: <agent-id>` para alimentar priorização."
- **Write agents (Fase 2):** "Escopo HB PRO conforme plan. Tocou Hyper RB = falha. Mudança em migrations/config.toml/package.json/lockfile → `Migration-Request` ou `Dep-Request` para Agent H. Mudança em arquivo de OUTRO agente → `Edit-Request`. Sync rule: A edita `extension/**`, B espelha. Blue team (Agent E) patcha PoCs de Red conforme `hbp-audit-report.md`. Reporte sempre `**Modelo usado:**` no topo."

## Encerramento

Resposta final ao usuário: 2–3 frases. Mencionar `Na`/`Nb`, número de bugs P0 fechados, version bump, link do `hbp-release-notes.md`, archive timestamp.

Exemplo:
> `HyperBuild PRO Master · Na=7 audit · Nb=8 fix · 12 bugs P0 fechados · v7.1.2 → v7.2.0 · release notes em hbp-release-notes.md · archive em .agents/archive/<ts>/`

## Anti-padrões

- ❌ Tocar Hyper RB.
- ❌ Editar `extension/**` ou `public/ext_src/**` (pastas legadas — fonte é `public/ext_build_v62/`).
- ❌ Pular Fase 1 (audit) e ir direto pra fix.
- ❌ Mais de 1 agente escrevendo em migrations/lockfile.
- ❌ Bump de version em qualquer manifest que não seja `public/ext_build_v62/manifest.json`.
- ❌ Fechar bug P0 sem teste correspondente.
- ❌ Aplicar `mem://` em qualquer fase que não a 3.
- ❌ Major version bump em deps sem flag explícita.
- ❌ Spawn serial.
- ❌ Esquecer archive antes de `rm`.

## Garantias

- ✅ Cobertura ponta-a-ponta: audit → fix → docs → release notes numa invocação.
- ✅ Drift extension vs espelhos eliminado por contrato (Agent B + validação Orchestrator).
- ✅ Migrations e deps centralizadas em Agent H = zero race.
- ✅ Red/Blue dentro do mesmo ciclo fecha vulns sem nova invocação.
- ✅ Bugs P0 só fecham com teste.
- ✅ Compatível com `task-master-v2`, `auditor-master`, `task-master` (prefixos distintos).
- ✅ Archive forense sempre.