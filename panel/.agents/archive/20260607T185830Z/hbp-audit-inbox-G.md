# Inbox G
(append-only — entradas mais novas embaixo)

---
## AUDIT-FINDING — Agent A (READ-ONLY) | Fase 1 | RGB Animation Audit
**IA usada: Claude Opus 4.7**
**Timestamp:** 2025-07-25 | Arquivos lidos: hyper-rgb.css, manifest.json, sidepanel.html

### Resumo dos arquivos auditados
| Arquivo | Linhas relevantes |
|---|---|
| `public/ext_build_v62/hyper-rgb.css` | L25-47 (@keyframes), L74-86 (.rgb-border), L114-130 (texto RGB) |
| `public/ext_build_v62/manifest.json` | L53-56 (content_scripts.css order) |
| `public/ext_build_v62/sidepanel.html` | L7-9 (<link> order no <head>) |

---

### 🔴 ROOT CAUSE PROVÁVEL — 5 Bugs Candidatos (ordenados por prioridade)

**BUG #1 — CRÍTICO: `background-size` ausente no seletor de texto RGB** `hyper-rgb.css:L114-130`
- `.user-name-rgb`, `.ql-user-name-text`, `.logo-text` etc. declaram `background-size: 300% auto` — ✅ presente.
- **Mas**: a animação usa `background-position: 0%→300% 50%` com `background-size: 300% auto`. O eixo Y fixo `auto` pode colapsar a altura dependendo do contexto — isso é marginal, não crítico.
- **Mais grave**: `background-clip: text` + `-webkit-text-fill-color: transparent` só funciona se o elemento NÃO tiver `display: inline` (padrão `<span>`). Se `.logo-text` for `<span>` inline sem `display: inline-block` ou `block`, o `background-size` + `background-position` animation pode ser **no-op visual** mesmo sendo tecnicamente aplicado. `sidepanel.html:L32` confirma `<span class="logo-text">` — **inline puro**.

**BUG #2 — ALTO: Ordem de carregamento no sidepanel.html pode ser sobrescrita por Google Fonts** `sidepanel.html:L9-12`
- `hyper-rgb.css` é o 3º `<link>` (L9), mas `Google Fonts` vem em L12 — posterior. Se fonts.googleapis.com injeta regras que resetam `color` ou `background`, o `!important` protege, mas o `<link rel="preconnect">` em L10-11 pode causar FOUC que deixa o texto sem animação até o repaint.

**BUG #3 — ALTO: `content_scripts` no manifest NÃO inclui `hyper-rgb.css` para páginas `supabase.co`** `manifest.json:L40-56`
- O seletor `.ql-rgb-border`, `.ql-user-name-text` (floating panel) são injetados via content_scripts, mas o floating panel roda no contexto da página lovable.dev — OK. Porém se o floating é montado via Shadow DOM, os CSS de content_scripts **não penetram Shadow DOM** — animação nunca chega ao elemento.

**BUG #4 — MÉDIO: @keyframes legados redefinidos (`rgb-spin`, `rgb-spin-ql`) assumem que são os últimos na cascata** `hyper-rgb.css:L36-47`
- O comentário no topo (L14-21) afirma que `hyper-rgb.css` é "o último item de content_scripts.css". **Confirmado** no manifest (L53-55: `["floating.css", "hyper-rgb.css"]`) ✅ e no sidepanel.html (L7-9) ✅. Mas se `content.js` injeta `<style>` com `rgb-spin-ql` **depois** do carregamento dos CSS (inline style via JS), os keyframes do CSS são sobrescritos — JS ganha. Verificar `content.js` é essencial.

