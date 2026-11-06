# Audit-Finding G — hyper-customize RGB Overrides
**IA usada: Claude Opus 4.5**  
**Escopo:** `public/ext_build_v62/hyper-customize.js` + `hyper-customize.css`  
**Data:** 2025-07-28

---

## 1. `_cfg.rgbSpeed` — Fluxo completo

| Ponto | Local | Detalhe |
|---|---|---|
| Default | JS L18 | `rgbSpeed: 4` (range clamp 1–12, JS L183) |
| CSS Var | JS L310 | `r.style.setProperty('--hb-rgb-dur', _cfg.rgbSpeed + 's')` |
| CSS Consumer | CSS L443 | `.rgb-border { animation-duration: var(--hb-rgb-dur, 4s) !important }` |
| **Injected `<style>`** | JS L322–332 | `Apply._patchRgbSpin()` cria/atualiza `<style id="hb-rgb-speed-style">` |

---

## 2. Style Injection — `Apply._patchRgbSpin()` (JS L322–332)

Injeta 4 regras via `el.textContent` a cada `Apply.vars()`:

```
[data-theme="dark"] .user-card .rgb-border { animation-duration: Xs !important }
.ql-dark .ql-rgb-border             { animation-duration: Xs !important }
.rgb-border                          { background: var(--hb-rgb-conic) !important }
.ql-rgb-border                       { background: var(--hb-rgb-conic-ql,...) !important }
```

**⚠️ Redundância:** Linhas 1–2 duplicam CSS L443 com valor hardcoded em vez de usar `var(--hb-rgb-dur)`. Não mata RGB mas cria conflito de especificidade se `_cfg.rgbSpeed` mudar e o `<style>` não for re-injetado a tempo.

---

## 3. RGB Killers — `html.rgb-off`

| Regra | Local | Efeito |
|---|---|---|
| `#hb-preview-rgb { opacity:0 !important }` | CSS L275–277 | Mata preview no painel |
| `#sp-user-card .rgb-border { opacity:0 !important }` | CSS L279–281 | **Mata** border RGB do card |
| `.user-card .rgb-border { background: rgba(...,.34) !important }` | CSS L663–664 | Substitui conic-gradient por cor sólida |
| `.user-name-rgb { background-size: 100% auto !important }` | CSS L670–671 | **Mata** a animação de texto (precisa de 300%) |

---

## 4. `background-size` do texto RGB

- **CSS L389:** `.user-name-rgb { background-size: 300% auto !important }` → animação ativa  
- **CSS L670–671:** `html.rgb-off .user-name-rgb { background-size: 100% auto !important }` → congela animação  
- **Risco:** Se `rgb-off` for aplicado acidentalmente ou sobreviver entre sessões, o texto RGB para de animar sem console error visível.

---

## 5. Gradient/Background Sem Override Indevido

- `--hb-rgb-gradient` e `--hb-rgb-conic` são definidos corretamente em `Apply.vars()` (JS L266–290)
- CSS `:root` tem fallbacks estáticos (CSS L314–315) mas são sobrescritos pelo JS — **sem risco**
- Nenhum outro `style` tag além de `#hb-rgb-speed-style` injeta sobre gradient/background-size

---

## 6. Findings Priorizados

| Prioridade | Finding | Localização |
|---|---|---|
| 🔴 HIGH | `html.rgb-off` persiste → `background-size:100%` trava animação de texto | CSS L670–671 |
| 🔴 HIGH | `html.rgb-off` → `opacity:0` mata border RGB no card | CSS L279–281 |
| 🟡 MED | `_patchRgbSpin` injeta `animation-duration` hardcoded em vez de `var(--hb-rgb-dur)` | JS L326–327 |
| 🟡 MED | Dupla definição de `animation-duration` (CSS var + injected style) — risco de dessincronização | JS L310 vs L326 |
| 🟢 LOW | `rgb-off` substitui conic por cor sólida sem restaurar ao reativar (sem toggle reverso mapeado) | CSS L663–664 |

---

## 7. Recomendação Rápida

```js
// _patchRgbSpin — usar var() em vez de valor literal:
'[data-theme="dark"] .user-card .rgb-border{animation-duration:var(--hb-rgb-dur,4s)!important;}'
```

```css
/* Garantir restauração ao remover html.rgb-off: */
html:not(.rgb-off) .user-name-rgb { background-size: 300% auto !important; }
```

