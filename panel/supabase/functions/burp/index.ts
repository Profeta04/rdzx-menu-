import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  ALLOWED_LOVABLE,
  buildRotatedHeaders,
  fetchWithRetry,
  isPrivateHost as sharedIsPrivateHost,
  mapLovableError,
} from "../_shared/lovable.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-license-key",
};

const MAX_RESPONSE_CHARS = 10000;
const RATE_LIMIT_PER_MIN = 60;
const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie", "x-api-key", "apikey", "proxy-authorization"];
const ALLOWED_HOST_PATTERNS: RegExp[] = [
  /(^|\.)lovable\.dev$/i,
  /(^|\.)lovable\.app$/i,
  /(^|\.)supabase\.co$/i,
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOST_PATTERNS.some((re) => re.test(hostname));
}

function isLovableHost(hostname: string): boolean {
  return ALLOWED_LOVABLE.some((re) => re.test(hostname));
}

function maskValue(value: unknown): string {
  const s = String(value ?? "");
  if (s.length <= 10) return "••••";
  return `${s.slice(0, 6)}••••${s.slice(-4)}`;
}

function sanitizeHeadersForLog(headers: Record<string, unknown> | undefined | null): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const isSensitive = SENSITIVE_HEADERS.some((h) => k.toLowerCase().includes(h));
    out[k] = isSensitive ? maskValue(v) : String(v);
  }
  return out;
}

// SSRF protection: block private/internal/metadata addresses
const isPrivateHost = sharedIsPrivateHost;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // NOTA: A extensão Hyper RB é uma ferramenta interna usada pelos devs do
    // HyperBuild. Não exige validação de licença — proteção é feita via
    // host allowlist + SSRF guard + rate-limit por IP.
    const licenseKey = req.headers.get("x-license-key")?.trim() || null;
    const rawBody = await req.json();
    const { url, method, body, headers: customHeaders, auth, device_id } = rawBody;

    // Rate limit por IP (sem licença vinculada).
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "unknown";
    try {
      const sinceIso = new Date(Date.now() - 60_000).toISOString();
      const { count } = await service
        .from("security_logs")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "burp_replay")
        .gte("created_at", sinceIso)
        .ilike("message", `%ip:${clientIp}%`);
      if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
        return new Response(JSON.stringify({ error: "Limite de requisições por minuto excedido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
      }
      await service.from("security_logs").insert({
        event_type: "burp_replay",
        status: "info",
        message: `replay:ip:${clientIp}`,
      });
    } catch (_) {
      // rate-limit logging é best-effort; não bloqueia em caso de falha
    }

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF guard
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Protocolo não permitido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (isPrivateHost(parsedUrl.hostname)) {
      console.warn("[burp] blocked SSRF attempt to", parsedUrl.hostname, "ip:", clientIp);
      return new Response(JSON.stringify({ error: "Destino não permitido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isAllowedHost(parsedUrl.hostname)) {
      console.warn("[burp] blocked non-allowlisted host", parsedUrl.hostname, "ip:", clientIp);
      return new Response(JSON.stringify({ error: "Host não permitido. Apenas lovable.dev, lovable.app e supabase.co são aceitos." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Para hosts Lovable usamos buildRotatedHeaders (UA rotacionado, sec-ch-ua,
    // X-Request-ID, etc) — evita fingerprint "bot HyperBuild". Custom headers do
    // caller têm precedência (replay fiel). Para hosts não-Lovable (supabase.co)
    // mantemos um UA Chromium recente sem rotação agressiva.
    const targetIsLovable = isLovableHost(parsedUrl.hostname);
    const bearerForRotation = auth?.bearerToken || "";
    const baseHeaders: Record<string, string> = targetIsLovable
      ? buildRotatedHeaders(bearerForRotation)
      : {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
        };

    // Se não há bearer, remover Authorization gerado por buildRotatedHeaders
    if (targetIsLovable && !bearerForRotation) {
      delete baseHeaders["Authorization"];
    }

    const requestHeaders: Record<string, string> = {
      ...baseHeaders,
      ...(customHeaders || {}),
    };

    if (auth?.cookies && !requestHeaders.Cookie && !requestHeaders.cookie) {
      requestHeaders.Cookie = auth.cookies;
    }

    const startedAt = Date.now();
    const response = await fetchWithRetry(url, {
      method: method || "GET",
      headers: requestHeaders,
      body: body == null || method === "GET" ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
    }, 3);

    const responseBody = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const timingMs = Date.now() - startedAt;
    let responseJson: unknown = null;

    try {
      responseJson = JSON.parse(responseBody);
    } catch {
      responseJson = null;
    }

    // Para hosts Lovable, anexa diagnóstico mapeado quando upstream falhou.
    // Mantém body cru no payload (semântica de replay/burp) mas oferece ao
    // cliente um error_code estável.
    let mappedError: ReturnType<typeof mapLovableError> | null = null;
    if (targetIsLovable && !response.ok) {
      mappedError = mapLovableError(response.status, responseBody);
    }

    // Logging opcional de requests só quando temos licença vinculada (uso por
    // um dev autenticado). Para uso anônimo, não persistimos histórico.
    if (licenseKey) {
      try {
        const { data: license } = await service
          .from("licenses")
          .select("created_by")
          .eq("license_key", licenseKey)
          .maybeSingle();
        if (license?.created_by) {
          await service.from("burp_requests").insert({
            user_id: license.created_by,
            url,
            method: method || "GET",
            payload: body ?? null,
            headers: sanitizeHeadersForLog(customHeaders || {}),
            response_status: response.status,
            response_body: responseBody.substring(0, MAX_RESPONSE_CHARS),
          });
        }
      } catch (_) { /* logging best-effort */ }
    }

    return new Response(JSON.stringify({
      ok: response.ok,
      requestId: crypto.randomUUID(),
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      json: responseJson,
      timingMs,
      responseSize: responseBody.length,
      mappedError,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Burp function error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});