**BUG #5 — MÉDIO: `hb-rgb-text-slide` anima `background-position: 0%→300%` mas `background-size` é `300% auto`** `hyper-rgb.css:L29-32 + L124`
- Com `background-size: 300% auto`, o gradiente ocupa 300% da largura do elemento. Animar `background-position` de `0%` a `300%` deveria funcionar — mas a spec CSS define `background-position` em percentual relativo ao espaço sobrante `(container - background-size)`. Se `background-size: 300%` e container = 100%, o espaço sobrante é negativo → comportamento de animação **indefinido/browser-dependent**. Firefox pode não animar; Safari pode inverter. **O valor correto seria `200% auto` com animação `0%→200%`** para um loop perfeito.

---

### 🎯 Achado Principal (para Orchestrator)
> **`<span class="logo-text">` é `display:inline` nativo** (`sidepanel.html:L32`). CSS `background-clip: text` com animação `background-position` em elementos inline pode não disparar repaint contínuo em Chromium-based browsers dependendo da compositing layer. Combine isso com o BUG #5 (background-position percentual sobre background-size>100% é matematicamente negativo em espaço sobrante), e temos **dois bugs estruturais que sozinhos já explicam animação RGB inativa**. Fix mínimo: adicionar `display: inline-block` aos seletores de texto RGB E corrigir `background-size: 200% auto` + `background-position: 0%→200%`.


---
## AUDIT-FINDING — Agent E (READ-ONLY) | Theme Toggle Bridge Audit
**IA usada: Claude Opus 4.7**
**Timestamp:** 2025-07-25 | Arquivo: public/ext_build_v62/sidepanel.js (L507-526, L640-810, L2020-2038)

### Escopo: fluxo `ql_dark_mode` no sidepanel + bridge para floating

#### 1. Handler do botão (L507-526)
```js
// L507-526 — onclick delegado no document
const themeBtn = e.target.closest('#ql-theme-btn');
if (themeBtn) {
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);          // aplica só no sidepanel DOM
  themeKnob.innerHTML = next === 'dark' ? SP_SVG.moon : SP_SVG.sun;
  chrome.storage.local.set({ ql_dark_mode: next === 'dark' }); // ← única "ponte"
  // ⛔ NÃO há chrome.tabs.sendMessage aqui
}
```

#### 2. Persistência
`chrome.storage.local.set({ ql_dark_mode: boolean })` — booleano. Correto semanticamente.

#### 3. Broadcast para o floating — **AUSENTE**
Nenhum `chrome.tabs.sendMessage` é chamado após o set. Contraste com `toggleShield` (L1080-1081) que usa o padrão correto:
```js
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "toggleShield", active: next });
});
```

### 🔴 GAP EXATO
| Componente | O que faz | O que falta |
|---|---|---|
| `sidepanel.js:L525` | `storage.local.set({ ql_dark_mode })` | `chrome.tabs.sendMessage({ action:'ql_theme_changed', isDark })` |
| `content.js:L960-1040` | `onChanged` listener aplica `ql-dark` em `#ql-floating` | Handler `onMessage` para `ql_theme_changed` |

**Por que `onChanged` falha em alguns cenários:**
1. Se o valor não muda (ex: sidepanel forçar dark quando já é dark), nenhum evento dispara — floating nunca atualiza.
2. Race condition: content script recém-injetado pode não ter registrado o listener ainda quando o `onChanged` dispara.
3. Nenhum `() => void chrome.runtime.lastError` → erros silenciosos se a tab não existe.

### Fix mínimo recomendado
**sidepanel.js após L525:**
```js
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]) chrome.tabs.sendMessage(
    tabs[0].id,
    { action: 'ql_theme_changed', isDark: next === 'dark' },
    () => void chrome.runtime.lastError
  );
});
```
**content.js — adicionar ao onMessage (L1045-1075):**
```js
if (msg.action === 'ql_theme_changed') {
  const box = document.getElementById('ql-floating');
  if (box) {
    box.classList.toggle('ql-dark', msg.isDark);
    box.classList.toggle('ql-light', !msg.isDark);
    box.setAttribute('data-theme', msg.isDark ? 'dark' : 'light');
  }
  chrome.storage.local.set({ ql_dark_mode: msg.isDark });
}
```
