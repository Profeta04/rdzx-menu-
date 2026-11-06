/**
 * Módulo compartilhado para egress Lovable.
 * Centraliza: allowlist, SSRF guard, rotação de headers, retry, mapeamento de erro.
 *
 * Todas as edge functions que chamam api.lovable.dev DEVEM importar daqui.
 * Nunca defina pools de UA/lang inline — a divergência cria fingerprint.
 */

// ─── Host allowlists ───────────────────────────────────────────────────────────

export const ALLOWED_LOVABLE: RegExp[] = [
  /(^|\.)lovable\.dev$/i,
  /(^|\.)lovable\.app$/i,
];

export const ALLOWED_LOVABLE_STORAGE: RegExp[] = [
  /(^|\.)amazonaws\.com$/i,
  /(^|\.)storage\.googleapis\.com$/i,
  /(^|\.)googleapis\.com$/i,
  /(^|\.)r2\.cloudflarestorage\.com$/i,
];

// ─── SSRF guard ─────────────────────────────────────────────────────────────────

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function assertAllowedUpstream(url: string, scope: "lovable" | "storage"): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("URL inválida"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Protocolo não permitido");
  if (isPrivateHost(parsed.hostname)) throw new Error("Destino não permitido (SSRF)");
  const patterns = scope === "lovable" ? ALLOWED_LOVABLE : ALLOWED_LOVABLE_STORAGE;
  if (!patterns.some((re) => re.test(parsed.hostname))) {
    throw new Error(`Host ${parsed.hostname} não permitido para scope=${scope}`);
  }
}

// ─── Browser fingerprint pools ───────────────────────────────────────────────
// Estratégia: emular browser real de forma consistente. Cada "perfil" amarra
// UA + sec-ch-ua + platform para evitar inconsistências (mismatch UA/CH-UA é
// assinatura clássica de bot). Sem X-Forwarded-For falso: o upstream usa o IP
// TCP real do Supabase Edge; um XFF inconsistente piora o score anti-bot.

type BrowserProfile = {
  ua: string;
  secChUa: string;
  platform: '"Windows"' | '"macOS"' | '"Linux"';
  mobile: "?0";
  isChromium: boolean; // controla envio de sec-ch-ua-* e Priority
};

const BROWSER_PROFILES: BrowserProfile[] = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="149", "Chromium";v="149", "Not?A_Brand";v="24"',
    platform: '"Windows"',
    mobile: "?0",
    isChromium: true,
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="148", "Chromium";v="148", "Not?A_Brand";v="24"',
    platform: '"Windows"',
    mobile: "?0",
    isChromium: true,
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="149", "Chromium";v="149", "Not?A_Brand";v="24"',
    platform: '"macOS"',
    mobile: "?0",
    isChromium: true,
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
    secChUa: '"Microsoft Edge";v="149", "Chromium";v="149", "Not?A_Brand";v="24"',
    platform: '"Windows"',
    mobile: "?0",
    isChromium: true,
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    secChUa: '"Google Chrome";v="148", "Chromium";v="148", "Not?A_Brand";v="24"',
    platform: '"Linux"',
    mobile: "?0",
    isChromium: true,
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    secChUa: "",
    platform: '"macOS"',
    mobile: "?0",
    isChromium: false,
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    secChUa: "",
    platform: '"Windows"',
    mobile: "?0",
    isChromium: false,
  },
];

export const LANG_POOL: string[] = [
  "en-US,en;q=0.9",
  "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "en-GB,en-US;q=0.9,en;q=0.8",
  "es-ES,es;q=0.9,en;q=0.8",
  "fr-FR,fr;q=0.9,en;q=0.8",
];

/** Internal: pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Rotated headers ─────────────────────────────────────────────────────────
// Constrói um conjunto de headers que emula um browser real em cada requisição.
// Amarra UA + sec-ch-ua + platform para evitar mismatch detectável como bot.

export function buildRotatedHeaders(authToken: string): Record<string, string> {
  const p = pick(BROWSER_PROFILES);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
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

/** Headers para PUT em signed URLs (sem Authorization). */
export function buildRotatedStorageHeaders(): Record<string, string> {
  return {};
}

// ─── Fetch with retry ───────────────────────────────────────────────────────────

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.ok) return resp;
      const isTransient = resp.status === 429 || resp.status >= 500;
      if (!isTransient || attempt === maxAttempts) return resp;
      lastResponse = resp;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
    }
    const delayMs = 500 * Math.pow(3, attempt - 1);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return lastResponse!;
}

// ─── Error mapping ──────────────────────────────────────────────────────────────

export interface MappedError {
  error_code: string;
  error_display: string;
  user_action: string;
  retryable: boolean;
  details: unknown;
}

export function mapLovableError(status: number, rawBody: string): MappedError {
  let parsed: any = null;
  try { parsed = JSON.parse(rawBody); } catch { parsed = { raw: rawBody }; }

  const upstreamType = parsed?.type || parsed?.code || "";
  const upstreamMessage = parsed?.message || "";

  if (status === 428 || upstreamType === "captcha_required") {
    return { error_code: "CAPTCHA_REQUIRED", error_display: "Verificação de segurança necessária", user_action: "Acesse https://lovable.dev no navegador, complete o captcha que aparecer e tente novamente.", retryable: false, details: parsed };
  }
  if (status === 401 || status === 403) {
    return { error_code: "AUTH_FAILED", error_display: "Token Lovable inválido ou expirado", user_action: "Faça login novamente em https://lovable.dev.", retryable: false, details: parsed };
  }
  if (status === 404) {
    return { error_code: "PROJECT_NOT_FOUND", error_display: "Projeto não encontrado", user_action: "Verifique o ID do projeto Lovable.", retryable: false, details: parsed };
  }
  if (status === 429) {
    return { error_code: "RATE_LIMITED", error_display: "Muitas requisições em pouco tempo", user_action: "Aguarde alguns segundos.", retryable: true, details: parsed };
  }
  if (status >= 500) {
    return { error_code: "UPSTREAM_UNAVAILABLE", error_display: "Servidor da Lovable indisponível", user_action: "Tente novamente em alguns segundos.", retryable: true, details: parsed };
  }
  return { error_code: `UPSTREAM_${status}`, error_display: upstreamMessage || "Erro na API da Lovable", user_action: "Tente novamente. Se persistir, contate o suporte.", retryable: false, details: parsed };
}

// ─── Token helpers ──────────────────────────────────────────────────────────────

export function maskToken(t: unknown): string {
  const s = String(t ?? "");
  if (s.length <= 10) return "••••";
  return `${s.slice(0, 6)}••••${s.slice(-4)}`;
}

// ─── Human jitter ───────────────────────────────────────────────────────────────
// 50–250 ms antes do egress quebra padrão temporal de bot.

export async function humanJitter(): Promise<void> {
  const ms = 50 + Math.floor(Math.random() * 200);
  await new Promise((r) => setTimeout(r, ms));
}
