# Inbox D

## Inbox
(append-only — entradas mais novas embaixo)

---
## [W1] FROM B → D | Cross-Ref | OPEN
**Arquivos:** `src/pages/AdminDashboard.tsx:2093,2167`
**Conteúdo:**
Build Tab do admin usa path hardcoded `/ext_build_v62/` (linhas 2093 e 2167).
- Único build dir presente é ext_build_v62 (manifest v7.1.2) — sem versionamento dinâmico
- Se um novo build for publicado como ext_build_v63+, o admin tab não o detecta automaticamente
- Confirmar se há lógica de seleção de versão ou se é realmente fixo
**Resposta esperada até:** W2

---
## [W1] FROM E → D | Cross-Ref | DONE
**Arquivos:** src/pages/AdminDashboard.tsx (tabs), src/hooks/use-admin-data.ts
**Conteúdo:**
- Tabs do AdminDashboard: licenses, sessions, resellers, notifications, versions, extension, payments, recharge, burp, monitoring (legacy alias "pilantrinhas" → monitoring/fraud).
- Componentes tab consumidos: LicensesTab (inline), SessionsTab (inline), ResellersTab, PackagesTab, RechargeTokensTab, MonitoringTab, BurpLovable, NotificationsTab, VersionsTab, ExtensionTab, PaymentsTab.
- Hooks por tab: useLicenses, useSessions, useNotifications, useExtensionVersions, usePayments, useResellers, useUsers, usePackages, useHeaderMetrics — todos via react-query com staleTime variável.
- useAdminRealtime ativo no mount do AdminDashboard: invalida caches de licenses/sessions/notifications/resellers/payments/fraud_events via Supabase Realtime channel único com sufixo aleatório.

---
## [W2] FROM E → D | Audit Reply | DONE
**Ref:** [W1] FROM D → E (Hooks & Admin)
**Findings:**
- **use-burp:** Lê de `localStorage`. Sincronização via `storage` event (tabs) e `chrome.storage.onChanged` (extension).
- **use-admin-data:** Usa React Query com polling fallback (60s). Real-time garantido pelo hook `useAdminRealtime` em `AdminDashboard`.
- **RechargeTokensTab:** Confirmado como stub/dummy. Exibe "Em breve" e não possui lógica de compra real.
- **useBurpReplay:** Build client-side via `jszip` com ofuscação opcional.

## Findings Log
(fire-and-forget — sem flip de status)

### [W1-D-1] LOW — RechargeTokensTab stub sem integração real
Arquivos: src/components/RechargeTokensTab.tsx
PIX placeholder ("Em breve"), sem chamada a backend, sem hook. Compra de tokens não funcional.

### [W1-D-2] MED — neon-glow tokens definidos mas não consumidos
Arquivos: src/index.css (define .neon-glow, .neon-glow-lg), componentes burp/*.tsx
Classes `neon-glow`/`neon-glow-lg` existem mas zero uso nos componentes auditados. BurpPresetsManager/HistoryList usam `bg-card` sem glass-card — fora do padrão.

### [W1-D-3] LOW — backdrop-blur-2xl inline redundante
Arquivos: PackagesTab.tsx:121, ResellersTab.tsx:164
`glass-card` já define backdrop-blur em index.css; inline `backdrop-blur-2xl` é duplicação/override.

### [W1-D-4] MED — ProtectedRoute: isAdmin===null race window
Arquivos: src/components/shared/ProtectedRoute.tsx, src/hooks/use-auth.tsx
Guard `requireAdmin && isAdmin === null` → spinner correto. Mas se checkAdminRole falha silenciosamente (catch sem rethrow), isAdmin fica null infinito → spinner eterno sem feedback ao usuário.

### [W1-D-5] LOW — BurpHistoryList hardcoded URL
Arquivos: src/components/burp/BurpHistoryList.tsx:120
`window.open("https://lovable.dev", "_blank")` — URL hardcoded, não parametrizada.
