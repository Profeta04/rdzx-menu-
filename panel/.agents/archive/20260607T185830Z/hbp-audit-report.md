# HyperBuild PRO — Audit Report
**Gerado por:** Agent G Synthesizer  
**IA utilizada:** Claude Opus 4.5 (claude-opus-4-5)  
**Data:** 2025-07-14  
**Fonte:** Análise direta dos arquivos `public/ext_build_v62/` (inbox dos agentes A–F estava vazio no momento da síntese — análise 100% independente via leitura de código)

---

## Root Causes

### 1. Por que RGB não anima corretamente

**Conflito triplo entre `sidepanel.css`, `floating.css` e `hyper-rgb.css`:**

#### 1a — Sidepanel (`.rgb-border`) — Houdini vs background-position
`sidepanel.css` (L1127–1188) define o motor RGB via CSS Houdini:
```css
@property --border-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes rgb-spin { to { --border-angle: 360deg; } }
.rgb-border {
  background: conic-gradient(from var(--border-angle), #bf00ff 0%, …);
  animation: rgb-spin 4s linear infinite;
}
```
`hyper-rgb.css` redefine `@keyframes rgb-spin` para animar `background-position` (não `--border-angle`). O efeito: qualquer elemento que ainda usa `animation: rgb-spin` com `conic-gradient` **congela** — a animação roda, mas não muda nada visível porque `background-position` não afeta `conic-gradient`. O `hyper-rgb.css` tenta compensar sobrescrevendo `background` e `animation` com `!important`, mas a ordem de aplicação no sidepanel é:

1. `sidepanel.css` → `background: conic-gradient(...)`, `animation: rgb-spin`
2. `hyper-customize.css` → pode sobrescrever
3. `hyper-rgb.css` → `background: var(--hb-rgb-bar) !important`, `animation: hb-rgb-slide !important`

**Se** `hyper-rgb.css` for carregado após os outros (garantido pelo `<link>` em sidepanel.html na ordem correta), a animação deveria funcionar. O risco real está em **reordenações de carregamento** e em elementos criados dinamicamente após o carregamento dos CSS.

#### 1b — Floating (`.ql-rgb-border`) — inline style vs CSS `!important`
`content.js` (L892–896), função `forcePopupRgbOn()`, injeta inline:
```js
border.style.animation = "rgb-spin-ql var(--hb-rgb-dur, 4s) linear infinite";
```
`@keyframes rgb-spin-ql` foi redefinido em `hyper-rgb.css` para animar `background-position`, mas o `background` do elemento quando esse inline é aplicado pode ainda ser `conic-gradient` (de `sidepanel.css` linha 1411–1422: `.ql-dark .ql-rgb-border` com `conic-gradient`). O CSS `!important` no `hyper-rgb.css` DEVERIA ganhar do inline style, mas há uma race condition:

- `hbInjectFloatingThemeOverrides()` é chamado por `hbBootThemeSync()` (L834) — injeta um `<style>` no `document.head` **sem** restaurar `background` ou `animation` para `.ql-rgb-border` (apenas `inset`, `z-index`, `border-radius`, `box-shadow` — ver L791).
- O `hyper-rgb.css` é injetado via `content_scripts.css` (`manifest.json` L53–55) com `run_at: document_start`, mas o `<style>` inline injetado por JS tem precedência de **documento** (carregado após), podendo empurrar `hyper-rgb.css` para posição anterior na cascata.

#### 1c — `@keyframes rgb-spin` duplicado/incompatível
Três definições concorrentes do mesmo keyframe em arquivos diferentes:
| Arquivo | `@keyframes rgb-spin` |
|---|---|
| `sidepanel.css` L1134 | `to { --border-angle: 360deg }` (Houdini) |
| `hyper-rgb.css` L36 | `0%→100% { background-position: 0%→200% }` |
| `floating.css` | não define (usa `textFlow`, `neonTextFlow`) |

