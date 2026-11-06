# ZDRX Mod Menu Client & Admin Dashboard

Sistema completo de Mod Menu com validação server-side de alta segurança (Supabase), painel administrativo web em React/Vite com Glassmorphism e sistema de notificações em tempo real.

## Downloads do APK

- **No repositório (Git)**: [`release/zdrx-mod-menu-v1.0.0.apk`](file:///home/profeta/rdzx-menu-/release/zdrx-mod-menu-v1.0.0.apk)
- **No painel web**: Aba **Versões APK** em `http://localhost:3000` ou botão direto na tela inicial.
- **GitHub Actions**: Compilação automática e publicação de release via `.github/workflows/build.yml`.

## Recursos de Segurança

- **HMAC-SHA256**: Validação criptográfica server-side de todas as requisições com nonce e timestamp window (anti-replay).
- **Controle de HWID**: Cooldown de 10 minutos para troca de dispositivo e histórico de aparelhos.
- **Sessões Ativas**: Heartbeat periódico (45s), verificação local de expiração (5s) e auto-logout com kill-switch.
- **Notificações em Tempo Real**: Envio de alertas e avisos via painel web que chegam instantaneamente no jogo via Toast e Alert Dialog.

## Painel Administrativo

- Local: `http://localhost:3000`
- Senha Mestra: `zdrx2026` ou botão "Acesso Direto (Admin)"
