/// <reference types="vitest" />
/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  sanitizeUrl,
  decodeJwtPayload,
  hbClamp,
  hbHex,
  hbRgb,
  hbRgbStr,
  hbMix,
} from "./content-utils";

describe("content-utils — escapeHtml", () => {
  it("escapa caracteres perigosos", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=\"alert(1)\"&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
  it("retorna string vazia para falsy", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("content-utils — sanitizeUrl", () => {
  it("permite http e https", () => {
    expect(sanitizeUrl("https://lovable.dev/x")).toBe("https://lovable.dev/x");
    expect(sanitizeUrl("http://x.test")).toBe("http://x.test");
  });
  it("bloqueia javascript:, data:, file:", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeUrl("file:///etc/passwd")).toBe("");
  });
  it("retorna vazio para input inválido", () => {
    expect(sanitizeUrl("")).toBe("");
    expect(sanitizeUrl("not a url")).toBe("");
  });
});

describe("content-utils — decodeJwtPayload", () => {
  it("decodifica payload base64url com Bearer prefix", () => {
    const payload = { sub: "user-1", role: "admin" };
    const b64 = btoa(JSON.stringify(payload)).replace(/=+$/, "");
    const token = "header." + b64 + ".sig";
    expect(decodeJwtPayload("Bearer " + token)).toEqual(payload);
    expect(decodeJwtPayload(token)).toEqual(payload);
  });
  it("retorna null para token malformado", () => {
    expect(decodeJwtPayload("")).toBeNull();
    expect(decodeJwtPayload("invalid")).toBeNull();
    expect(decodeJwtPayload("a.b.c")).toBeNull(); // base64 inválido
  });
});

describe("content-utils — color helpers", () => {
  it("hbClamp limita corretamente e cai pro min em NaN", () => {
    expect(hbClamp(5, 0, 10)).toBe(5);
    expect(hbClamp(-5, 0, 10)).toBe(0);
    expect(hbClamp(99, 0, 10)).toBe(10);
    expect(hbClamp("nope", 1, 10)).toBe(1);
  });
  it("hbHex normaliza 3 e 6 dígitos, cai pro fallback se inválido", () => {
    expect(hbHex("#bf00ff")).toBe("#bf00ff");
    expect(hbHex("bf00ff")).toBe("#bf00ff");
    expect(hbHex("#f0f")).toBe("#ff00ff");
    expect(hbHex("not hex", "#abcdef")).toBe("#abcdef");
  });
  it("hbRgb e hbRgbStr derivam de hbHex", () => {
    expect(hbRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(hbRgbStr("#000000")).toBe("0, 0, 0");
  });
  it("hbMix interpola entre duas cores", () => {
    expect(hbMix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(hbMix("#000000", "#ffffff", 1)).toBe("#ffffff");
    // weight 0.5 → cinza médio
    expect(hbMix("#000000", "#ffffff", 0.5)).toBe("#808080");
    // weight fora do range é clampado
    expect(hbMix("#000000", "#ffffff", 99)).toBe("#ffffff");
  });
});