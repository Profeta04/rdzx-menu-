# Audit Report — HyperBuild PRO Refactor v7.5.0 → v7.6.0
_Fase 1 concluída · 7 agentes read-only paralelos · sintetizado pelo Orchestrator_

## Executive Summary

**Estado real do produto:** 10.331 LOC na extensão (`public/ext_build_v62/`), 27 edge functions (não 15 — memória ultrapassada), 10 abas no admin dashboard (não 11), 2.899 LOC monolíticas em `AdminDashboard.tsx`.

**Top-3 achados que mudam o plano da Fase 2:**
1. **5 vulnerabilidades CRÍTICAS de RLS** permitem comprometer todo o sistema de licenciamento via REST API pública (anon key) — supply-chain, free-licenses, denial-of-revenue.
2. **Secrets reais hardcoded** em arquivos servidos no bundle da extensão (GROQ key, HMAC secret, JWT supabase).
3. **OTP escalation controlado por localStorage** — bypass trivial via DevTools.

Esses achados devem virar **migration + patches focados ANTES** de qualquer refactor cosmético, porque uma refatoração grande aumenta risco de mascarar essas correções.

---

## Bugs P0 (consolidado — votação cruzada)

| ID | Severidade | Onde | Resumo | Votos |
|---|---|---|---|---|
| **P0-1** | CRÍTICO | `migrations/20260408162554` | `licenses` aceita `INSERT/UPDATE` por `anon` com `USING(true)` → free licenses via curl | F |
| **P0-2** | CRÍTICO | `migrations/20260408162554` | `extension_versions` aceita `INSERT` por `anon` → supply-chain attack | F |
| **P0-3** | CRÍTICO | `sessions` policy "Allow anon read" | Tabela de sessões pública (device_id, IP, metadata) | F |
| **P0-4** | CRÍTICO | `migrations/20260415073211` | `payments` policy `USING(true)` para `authenticated` → qualquer user aprova pagamentos | F |
| **P0-5** | CRÍTICO | `background.js:96` | `GROQ_API_KEY` real em plaintext no bundle | A |
| **P0-6** | CRÍTICO | `security.js:27` | `HB_HMAC_SECRET` em plaintext → atacante assina requests | A |
| **P0-7** | CRÍTICO | `sidepanel.js:1681` | `GROQ_KEY` hardcoded (segunda cópia além de background.js) | B |
| **P0-8** | CRÍTICO | `AdminDashboard.tsx:410-416` | OTP escalation só dispara se `localStorage.hyper_login_fails ≥ 2` → bypass via DevTools | D |
| **P0-9** | CRÍTICO | `AdminDashboard.tsx:192-266` | Cache `hyper_admin_auth` em localStorage puro → injeção via DevTools/XSS pula 2ª camada | D |
| **P0-10** | CRÍTICO | `/op`, `/uf`, `/pp` | Zero rate-limit, zero `isBanned`, zero kill-switch → API key burning, DoS, abuse | C, F |
| **P0-11** | CRÍTICO | `/reseller-login` | Sem rate-limit → brute-force offline de license_keys de revendedor | C |
| **P0-12** | CRÍTICO | `notifications` policies | `anon` pode INSERT/DELETE → spam + denial-of-revenue | F |
| **P0-13** | ALTO | `sidepanel.js:987,1021` | `setupSpFileAttachment()` chamado 2× → cada anexo sobe duas vezes | B |
| **P0-14** | ALTO | `sidepanel.js:597+677` | `validateLicense()` dispara 2× por clique (listener direto + global capture) | B |

## Bugs P1 (refactor depende deles)

