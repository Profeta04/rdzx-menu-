// Valida rotação de IP usando a tabela `proxies`.
// Roda direto contra a função /dev-proxy-test deployada.
//
// Pré-requisitos:
//   - Pelo menos 3 proxies ativos em public.proxies
//   - Secret DEV_LICENSE_KEY configurado
//
// Executar:
//   deno test --allow-net --allow-env supabase/functions/pc/proxy_rotation_test.ts

import { assert, assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";

const PROJECT_REF = "cvbgrjauqjawrsyknhyj";
const FUNC_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/dev-proxy-test`;
const DEV_KEY = Deno.env.get("DEV_LICENSE_KEY") || "";

Deno.test({
  name: "dev-proxy-test: deve rotacionar IP (>=3 IPs únicos em 5 amostras)",
  async fn() {
    assert(DEV_KEY.length > 0, "Defina DEV_LICENSE_KEY no ambiente do teste");

    const res = await fetch(`${FUNC_URL}?n=5`, {
      method: "GET",
      headers: { "x-dev-license": DEV_KEY },
    });
    assertEquals(res.status, 200);

    const body = await res.json();
    console.log("[proxy_rotation_test] resultado:", JSON.stringify(body, null, 2));

    assertEquals(body.ok, true, "endpoint deveria retornar ok=true");
    assert(body.successful >= 3, `esperava ≥3 chamadas com sucesso, veio ${body.successful}`);
    assert(
      body.unique_egress_ips >= 3,
      `rotação falhou: apenas ${body.unique_egress_ips} IP(s) único(s) em ${body.successful} chamadas`,
    );
    assertEquals(body.rotating, true, "flag rotating deveria ser true");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "dev-proxy-test: sem header x-dev-license retorna 403",
  async fn() {
    const res = await fetch(`${FUNC_URL}?n=1`, { method: "GET" });
    assertEquals(res.status, 403);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
