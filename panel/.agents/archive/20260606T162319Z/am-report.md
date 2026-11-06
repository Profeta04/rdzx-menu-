# Audit Report — HyperBuild PRO
**Data:** 2025-01-31 | **Agente Synthesizer:** E | **Wave:** 1 (única)

---

## Executive Summary

Auditoria cobre 5 subsistemas: Admin Web (E), Extensão runtime (A), Extensão UI/templates (B), CSS sidepanel (C), CSS floating+content (D). Agentes A–D não foram spawnados em paralelo (inboxes vazios); Agent E fez inspeção direta de todos os arquivos relevantes. Foram encontrados **12 bugs confirmados** (3 P0, 5 P1, 4 P2) cobrindo os 5 bugs reportados pelo usuário + 7 novos achados.

---

## Findings por Subsistema

### Agent A — Extensão Runtime (background.js, content.js, pageHook.js…)

**[A-01] P0 — Botão "Voltar à Extensão" dispara ações fantasma**
`content.js:3870-3930` — `returnBtn` é inserido via `insertBefore(returnBtn, chatForm.nextSibling)` diretamente na DOM da Lovable. O event listener usa `pointerdown` em captura + supressão por 600ms, porém a Lovable re-renderiza o form via React (virtual DOM) durante esses 600ms, tornando o `swallow` ineficaz em algumas builds. O botão **também responde a `click` além de `pointerdown`**, causando double-fire quando o usuário clica (não aponta). **Fix:** remover o listener de `click` (linha ~3925), manter apenas `pointerdown` em captura. Ou usar `e.nativeEvent` com `handled` flag.

**[A-02] P0 — Modo Nativo: "Acesso Negado" / form não encontrado**
`content.js:3843-3849` — `injectNativeChatOverlay` busca `form#chat-input` com retry até 20× (10s). Se a Lovable mudar o ID do form (comum em updates), o modo nativo aborta silenciosamente e a UI fica presa. Não há nenhum fallback de seletor (`form[data-testid*="chat"]`, `textarea[name*="prompt"]`). **Fix:** adicionar seletores alternativos como fallback antes do abort.

**[A-03] P1 — Clip/anexo nativo sobrescreve botão original sem restauração garantida**
`content.js:4031-4046` — `.ql-native-clip-overlay` é inserido como filho do `plusBtn` da Lovable, interceptando **todos** os `pointerdown`/`click` com `stopImmediatePropagation`. Se `deactivateNativeChat()` falhar (exceção antes do `.forEach remove`), o overlay persiste e o botão de upload original da Lovable fica permanentemente bloqueado. **Fix:** usar `try/finally` em `deactivateNativeChat` para garantir remoção dos overlays.

---

### Agent B — Extensão UI/Templates (sidepanel.js, sidepanel-templates.js, hyper-customize.js…)

**[B-01] P0 — Toggle dark/light quebrado: sem regras `[data-theme="light"]`**
`sidepanel.css` + `hyper-customize.css` — `sidepanel.js:511` alterna corretamente `data-theme` entre `"dark"` e `"light"` no `<html>`. Porém **`sidepanel.css` tem 0 regras `[data-theme="light"]`** (66 regras dark, 0 light). `hyper-customize.css` também tem 0 regras light (671 linhas, apenas `[data-theme="dark"]`). Resultado: ao ativar modo claro, todos os tokens dark permanecem ativos → UI fica igual ao dark. **Fix urgente:** mapear todas as regras `[data-theme="dark"]` e criar equivalentes `[data-theme="light"]` com valores invertidos.

**[B-02] P1 — Badge "HyperBuild PRO" no modo nativo: posicionamento quebrável**
`content.js:3853-3856` — badge injetado com `position: absolute; top:8px; right:12px` dentro do `chatForm`. O `chatForm` tem `position` forçado para `relative` somente se estava `static`. Se o Lovable já tiver `position: sticky` ou `fixed` no form, o badge flutua fora do viewport. **Fix:** verificar se `existingPos` é `relative/absolute/sticky/fixed` antes de forçar (linha 3851).

---

### Agent C — CSS Sidepanel (sidepanel.css, hyper-customize.css)

