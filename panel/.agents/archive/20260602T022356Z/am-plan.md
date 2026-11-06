# Auditor Master — Refresh Global da Memória do Projeto

## Objetivo
Auditar **TODO o projeto** (extensão Hyper RB + Burp Lovable + Web Admin + Edge Functions + Migrations + Design System + Docs) para detectar drift entre o código real e a memória atual (`mem://**`), e produzir um relatório consolidado que o Orchestrator usará para reescrever a memória do projeto.

## N escolhido: 10
Justificativa: monorepo com 10+ subsistemas claramente separáveis (extensão MV3, builds publicados, runtime Burp, UI React, hooks/lib/pages, edges auth/admin, edges proxy/AI, migrations/RLS, design system, docs+memory). Cabe no teto da skill.

`Chatty: on` (audit complexo).

## Contrato de escopo (disjunto, read-only)

| Agent | Escopo |
|-------|--------|
| **A** | `extension/**` (MV3 core: manifest, background, content, sidepanel, hwFingerprint, security, upload-manager, pageHook, hyper-customize, sidepanel-effects/templates, floating) |
| **B** | `public/ext_src/**` + `public/ext_build_v*/**` + verificar drift entre `extension/` e os builds publicados |
| **C** | `public/burp_src/**` (manifest, background, content, sidepanel, pageHook, ai_client, chains, floating + `scripts/_registry.js` + todos `scripts/*.js`) |
| **D** | `src/components/**` (todos: burp/, shared/, ui/, *Tab.tsx, NavLink) |
| **E** | `src/hooks/**` + `src/lib/**` + `src/pages/**` + `src/App.tsx` + `src/main.tsx` |
| **F** | Edges de auth/admin/reseller: `supabase/functions/admin-otp-send`, `admin-otp-verify`, `verify-admin-key`, `reseller-api`, `reseller-login`, `get-user-role`, `bulk-license-ops`, `fraud-alerts`, `get-license-user`, `get-notifications`, `get-versions`, `heartbeat` + `_shared/security.ts` |
| **G** | Edges restantes: `supabase/functions/ai`, `burp`, `cp`, `dz`, `gn`, `gp`, `gr`, `gu`, `gv`, `op`, `pc`, `pp`, `uf`, `vx`, `dev-proxy-test` + `_shared/lovable.ts`, `_shared/proxy.ts` |
| **H** | `supabase/migrations/**` (schema completo, RLS, triggers, GRANTs) + `supabase/config.toml` + tabelas reais via `psql` se disponível |
| **I** | `src/index.css` + `tailwind.config.ts` + `components.json` + `public/*.svg` + `public/llms.txt` + `index.html` + design system / glassmorphism / tokens neon purple |
| **J (Synthesizer)** | `README.md` + `RESELLER_API.md` + `.lovable/**` + `scripts/**` (top-level, fora de burp_src) + `package.json` + `playwright*` + memória atual (`mem://**`) + cross-cutting risk view. **Consolida `am-report.md` na wave final.** |

## Outputs esperados
1. `.agents/shared/am-report.md` (Synthesizer, wave final).
2. Atualização completa de `mem://index.md` e arquivos referenciados (Orchestrator, pós-audit).
3. Lista de itens removidos/atualizados/criados na memória.
4. Cópia do report em `/mnt/documents/project-memory-audit.md` para o usuário.

## Memória atual a confrontar (drift target)
- `mem://index.md` (Core + 9 referências)
- `mem://project/overview`
- `mem://architecture/backend`
- `mem://features/admin-dashboard`
- `mem://features/extension-ui`
- `mem://style/visual-identity`
- `mem://auth/admin-otp-telegram`
- `mem://extension/hyper-rb-architecture`
- `mem://workflow/task-master-v2`
- `mem://tech/promptx-secrets`

## Regras
- READ-ONLY total para os 10 agentes.
- Cada agente posta `Outdated-Memory` no inbox de J para cada item que estiver errado/ultrapassado na memória atual (com evidência: arquivo:linha).
- Cap de findings por wave (≤6 no Findings Log; sem cap em `Audit-Finding` formal high-severity).
- 2 waves planejadas: W1 = audit + cross-refs; W2 = drenar + Synthesizer escreve `am-report.md`.

## Status
- Wave: 0
- Status: In Progress

---

## Wave 1 — Review (Orchestrator)

10/10 agentes reportaram. 487 linhas totais nos inboxes. Findings consolidados:

| agente | findings | msgs | OPENs | destaque |
|--------|----------|------|-------|----------|
| A | 2H/1M/3L | 5 | 0 | Nome real = **HyperBuild** (não "Hyper RB"); manifest v7.1.2; sem popup; sem fast_mode manifest |
| B | 0H/2M/2L | 3 | 2 | ext_src v6.2 ≠ extension/ v7.1.2 (SYNC RULE violada); ext_src tem burp_* |
| C | 0H/0M/0L | 3 | 0 | 23 scripts no _registry; edges Burp=/ai+/burp+/heartbeat+/vx; sanitização OK |
| D | 0H/2M/3L | 3 | 0 | RechargeTokens é stub; ProtectedRoute=user_roles (sem master key/OTP no guard) |
| E | 0H/?/? | 5 (incl 4 Outdated-Memory) | 0 | 2 clientes Supabase divergentes; pricing só em DB |
| F | 0H/2M/3L | 5 | 1 | OTP real: chat_id por-usuário em tabela admin_telegram (NÃO env var global); rate IP=8/15min |
| G | 3H/?/? | 5 | 0 | 15 edges catalogadas; /dz DRY; /pp sem HMAC; /gn/gp/gv públicos |
| H | 0H/0M/3 drifts | 3 | 0 | 33 tabelas reais; `licenses` (não license_keys); `admin_otp_codes` (não telegram_otp); `is_admin()` (não has_role); 76 RLS policies; 47 triggers |
| I | 0H/?/6 gaps | 1 | 0 | neon #bf00ff = 286° HSL ✓; --primary-glow ausente :root; body bg externa pxfuel.com; theme dark-only |
| J | 3H/1M/2L | 2 | 0 | package.json name=vite_react_shadcn_ts; README vazio; .lovable/plan stale |

**Decisão:** prosseguir para **Wave 2 (final)**. Synthesizer (J) consolida `am-report.md`. Outros 9 agentes só drenam OPENs cross-ref (carga leve). Memória reescrita inteira pelo Orchestrator após report.

**Wave: 1 → 2**
