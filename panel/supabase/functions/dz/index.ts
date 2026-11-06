// dz — Download Project ZIP (Lovable proxy)
// Segue o canon de hyperbuild-burp-lovable-master:
//  - validateExtensionRequest + license + device_id strict match
//  - rate limit por IP e por licença
//  - header rotation + retry com mapLovableError
//  - token_lovable server-stored quando disponível; fallback env LOVABLE_API_KEY
//  - retorna o binário ZIP cru (Content-Type: application/zip) para o cliente
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getClientIp,
  isRateLimitedByIp,
  isRateLimitedByLicense,
  validateExtensionRequest,
  logFraud,
  isValidString,
  isBanned,
} from "../_shared/security.ts";

// --- Allowlist Lovable upstream (defense in depth) ---
const ALLOWED_LOVABLE: RegExp[] = [
  /(^|\.)lovable\.dev$/i,
  /(^|\.)lovable\.app$/i,
];

function assertAllowedLovable(url: string): void {
  const u = new URL(url);
  if (!ALLOWED_LOVABLE.some((r) => r.test(u.hostname))) {
    throw new Error(`Upstream não permitido: ${u.hostname}`);
  }
}

// --- Error mapping (mesma convenção do /pc, NUNCA renomear error_code) ---
function mapLovableError(status: number, rawBody: string) {
  let parsed: any = null;
  try { parsed = JSON.parse(rawBody); } catch { parsed = { raw: rawBody.slice(0, 500) }; }
  const upstreamType = parsed?.type || parsed?.code || "";

  if (status === 428 || upstreamType === "captcha_required") {
    return { error_code: "CAPTCHA_REQUIRED", error_display: "Verificação de segurança necessária", user_action: "Acesse https://lovable.dev, complete o captcha e tente novamente.", retryable: false, details: parsed };
  }
  if (status === 401 || status === 403) {
    return { error_code: "AUTH_FAILED", error_display: "Token Lovable inválido ou expirado", user_action: "Faça login novamente em https://lovable.dev.", retryable: false, details: parsed };
  }
  if (status === 404) {
    return { error_code: "PROJECT_NOT_FOUND", error_display: "Projeto não encontrado", user_action: "Verifique o ID do projeto.", retryable: false, details: parsed };
  }
  if (status === 429) {
    return { error_code: "RATE_LIMITED", error_display: "Muitas requisições", user_action: "Aguarde alguns segundos.", retryable: true, details: parsed };
  }
  if (status >= 500) {
    return { error_code: "UPSTREAM_UNAVAILABLE", error_display: "Servidor da Lovable indisponível", user_action: "Tente novamente em alguns segundos.", retryable: true, details: parsed };
  }
  return { error_code: `UPSTREAM_${status}`, error_display: parsed?.message || "Erro na API da Lovable", user_action: "Tente novamente. Se persistir, contate o suporte.", retryable: false, details: parsed };
}

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch(url, init);
    if (resp.ok) return resp;
    const transient = resp.status === 429 || resp.status >= 500;
    if (!transient || attempt === maxAttempts) return resp;
    last = resp;
    await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
  }
  return last!;
}

// --- Header rotation (pool sincronizado com /pc) ---
type BrowserProfile = {
  ua: string;
  secChUa: string;
  platform: '"Windows"' | '"macOS"' | '"Linux"';
  mobile: "?0";
  isChromium: boolean;
};