A última definição carregada vence. Se a ordem de carregamento for garantida (`hyper-rgb.css` por último), o Houdini `--border-angle` fica sem animação para qualquer elemento que não tenha seu `animation` substituído por `!important`. O elemento `.ql-dark .ql-rgb-border` em `sidepanel.css` (L1411–1422) usa `animation: rgb-spin` com `conic-gradient` — se o `hyper-rgb.css !important` não cobrir, congela.

---

### 2. Por que Floating ignora dark/light

**Dois problemas independentes:**

#### 2a — `#ql-floating.ql-light` tem background escuro
`floating.css` (L154–158):
```css
#ql-floating.ql-light {
  background: rgba(28, 28, 30, 0.75) !important;  /* ← ESCURO! */
  color: #f0e8ff !important;
}
```
O "light mode" do floating simplesmente não implementa um background claro. Tanto `.ql-dark` quanto `.ql-light` resultam em painéis de fundo escuro/cinza-escuro.

#### 2b — `hbInjectFloatingThemeOverrides` sobrescreve qualquer tema com fundo fixo dark
`content.js` (L783):
```css
#ql-floating {
  background: rgba(var(--hb-dark-rgb), .88) !important;
  …
}
```
Seletor `#ql-floating` (sem condição de tema) tem specificidade `(1,0,0)`. O `#ql-floating.ql-dark` e `#ql-floating.ql-light` têm specificidade `(1,0,1)`. A regra `.ql-dark` ganha a disputa de spec, mas `.ql-light` TAMBÉM ganha — e usa fundo escuro (2a). Portanto, independente do tema, o floating sempre parece dark.

#### 2c — Default do dark mode é `true` por semântica
`content.js` (L1109): `const isDark = res.ql_dark_mode !== false;` — se o usuário nunca definiu a preferência, `ql_dark_mode` é `undefined`, então `undefined !== false` = `true` → dark é o padrão. A UI do toggle existe, mas mudar para light ainda resulta num painel praticamente idêntico ao dark (ver 2a/2b).

---

## Findings P0 (críticos — quebra funcional visível)

### P0-01 · `.ql-light` do floating usa background escuro
- **Arquivo:** `floating.css` L154–158
- **Evidência:** `background: rgba(28, 28, 30, 0.75) !important` — RGB `(28,28,30)` é quase preto
- **Impacto:** Toggle dark/light no floating não produz mudança visual perceptível
- **Fix:** Substituir por fundo claro real (ex: `rgba(245, 243, 255, 0.95)`) + `color: #1a0030`

### P0-02 · `hbInjectFloatingThemeOverrides` aplica `--hb-dark-rgb` incondicionalmente
- **Arquivo:** `content.js` L783
- **Evidência:** `#ql-floating { background: rgba(var(--hb-dark-rgb),.88) !important }` — sem `.ql-dark`
- **Impacto:** Floating nunca muda aparência independentemente do tema selecionado
- **Fix:** Mover esta regra para `#ql-floating.ql-dark { … }` ou criar variante responsiva ao tema

### P0-03 · `@keyframes rgb-spin` incompatível: Houdini vs background-position
- **Arquivo:** `sidepanel.css` L1134–1136 vs `hyper-rgb.css` L36–43
- **Evidência:** `sidepanel.css` anima `--border-angle` (conic); `hyper-rgb.css` redefine para `background-position` (linear). Resultado: conic-gradients congelam quando não substituídos por `!important`
- **Impacto:** `.ql-dark .ql-rgb-border` com `conic-gradient` congela se `hyper-rgb.css` não vencer na cascata
- **Fix:** Consolidar em apenas uma estratégia de animação; remover a redefinição de keyframe legacy ou garantir que TODO elemento RGB tenha `animation` sobrescrito pelo `hyper-rgb.css`

