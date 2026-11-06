/**
 * Módulo de segurança compartilhado para Edge Functions.
 *
 * Recursos:
 *  - Verificação HMAC-SHA256 (assinatura cruzada extensão↔backend)
 *  - Anti-replay via nonce + timestamp window
 *  - Kill-switch / controle de versão da extensão
 *  - Rate limiting por IP
 *  - Logs estruturados antifraude
 *  - Respostas de erro genéricas (não vaza arquitetura)
 *
 * IMPORTANTE: Este módulo é importado pelas funções críticas. Não importar SDK
 * Supabase aqui — receba o client por parâmetro para evitar dependência circular.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ext-version, x-ext-nonce, x-ext-timestamp, x-ext-signature, x-api-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
};

export const TIMESTAMP_WINDOW_MS = 60_000; // 60s window
export const HMAC_SECRET_ENV = "EXTENSION_HMAC_SECRET";

/**
 * Padrões conhecidos de prompt-injection usados por clones/forks piratas
 * da extensão (ex.: HyperBuild clonado como "Lovable ∞ PRO"). Nenhum
 * prompt legítimo do usuário deve conter estes marcadores — eles são
 * inseridos pelo clone para sequestrar o Fast Mode via API da Lovable.
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\[\s*SYSTEM\s*:\s*APPLY\s+CHANGES\s+DIRECTLY/i,
  /\[\s*SYSTEM\s*:[^\]]*ignore[^\]]*security/i,
  /HyperBuildHook/i,
  /HyperBuild\s*v?[45]\.\d/i,
  /Lovable\s*∞\s*PRO/i,
  /Lovable\s+SEM\s+LIMITES/i,
  /dwpuqewnfibeldegvimp/i, // host Supabase do clone
  /validate-child-license/i,
  /\bLVB-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\b/i, // formato de licença filha do clone
];

export interface InjectionMatch {
  matched: boolean;
  pattern?: string;
  sample?: string;
}

/**
 * Detecta tentativas de prompt-injection em mensagens vindas do cliente.
 * Retorna o padrão que casou (string) para logging antifraude.
 */
export function detectPromptInjection(input: unknown): InjectionMatch {
  if (typeof input !== "string" || input.length === 0) {
    return { matched: false };
  }
  for (const re of PROMPT_INJECTION_PATTERNS) {
    const m = input.match(re);
    if (m) {
      return {
        matched: true,
        pattern: re.source,
        sample: m[0].slice(0, 120),
      };
    }
  }
  return { matched: false };
}

/** Resposta JSON padronizada com CORS. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Resposta de erro genérica (não vaza arquitetura interna). */
export function genericError(
  status: number,
  message = "Requisição inválida",
): Response {
  return jsonResponse({ success: false, valid: false, message }, status);
}

/** Extrai IP real considerando proxies. */
export function getClientIp(req: Request): string {
  // Ordem por confiabilidade (anti-spoof):
  // 1) cf-connecting-ip — setado pela Cloudflare na borda; cliente não consegue forjar.
  // 2) x-real-ip — setado pelo proxy reverso interno.
  // 3) x-forwarded-for — último recurso; cliente PODE forjar, então usa-se só
  //    se nenhum dos anteriores existir.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

/** Compara dois Uint8Array em tempo constante para evitar timing attacks. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Calcula HMAC-SHA256(secret, message) em hex. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verifica assinatura HMAC com comparação tempo-constante. */
export async function verifyHmac(
  secret: string,
  message: string,
  signatureHex: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(secret, message);
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(expected), enc.encode(signatureHex));
}

