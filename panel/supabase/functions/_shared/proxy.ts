// Helper de rotação de proxy (dev-only).
// Implementação nativa Deno (Deno.connect + Deno.startTls) para evitar o bug
// conhecido do undici@6.21 no Supabase Edge Runtime:
//   "BadResource: Bad resource ID" em TcpConn.setNoDelay logo após o
//   tunnel TLS estabelecido pelo ProxyAgent.
// Implementa manualmente: TCP -> CONNECT -> startTls -> HTTP/1.1.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ProxyRow {
  id: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  protocol: string;
}

/** Pega 1 proxy aleatório ativo. Retorna null se não houver. */
export async function pickRandomProxy(
  supabase: SupabaseClient,
): Promise<ProxyRow | null> {
  const { data, error } = await supabase
    .from("proxies")
    .select("id, host, port, username, password, protocol")
    .eq("active", true);
  if (error || !data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)] as ProxyRow;
}

/** Pega N proxies aleatórios distintos (até o que existir). */
export async function pickRandomProxies(
  supabase: SupabaseClient,
  count: number,
): Promise<ProxyRow[]> {
  const { data, error } = await supabase
    .from("proxies")
    .select("id, host, port, username, password, protocol")
    .eq("active", true);
  if (error || !data) return [];
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)) as ProxyRow[];
}

/** Marca o resultado da última checagem do proxy. */
export async function markProxyCheck(
  supabase: SupabaseClient,
  proxyId: string,
  status: string,
  egressIp: string | null,
): Promise<void> {
  await supabase
    .from("proxies")
    .update({
      last_checked: new Date().toISOString(),
      last_status: status,
      last_egress_ip: egressIp,
    })
    .eq("id", proxyId);
}

// ---------- Internals ----------

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); },
           (e) => { clearTimeout(t); reject(e); });
  });
}

async function readUntilDoubleCRLF(
  conn: Deno.Conn,
  maxBytes = 64 * 1024,
  timeoutMs = 15_000,
): Promise<{ head: Uint8Array; rest: Uint8Array }> {
  const buf = new Uint8Array(maxBytes);
  let off = 0;
  const deadline = Date.now() + timeoutMs;
  while (off < maxBytes) {
    const slice = buf.subarray(off);
    const n = await withTimeout(conn.read(slice), Math.max(1, deadline - Date.now()), "read_timeout");
    if (n === null) break;
    off += n;
    // procura \r\n\r\n
    for (let i = Math.max(0, off - n - 3); i <= off - 4; i++) {
      if (buf[i] === 13 && buf[i+1] === 10 && buf[i+2] === 13 && buf[i+3] === 10) {
        return { head: buf.slice(0, i), rest: buf.slice(i + 4, off) };
      }
    }
  }
  throw new Error("headers_too_large");
}

async function readAll(conn: Deno.Conn, initial: Uint8Array, timeoutMs = 30_000): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  if (initial.byteLength) chunks.push(initial);
  const tmp = new Uint8Array(16 * 1024);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const n = await withTimeout(conn.read(tmp), Math.max(1, deadline - Date.now()), "body_read_timeout");
    if (n === null) break;
    chunks.push(tmp.slice(0, n));
  }
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

function dechunk(data: Uint8Array): Uint8Array {
  const td = new TextDecoder();
  const parts: Uint8Array[] = [];
  let i = 0;
  while (i < data.length) {
    // line ending of size
    let j = i;
    while (j < data.length - 1 && !(data[j] === 13 && data[j+1] === 10)) j++;
    if (j >= data.length - 1) break;
    const sizeHex = td.decode(data.subarray(i, j)).split(";")[0].trim();
    const size = parseInt(sizeHex, 16);
    if (!Number.isFinite(size) || isNaN(size)) break;
    i = j + 2;
    if (size === 0) break;
    if (i + size > data.length) break;
    parts.push(data.subarray(i, i + size));
    i += size + 2; // CRLF after chunk
  }
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}

