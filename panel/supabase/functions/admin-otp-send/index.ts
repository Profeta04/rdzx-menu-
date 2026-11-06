import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  getClientIp,
  isRateLimitedByIp,
  logFraud,
} from "../_shared/security.ts";

const OTP_TTL_SECONDS = 300; // 5 min
const TELEGRAM_TIMEOUT_MS = 10_000; // 10 s — prevent indefinite hang

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a cryptographically random 6-digit OTP.
 * Uses rejection sampling to eliminate modulo bias.
 */
function generateOtp(): string {
  const LIMIT = 1_000_000;
  const MAX_UNBIASED = Math.floor(0x100000000 / LIMIT) * LIMIT; // 4294000000
  const arr = new Uint32Array(1);
  let v: number;
  do {
    crypto.getRandomValues(arr);
    v = arr[0];
  } while (v >= MAX_UNBIASED);
  return (v % LIMIT).toString().padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      console.error("[admin-otp-send] TELEGRAM_BOT_TOKEN ausente");
      return jsonResponse({ success: false, error: "Telegram não configurado" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (await isRateLimitedByIp(supabaseAdmin, ip, "admin_otp_send", 8, 15)) {
      await logFraud(supabaseAdmin, {
        event_type: "admin_otp_send_rate_limited",
        severity: "warn", ip, user_agent: userAgent, endpoint: "/admin-otp-send",
      });
      return jsonResponse({ success: false, error: "Rate limited" }, 429);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    // Confirma role admin
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403);
    }

    // Rate limit por usuário
    const { data: userLimited } = await supabaseAdmin.rpc("check_rate_limit", {
      p_user_id: userId,
      p_event_type: "admin_otp_send",
      p_limit: 5,
      p_window_minutes: 15,
    });
    if (userLimited) {
      return jsonResponse({ success: false, error: "Rate limited" }, 429);
    }

    // Busca chat_id do admin
    const { data: tg, error: tgError } = await supabaseAdmin
      .from("admin_telegram")
      .select("chat_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (tgError || !tg?.chat_id) {
      return jsonResponse({ success: false, error: "Telegram não cadastrado para este admin" }, 412);
    }

    // Invalida códigos pendentes antigos
    await supabaseAdmin
      .from("admin_otp_codes")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);

    // Gera OTP (sem viés de módulo), hash, persiste
    const code = generateOtp();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("admin_otp_codes")
      .insert({ user_id: userId, code_hash: codeHash, expires_at: expiresAt, ip_address: ip });
    if (insertError) {
      console.error("[admin-otp-send] insert error", insertError);
      return jsonResponse({ success: false, error: "Erro interno" }, 500);
    }

    // Envia via Telegram com timeout para evitar hang indefinido
    const text = `🛡️ HyperBuild Admin\n\nCódigo de verificação: ${code}\n\nVálido por 5 minutos. Não compartilhe.\nIP: ${ip}`;
    const abortCtrl = new AbortController();
    const tgTimeout = setTimeout(() => abortCtrl.abort(), TELEGRAM_TIMEOUT_MS);
    let tgRes: Response;
    try {
      tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tg.chat_id, text }),
        signal: abortCtrl.signal,
      });
    } catch (fetchErr) {
      clearTimeout(tgTimeout);
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
      console.error("[admin-otp-send] Telegram fetch error", isTimeout ? "timeout" : fetchErr);
      await logFraud(supabaseAdmin, {
        event_type: "admin_otp_telegram_failed",
        severity: "error", ip, user_agent: userAgent, endpoint: "/admin-otp-send",
        details: { user_id: userId, reason: isTimeout ? "timeout" : "network_error" },
      });
      return jsonResponse({ success: false, error: "Falha ao enviar código" }, 502);
    }
    clearTimeout(tgTimeout);

    if (!tgRes.ok) {
      const errBody = await tgRes.text();
      console.error("[admin-otp-send] Telegram falhou", tgRes.status, errBody);
      await logFraud(supabaseAdmin, {
        event_type: "admin_otp_telegram_failed",
        severity: "error", ip, user_agent: userAgent, endpoint: "/admin-otp-send",
        details: { user_id: userId, status: tgRes.status },
      });
      return jsonResponse({ success: false, error: "Falha ao enviar código" }, 502);
    }

    await supabaseAdmin.from("security_logs").insert({
      user_id: userId,
      event_type: "admin_otp_send",
      status: "success",
      ip_address: ip,
      user_agent: userAgent,
      metadata: {},
    });

    return jsonResponse({ success: true, expires_in: OTP_TTL_SECONDS }, 200);
  } catch (err) {
    console.error("[admin-otp-send] error", err);
    return jsonResponse({ success: false, error: "Internal error" }, 500);
  }
});
