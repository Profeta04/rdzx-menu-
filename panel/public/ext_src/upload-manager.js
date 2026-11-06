/**
 * HyperBuild UploadManager
 * Centralizes file processing and URL conversion for all interfaces
 */

const UploadManager = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB (Minimum 20MB per requirement)
  MAX_FILES: 15,
  LOVABLE_API_BASE: "https://api.lovable.dev",

  /**
   * Upload nativo Lovable (replicando o fluxo do site oficial):
   *  1) POST /projects/{projectId}/files/generate-upload-url -> { url, file_id, ... }
   *  2) PUT raw bytes para a signed URL
   *  3) (opcional) POST /projects/{projectId}/files/generate-download-url -> { url } para preview
   *
   * @param {File} file
   * @param {Object} ctx { projectId, token, onProgress? }
   * @returns {Promise<{file_id:string,file_name:string,mime_type:string,optimisticImageUrl:string|null,size:number}>}
   */
  async uploadFile(file, ctx, legacyOnProgress) {
    if (!file) throw new Error("Arquivo não fornecido");
    if (file.size > this.MAX_FILE_SIZE)
      throw new Error(`Arquivo excede o limite de ${this.formatFileSize(this.MAX_FILE_SIZE)}`);

    // Backwards compat: if ctx is a string (old userId param), reject — caller deve atualizar.
    if (typeof ctx === "string" || !ctx || !ctx.projectId || !ctx.token) {
      throw new Error("UploadManager.uploadFile requer { projectId, token }");
    }

    const { projectId, token } = ctx;
    const onProgress = ctx.onProgress || legacyOnProgress;
    const contentType = file.type || this.guessMimeFromName(file.name);

    // === STEP 1: Gerar URL de upload assinada ===
    if (onProgress) onProgress(5);
    const genUrlResp = await this._lovableFetch(
      `${this.LOVABLE_API_BASE}/projects/${projectId}/files/generate-upload-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          content_type: contentType,
          original_file_name: file.name,
          file_size_bytes: file.size,
          original_file_size_bytes: file.size,
        }),
      },
    );

    const signedUrl =
      genUrlResp?.url || genUrlResp?.signed_url || genUrlResp?.signedUrl || genUrlResp?.data?.url;
    const fileId =
      genUrlResp?.file_id || genUrlResp?.id || genUrlResp?.data?.file_id || genUrlResp?.data?.id;

    if (!signedUrl || !fileId) {
      throw new Error("Resposta inválida de generate-upload-url: " + JSON.stringify(genUrlResp).slice(0, 200));
    }

    // === STEP 2: PUT raw bytes ===
    if (onProgress) onProgress(20);
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = 20 + Math.round((ev.loaded / ev.total) * 70);
            onProgress(pct);
          }
        };
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`PUT signed URL falhou: ${xhr.status} ${xhr.statusText}`));
      xhr.onerror = () => reject(new Error("Erro de rede no PUT signed URL"));
      xhr.send(file);
    });

    // === STEP 3: (best-effort) Gerar URL de download para preview otimista ===
    let optimisticImageUrl = null;
    if (this.isImageType(contentType)) {
      try {
        const dl = await this._lovableFetch(
          `${this.LOVABLE_API_BASE}/projects/${projectId}/files/generate-download-url`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            body: JSON.stringify({ file_id: fileId }),
          },
        );
        optimisticImageUrl = dl?.url || dl?.signed_url || dl?.data?.url || null;
      } catch (e) {
        console.warn("[UploadManager] generate-download-url falhou (preview ignorado):", e?.message);
      }
    }

    if (onProgress) onProgress(100);

    return {
      file_id: fileId,
      file_name: file.name,
      mime_type: contentType,
      optimisticImageUrl,
      size: file.size,
    };
  },

  /**
   * Faz fetch usando o background service worker quando estamos em content script
   * (para evitar CORS), e fetch direto quando em extension page (sidepanel/popup).
   */
  async _lovableFetch(url, opts) {
    const useBg =
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.sendMessage &&
      // Heurística: content scripts não têm chrome.tabs; sidepanel sim. Em ambos os casos
      // o background pode fetchar com host_permissions já declarados.
      true;

    if (useBg) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "proxyFetch",
            url,
            method: opts.method || "GET",
            headers: opts.headers || {},
            body: opts.body || null,
          },
          (resp) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!resp) return reject(new Error("Sem resposta do background"));
            if (!resp.ok) {
              return reject(
                new Error(
                  `Lovable API ${resp.status}: ${typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data).slice(0, 300)}`,
                ),
              );
            }
            resolve(resp.data);
          },
        );
      });
    }

    const r = await fetch(url, opts);
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }
    if (!r.ok) throw new Error(`Lovable API ${r.status}: ${text.slice(0, 300)}`);
    return data;
  },

  guessMimeFromName(name) {
    if (!name) return "application/octet-stream";
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
      webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
      mp3: "audio/mpeg", wav: "audio/wav", json: "application/json",
      txt: "text/plain", csv: "text/csv", zip: "application/zip",
    };
    return map[ext] || "application/octet-stream";
  },

  isImageType(type) {
    return type && type.startsWith("image/");
  },

  isVideoType(type) {
    return type && (type.startsWith("video/") || type.endsWith("mp4") || type.endsWith("webm"));
  },

  getFileIcon(type, fileName = "") {
    const ext = fileName.split(".").pop().toLowerCase();
    if (this.isImageType(type) || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "🖼️";
    if (this.isVideoType(type) || ["mp4", "webm", "mov", "avi"].includes(ext)) return "🎬";
    if (type.includes("pdf") || ext === "pdf") return "📕";
    if (type.includes("zip") || type.includes("rar") || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
    if (type.includes("word") || type.includes("document") || ["doc", "docx"].includes(ext)) return "📝";
    if (type.includes("excel") || type.includes("sheet") || ["xls", "xlsx", "csv"].includes(ext)) return "📊";
    if (type.includes("audio") || ["mp3", "wav", "ogg"].includes(ext)) return "🎵";
    return "📄";
  },

  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  },

  formatFilesPayload(attachments) {
    if (!attachments || attachments.length === 0) return "";

    // If only one file, we can send its URL directly or as a single item JSON
    // The requirement says "detect automatically the format accepted by the endpoint"
    // Usually, if the endpoint expects a string, JSON string is the safest for multiple files.
    if (attachments.length === 1) {
      return attachments[0].url || "";
    }

    // For multiple files, we use Opção 1 (string JSON) as it's the most common for bypasses
    return JSON.stringify(
      attachments.map((f) => ({
        url: f.url || f.publicUrl,
        name: f.name || f.file_name,
        type: (f.type || f.file_type || "").split("/")[0] || "file",
      })),
    );
  },
};
