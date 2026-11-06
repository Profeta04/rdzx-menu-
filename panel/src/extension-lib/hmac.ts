/**
 * Assinatura HMAC-SHA256 das requisições da extensão para o backend Supabase.
 * Espelha public/ext_build_v62/security.js como TypeScript puro testável.
 * Usa WebCrypto (disponível em jsdom + service worker + browser).
 */

const SIGN_HOST = "cvbgrjauqjawrsyknhyj.supabase.co";
const SIGN_PATH_PREFIX = "/functions/v1/";

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16);
    s += h.length === 1 ? "0" + h : h;
  }
  return s;
}

function enc(s: string | null | undefined): BufferSource {
  return new TextEncoder().encode(s == null ? "" : String(s)) as unknown as BufferSource;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc(text));
  return toHex(buf);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc(message));
  return toHex(sig);
}

export function shouldSign(url: string): boolean {
  try {
    const u = new URL(url);
    return u.host === SIGN_HOST && u.pathname.indexOf(SIGN_PATH_PREFIX) === 0;
  } catch {
    return false;
  }
}

export interface SignedHeaders {
  "x-ext-version": string;
  "x-ext-timestamp": string;
  "x-ext-nonce": string;
  "x-ext-signature": string;
}

export interface SignRequestOpts {
  method: string;
  url: string;
  body: string | null;
  secret: string;
  version: string;
  nonce: string;
  timestamp: string;
}

/**
 * Versão determinística para testes: caller injeta nonce + timestamp.
 * Em runtime, gere com crypto.getRandomValues + Date.now().
 */
export async function signRequestDeterministic(opts: SignRequestOpts): Promise<SignedHeaders> {
  const u = new URL(opts.url);
  const bodyHash = await sha256Hex(opts.body || "");
  const msg = `${(opts.method || "POST").toUpperCase()}|${u.pathname}|${opts.timestamp}|${opts.nonce}|${bodyHash}`;
  const sig = await hmacHex(opts.secret, msg);
  return {
    "x-ext-version": opts.version,
    "x-ext-timestamp": opts.timestamp,
    "x-ext-nonce": opts.nonce,
    "x-ext-signature": sig,
  };
}