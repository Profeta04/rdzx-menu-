# Inbox E

## Inbox
(append-only — entradas mais novas embaixo)

---
## [W1] FROM D → E | Cross-Ref / Audit-Finding | DONE
**Arquivos:** src/hooks/use-burp.ts, src/hooks/usePresets.ts, src/hooks/useBurpReplay.ts, src/hooks/use-admin-data.ts
**Conteúdo:**
- BurpLovable consome `useBurp` (history, loading, authStatus, projectId, workspaceId, executeRequest, clearHistory) + `useBurpReplay` (isBuilding, buildMode, downloadExtension). Confirmar se use-burp lê tokens de extensão via postMessage/chrome.runtime ou apenas estado local.
- PackagesTab e ResellersTab recebem dados via props de `use-admin-data` (CreditPackage, Reseller, License) — sem React Query próprio. Confirmar se hook pai faz polling/realtime ou é one-shot.
- RechargeTokensTab **não consome nenhum hook** — totalmente estático/dummy (PIX placeholder "Em breve"). Fluxo de compra real ausente.
**Resposta:** Auditado em W2. Findings logs atualizados. use-burp lê de localStorage + chrome.storage.onChanged. use-admin-data usa polling (60s) + useAdminRealtime (Supabase Realtime). RechargeTokensTab é dummy.

## Findings Log
(fire-and-forget — sem flip de status)

### [W2-E-01] use-burp: Extensão Sync via Storage Event + Chrome Storage
Arquivos: src/hooks/use-burp.ts
Sincroniza `lovable_captured_token` via `window.addEventListener("storage")` e `chrome.storage.onChanged.addListener`. Suporta tanto abas normais quanto Chrome Extension sidepanel/background.

### [W2-E-02] Admin Data: Polling 60s + Realtime Invalidation
Arquivos: src/hooks/use-admin-data.ts, src/hooks/use-admin-realtime.ts
React Query configurado com `staleTime` variado e `refetchInterval: 60_000` (sessions/metrics). `useAdminRealtime` invalida caches via canal Supabase único ao detectar `postgres_changes`.

### [W2-E-03] Burp Replay: Build Client-side via JSZip
Arquivos: src/hooks/useBurpReplay.ts
Gera ZIP dinamicamente no browser buscando fontes em `/burp_src/*`. Faz substituição de `SUPABASE_URL`/`SUPABASE_ANON_KEY` e ofuscação opcional via `javascript-obfuscator`.

### [W2-E-04] RechargeTokensTab: UI Placeholder
Arquivos: src/components/RechargeTokensTab.tsx
Componente puramente visual. Botão "Finalizar compra" apenas alterna `showPix` para exibir "Em breve". Sem integração com gateway de pagamento ou hooks de dados.