/** Fetch via proxy HTTP (CONNECT tunnel). Suporta target HTTPS ou HTTP. */
export async function fetchViaProxy(
  proxy: ProxyRow,
  url: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const u = new URL(url);
  const isHttps = u.protocol === "https:";
  const targetHost = u.hostname;
  const targetPort = u.port ? Number(u.port) : (isHttps ? 443 : 80);
  const enc = new TextEncoder();
  const td = new TextDecoder();

  // 1) TCP -> proxy
  let conn: Deno.Conn = await withTimeout(
    Deno.connect({ hostname: proxy.host, port: proxy.port }),
    10_000,
    "proxy_connect_timeout",
  );

  let active: Deno.Conn = conn;

  try {
    // 2) CONNECT
    const authLine = proxy.username
      ? `Proxy-Authorization: Basic ${btoa(`${proxy.username}:${proxy.password ?? ""}`)}\r\n`
      : "";
    const connectReq =
      `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
      `Host: ${targetHost}:${targetPort}\r\n` +
      `Proxy-Connection: keep-alive\r\n` +
      authLine +
      `\r\n`;
    await withTimeout(conn.write(enc.encode(connectReq)), 10_000, "connect_write_timeout");
    const { head, rest } = await readUntilDoubleCRLF(conn, 8192, 10_000);
    const statusLine = td.decode(head).split("\r\n")[0] ?? "";
    if (!/^HTTP\/\d\.\d 2\d\d/.test(statusLine)) {
      throw new Error(`proxy_connect_failed: ${statusLine}`);
    }
    if (rest.byteLength) {
      // Após CONNECT bem-sucedido não devem vir bytes extras antes do TLS.
      throw new Error("proxy_unexpected_bytes_after_connect");
    }

    // 3) TLS sobre o tunnel (se HTTPS)
    if (isHttps) {
      active = await withTimeout(
        Deno.startTls(conn as Deno.TcpConn, { hostname: targetHost }),
        10_000,
        "tls_handshake_timeout",
      );
    }

    // 4) Monta requisição HTTP/1.1
    const method = (init.method || "GET").toUpperCase();
    const reqHeaders = new Headers(init.headers || {});
    reqHeaders.set("Host", u.host);
    reqHeaders.set("Connection", "close");
    if (!reqHeaders.has("Accept")) reqHeaders.set("Accept", "*/*");
    if (!reqHeaders.has("User-Agent")) reqHeaders.set("User-Agent", "Mozilla/5.0");

    let bodyBytes: Uint8Array | null = null;
    if (init.body != null) {
      if (typeof init.body === "string") {
        bodyBytes = enc.encode(init.body);
      } else if (init.body instanceof Uint8Array) {
        bodyBytes = init.body;
      } else if (init.body instanceof ArrayBuffer) {
        bodyBytes = new Uint8Array(init.body);
      } else {
        // Fallback: serializa para texto
        bodyBytes = enc.encode(String(init.body));
      }
      reqHeaders.set("Content-Length", String(bodyBytes.byteLength));
      if (!reqHeaders.has("Content-Type")) reqHeaders.set("Content-Type", "application/json");
    }

    let reqStr = `${method} ${u.pathname}${u.search || ""} HTTP/1.1\r\n`;
    reqHeaders.forEach((v, k) => { reqStr += `${k}: ${v}\r\n`; });
    reqStr += "\r\n";
    await withTimeout(active.write(enc.encode(reqStr)), timeoutMs, "request_write_timeout");
    if (bodyBytes) {
      await withTimeout(active.write(bodyBytes), timeoutMs, "request_body_write_timeout");
    }

    // 5) Lê resposta
    const { head: resHead, rest: resRest } = await readUntilDoubleCRLF(active, 64 * 1024, timeoutMs);
    const headerStr = td.decode(resHead);
    const lines = headerStr.split("\r\n");
    const statusM = lines[0].match(/^HTTP\/\d\.\d (\d+)/);
    const status = statusM ? Number(statusM[1]) : 502;

    const resHeaders = new Headers();
    let chunked = false;
    let contentLength: number | null = null;
    for (let i = 1; i < lines.length; i++) {
      const idx = lines[i].indexOf(":");
      if (idx <= 0) continue;
      const k = lines[i].slice(0, idx).trim();
      const v = lines[i].slice(idx + 1).trim();
      const kl = k.toLowerCase();
      if (kl === "transfer-encoding" && v.toLowerCase().includes("chunked")) chunked = true;
      if (kl === "content-length") contentLength = Number(v);
      // remove hop-by-hop / proibidos no Response
      if (kl === "transfer-encoding" || kl === "connection" || kl === "keep-alive") continue;
      try { resHeaders.append(k, v); } catch { /* ignore invalid */ }
    }

    // Lê body conforme cabeçalho
    let bodyAll: Uint8Array;
    if (contentLength != null) {
      const need = contentLength - resRest.byteLength;
      if (need <= 0) {
        bodyAll = resRest.slice(0, contentLength);
      } else {
        const more = new Uint8Array(need);
        let got = 0;
        const deadline = Date.now() + timeoutMs;
        while (got < need) {
          const n = await withTimeout(active.read(more.subarray(got)), Math.max(1, deadline - Date.now()), "body_read_timeout");
          if (n === null) break;
          got += n;
        }
        bodyAll = new Uint8Array(resRest.byteLength + got);
        bodyAll.set(resRest, 0);
        bodyAll.set(more.subarray(0, got), resRest.byteLength);
      }
    } else {
      // sem Content-Length → lê até EOF (Connection: close)
      bodyAll = await readAll(active, resRest, timeoutMs);
    }

    if (chunked) bodyAll = dechunk(bodyAll);

    return new Response(bodyAll, { status, headers: resHeaders });
  } finally {
    try { active.close(); } catch { /* ignore */ }
    if (active !== conn) {
      try { conn.close(); } catch { /* ignore */ }
    }
  }
}