### P0-04 · `forcePopupRgbOn` injeta inline style de animação legado
- **Arquivo:** `content.js` L896
- **Evidência:** `border.style.animation = "rgb-spin-ql var(--hb-rgb-dur, 4s) linear infinite"` — força keyframe legacy via inline
- **Impacto:** Race condition — se executado após o CSS, CSS `!important` vence; se ocorrer alguma mutação do DOM, o observer reinvoca e pode re-aplicar o inline, forçando flash/reset da animação
- **Fix:** Remover a linha 896 inteiramente; o CSS em `hyper-rgb.css` cuida da animação

---

## Findings P1 (relevantes — degradação de qualidade)

### P1-01 · `sidepanel.css` e `sidepanel.html` incluem `hyper-rgb.css` mas há duplicação de seletores
- `sidepanel.css` (L1403–1423) ainda define `background` e `animation` para `.ql-rgb-border` e `.ql-dark .ql-rgb-border`
- `hyper-rgb.css` reescreve tudo com `!important`
- **Risco:** Qualquer reordenação de `<link>` quebra o RGB silenciosamente

### P1-02 · `@supports not (property(--border-angle))` fallback (sidepanel.css L1200–1203)
- Define `rgb-spin-fallback` para browsers sem Houdini, mas `hyper-rgb.css` não referencia esse keyframe em nenhum lugar
- **Risco:** Em browsers sem suporte a `@property`, o fallback usa o keyframe legado que também foi redefinido

### P1-03 · `.ql-rgb-border` sem `position: absolute` no `hbInjectFloatingThemeOverrides`
- `content.js` L791 injeta `inset: -2px` para `.ql-rgb-border`, mas não `position: absolute`
- O `position: absolute` vem do `sidepanel.css` L1404
- Se a ordem de carregamento do `<style>` gerado pelo JS ultrapassar a do CSS base, o elemento perde o posicionamento

### P1-04 · `manifest.json` não inclui `hyper-rgb.css` em `web_accessible_resources`
- `manifest.json` L60–75: `web_accessible_resources` inclui `hyper-customize.css` mas NÃO `hyper-rgb.css` como URL acessível a scripts de página (não é o mesmo que `content_scripts.css`)
- **Risco:** Qualquer tentativa de injetar `hyper-rgb.css` via `chrome.runtime.getURL()` em `pageHook.js` ou similar falhará silenciosamente

### P1-05 · `floating.css` e `sidepanel.css` definem `@keyframes neonTextFlow` e `textFlow` separadamente
- Definições duplicadas de keyframes idênticos em dois arquivos. `hyper-rgb.css` substitui por `hb-rgb-text-slide`
- **Risco:** Textos RGB em páginas que carregam só `floating.css` (sem `hyper-rgb.css`) usam keyframe diferente

### P1-06 · `hbApplyTheme` não atualiza gradiente do `hyper-rgb.css`
- `hbApplyTheme` atualiza `--hb-accent`, `--hb-secondary`, `--hb-tertiary` etc., mas `hyper-rgb.css` usa cores hardcoded (`#bf00ff`, `#ff0099`, `#00fff7`) em `--hb-rgb-bar` e `--hb-rgb-text` definidos em `:root`
- **Impacto:** Ao aplicar um preset personalizado (ex: `redBlack`), a borda RGB continua exibindo as cores padrão purple/pink/cyan ao invés das cores do tema

---

## Plano de Fix Fase 2 (8 agentes — partição A…H)

