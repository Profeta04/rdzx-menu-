---
name: hyperbuild-send-method-rollout
description: End-to-end checklist for adding, renaming, or removing a HyperBuild send method (v1/v2/v3/v4/v5/master/auto). Use whenever a new method is introduced or a selected method is being ignored by the backend (falls back to auto).
---

# HyperBuild Send-Method Rollout

The send-method (a.k.a. "modo de envio") is selected client-side in the extension and travels through `proxyFetch → /pc` to Lovable. The value lives in **six** places that MUST stay in lockstep. Skipping one is the classic "selecionei V5 e cai em auto" bug.

> **Disambiguação de arquivos:** `extension/content.js` e `extension/sidepanel.js` são os arquivos da extensão HyperBuild (UI de envio). NÃO confundir com `public/burp_src/burp_content.js` (camada de captura de rede do Hyper RB) — são sistemas completamente distintos. Esta skill trata exclusivamente dos arquivos da extensão HyperBuild.

## The six sources of truth (update ALL or nothing)

| # | File | Symbol | What lives here |
|---|------|--------|----------------|
| 1 | `extension/content.js` | `HB_ALLOWED_SEND_METHODS` (~line 180) | Whitelist used by `qlNormalizeMethod`. If the new id is missing, every selection collapses to `'auto'`. |
| 2 | `extension/content.js` | Floating-mode method menu array (~line 4568, `{ id, label, icon, desc }`) | UI entry for floating mode. |
| 3 | `extension/sidepanel.js` | `HB_ICON` map (~line 9) + `window.HB_METHODS` array (~line 12) | UI entry for sidepanel mode. |
| 4 | `extension/sidepanel.js` | `hbNormalizeMethod` whitelist (~line 48: `['auto','v1',...,'master']`) | Sidepanel-side normalizer. **Same bug as #1 if missed.** |
| 5 | `supabase/functions/pc/index.ts` | `ALLOWED_METHODS` Set (~line 444) | Server whitelist. Unknown id → forced to `'auto'`. |
| 6 | `supabase/functions/pc/index.ts` | `METHOD_POOL` array (~line 447) **and** the `if (effectiveMethod === '<id>')` branch chain (~lines 648–720) | Auto-rotation pool + per-method upstream payload shaping. Missing branch = method recognized but behaves like default. |

> **Nota de line numbers:** os números de linha acima são aproximados e derivam de snapshots históricos. Sempre confirme via `grep -n` antes de editar.

Plus the mirrored build folder (handled by `hyperbuild-release-packager`): `public/ext_build_v62/content.js` and `public/ext_build_v62/sidepanel.js` must receive the same edits, then `manifest.json` version bump in both `extension/` and `public/ext_build_v62/`.

## Symptom → which step you forgot

| Symptom | Forgotten step |
|---|---|
| Selecionei `vN` no menu, mas request ao `/pc` chega com `method: "auto"` | **#1 or #4** — normalizer whitelist. The id was stripped client-side before egress. |
| `/pc` recebe `method: "vN"` mas log mostra `effective=auto` (ou outro) | **#5** — server whitelist. |
| `/pc` aceita o método mas o comportamento é idêntico ao default | **#6** — missing `if (effectiveMethod === 'vN')` payload branch. |
| Menu não mostra o novo método | **#2** (floating) ou **#3** (sidepanel). |
| Funciona no dev preview, quebra na extensão instalada | Mirror em `public/ext_build_v62/` não foi sincronizado, ou `manifest.json` version não foi bumpada → user está rodando build antigo. |
| Valor chega serializado tipo `"\"v5\""` ou `{method:"v5"}` | Bug histórico do `chrome.storage` round-trip. `qlNormalizeMethod`/`hbNormalizeMethod` já têm loop recursivo (até 4 níveis) + `replace(/^\"+|\"+$/g, '')` — preserve isso ao editar. |
| Método funciona na primeira sessão, some após recarregar | Bootstrap-sync guard ausente ou quebrado — veja seção abaixo. |

## Bootstrap-sync guard (não regredir)

Tanto `content.js` quanto `sidepanel.js` carregam o método de `chrome.storage` no boot. **Nunca** sobrescreva um método local específico (`vN`) com `'auto'` vindo do storage remoto. Padrão canônico:

```js
if (bootMethod !== 'auto' || currentMethod === 'auto') {
  qlApplyMethod(bootMethod, { persist: false });
}
```

Sem essa guarda, a primeira hidratação do storage joga o usuário em `auto` mesmo com `vN` selecionado — foi a causa raiz da saga V5.

