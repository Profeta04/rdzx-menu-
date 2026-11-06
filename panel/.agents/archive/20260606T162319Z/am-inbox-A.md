# Inbox A
## Inbox
(append-only)

## Findings Log
(fire-and-forget)

## Findings Log
- [W1-F1] HIGH: plusBtn listener (interceptNativeAttachClick) NUNCA removido no deactivateNativeChat — content.js:4028-4029. qlNativeChatCleanup só remove interceptSend/Submit/Keydown. dataset.qlNativeAttachIntercepted="1" nunca limpo → re-ativação perde o listener no nó sobrevivente.
- [W1-F2] HIGH: Fallback plusBtn selector chama getBoundingClientRect() em botões possivelmente hidden (display:none) → left=0 → botão errado selecionado como target do clip — content.js:4014-4023.
- [W1-F3] HIGH: manifest content_scripts injeta hwFingerprint+content.js em *.supabase.co/* — fingerprinting em domínios Supabase não relacionados ao Lovable. Permissão excessiva.
- [W1-F4] HIGH: Classes ql-attach-item/thumb/info/name/size/status/remove AUSENTES em floating.css — panel de preview de anexos nativo renderiza sem estilo. → enviado a D.
- [W1-F5] MED: swallow ghost-click (L3885) não cobre touchstart/touchend — em touchscreen botões Lovable adjacentes não são suprimidos.
- [W1-F6] MED: run_at:document_start + content.js 4710 linhas em TODAS as páginas lovable.dev + supabase.co — bloqueia parsing precoce.
- [W1-F7] LOW: .ql-native-return-btn sem z-index em floating.css:1674 — depende de inline JS. → enviado a D.
- [W1-F8] LOW: Todas rules .ql-native-* sem [data-theme=light] — modo nativo ilegível em light theme. → enviado a D.
- [W1-CONF] CONFIRMADO: method repassado corretamente (content.js:4171). "Acesso negado" vem do edge quando deviceId está ausente/timeout (L4160-4163) — design correto, não é bug de header. bgFetch passa apikey no header, token no body conforme esperado pelo /pc.