const BROWSER_PROFILES: BrowserProfile[] = [
  { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36", secChUa: '"Google Chrome";v="149", "Chromium";v="149", "Not?A_Brand";v="24"', platform: '"Windows"', mobile: "?0", isChromium: true },
  { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36", secChUa: '"Google Chrome";v="148", "Chromium";v="148", "Not?A_Brand";v="24"', platform: '"Windows"', mobile: "?0", isChromium: true },
  { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36", secChUa: '"Google Chrome";v="149", "Chromium";v="149", "Not?A_Brand";v="24"', platform: '"macOS"', mobile: "?0", isChromium: true },
  { ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36", secChUa: '"Google Chrome";v="148", "Chromium";v="148", "Not?A_Brand";v="24"', platform: '"Linux"', mobile: "?0", isChromium: true },
  { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15", secChUa: "", platform: '"macOS"', mobile: "?0", isChromium: false },
];

const LANG_POOL = [
  "en-US,en;q=0.9",
  "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "en-GB,en-US;q=0.9,en;q=0.8",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function humanJitter(): Promise<void> {
  await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 200)));
}

function buildRotatedHeaders(authToken: string): Record<string, string> {
  const p = pick(BROWSER_PROFILES);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    // Mesmo que o request real seja "Accept: */*", manter "application/zip"
    // como preferência aumenta naturalidade vs. usuário baixando ZIP.
    Accept: "application/zip, application/octet-stream, */*",
    "Accept-Language": pick(LANG_POOL),
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "User-Agent": p.ua,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    "Sec-Fetch-Site": "same-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    DNT: "1",
    "X-Request-ID": crypto.randomUUID(),
  };
  if (p.isChromium) {
    headers["sec-ch-ua"] = p.secChUa;
    headers["sec-ch-ua-mobile"] = p.mobile;
    headers["sec-ch-ua-platform"] = p.platform;
    headers["Priority"] = "u=1, i";
  }
  return headers;
}

function maskKey(k: string): string {
  if (!k) return "";
  return k.length <= 10 ? k.slice(0, 2) + "••••" : k.slice(0, 6) + "••••" + k.slice(-4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405, "Método não permitido");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const banCheck = await isBanned(supabase, { ip });
    if (banCheck.banned) return genericError(403, "Acesso negado");

    // Rate limit por IP: download é pesado, segurar mais agressivo que /pc.
    if (await isRateLimitedByIp(supabase, ip, "download_zip", 10, 1)) {
      return genericError(429, "Muitas requisições. Aguarde alguns segundos.");
    }

    const rawText = await req.text();
    if (rawText.length > 64 * 1024) return genericError(413, "Payload muito grande");

    const ext = await validateExtensionRequest(supabase, req, rawText);
    if (ext) return ext;

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawText); } catch { return genericError(400, "JSON inválido"); }

    const allowed = new Set(["license_key", "device_id", "session_id", "projeto_id", "token_lovable"]);
    const unknown = Object.keys(body).filter((k) => !allowed.has(k));
    if (unknown.length) {
      await logFraud(supabase, { event_type: "unknown_fields_in_payload", severity: "info", ip, user_agent: userAgent, endpoint: "/dz", details: { unknown } });
      return genericError(400, "Campos inválidos no payload");
    }

    const { license_key, device_id, projeto_id, token_lovable } = body as any;

    if (!isValidString(license_key, 8, 100)) return genericError(400, "license_key inválida");
    if (!isValidString(projeto_id, 8, 100)) return genericError(400, "projeto_id inválido");
    if (!isValidString(device_id, 32, 256)) {
      await logFraud(supabase, { event_type: "missing_device_id", severity: "info", license_key, ip, user_agent: userAgent, endpoint: "/dz" });
      return genericError(403, "Acesso negado");
    }
    if (token_lovable !== undefined && !isValidString(token_lovable, 10, 4000)) {
      return genericError(400, "token inválido");
    }

    // Rate limit por licença (downloads são caros)
    if (await isRateLimitedByLicense(supabase, license_key, "download_zip", 5, 1)) {
      return genericError(429, "Muitos downloads para esta licença. Aguarde um momento.");
    }

    // License + hardware lock
    const { data: license, error: licErr } = await supabase
      .from("licenses")
      .select("id, status, device_id")
      .eq("license_key", license_key)
      .single();

    if (licErr || !license) {
      await logFraud(supabase, { event_type: "license_not_found", severity: "warn", license_key, ip, user_agent: userAgent, endpoint: "/dz" });
      return genericError(403, "Acesso negado");
    }
    if (license.status !== "active") {
      return genericError(403, "Acesso negado");
    }
    if (!license.device_id || license.device_id !== device_id) {
      await logFraud(supabase, { event_type: "hwid_mismatch", severity: "error", license_key, device_id, ip, user_agent: userAgent, endpoint: "/dz" });
      return genericError(403, "Acesso negado");
    }

    const envToken = Deno.env.get("LOVABLE_API_KEY");
    const activeToken = token_lovable || envToken;
    if (!activeToken) {
      return jsonResponse({ success: false, error_code: "AUTH_FAILED", error_display: "Token Lovable ausente", user_action: "Faça login em https://lovable.dev." }, 403);
    }

    const apiUrl = `https://api.lovable.dev/projects/${projeto_id}/download-zip`;
    assertAllowedLovable(apiUrl);

    await humanJitter();
    const t0 = Date.now();
    const upstream = await fetchWithRetry(apiUrl, { method: "GET", headers: buildRotatedHeaders(activeToken) }, 3);
    const ms = Date.now() - t0;

    console.log(`[dz] event=upstream status=${upstream.status} ms=${ms} license=${maskKey(license_key)} project=${projeto_id}`);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.log(`[dz] event=upstream_error_body status=${upstream.status} body=${errText.slice(0, 500)}`);
      const mapped = mapLovableError(upstream.status, errText);

      if (mapped.error_code === "AUTH_FAILED") {
        await logFraud(supabase, { event_type: "lovable_auth_failed", severity: "warn", license_key, device_id, ip, user_agent: userAgent, endpoint: "/dz" });
      }

      // Log de tentativa
      await supabase.from("project_download_logs").insert({
        project_id: projeto_id,
        license_key,
        status: `error:${mapped.error_code}`,
      }).then(() => {}, () => {});

      return jsonResponse({
        success: false,
        upstream_status: upstream.status,
        error_code: mapped.error_code,
        error_display: mapped.error_display,
        user_action: mapped.user_action,
        retryable: mapped.retryable,
      }, 200);
    }

    // Sucesso: stream do ZIP de volta ao cliente.
    const buf = await upstream.arrayBuffer();
    await supabase.from("project_download_logs").insert({
      project_id: projeto_id,
      license_key,
      status: "success",
    }).then(() => {}, () => {});

    const filename = `lovable-project-${projeto_id}.zip`;
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[dz] error:", (e as Error).message);
    return jsonResponse({ success: false, error_display: "Erro interno do servidor" }, 500);
  }
});