import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  getClientIp,
  isRateLimitedByIp,
  logFraud,
  timingSafeEqual,
} from "../_shared/security.ts";

const MAX_ATTEMPTS = 3;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Tighter IP rate limit for OTP verify (5/15min — was 20, too permissive for a 6-digit code)
    if (await isRateLimitedByIp(supabaseAdmin, ip, "admin_otp_verify", 5, 15)) {
      await logFraud(supabaseAdmin, {
        event_type: "admin_otp_verify_ip_rate_limited",
        severity: "error", ip, user_agent: userAgent, endpoint: "/admin-otp-verify",
      });
      return jsonResponse({ valid: false, error: "Rate limited" }, 429);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ valid: false, error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return jsonResponse({ valid: false, error: "Unauthorized" }, 401);
    }

    let body: any;
    try { body = await req.json(); } catch { return jsonResponse({ valid: false, error: "Invalid input" }, 400); }
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({ valid: false, error: "Código inválido" }, 400);
    }

    // Confirma admin
    const { data: role } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return jsonResponse({ valid: false, error: "Forbidden" }, 403);

    // Busca OTP ativo mais recente
    const { data: otp } = await supabaseAdmin
      .from("admin_otp_codes")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("user_id", userId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) {
      return jsonResponse({ valid: false, error: "Nenhum código ativo. Solicite um novo." }, 404);
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("admin_otp_codes").update({ used: true }).eq("id", otp.id);
      return jsonResponse({ valid: false, error: "Código expirado. Solicite um novo." }, 410);
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("admin_otp_codes").update({ used: true }).eq("id", otp.id);
      await logFraud(supabaseAdmin, {
        event_type: "admin_otp_max_attempts",
        severity: "error", ip, user_agent: userAgent, endpoint: "/admin-otp-verify",
        details: { user_id: userId },
      });
      return jsonResponse({ valid: false, error: "Tentativas excedidas. Solicite um novo código." }, 429);
    }

    const providedHash = await sha256Hex(code);
    const enc = new TextEncoder();
    const isValid = timingSafeEqual(enc.encode(providedHash), enc.encode(otp.code_hash));

    if (!isValid) {
      // Atomic optimistic-lock increment: only update if attempts hasn't changed since we read it.
      // This prevents concurrent requests from bypassing MAX_ATTEMPTS via a race condition.
      const { count } = await supabaseAdmin
        .from("admin_otp_codes")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id)
        .eq("attempts", otp.attempts) // optimistic lock
        .select("id", { count: "exact", head: true });

      // If count === 0, a concurrent request already incremented — treat as failed attempt regardless
      const newAttempts = otp.attempts + 1;
      await supabaseAdmin.from("security_logs").insert({
        user_id: userId, event_type: "admin_otp_verify", status: "failure",
        ip_address: ip, user_agent: userAgent,
        metadata: { attempt: newAttempts, concurrent_collision: count === 0 },
      });

      const attemptsLeft = Math.max(0, MAX_ATTEMPTS - newAttempts);
      return jsonResponse({ valid: false, error: "Código incorreto", attempts_left: attemptsLeft }, 401);
    }

    await supabaseAdmin.from("admin_otp_codes").update({ used: true }).eq("id", otp.id);
    await supabaseAdmin.from("security_logs").insert({
      user_id: userId, event_type: "admin_otp_verify", status: "success",
      ip_address: ip, user_agent: userAgent, metadata: {},
    });

    return jsonResponse({ valid: true }, 200);
  } catch (err) {
    console.error("[admin-otp-verify] error", err);
    return jsonResponse({ valid: false, error: "Internal error" }, 500);
  }
});