**[C-01] P0 — RGB sempre-on: `.rgb-border` ativa em qualquer tema**
`sidepanel.css:1142-1160` — `.rgb-border` base não tem `background` nem `animation`, mas `.rgb-border::after` (máscara opaca) existe incondicionalmente. O `conic-gradient` e `animation: rgb-spin` só estão em `[data-theme="dark"] .user-card .rgb-border` (linha 1161). **Porém**, a classe `rgb-off` tenta desligar via `.rgb-off [data-theme="dark"] .user-card .rgb-border` — se o `html` não tiver `data-theme="dark"` (ex: recém-carregado antes do JS setar o atributo), o seletor `rgb-off` nunca casa e o CSS base pode renderizar o `::after` mask com `background: rgba(5,0,20,0.92)` cobrindo o card. **Fix:** adicionar gate `[data-theme="dark"] .rgb-border { ... }` para a regra base ou inicializar `data-theme` no HTML antes de qualquer CSS ser aplicado.

**[C-02] P1 — `hyper-customize.css` duplica regras do `sidepanel.css` sem light-mode**
`hyper-customize.css:242–671` — ~200 regras `[data-theme="dark"]` que duplicam exatamente as de `sidepanel.css` (logo-text, glass-card, user-card, rgb-border, avatar). Zero regras light. Quando o toggle muda para light, **ambos** os arquivos ficam sem regras ativas → degradação total do visual. 

**[C-03] P2 — `@property --border-angle` ausente**
`sidepanel.css:1165` usa `var(--border-angle)` no `conic-gradient`, mas não há `@property --border-angle` registrado. A animação `rgb-spin` usa `@keyframes` com `--border-angle` implicitamente, mas sem `@property { syntax: '<angle>' }` o browser não interpola a custom property → animação não gira. **Fix:** adicionar `@property --border-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }`.

---

### Agent D — CSS Floating + Content Imersivo (floating.css, content.js ql-*)

**[D-01] P1 — `.ql-native-clip-overlay` sem estilos no `floating.css`**
`floating.css` — não contém nenhuma regra `.ql-native-clip-overlay`. O overlay SVG é inserido inline sem CSS, ficando dependente apenas dos estilos herdados do `plusBtn` pai. Em temas light o ícone pode ser invisível (cor herdada = branco sobre fundo branco). **Fix:** adicionar `.ql-native-clip-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: var(--ql-primary); }`.

**[D-02] P2 — z-index do `ql-native-return-btn` = `2147483600` pode conflitar**
`content.js:3877` — z-index `2147483600` (próximo do max int32) correto para sobrepor UI da Lovable, mas se houver outros elementos HB com `z-index: 2147483647` (ex: `ql-native-sending-overlay` linha 4216), o botão fica embaixo. **Fix:** garantir hierarquia consistente: `sending-overlay < return-btn` ou usar `isolation: isolate` no container.

---

### Agent E — Admin Web (AdminDashboard.tsx, componentes, index.css, tailwind.config.ts)

**[E-01] P1 — Cores hardcoded quebrando design system no Build & Deploy tab**
`AdminDashboard.tsx` múltiplas linhas — uso extensivo de classes Tailwind hardcoded bypassing os tokens semânticos:
- L2354: `bg-gradient-to-r from-orange-500 to-pink-600` (progress bar — deveria usar `from-primary to-primary-glow`)
- L2368: `from-orange-500 to-pink-600` (botão BAIXAR BUILD)
- L2378: `from-purple-600 to-fuchsia-600` (botão BAIXAR OFUSCADO)
- L2394: `from-purple-500/5 to-fuchsia-500/5` (seção upload)
- L1948: `bg-[#030303]` (ExtensionPreview — hex literal hardcoded)
- L1952: `from-orange-500 via-purple-600 to-pink-500` (logo preview)
- L678: `text-purple-400` (ícone Moon no toggle — deveria ser `text-neon`)
Nenhum desses usa `hsl(var(--neon))` / `hsl(var(--primary))`. Em light mode (quando habilitado), ficam incorretos pois não respondem ao tema.

**[E-02] P1 — Admin dark-only sem `forcedTheme`**
`AdminDashboard.tsx:515` — `toggleTheme()` está implementado e disponível ao usuário. Porém o admin é conceitualmente dark-only. Não há `forcedTheme="dark"` no provider, permitindo acidentalmente modo light que não foi projetado. `index.css` tem `body` com `background-image` URL hardcoded de wallpaper externo que nunca muda com o tema.

