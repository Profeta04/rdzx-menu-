# Inbox I

## Inbox
(append-only — entradas mais novas embaixo)

## Findings Log
(fire-and-forget — sem flip de status)

---
## [W1] FROM D → I | Cross-Ref / Design-Token Audit | CLOSED
**Arquivos:** src/components/MonitoringTab.tsx, PackagesTab.tsx, PilantrinhasTab.tsx, ResellersTab.tsx, burp/*.tsx
**Conteúdo:**
- `glass-card` (CSS utility em index.css) é usado amplamente em Monitoring e Pilantrinhas — correto.
- PackagesTab e ResellersTab misturam `glass-card` com `backdrop-blur-2xl` inline — redundante se glass-card já define backdrop-blur.
- BurpPresetsManager e BurpHistoryList usam `bg-card`/`border-border` sem `glass-card` — fora do padrão glassmorphism das demais abas.
- `neon-glow`/`neon-glow-lg` existem em index.css mas **não são usados** em nenhum componente deste escopo; apenas `shadow-[0_0_20px_hsl(var(--primary)/0.3)]` inline em PackagesTab/ResellersTab — incoerência com sistema de tokens.
**Resposta esperada até:** W2

---
## [W1] FROM I → I | Audit-Done | CLOSED
**Arquivos:** src/index.css, tailwind.config.ts, components.json, index.html, public/*
**Resumo (≤30 linhas):**

### ✅ Confirmados OK
1. **Neon purple** `286 100% 50%` = #bf00ff ✓ (correto, magenta-purple puro)
2. **`.glass-card`** existe em `@layer components`; `backdrop-filter: blur(24px) saturate(180%)` + `-webkit-` ativo; hover eleva sombra neon
3. **Glassmorphism tokens** completos: `--glass-bg`, `--glass-bg-alpha`, `--glass-blur`, `--glass-border`, `--glass-border-alpha` em `:root` e `.dark`
4. **Fonte** Plus Jakarta Sans carregada via Google Fonts (`preconnect` + `display=swap`); fallback declarado via `@font-face`
5. **SEO index.html** completo: title, description, og:title/desc/image, twitter card, schema.org JSON-LD, canonical, viewport+cover
6. **Tailwind semantic colors**: primary, accent, neon, glass, card.elevated, success, warning, sidebar — todos mapeados para CSS vars
7. **robots.txt** permite crawlers comuns; **sitemap.xml** presente; **llms.txt** presente; **pwa-icon.svg** presente

### ⚠️ Issues / Gaps
8. **`--primary-glow` ausente em `:root`** (light mode) — só definido em `.dark`; referência em tailwind pode resolver para undefined no light
9. **Body background-image hardcoded** URL externa (pxfuel.com) — não é token CSS, quebra se URL mudar; CSP precisa allowlist explícita
10. **`components.json` baseColor = "slate"** — inconsistente com identidade neon-purple; shadcn shadowing não seguirá a paleta correta
11. **ThemeProvider `defaultTheme="dark"` sem toggle UI exposto** — usuário não pode mudar tema; light tokens existem mas ficam inativos
12. **`--accent`** no dark = `240 8% 14%` (cinza escuro), não usa neon — accent-foreground branco mas base neutra, pode causar contraste fraco
13. **`float` keyframe** definido em CSS mas não registrado no tailwind `keyframes` block — `animate-float` só funciona via classe CSS raw

### 📌 Outdated-Memory → enviado para J
