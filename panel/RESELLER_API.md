 # Documentação da API de Revendedores - HyperBuild
 
 Bem-vindo à API de integração para revendedores HyperBuild. Esta API permite que você automatize a entrega de chaves de licença integrando seu site, bot de vendas (Telegram/Discord) ou sistema de gestão diretamente com nossa infraestrutura.
 
 ## Configuração Inicial
 
 ### Base URL
 `https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api`
 
 ### Autenticação
 Todas as requisições devem ser feitas via **POST** e incluir o seguinte header:
 - `x-api-token`: Sua chave de API gerada no painel de revendedor.
 - `Content-Type`: `application/json`
 
 ---
 
 ## Endpoints
 
 ### 1. Verificar Status e Saldo (`/status`)
 Retorna informações sobre sua conta e saldo atual de tokens.
 
 **Exemplo cURL:**
 ```bash
 curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/status \
   -H "x-api-token: SUA_API_KEY" \
   -H "Content-Type: application/json" \
   -d '{}'
 ```

**Resposta:**
```json
{
  "email": "voce@exemplo.com",
  "tokens_7d": 0,
  "tokens_monthly": 0,
  "tokens_annual": 0,
  "tokens_lifetime": 0,
  "tokens_daily": 0,
  "status": "active"
}
```
 
 ---
 
 ### 2. Gerar Licença (`/generate-license`)
Gera uma nova licença **ativa**. O tipo de token consumido depende dos parâmetros enviados.

**Parâmetros comuns:**
- `display_name` (string, opcional): Nome do cliente.
- `email` (string, opcional): E-mail do cliente.
- `phone` (string, opcional): Telefone do cliente.
- `max_sessions` (number, padrão 1, máx 50): Limite de dispositivos simultâneos.

**Parâmetros de duração / tipo (escolha UM modo):**

| Modo | Flag | Campo de duração | Token consumido |
|---|---|---|---|
| Teste grátis | `is_free: true` | `minutes` (1–30, padrão 30) | **Nenhum** (não consome tokens) |
| Diária | `is_daily: true` | `days` (1–6) | **1 token Diário por dia** (ex.: 3 dias = 3 tokens) |
| 7 dias | — | `days: 7` | 1 token **7D** |
| Mensal | — | `days: 30` | 1 token **Mensal** |
| Anual | — | `days: 365` | 1 token **Anual** |
| Vitalícia | `lifetime: true` ou `days: 99999` | — | 1 token **Vitalício** |

> Observações:
> - A licença de teste grátis tem status `active` e duração máxima de 30 minutos. A chave gerada tem o prefixo `HYPER-FREE-`.
> - Para licença diária é obrigatório enviar `is_daily: true` junto com `days` entre 1 e 6, caso contrário a requisição será rejeitada.
> - Saldo insuficiente do tipo de token correspondente retorna **403**.

**Resposta (sucesso):**
```json
{
  "success": true,
  "license_key": "HYPER-XXXXXXXXXXXXXXXXXXXX",
  "expires_at": "2026-06-15T12:00:00.000Z",
  "token_used": "monthly",
  "tokens_count": 1
}
```

**Exemplo — Licença Mensal:**
```bash
curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/generate-license \
  -H "x-api-token: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Cliente Exemplo",
    "email": "cliente@email.com",
    "days": 30
  }'
```

**Exemplo — Teste Grátis (até 30 min, não consome tokens):**
```bash
curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/generate-license \
  -H "x-api-token: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Teste Cliente",
    "is_free": true,
    "minutes": 15
  }'
```

**Exemplo — Licença Diária (3 dias = 3 tokens diários):**
```bash
curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/generate-license \
  -H "x-api-token: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Cliente Diário",
    "is_daily": true,
    "days": 3
  }'
```

**Exemplo — Licença Vitalícia:**
```bash
curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/generate-license \
  -H "x-api-token: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Cliente VIP",
    "lifetime": true
  }'
```

---

### 3. [DESATIVADO] Gerar Trial (`/generate-trial`)
**Atenção**: Este endpoint foi descontinuado. Use `generate-license` com `is_free: true` para gerar uma licença de teste grátis (até 30 minutos, sem consumo de tokens).
 
 ---
 
  ### 4. Buscar Licença Específica (`/get-license`)
  Retorna os detalhes de uma única licença.

  **Parâmetros:**
  - `license_key` (string, obrigatório): A chave da licença.

  **Exemplo cURL:**
  ```bash
  curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/get-license \
    -H "x-api-token: SUA_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
       "license_key": "HYPER-XXXXXXXXXXXXXXXXXXXX"
    }'
  ```

  ---

  ### 5. Listar Licenças (`/list-licenses`)
 Retorna a lista de todas as licenças criadas por você.
 
 **Exemplo cURL:**
 ```bash
 curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/list-licenses \
   -H "x-api-token: SUA_API_KEY" \
   -H "Content-Type: application/json" \
   -d '{}'
 ```
 
 ---
 
  ### 6. Resetar HWID (`/reset-hwid`)
 Remove o vínculo de hardware de uma licença, permitindo que o cliente use em outro dispositivo.
 
 **Parâmetros:**
 - `license_key` (string, obrigatório): A chave da licença.
 
 **Exemplo cURL:**
 ```bash
 curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/reset-hwid \
   -H "x-api-token: SUA_API_KEY" \
   -H "Content-Type: application/json" \
   -d '{
      "license_key": "HYPER-XXXXXXXXXXXXXXXXXXXX"
   }'
 ```
 
 ---
 
  ### 7. Revogar Licença (`/revoke-license`)
 Desativa uma licença permanentemente. **Não devolve o token consumido.**
 
 **Parâmetros:**
 - `license_key` (string, obrigatório): A chave da licença.
 
 **Exemplo cURL:**
 ```bash
 curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/revoke-license \
   -H "x-api-token: SUA_API_KEY" \
   -H "Content-Type: application/json" \
   -d '{
      "license_key": "HYPER-XXXXXXXXXXXXXXXXXXXX"
   }'
 ```
 

---

  ### 8. Excluir Licença (`/delete-license`)
Exclui permanentemente uma licença que esteja expirada ou revogada.

**Parâmetros:**
- `license_key` (string, obrigatório): A chave da licença.

**Exemplo cURL:**
```bash
curl -X POST https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/reseller-api/delete-license \
  -H "x-api-token: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
     "license_key": "HYPER-XXXXXXXXXXXXXXXXXXXX"
  }'
```

 ---
 
 ## Códigos de Resposta
 
 | Status | Descrição |
 |---|---|
 | 200 | Sucesso |
 | 400 | Erro na requisição (ex: parâmetro faltando) |
 | 401 | Token de API ausente ou inválido |
 | 403 | Saldo insuficiente ou conta suspensa |
 | 404 | Endpoint não encontrado |
 | 500 | Erro interno no servidor |