| Agente | Escopo | Arquivos | Prioridade |
|--------|--------|----------|------------|
| **A** | Fix P0-01: Implementar light mode real no floating | `floating.css` | P0 |
| **B** | Fix P0-02: Mover regra `background` do `hbInjectFloatingThemeOverrides` para `.ql-dark` condicional | `content.js` | P0 |
| **C** | Fix P0-03/P0-04: Remover `forcePopupRgbOn` inline style; unificar `@keyframes rgb-spin` para só existir em `hyper-rgb.css` | `content.js`, `hyper-rgb.css` | P0 |
| **D** | Fix P0-03 (CSS side): Remover blocos de `background`/`animation` duplicados em `sidepanel.css` L1176–1188 e L1411–1422; deixar só `position`, `inset`, `z-index` | `sidepanel.css` | P0 |
| **E** | Fix P1-06: Tornar `--hb-rgb-bar` e `--hb-rgb-text` em `hyper-rgb.css` reativos a `--hb-accent`, `--hb-secondary`, `--hb-tertiary` | `hyper-rgb.css`, `content.js` | P1 |
| **F** | Fix P1-04: Adicionar `hyper-rgb.css` a `web_accessible_resources` no manifest; validar `run_at` | `manifest.json` | P1 |
| **G** (Coordinator) | Revisão final de cascata: verificar ordem de `<link>` em `sidepanel.html`; adicionar comentário de ordem de precedência; gerar nova versão do manifest | `sidepanel.html`, `manifest.json` | P1 |
| **H** | QA/Regression: escrever testes de smoke (Playwright ou manual script) para RGB animado + dark/light toggle no floating + sidepanel | `tests/` (novo) | P1 |

---

## Red Team PoCs

### PoC-1: RGB freeze via DOM mutation
```js
// Após abertura do floating, forçar reobservação do MutationObserver:
document.getElementById('ql-rgb-border-el').remove();
// → sidepanel-effects.js observer re-invoca initTiltEffect
// → content.js observer pode re-invocar forcePopupRgbOn
// → inline style re-aplicado → CSS !important vence, mas há flash
```

### PoC-2: Light mode indetectável
```js
chrome.storage.local.set({ ql_dark_mode: false });
// → floating recebe .ql-light
// → background: rgba(28,28,30,0.75) → visualmente idêntico ao dark
// → usuário acredita que o toggle está quebrado
```

### PoC-3: Tema customizado quebra RGB colors
```js
// Aplicar preset "redBlack" via hyper-customize
// → --hb-accent = #ff174d (vermelho), --hb-secondary = #ff6b35
// → Mas hyper-rgb.css usa var(--hb-rgb-bar) = linear-gradient com #bf00ff hardcoded
// → Borda RGB exibe roxo/pink ao invés de vermelho/laranja
```

---

## Notas Cross-Product (sem fix em Hyper RB)

1. **`@property --border-angle` não é suportado no Firefox** — toda a stack de animação Houdini é Chrome-only. Em Firefox, o `conic-gradient` congela e o fallback `rgb-spin-fallback` só existe em `sidepanel.css`, não no floating. Se o produto expandir para Firefox, será necessário reescrever toda a animação de borda sem Houdini.

2. **`background-attachment: fixed` em `.hyper-bg`** (`sidepanel.css` L53) — não funciona dentro de iframes ou elementos com `transform`, `filter` ou `backdrop-filter` no ancestral. Em alguns setups do Chrome SidePanel, isso pode fazer o wallpaper parecer estático.

3. **`hardcoded` URL de wallpaper** (`sidepanel.css` L53): `url("https://e0.pxfuel.com/…")` — domínio externo não está em `host_permissions`. Pode falhar por CSP ou CORS em futuras versões do Chrome Manifest V3 com políticas mais rígidas. A imagem deveria ser bundled ou configurável.

4. **`content.js` versão string desatualizada** (L178): `console.log("[ContentScript] HyperBuild v7.0.8 iniciado")` mas `manifest.json` indica `version: "7.2.6"`. Indicador de que os arquivos foram editados sem atualizar o log de versão — potencialmente problemático para debugging em produção.

5. **`ql_dark_mode !== false` como default dark** (`content.js` L1109) — novos usuários sempre iniciam em dark mode sem opção de onboarding para light. Se o OS reportar `prefers-color-scheme: light`, a extensão continua dark. Considerar respeitar o sistema no primeiro uso.

---

*Relatório produzido via análise estática direta dos 9 arquivos-fonte. Nenhum agente A–F havia contribuído ao inbox no momento da geração. Severidades baseadas em impacto visual observável e risco de regressão.*
