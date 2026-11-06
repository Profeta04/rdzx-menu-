/**
 * content-utils — TS port das utilidades puras de
 * public/ext_build_v62/services/content-utils.js.
 *
 * Mantém paridade exata. Atualize os DOIS lados quando mudar uma função
 * (testes garantem ao menos a paridade comportamental).
 */

export function escapeHtml(str: unknown): string {
  if (!str) return "";
  // Mesma semântica do impl extension: textContent → innerHTML escapa &, <, >, ".
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sanitizeUrl(url: unknown): string {
  if (!url) return "";
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return String(url);
    return "";
  } catch (_) {
    return "";
  }
}

export function decodeJwtPayload(token: unknown): Record<string, unknown> | null {
  try {
    const raw = String(token ?? "").replace(/^Bearer\s+/i, "").trim();
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

export function hbClamp(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function hbHex(value: unknown, fallback?: string): string {
  let raw = String(value || fallback || "#000000").trim();
  if (!raw.startsWith("#")) raw = "#" + raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    raw = "#" + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
  }
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : String(fallback || "#000000").toLowerCase();
}

export interface Rgb { r: number; g: number; b: number; }

export function hbRgb(value: unknown, fallback?: string): Rgb {
  const hex = hbHex(value, fallback).slice(1);
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hbRgbStr(value: unknown, fallback?: string): string {
  const c = hbRgb(value, fallback);
  return c.r + ", " + c.g + ", " + c.b;
}

export function hbMix(a: unknown, b: unknown, weight: number): string {
  const ca = hbRgb(a, "#000000");
  const cb = hbRgb(b, "#000000");
  const w = hbClamp(weight, 0, 1);
  return "#" + [ca.r, ca.g, ca.b].map((v, i) => {
    const target = [cb.r, cb.g, cb.b][i];
    const s = Math.round(v * (1 - w) + target * w).toString(16);
    return s.length === 1 ? "0" + s : s;
  }).join("");
}