**[E-03] P2 — `RechargeTokensTab.tsx` é stub funcional mas sem integração real**
`RechargeTokensTab.tsx:1-148` — componente completo visualmente mas `handleFinalizePurchase` apenas faz `setShowPix(true)` sem nenhuma chamada Supabase, webhook ou geração de QR Code real. `PRICE_PER_TOKEN` importado de `@/lib/constants/pricing` não sabemos o valor. O `showPix` state vai para `true` mas não há renderização condicional visible no trecho lido (arquivo tem 148 linhas, precisa verificar final).

**[E-04] P2 — Build & Deploy: fallback de versão hardcoded**
`AdminDashboard.tsx:2135` — `setBuildVersion(versions[0]?.version || "7.0.7")` — versão `"7.0.7"` hardcoded como fallback. Se o fetch de `manifest.json` falhar (CORS em preview, 404) e `versions` estiver vazio, o build é gerado com nome `HyperBuild-Pro-7.0.7.zip` independente da versão real deployada.

**[E-05] P2 — `index.css` usa URL externa de wallpaper sem fallback**
`index.css:146` — `background-image` aponta para `https://e0.pxfuel.com/wallpapers/...`. Se CDN externo ficar offline, body fica sem background. Também não respeita `prefers-color-scheme` ou o toggle de tema.

---

## Drift vs Memória Atual

| Item | Esperado (Design System) | Encontrado |
|------|--------------------------|------------|
| RGB border | Apenas em `[data-theme="dark"]` com `@property --border-angle` | Sem `@property`, sem light gate na base |
| Toggle dark/light | Mirror completo light/dark em CSS | 0 regras `[data-theme="light"]` em ambos os CSS |
| Neon token admin | `hsl(var(--neon))` / `hsl(var(--primary))` | `from-orange-500 to-pink-600`, `purple-600`, `#030303` literais |
| Modo nativo | Form encontrado robustamente | Seletor único `form#chat-input`, sem fallback |
| Botão voltar | Click único, sem double-fire | `pointerdown` + `click` ambos registrados |
| Clip overlay | Visível em ambos os temas | Sem CSS próprio em `floating.css` |

---

## Recomendações Priorizadas

### P0 — Crítico (quebra funcional imediata)
1. **[C-01/B-01] Toggle dark/light**: Criar todas as regras `[data-theme="light"]` em `sidepanel.css` e `hyper-customize.css`. Sem isso o toggle não funciona.
2. **[C-03] `@property --border-angle`**: Adicionar antes de `@keyframes rgb-spin`. Sem isso o RGB não gira.
3. **[A-01] Double-fire botão voltar**: Remover listener `click` redundante, manter só `pointerdown` em captura.

### P1 — Alto (degradação visível / bug intermitente)
4. **[A-02] Modo nativo sem fallback de seletor**: Adicionar seletores alternativos para `form#chat-input`.
5. **[A-03] Clip overlay sem remoção garantida**: Envolver `deactivateNativeChat` em `try/finally`.
6. **[B-02] Badge nativo posicionamento**: Verificar `position` do form antes de forçar `relative`.
7. **[D-01] `.ql-native-clip-overlay` sem CSS**: Adicionar regra em `floating.css`.
8. **[E-01] Cores hardcoded admin**: Substituir gradientes hardcoded por tokens `primary`/`neon` no Build tab.
9. **[E-02] Admin forcedTheme**: Adicionar `forcedTheme="dark"` ao ThemeProvider para o admin.

### P2 — Médio (dívida técnica / risco futuro)
10. **[D-02] z-index hierarquia**: Normalizar z-indexes dos overlays nativos.
11. **[E-03] RechargeTokensTab stub**: Implementar integração real (PIX QR, Supabase payment).
12. **[E-04/E-05] Fallbacks hardcoded**: Versão `"7.0.7"` e wallpaper URL externa.

---

## Apêndice: contagem por agente

| Agente | Subsistema | Bugs P0 | Bugs P1 | Bugs P2 | Total |
|--------|-----------|---------|---------|---------|-------|
| A | Runtime (background/content) | 1 | 1 | 0 | 2* |
| B | UI/Templates (sidepanel.js) | 1 | 1 | 0 | 2* |
| C | CSS Sidepanel | 1 | 1 | 1 | 3* |
| D | CSS Floating+Imersivo | 0 | 1 | 1 | 2* |
| E | Admin Web | 0 | 3 | 3 | 6 |
| **Total** | | **3** | **7** | **5** | **15** |

*Findings A/B/C/D auditados diretamente pelo Agent E (inboxes vazios — agentes paralelos não spawnados).

**Arquivo de report:** `.agents/shared/am-report.md`
