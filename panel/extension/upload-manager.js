/**
 * HyperBuild UploadManager
 * Centralizes file processing and URL conversion for all interfaces
 */

const UploadManager = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB (Minimum 20MB per requirement)
  MAX_FILES: 15,
  BUCKET_NAME: "files",
  SUPABASE_URL: "https://cvbgrjauqjawrsyknhyj.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmdyamF1cWphd3JzeWtuaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTk1OTYsImV4cCI6MjA5MTIzNTU5Nn0.JdZeY39iGHcZ5P3p0DDXYVUvNJfMrKp_OraUC5EDyzU",

  async uploadFile(file, userId, onProgress) {
    if (!file) throw new Error("Arquivo não fornecido");
    if (file.size > this.MAX_FILE_SIZE)
      throw new Error(`Arquivo excede o limite de ${this.formatFileSize(this.MAX_FILE_SIZE)}`);

    if (onProgress) onProgress(10);

    // Get project data for 'uf' function
    const sd = await new Promise(r => chrome.storage.local.get(["lovable_projectId", "lovable_token", "ql_license_key"], r));
    const pid = sd.lovable_projectId;
    const token = sd.lovable_token;
    const lKey = sd.ql_license_key;

    if (!pid || !token || !lKey) {
      // Fallback to direct upload if project is not synced
      return this.uploadFileDirect(file, userId, onProgress);
    }

    if (onProgress) onProgress(30);
    const base64 = await this.fileToBase64(file);
    if (onProgress) onProgress(60);

    // Call 'uf' function via background proxy
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: "proxyFetch",
        url: `${this.SUPABASE_URL}/functions/v1/uf`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          projeto_id: pid,
          token_lovable: token.startsWith('Bearer ') ? token.slice(7) : token,
          license_key: lKey
        })
      }, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!resp || !resp.ok) return reject(new Error(resp?.data?.error || "Upload falhou via UF"));
        resolve(resp.data);
      });
    });

    if (onProgress) onProgress(100);

    return {
      file_id: result.file_id,
      url: result.optimisticImageUrl,
      fileName: result.fileName,
      contentType: result.contentType
    };
  },

  async uploadFileDirect(file, userId, onProgress) {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `uploads/${userId || "public"}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${cleanName}`;
    const url = `${this.SUPABASE_URL}/storage/v1/object/${this.BUCKET_NAME}/${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: this.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${this.SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(err.message || `Erro no upload (${response.status})`);
    }

    return {
      url: `${this.SUPABASE_URL}/storage/v1/object/public/${this.BUCKET_NAME}/${path}`,
      file_id: path
    };
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
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