| ID | Onde | Resumo |
|---|---|---|
| P1-1 | `content.js:1197` | Boot heartbeat usa `fetch()` direto (sem proxy, sem HMAC) e nunca chama `startHeartbeat()` em retorno positivo → keep-alive morre em reload |
| P1-2 | `hwFingerprint.js:228` | Race em `getHardwareFingerprint`: chamadas paralelas geram dois hashes diferentes |
| P1-3 | `/pp:console.log` | Log de dados de pagamento (CPF/PIX/nome/email) — violação LGPD |
| P1-4 | `op`/`cp`/`uf`/`pp`/`gr`/`gu` | Bypass de hardware-lock quando `license.device_id === null` |
| P1-5 | `/heartbeat` | Sem auth, sem rate-limit → flood de tabela + URL/metadata arbitrários |
| P1-6 | `/ai` | Rate-limit não-atômico (SELECT count → INSERT em 2 round-trips) |
| P1-7 | `manifest.json` | `*.supabase.co/*` injeta em qualquer Supabase no mundo (cross-tenant) |
| P1-8 | `pageHook.js:124` | `postMessage(token, "*")` → token Lovable broadcast a qualquer script da aba |
| P1-9 | `dz/index.ts` | Duplica `buildRotatedHeaders`/`fetchWithRetry`/`mapLovableError` que já existem em `_shared/lovable.ts` |
| P1-10 | `gn` ≡ `get-notifications`, `gv` ≡ `get-versions` | Edges duplicadas idênticas |
| P1-11 | `use-auth.tsx:36-57` | Check de admin via query client-side (não JWT claim) — dead code paralelo ao AdminDashboard |
| P1-12 | `SUPABASE_ANON_KEY` divergente | `content.js:268` (`sb_publishable_...`) vs `upload-manager.js:12` (JWT completo) — valores DIFERENTES |
| P1-13 | `AdminDashboard.tsx` | 2.899 LOC, 66 useState, 10 hooks externos + 10 `supabase.from()` diretos, eager-imported em `App.tsx` |
| P1-14 | Bundle | `javascript-obfuscator` (~4-6 MB) + `jszip` + `file-saver` no chunk inicial |
| P1-15 | `sidepanel.js:808` | `showMainUI()` adiciona listeners `storage.onChanged`/`runtime.onMessage` sem remover → empilha |
| P1-16 | Token theme | `--primary` em `:root` = navy (shadcn default) vs `.dark` = neon purple → swap silencioso se forcedTheme falhar |
| P1-17 | `_shared/security.ts` (drift) | `sha256Hex`/`getClientIp`/`jsonResponse` redefinidos inline em `ai`, `admin-otp-*` |

## Bugs P2 / cosmético

P2-1 anon key injetada em plaintext no ZIP do build · P2-2 obfuscator opts `any` · P2-3 keyframes duplicados (CSS + Tailwind) · P2-4 `Badge`/`Button`/`Input` sem variants `success`/`warning`/`glass` · P2-5 `Card` base usa `backdrop-blur-md` (12px) vs `.glass-card` (24px) · P2-6 SVG icons duplicados entre `sidepanel-templates` e `content-templates` · P2-7 banner fake `AKIA*` em `src/App.tsx` (não-executável mas polui SAST).

## Duplicações estruturais

- Chrome storage shim copiado 3× (background, content, hwFingerprint)
- Lista de keys de logout `ql_*` repetida 4× em content.js
- Padrão `get(["ql_license_key","ql_session_id"]) → header x-license-key` repetido 5×
- `corsHeaders` redefinido localmente em 12 edges
- SVG_ICONS (18+ ícones) duplicados sidepanel↔content templates
- Hardware-lock check copy-paste em 7 edges
- `gn`/`get-notifications` e `gv`/`get-versions` são bytes idênticos

## Inconsistências cross-cutting

- **Response shape**: 4 convenções coexistem entre edges (`valid` / `success` / `ok` / `error` no topo). Padronizar.
- **HMAC coverage**: kill-switch protege só 4 de 19 edges sensíveis.
- **Storage keys**: prefix `ql_` é regra de memória mas há `hyper_*` (admin) e `hb_*` (security) violando.

## Drift de docs / memória

- `README.md` é placeholder Lovable padrão (zero info)
- `public/llms.txt` lista só "Home" — não documenta as 10 abas
- `.lovable/knowledge/ai-rules.md:122-124` **contradiz a memória**: aponta `extension/` → `public/ext_src/` como fonte de verdade. Toda IA lendo isso edita o diretório errado.
- Memory `# edges = 15`: real é **27**
- Memory `11 abas no admin`: real é **10** (licenses, sessions, resellers, notifications, versions, extension, payments, recharge, burp, monitoring)
- `RESELLER_API.md`: gap menor (`/health` e fallback `body.action` não documentados)

