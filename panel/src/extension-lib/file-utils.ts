// TypeScript port of public/ext_build_v62/services/file-utils.js
// Pure utilities only — URL.createObjectURL/revoke wrappers depend on browser DOM
// but are testable via DI of a urlApi object in tests.

export interface FileEntry {
  objectUrl?: string | null;
  previewUrl?: string | null;
}

export interface UrlApi {
  createObjectURL: (file: Blob) => string;
  revokeObjectURL: (url: string) => void;
}

export const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function guessMimeFromName(name: string | null | undefined): string {
  if (!name) return "application/octet-stream";
  const parts = String(name).split(".");
  if (parts.length < 2) return "application/octet-stream";
  const ext = parts.pop()!.toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

export function genFileId(
  now: () => number = Date.now,
  rand: () => number = Math.random,
): string {
  return "ql_" + now() + "_" + rand().toString(36).slice(2, 8);
}

export function createFileObjectURL(file: Blob, urlApi: UrlApi): string | null {
  try {
    return urlApi.createObjectURL(file);
  } catch {
    return null;
  }
}

export function revokeFileEntry(entry: FileEntry | null | undefined, urlApi: UrlApi): void {
  if (!entry) return;
  if (entry.objectUrl) {
    try { urlApi.revokeObjectURL(entry.objectUrl); } catch {}
    entry.objectUrl = null;
  }
  if (entry.previewUrl && entry.previewUrl !== entry.objectUrl) {
    try { urlApi.revokeObjectURL(entry.previewUrl); } catch {}
    entry.previewUrl = null;
  }
}