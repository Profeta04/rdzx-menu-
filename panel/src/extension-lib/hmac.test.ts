import { describe, it, expect } from "vitest";
import { sha256Hex, hmacHex, shouldSign, signRequestDeterministic } from "./hmac";

describe("sha256Hex", () => {
  it("matches known vector for empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches known vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("hmacHex", () => {
  it("matches RFC 4231 test case 1", async () => {
    const key = "\x0b".repeat(20);
    const out = await hmacHex(key, "Hi There");
    expect(out).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  });
});

describe("shouldSign", () => {
  it("signs Supabase edge function URLs", () => {
    expect(shouldSign("https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/vx")).toBe(true);
    expect(shouldSign("https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/pc?a=1")).toBe(true);
  });

  it("does not sign other hosts or non-function paths", () => {
    expect(shouldSign("https://api.groq.com/openai/v1/chat/completions")).toBe(false);
    expect(shouldSign("https://cvbgrjauqjawrsyknhyj.supabase.co/rest/v1/licenses")).toBe(false);
    expect(shouldSign("not-a-url")).toBe(false);
  });
});

describe("signRequestDeterministic", () => {
  it("produces stable headers for fixed inputs", async () => {
    const headers = await signRequestDeterministic({
      method: "POST",
      url: "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/vx",
      body: JSON.stringify({ license_key: "HYPER-TEST" }),
      secret: "test-secret",
      version: "7.5.1",
      nonce: "fixednonce0123456789abcdef012345",
      timestamp: "1700000000000",
    });
    expect(headers["x-ext-version"]).toBe("7.5.1");
    expect(headers["x-ext-timestamp"]).toBe("1700000000000");
    expect(headers["x-ext-nonce"]).toBe("fixednonce0123456789abcdef012345");
    // signature should be 64-char hex (sha256)
    expect(headers["x-ext-signature"]).toMatch(/^[0-9a-f]{64}$/);
    // Same inputs must always produce the same signature
    const again = await signRequestDeterministic({
      method: "POST",
      url: "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/vx",
      body: JSON.stringify({ license_key: "HYPER-TEST" }),
      secret: "test-secret",
      version: "7.5.1",
      nonce: "fixednonce0123456789abcdef012345",
      timestamp: "1700000000000",
    });
    expect(again["x-ext-signature"]).toBe(headers["x-ext-signature"]);
  });

  it("changes signature when body changes", async () => {
    const base = {
      method: "POST",
      url: "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/vx",
      secret: "s",
      version: "7.5.1",
      nonce: "n".repeat(32),
      timestamp: "1",
    };
    const a = await signRequestDeterministic({ ...base, body: "a" });
    const b = await signRequestDeterministic({ ...base, body: "b" });
    expect(a["x-ext-signature"]).not.toBe(b["x-ext-signature"]);
  });
});