/** Valida timestamp dentro da janela (evita replay com nonces antigos). */
export function isTimestampValid(timestamp: string | null): boolean {
  if (!timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Date.now();
  return Math.abs(now - ts) <= TIMESTAMP_WINDOW_MS;
}

/** Consome nonce atomicamente. Retorna true se único, false se replay. */
export async function consumeNonce(
  supabase: SupabaseClient,
  nonce: string,
): Promise<boolean> {
  if (!nonce || nonce.length < 16 || nonce.length > 128) return false;
  const { data, error } = await supabase.rpc("consume_nonce", { p_nonce: nonce });
  if (error) {
    console.error("[security] consume_nonce error:", error.message);
    return false;
  }
  return data === true;
}

/** Lê estado do kill-switch e versão mínima exigida. */
export interface KillSwitchState {
  min_allowed_version: string;
  blocked_versions: string[];
  enforce_hmac: boolean;
  message: string | null;
}

let killSwitchCache: { value: KillSwitchState; ts: number } | null = null;
const KILL_SWITCH_TTL_MS = 30_000;

export async function getKillSwitch(supabase: SupabaseClient): Promise<KillSwitchState> {
  if (killSwitchCache && Date.now() - killSwitchCache.ts < KILL_SWITCH_TTL_MS) {
    return killSwitchCache.value;
  }
  const { data } = await supabase
    .from("extension_kill_switch")
    .select("min_allowed_version, blocked_versions, enforce_hmac, message")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const value: KillSwitchState = data ?? {
    min_allowed_version: "0.0",
    blocked_versions: [],
    enforce_hmac: false,
    message: null,
  };
  killSwitchCache = { value, ts: Date.now() };
  return value;
}

/** Compara versões semânticas simples (a >= b). */
export function versionGte(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

/**
 * Pipeline de validação para endpoints chamados pela extensão.
 * Retorna `null` se OK, ou uma `Response` de erro pronta.
 *
 * Headers esperados quando enforce_hmac=true:
 *  - x-ext-version: versão da extensão
 *  - x-ext-timestamp: epoch ms
 *  - x-ext-nonce: string única ≥16 chars
 *  - x-ext-signature: HMAC-SHA256(secret, `${method}|${path}|${timestamp}|${nonce}|${bodyHash}`)
 */
export async function validateExtensionRequest(
  supabase: SupabaseClient,
  req: Request,
  rawBody: string,
): Promise<Response | null> {
  const ks = await getKillSwitch(supabase);
  const version = req.headers.get("x-ext-version");

  // Só aplica gate de versão se o header foi enviado (extensões antigas pré-Fase3 ainda funcionam).
  if (version) {
    if (ks.blocked_versions.includes(version)) {
      await logFraud(supabase, {
        event_type: "blocked_version",
        severity: "warn",
        ip: getClientIp(req),
        user_agent: req.headers.get("user-agent"),
        endpoint: new URL(req.url).pathname,
        details: { version },
      });
      return genericError(403, "Versão da extensão bloqueada. Atualize para a versão mais recente.");
    }
    if (!versionGte(version, ks.min_allowed_version)) {
      return genericError(
        426,
        `Versão da extensão desatualizada. Requer ${ks.min_allowed_version}+.`,
      );
    }
  }

  // 3. Se enforce_hmac=true, exige assinatura válida
  if (ks.enforce_hmac) {
    const secret = Deno.env.get(HMAC_SECRET_ENV);
    if (!secret) {
      console.error("[security] EXTENSION_HMAC_SECRET ausente; bloqueando enquanto enforce ativo");
      return genericError(503, "Serviço temporariamente indisponível");
    }

    const ts = req.headers.get("x-ext-timestamp");
    const nonce = req.headers.get("x-ext-nonce");
    const sig = req.headers.get("x-ext-signature");

    if (!ts || !nonce || !sig) {
      return genericError(401, "Requisição não assinada");
    }

    if (!isTimestampValid(ts)) {
      await logFraud(supabase, {
        event_type: "timestamp_outside_window",
        severity: "warn",
        ip: getClientIp(req),
        endpoint: new URL(req.url).pathname,
        details: { ts, now: Date.now() },
      });
      return genericError(401, "Requisição expirada");
    }

    const bodyHash = await sha256Hex(rawBody);
    const url = new URL(req.url);
    const message = `${req.method}|${url.pathname}|${ts}|${nonce}|${bodyHash}`;
    const ok = await verifyHmac(secret, message, sig);
    if (!ok) {
      await logFraud(supabase, {
        event_type: "invalid_signature",
        severity: "error",
        ip: getClientIp(req),
        user_agent: req.headers.get("user-agent"),
        endpoint: url.pathname,
      });
      return genericError(401, "Assinatura inválida");
    }

    const fresh = await consumeNonce(supabase, nonce);
    if (!fresh) {
      await logFraud(supabase, {
        event_type: "nonce_replay",
        severity: "error",
        ip: getClientIp(req),
        endpoint: url.pathname,
        details: { nonce: nonce.substring(0, 8) + "..." },
      });
      return genericError(409, "Requisição duplicada");
    }
  }

  return null;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Helper para logging antifraude estruturado. */
export interface FraudEvent {
  event_type: string;
  severity: "info" | "warn" | "error" | "critical";
  license_key?: string | null;
  device_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  endpoint?: string | null;
  details?: Record<string, unknown>;
}

export async function logFraud(supabase: SupabaseClient, ev: FraudEvent): Promise<void> {
  try {
    await supabase.rpc("log_fraud_event", {
      p_event_type: ev.event_type,
      p_severity: ev.severity,
      p_license_key: ev.license_key ?? null,
      p_device_id: ev.device_id ?? null,
      p_ip: ev.ip ?? null,
      p_user_agent: ev.user_agent ?? null,
      p_endpoint: ev.endpoint ?? null,
      p_details: (ev.details as any) ?? {},
    });
  } catch (e) {
    console.error("[security] logFraud failed:", e);
  }
}

/** Rate limit por IP usando RPC. Retorna true se BLOQUEADO. */
export async function isRateLimitedByIp(
  supabase: SupabaseClient,
  ip: string,
  eventType: string,
  limit: number,
  windowMin: number,
): Promise<boolean> {
  const { data } = await supabase.rpc("check_rate_limit_ip", {
    p_ip: ip,
    p_event_type: eventType,
    p_limit: limit,
    p_window_minutes: windowMin,
  });
  return data === true;
}

 /** Rate limit por License Key usando RPC. Retorna true se BLOQUEADO. */
 export async function isRateLimitedByLicense(
   supabase: SupabaseClient,
   licenseKey: string,
   eventType: string,
   limit: number,
   windowMin: number,
 ): Promise<boolean> {
   const { data } = await supabase.rpc("check_rate_limit_license", {
     p_license_key: licenseKey,
     p_event_type: eventType,
     p_limit: limit,
     p_window_minutes: windowMin,
   });
   return data === true;
 }
 
/** Validação simples de campos string com tamanho. */
export function isValidString(v: unknown, min = 1, max = 512): v is string {
  return typeof v === "string" && v.length >= min && v.length <= max;
}

/** Sanitização defensiva: remove campos não esperados de um objeto. */
export function pickFields<T extends Record<string, unknown>>(
  obj: Record<string, unknown>,
  allowed: (keyof T)[],
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in obj) out[key as string] = obj[key as string];
  }
  return out as Partial<T>;
}

// ============================================================
// security_bans enforcement (Opção A)
// Cache em memória por instância (TTL 60s) — reduz custo de
// consultar a tabela em todo request. Trade-off aceito: até 60s
// de delay entre criar um ban e ele ter efeito em todas as
// instâncias frias.
// ============================================================

const BAN_CACHE_TTL_MS = 60_000;
let _banCache: { ips: Set<string>; hwids: Set<string>; expiresAt: number } | null = null;
let _banCacheInflight: Promise<void> | null = null;

async function refreshBanCache(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase
    .from("security_bans")
    .select("ban_type, value");
  if (error) {
    // Falha de leitura: NUNCA bloqueia tráfego legítimo (fail-open
    // proposital). Mantemos cache anterior se existir, ou um cache
    // vazio temporário com TTL curto para retry rápido.
    if (!_banCache) {
      _banCache = { ips: new Set(), hwids: new Set(), expiresAt: Date.now() + 5_000 };
    }
    return;
  }
  const ips = new Set<string>();
  const hwids = new Set<string>();
  for (const row of data ?? []) {
    if (row.ban_type === "ip" && typeof row.value === "string") ips.add(row.value);
    else if (row.ban_type === "hwid" && typeof row.value === "string") hwids.add(row.value);
  }
  _banCache = { ips, hwids, expiresAt: Date.now() + BAN_CACHE_TTL_MS };
}

async function ensureBanCache(supabase: SupabaseClient): Promise<void> {
  if (_banCache && _banCache.expiresAt > Date.now()) return;
  if (_banCacheInflight) {
    await _banCacheInflight;
    return;
  }
  _banCacheInflight = refreshBanCache(supabase).finally(() => {
    _banCacheInflight = null;
  });
  await _banCacheInflight;
}

/**
 * Verifica se o IP ou HWID está em `security_bans`.
 * Use ANTES de qualquer parse/rate-limit — corta tráfego malicioso
 * o mais cedo possível. Fail-open em caso de erro de DB.
 */
export async function isBanned(
  supabase: SupabaseClient,
  identifiers: { ip?: string | null; hwid?: string | null },
): Promise<{ banned: boolean; banType?: "ip" | "hwid"; value?: string }> {
  await ensureBanCache(supabase);
  const cache = _banCache;
  if (!cache) return { banned: false };
  const ip = identifiers.ip?.trim();
  if (ip && cache.ips.has(ip)) return { banned: true, banType: "ip", value: ip };
  const hwid = identifiers.hwid?.trim();
  if (hwid && cache.hwids.has(hwid)) return { banned: true, banType: "hwid", value: hwid };
  return { banned: false };
}

/** Limpa cache (para testes / após admin criar novo ban). */
export function invalidateBanCache(): void {
  _banCache = null;
}