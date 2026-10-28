# ZDRX Client

Cheat para Free Fire com arquitetura de proxy VPN local.
Projeto original; estrutura de referencia: rede (tun) -> motor nativo -> overlay.

## Build

    export ANDROID_HOME=/caminho/do/sdk
    ./build.sh

Saida: app/build/outputs/apk/debug/app-debug.apk

Ou faca push no GitHub: .github/workflows/build.yml compila e publica o APK.

## Licenca

- ZDRX-TRIAL  -> sempre valida
- ZDRX-XXXXXXXX -> XXXXXXXX = 8 primeiros digitos do HWID mostrado na tela
