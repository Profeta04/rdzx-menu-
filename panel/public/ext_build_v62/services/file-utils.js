// HyperBuild — File utilities (pure / DOM-light)
// Extracted from content.js (wave 3 / slice 3).
// Exposes globals (drop-in) and namespaced window.HBFileUtils.
(function () {
  "use strict";

  function genFileId() {
    return "ql_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createFileObjectURL(file) {
    try {
      return URL.createObjectURL(file);
    } catch (e) {
      try { console.warn("[QL Attach] createObjectURL failed:", e); } catch (_) {}
      return null;
    }
  }

  function revokeFileEntry(entry) {
    if (entry && entry.objectUrl) {
      try { URL.revokeObjectURL(entry.objectUrl); } catch (e) {}
      entry.objectUrl = null;
    }
    if (entry && entry.previewUrl && entry.previewUrl !== entry.objectUrl) {
      try { URL.revokeObjectURL(entry.previewUrl); } catch (e) {}
      entry.previewUrl = null;
    }
  }

  var MIME_MAP = {
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

  function guessMimeFromName(name) {
    if (!name) return "application/octet-stream";
    var parts = String(name).split(".");
    if (parts.length < 2) return "application/octet-stream";
    var ext = parts.pop().toLowerCase();
    return MIME_MAP[ext] || "application/octet-stream";
  }

  var api = { genFileId: genFileId, createFileObjectURL: createFileObjectURL, revokeFileEntry: revokeFileEntry, guessMimeFromName: guessMimeFromName, MIME_MAP: MIME_MAP };

  try { window.HBFileUtils = api; } catch (_) {}
  // Drop-in globals (backwards-compat with content.js call sites)
  try {
    window.genFileId = genFileId;
    window.createFileObjectURL = createFileObjectURL;
    window.revokeFileEntry = revokeFileEntry;
    window.guessMimeFromName = guessMimeFromName;
  } catch (_) {}
})();