## Procedimento (siga em ordem, sem pular)

1. **Escolha o id** — minúsculas, formato `vN` ou nome curto (`master`). Sem acentos, sem espaços. Imutável depois de released (clients antigos parseiam por igualdade exata).
2. **Backend primeiro** (`supabase/functions/pc/index.ts`):
   - Adicione o id ao `ALLOWED_METHODS` Set.
   - Adicione ao `METHOD_POOL` **somente** se o método deve entrar na rotação `auto`. Métodos experimentais ou destrutivos NÃO entram no pool.
   - Adicione o branch `else if (effectiveMethod === '<id>') { ... }` montando o `finalPayload` específico.
   - Mantenha o log `console.log(\`[proxy-command] requested_method=... effective=... -> ${apiUrl}\`)`.
3. **Deploy o `/pc`** antes de tocar no client. Cliente novo apontando para backend velho = 400 "método desconhecido" em massa.
4. **Client — content.js (floating)**:
   - Adicione ao `HB_ALLOWED_SEND_METHODS`.
   - Adicione `{ id, label, icon, desc }` ao array do menu (~4568). Use ícone SVG inline.
5. **Client — sidepanel.js**:
   - Adicione ícone a `HB_ICON`.
   - Adicione objeto a `window.HB_METHODS`.
   - Atualize o whitelist em `hbNormalizeMethod`.
6. **Mirror para `public/ext_build_v62/`** os mesmos arquivos editados. Não use `cp -r` cego — preserva `hyper-customize.js`, `security.js`, etc.
7. **Bump `manifest.json` version** em ambos os locais.
8. **Repackage** `public/extension.zip` via `nix run nixpkgs#zip`.
9. **Smoke test**:
   - `supabase--curl_edge_functions` em `/pc` com `method: "<id>"` → log deve mostrar `requested_method=<id> effective=<id>`.
   - Recarregue a extensão, selecione o método, envie uma mensagem, confira Network do DevTools: body POST traz `"method":"<id>"`.
   - Repita em **ambos** os modos (floating + sidepanel).

## Backward compatibility

- **Nunca remova** um id de `ALLOWED_METHODS` no servidor enquanto houver clients antigos. Deprecate primeiro, remova só após N versões.
- **Nunca renomeie** um id existente. Adicione o novo e mantenha o velho como alias.
- Se o payload upstream do método mudar, gate por header `x-hb-ext-version`.

## Anti-patterns (rejeição automática)

- Adicionar o método apenas no menu (UI) sem tocar no whitelist — seleção vira `auto`.
- Adicionar no whitelist do client mas esquecer do servidor — `/pc` força `auto`.
- Adicionar branch no `/pc` mas esquecer do `ALLOWED_METHODS` — branch nunca executa.
- Editar `public/ext_build_v62/` direto e esquecer `extension/` — próxima rebuild apaga o fix.
- Não bumpar `manifest.json` — usuário continua na versão antiga.
- Adicionar ao `METHOD_POOL` um método experimental — todo usuário em `auto` cai nele.
- Remover a guarda de bootstrap-sync — regressão direta para o bug da saga V5.
- Confundir `extension/content.js` com `public/burp_src/burp_content.js` — são arquivos distintos; editar o errado não tem efeito no send-method.

## Pre-merge checklist

- [ ] `ALLOWED_METHODS` (server) contém o novo id.
- [ ] Branch `if (effectiveMethod === '<id>')` existe e monta payload completo.
- [ ] `METHOD_POOL` atualizado **só se** o método deve entrar em auto-rotation.
- [ ] `HB_ALLOWED_SEND_METHODS` (extension/content.js) atualizado.
- [ ] `hbNormalizeMethod` whitelist (extension/sidepanel.js) atualizado.
- [ ] Menu floating (extension/content.js ~4568) atualizado com `{id,label,icon,desc}`.
- [ ] `HB_ICON` + `HB_METHODS` (extension/sidepanel.js) atualizados.
- [ ] Bootstrap-sync guard preservado em ambos os arquivos.
- [ ] `public/ext_build_v62/content.js` + `sidepanel.js` espelhados.
- [ ] `extension/manifest.json` **e** `public/ext_build_v62/manifest.json` com mesmo `version`.
- [ ] `public/extension.zip` regenerado a partir de `extension/`.
- [ ] `/pc` deployado **antes** do client release.
- [ ] Smoke test em floating + sidepanel, log do `/pc` confirma `effective=<id>`.
