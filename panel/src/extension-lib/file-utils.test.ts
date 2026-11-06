import { describe, it, expect, vi } from "vitest";
import {
  guessMimeFromName,
  genFileId,
  createFileObjectURL,
  revokeFileEntry,
  MIME_MAP,
  type UrlApi,
} from "./file-utils";

describe("guessMimeFromName", () => {
  it("returns octet-stream for empty/null", () => {
    expect(guessMimeFromName("")).toBe("application/octet-stream");
    expect(guessMimeFromName(null)).toBe("application/octet-stream");
    expect(guessMimeFromName(undefined)).toBe("application/octet-stream");
  });
  it("returns octet-stream when no extension", () => {
    expect(guessMimeFromName("README")).toBe("application/octet-stream");
  });
  it("maps known extensions case-insensitively", () => {
    expect(guessMimeFromName("photo.PNG")).toBe("image/png");
    expect(guessMimeFromName("doc.PDF")).toBe("application/pdf");
    expect(guessMimeFromName("a.b.c.jpeg")).toBe("image/jpeg");
  });
  it("falls back for unknown extensions", () => {
    expect(guessMimeFromName("file.xyz")).toBe("application/octet-stream");
  });
  it("covers full MIME_MAP entries", () => {
    for (const [ext, mime] of Object.entries(MIME_MAP)) {
      expect(guessMimeFromName(`x.${ext}`)).toBe(mime);
    }
  });
});

describe("genFileId", () => {
  it("uses injected now+rand for determinism", () => {
    const id = genFileId(() => 1234567890, () => 0.123456789);
    expect(id).toMatch(/^ql_1234567890_/);
    expect(id.length).toBeGreaterThan("ql_1234567890_".length);
  });
  it("produces distinct ids across calls", () => {
    const a = genFileId();
    const b = genFileId();
    expect(a).not.toBe(b);
  });
});

function makeUrlApi(): UrlApi & { create: any; revoke: any } {
  const create = vi.fn((_b: Blob) => "blob:test/" + Math.random());
  const revoke = vi.fn();
  return { createObjectURL: create, revokeObjectURL: revoke, create, revoke };
}

describe("createFileObjectURL", () => {
  it("returns url on success", () => {
    const api = makeUrlApi();
    const url = createFileObjectURL(new Blob(["x"]), api);
    expect(url).toMatch(/^blob:test\//);
    expect(api.create).toHaveBeenCalledOnce();
  });
  it("returns null on throw", () => {
    const api: UrlApi = {
      createObjectURL: () => { throw new Error("nope"); },
      revokeObjectURL: () => {},
    };
    expect(createFileObjectURL(new Blob(["x"]), api)).toBeNull();
  });
});

describe("revokeFileEntry", () => {
  it("no-ops on null/undefined", () => {
    const api = makeUrlApi();
    revokeFileEntry(null, api);
    revokeFileEntry(undefined, api);
    expect(api.revoke).not.toHaveBeenCalled();
  });
  it("revokes objectUrl and clears it", () => {
    const api = makeUrlApi();
    const entry = { objectUrl: "blob:a", previewUrl: null };
    revokeFileEntry(entry, api);
    expect(api.revoke).toHaveBeenCalledWith("blob:a");
    expect(entry.objectUrl).toBeNull();
  });
  it("revokes previewUrl after objectUrl is nulled (current semantics)", () => {
    // After objectUrl is nulled, previewUrl !== null so it IS revoked.
    const api = makeUrlApi();
    const entry = { objectUrl: "blob:a", previewUrl: "blob:a" };
    revokeFileEntry(entry, api);
    expect(api.revoke).toHaveBeenCalledTimes(2);
    expect(entry.objectUrl).toBeNull();
    expect(entry.previewUrl).toBeNull();
  });
  it("revokes both when distinct", () => {
    const api = makeUrlApi();
    const entry = { objectUrl: "blob:a", previewUrl: "blob:b" };
    revokeFileEntry(entry, api);
    expect(api.revoke).toHaveBeenCalledTimes(2);
    expect(entry.objectUrl).toBeNull();
    expect(entry.previewUrl).toBeNull();
  });
  it("swallows revoke errors", () => {
    const api: UrlApi = {
      createObjectURL: () => "",
      revokeObjectURL: () => { throw new Error("boom"); },
    };
    const entry = { objectUrl: "blob:a", previewUrl: "blob:b" };
    expect(() => revokeFileEntry(entry, api)).not.toThrow();
  });
});