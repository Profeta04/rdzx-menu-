// /dev-proxy-test — dev-only. Faz N chamadas a api.ipify.org via proxies
// aleatórios da tabela `proxies` e retorna a lista de IPs de saída,
// para que o dev confirme visualmente que a rotação está funcionando.
//
// Gating: header `x-dev-license` precisa bater com o secret DEV_LICENSE_KEY.
// Não consome nada do Lovable nem mexe em licenças de cliente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, genericError, getClientIp, isRateLimitedByIp } from "../_shared/security.ts";
import { pickRandomProxies, fetchViaProxy, markProxyCheck } from "../_shared/proxy.ts";

const IP_ECHO_URL = "https://api.ipify.org?format=json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return genericError(405, "Method not allowed");
  }

  try {
    const devKey = Deno.env.get("DEV_LICENSE_KEY") || "";
    const provided = req.headers.get("x-dev-license") || "";
    if (!devKey || provided !== devKey) {
      return genericError(403, "Acesso negado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ip = getClientIp(req);
    if (await isRateLimitedByIp(supabase, ip, "dev_proxy_test", 10, 1)) {
      return genericError(429, "Aguarde um momento.");
    }

    const url = new URL(req.url);
    const sampleParam = Number(url.searchParams.get("n") || "5");
    const sampleSize = Math.min(Math.max(sampleParam, 1), 20);

    const proxies = await pickRandomProxies(supabase, sampleSize);
    if (proxies.length === 0) {
      return jsonResponse({ ok: false, error: "Nenhum proxy ativo cadastrado em public.proxies" }, 200);
    }

    const t0 = Date.now();
    const results = await Promise.all(
      proxies.map(async (p) => {
        const start = Date.now();
        try {
          const r = await fetchViaProxy(p, IP_ECHO_URL, { method: "GET" }, 15_000);
          const txt = await r.text();
          let egressIp: string | null = null;
          try { egressIp = JSON.parse(txt).ip ?? null; } catch { /* noop */ }
          markProxyCheck(supabase, p.id, `ok_${r.status}`, egressIp).catch(() => {});
          return {
            proxy: `${p.host}:${p.port}`,
            status: r.status,
            egress_ip: egressIp,
            ms: Date.now() - start,
          };
        } catch (e) {
          const msg = (e as Error).message.slice(0, 120);
          markProxyCheck(supabase, p.id, `err:${msg.slice(0, 60)}`, null).catch(() => {});
          return {
            proxy: `${p.host}:${p.port}`,
            status: 0,
            egress_ip: null,
            error: msg,
            ms: Date.now() - start,
          };
        }
      }),
    );

    const ips = results.map((r) => r.egress_ip).filter(Boolean) as string[];
    const uniqueIps = Array.from(new Set(ips));

    return jsonResponse({
      ok: true,
      total_proxies_in_pool: proxies.length,
      samples: results.length,
      successful: ips.length,
      unique_egress_ips: uniqueIps.length,
      rotating: uniqueIps.length >= Math.max(2, Math.floor(ips.length * 0.6)),
      egress_ips: uniqueIps,
      details: results,
      total_ms: Date.now() - t0,
    });
  } catch (e) {
    console.error("[dev-proxy-test] error:", e);
    return genericError(500, "Erro interno");
  }
});
