# HyperBuild PRO — Audit Plan (Fase 1)
**Status:** In Progress · **Wave:** 1 · **Na:** 7 · **Skill:** auditor-master

## Objetivo
Audit read-only completo da HyperBuild PRO antes da refatoração para v7.6.0. Identificar bugs P0/P1, duplicações, gaps de segurança, hotspots de perf, drift docs↔código. Entregar `hbp-audit-report.md` consolidado com Red PoCs para Fase 2 (Blue).

## Escopo (HB PRO apenas — Hyper RB OFF-LIMITS)
**Fonte de verdade extensão:** `public/ext_build_v62/**` (10.331 LOC, 22 arquivos). NÃO ler `extension/**` nem `public/ext_src/**` (legados).

## Partição disjunta (Na=7)
| Ag | Escopo |
|---|---|
| A | `public/ext_build_v62/{background.js, content.js, pageHook.js, hwFingerprint.js, upload-manager.js, security.js}` — runtime core |
| B | `public/ext_build_v62/{sidepanel.*, sidepanel-effects.js, sidepanel-templates.js, content-templates.js, floating.css, hyper-customize.*, manifest.json}` — UI layer |
| C | `supabase/functions/{vx,pc,cp,op,uf,dz,ai,heartbeat,gn,gp,gr,gu,gv,pp,get-*,reseller-*,admin-otp-*,verify-admin-key,bulk-license-ops,fraud-alerts}` + `_shared/` — edges HB PRO (NÃO burp) |
| D | `src/pages/AdminDashboard.tsx` + `src/hooks/use-admin-*` + `src/hooks/use-auth.tsx` + `src/lib/**` — admin web |
| E | `src/index.css`, `tailwind.config.ts`, `src/components/ui/**` afetados — design system |
| F | RLS, HMAC, kill-switch, rate-limit, bundle, render hotspots — segurança+perf cross-cutting |
| G (Synthesizer) | `mem://**`, `README.md`, `RESELLER_API.md`, `public/llms.txt`, `scripts/**` + consolida `hbp-audit-report.md` com Red PoCs |

## Regras
1. **READ-ONLY absoluto.** Zero edição de código de aplicação.
2. Apenas Agent G (Synthesizer) escreve em `hbp-audit-report.md` na wave final.
3. Cada agente vota até 5 bugs candidatos com `vote: <agent-id>`; ≥2 votos = P0.
4. PROIBIDO ler ou tocar Hyper RB (`public/burp_src/**`, `src/components/burp/**`, `supabase/functions/burp/**`).
5. Mensagens nos 6 inboxes dos OUTROS agentes; flip de status no próprio.

## Outputs esperados (Synthesizer)
- Bugs P0/P1/P2 por subsistema
- Duplicações entre arquivos
- Gaps de RLS/HMAC/secrets (com Red PoCs em `## Red Team PoCs`)
- Hotspots de bundle/render
- Drift docs ↔ código
- Itens de memória ultrapassados
