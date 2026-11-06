import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  getClientIp,
  isRateLimitedByIp,
  logFraud,
  isValidString,
  timingSafeEqual,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Rate-limit por IP (10/15min) — antes mesmo de validar auth
    if (await isRateLimitedByIp(supabaseAdmin, ip, "admin_key_verification", 10, 15)) {
      await logFraud(supabaseAdmin, {
        event_type: "admin_key_ip_rate_limited",
        severity: "warn", ip, user_agent: userAgent, endpoint: "/verify-admin-key",
      });
      return jsonResponse({ valid: false, error: "Rate limited", rate_limited: true }, 200);
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
      console.error("[verify-admin-key] auth error:", userError?.message);
      return jsonResponse({ valid: false, error: "Unauthorized" }, 401);
    }

    let bodyParsed: any;
    try { bodyParsed = await req.json(); } catch { return jsonResponse({ valid: false, error: "Invalid input" }, 400); }
    const allowed = new Set(["admin_key"]);
    if (Object.keys(bodyParsed).some((k) => !allowed.has(k))) {
      return jsonResponse({ valid: false, error: "Invalid input" }, 400);
    }
    const admin_key = bodyParsed.admin_key;
    if (!isValidString(admin_key, 8, 200)) {
      return jsonResponse({ valid: false, error: "Invalid input" }, 400);
    }

    const { data: isRateLimited } = await supabaseAdmin.rpc("check_rate_limit", {
      p_user_id: userId,
      p_event_type: "admin_key_verification",
      p_limit: 5,
      p_window_minutes: 15,
    });

    if (isRateLimited) {
      return jsonResponse({ valid: false, error: "Rate limited", rate_limited: true }, 200);
    }

    const { data: cred, error: credError } = await supabaseAdmin
      .from("admin_credentials")
      .select("admin_key")
      .eq("user_id", userId)
      .single();

    if (credError || !cred) {
      await supabaseAdmin.from("security_logs").insert({
        user_id: userId,
        event_type: "admin_key_verification",
        status: "failure",
        ip_address: ip,
        user_agent: userAgent,
        metadata: { reason: "credentials_not_found" },
      });
      return jsonResponse({ valid: false, error: "Not authorized" }, 403);
    }

    // Comparação tempo-constante (shared timingSafeEqual) para evitar timing attack
    const enc = new TextEncoder();
    const isValid = timingSafeEqual(enc.encode(cred.admin_key), enc.encode(admin_key));

    await supabaseAdmin.from("security_logs").insert({
      user_id: userId,
      event_type: "admin_key_verification",
      status: isValid ? "success" : "failure",
      ip_address: ip,
      user_agent: userAgent,
      // Never log any portion of the attempted key to avoid partial-key leaks in logs
      metadata: isValid ? {} : { reason: "key_mismatch" },
    });

    if (!isValid) {
      await logFraud(supabaseAdmin, {
        event_type: "admin_key_invalid",
        severity: "error", ip, user_agent: userAgent, endpoint: "/verify-admin-key",
        details: { user_id: userId },
      });
    }

    if (isValid) {
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!role) {
        return jsonResponse({ valid: false, error: "Not an admin" }, 403);
      }
    }

    return jsonResponse({ valid: isValid }, 200);
  } catch (err) {
    console.error("[verify-admin-key] error:", err);
    return jsonResponse({ valid: false, error: "Internal error" }, 500);
  }
});