## Red Team PoCs (para Blue patchar na Fase 2)

PoCs concretos disponíveis nos relatórios individuais:
1. **Free permanent license** via `POST /rest/v1/licenses` com anon key
2. **Fake extension version** via `POST /rest/v1/extension_versions` → auto-update malicioso
3. **API key burning** em `/op`: 1000 requests paralelos → quota Groq drenada
4. **Brute-force revendedor** via `/reseller-login` (sem rate-limit)
5. **Race takeover** no `/vx` (UPDATE não-atômico no device_id)
6. **Heartbeat flood + SSRF probe** via `/heartbeat` aceitando URL/metadata arbitrários
7. **DevTools bypass** do OTP admin: `localStorage.removeItem("hyper_login_fails_<email>")`
8. **DevTools bypass** da 2ª camada: `localStorage.setItem("hyper_admin_auth", JSON.stringify({verified:true, verifiedAt:Date.now()}))`
9. **Payment escalation**: `PATCH /rest/v1/payments` com JWT de revendedor → status=approved
10. **Notification denial-of-revenue**: `DELETE /rest/v1/notifications` (anon)

## Recomendações priorizadas

**Imediato (não pode ir junto com refactor):**
1. Migration revogando policies anon em `licenses`, `extension_versions`, `sessions`, `notifications`, `payments`. Substituir por `service_role`-only ou `is_admin()`.
2. Rotacionar `GROQ_API_KEY` e `HB_HMAC_SECRET` (já comprometidos no bundle público). Mover Groq para proxy via `/ai`. Mover HMAC secret pra build-time env e abandonar HMAC client-side em favor de JWT de sessão.
3. Forçar OTP admin server-side em `verify-admin-key` (não confiar em `localStorage.hyper_login_fails`). Mover cache de auth pra cookie HttpOnly.
4. Plugar `isBanned` + `isRateLimitedByIp` em `/op`, `/uf`, `/pp`, `/reseller-login`, `/heartbeat`.
5. Remover `console.log("Receiving payment data", body)` de `/pp`.

**Fase 2 (refactor estrutural — pode ir em paralelo via 8 agentes):**
6. Extensão: split de `content.js` (5061 LOC) e `sidepanel.js` (2040 LOC) em `services/` + `ui/` + `utils/` — HTML/CSS byte-idênticos.
7. Admin web: split de `AdminDashboard.tsx` (2899 LOC) em hooks + tabs isoladas; `React.lazy` no `App.tsx`; mover `javascript-obfuscator` pra edge function ou worker.
8. Edges: consolidar duplicações em `_shared`, deletar `gn`/`gv` duplicadas, padronizar response shape, padronizar hardware-lock helper.
9. Design tokens: adicionar `--primary-glow` em `:root`, criar variants `success`/`warning`/`glass` em Badge/Button/Input/Card, eliminar `bg-white/10`/`bg-black/60` hardcoded.
10. Manifest: restringir `host_permissions` a apenas `cvbgrjauqjawrsyknhyj.supabase.co`, adicionar CSP explícita.

## Apêndice — contagem por agente

| Agente | Bugs reportados | Hotspots | Red PoCs |
|---|---|---|---|
| A — runtime core | 8 (2 P0, 4 P1, 2 P2) | 6 funções | — |
| B — UI layer | 8 (3 P0, 4 P1, 1 P2) | sidepanel.js 8-way split | — |
| C — edges | 10 (3 P0, 5 P1, 2 P2) | 9 duplicações `_shared` | 5 |
| D — admin web | 8 (2 P0, 4 P1, 2 P2) | 2899→120 LOC viable | 2 |
| E — design | 19 issues (3 high, 4 med, 12 dry) | 4 variants faltando | — |
| F — sec+perf | 6 vulns (5 P0, 1 P2) | top-5 perf | 5 |
| G — docs | 4 drifts (2 high crit) | 6 docs novos | — |
