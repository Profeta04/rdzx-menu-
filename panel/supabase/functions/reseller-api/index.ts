import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  corsHeaders,
  jsonResponse,
  getClientIp,
  isRateLimitedByIp,
  logFraud,
} from "../_shared/security.ts";

const BUILD_VERSION = "2026-05-15-hardened";

// Endpoints permitidos (whitelist estrita; nenhum endpoint não listado é processado)
const ALLOWED_ENDPOINTS = new Set([
  "health", "status", "generate-trial", "generate-license",
  "get-license", "list-licenses", "reset-hwid", "revoke-license", "delete-license",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let path = url.pathname.split("/").pop() || "";
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Public Health endpoint (no auth required)
    if (path === "health") {
      return jsonResponse({ status: "ok", build: BUILD_VERSION });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate-limit anti brute force por IP — antes de validar token (protege endpoint inteiro)
    if (await isRateLimitedByIp(supabase, ip, "reseller_api_ip", 120, 1)) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }

    // 1. Validate API Token
    const apiToken = req.headers.get("x-api-token");
    if (!apiToken || apiToken.length < 16 || apiToken.length > 256) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    // Hash the token to compare with DB
    const encoder = new TextEncoder();
    const data = encoder.encode(apiToken);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Find reseller
    const { data: reseller, error: resellerError } = await supabase
      .rpc("find_reseller_by_api_key_hash", { p_hash: hashHex })
      .single();

    if (resellerError || !reseller) {
      await logFraud(supabase, {
        event_type: "reseller_invalid_token",
        severity: "info", ip, user_agent: userAgent, endpoint: `/reseller-api/${path}`,
      });
      return jsonResponse({ error: "Invalid credentials" }, 403);
    }

    // Rate limit check (simple implementation via logs)
    const { count: recentCalls } = await supabase
      .from("reseller_api_logs")
      .select("id", { count: "exact", head: true })
      .eq("reseller_id", reseller.id)
      .gt("created_at", new Date(Date.now() - 60000).toISOString()); // Last minute

    if (recentCalls && recentCalls > 60) { // Limit to 60 calls per minute
      await logFraud(supabase, {
        event_type: "reseller_rate_limited",
        severity: "warn", ip, endpoint: `/reseller-api/${path}`,
        details: { reseller_id: reseller.id, recentCalls },
      });
      return jsonResponse({ error: "Rate limit exceeded. Max 60 calls/min." }, 429);
    }

    let body: any = {};
    if (req.method === "POST") {
      const rawText = await req.text();
      if (rawText.length > 32 * 1024) return jsonResponse({ error: "Payload too large" }, 413);
      try { body = rawText ? JSON.parse(rawText) : {}; } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return jsonResponse({ error: "Invalid body" }, 400);
      }
      // Permitir ação no corpo caso o path seja genérico
      if ((!path || path === "reseller-api") && body.action) {
        path = body.action;
      }
    } else if (req.method !== "GET" || (path !== "status" && path !== "health")) {
       return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Bloqueia endpoints desconhecidos após processar body (para suportar action no body)
    if (!ALLOWED_ENDPOINTS.has(path)) {
      return jsonResponse({ error: `Endpoint not found: ${path}` }, 404);
    }

    let responseData: any = {};
    let status = 200;

    // Helper to log actions
    const logAction = async (action: string, metadata: any = {}, success = true, errorMsg?: string, tokensUsed = 0) => {
      await supabase.rpc("insert_api_log", {
        p_reseller_id: reseller.id,
        p_action: action,
        p_endpoint: path || action,
        p_tokens: tokensUsed,
        p_status: success ? "success" : "error",
        p_error: errorMsg,
        p_meta: metadata,
        p_ip: ip
      });
    };

    switch (path) {
      case "status":
        responseData = {
          email: reseller.email,
           tokens_7d: reseller.tokens_7d || 0,
           tokens_monthly: reseller.tokens_monthly || 0,
           tokens_annual: reseller.tokens_annual || 0,
           tokens_lifetime: reseller.tokens_lifetime || 0,
           tokens_daily: reseller.tokens_daily || 0,
          status: reseller.api_status,
          build: BUILD_VERSION
        };
        break;

       case "generate-trial":
         return jsonResponse({ error: "Trial system is decommissioned due to security maintenance." }, 403);
 
       case "generate-license": {
         const isLifetimeBody = body.lifetime === true;
         const isDailyBody = body.is_daily === true;
         const isFreeBody = body.is_free === true;

        // Validação e coerção de tipos para suportar inputs de formulários (strings)
        if (body.days !== undefined) {
          const daysNum = Number(body.days);
          if (isNaN(daysNum) || daysNum < 0 || daysNum > 100000) {
            return jsonResponse({ error: "days inválido" }, 400);
          }
          body.days = daysNum;
        }
        if (body.minutes !== undefined) {
          const minsNum = Number(body.minutes);
          if (isNaN(minsNum) || minsNum < 0 || minsNum > 100000) {
            return jsonResponse({ error: "minutes inválido" }, 400);
          }
          body.minutes = minsNum;
        }
        if (body.hours !== undefined) {
          const hoursNum = Number(body.hours);
          if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 100000) {
            return jsonResponse({ error: "hours inválido" }, 400);
          }
          body.hours = hoursNum;
        }
        if (body.max_sessions !== undefined) {
          const maxSessionsNum = Number(body.max_sessions);
          if (isNaN(maxSessionsNum) || maxSessionsNum < 1 || maxSessionsNum > 50) {
            return jsonResponse({ error: "max_sessions inválido" }, 400);
          }
          body.max_sessions = maxSessionsNum;
        }
        if (body.email !== undefined && body.email !== null && (typeof body.email !== "string" || body.email.length > 320)) {
          return jsonResponse({ error: "email inválido" }, 400);
        }
        if (body.phone !== undefined && body.phone !== null && (typeof body.phone !== "string" || body.phone.length > 30)) {
          return jsonResponse({ error: "phone inválido" }, 400);
        }
        if (body.display_name !== undefined && body.display_name !== null && (typeof body.display_name !== "string" || body.display_name.length > 200)) {
          return jsonResponse({ error: "display_name inválido" }, 400);
        }

        let days: number = 30;
        if (isLifetimeBody) {
          days = 99999;
        } else if (isFreeBody) {
          const mins = body.minutes || 30;
          days = Math.min(mins, 30) / 1440.0;
        } else if (isDailyBody) {
          days = body.days || 1;
        } else {
          days = body.days ?? (body.hours ? body.hours / 24 : 30);
        }

        const maxSessions = Math.max(1, body.max_sessions || 1);
        const userName = body.display_name || "Cliente API";

        // Determine token type and count for reporting
        let tokenType = "none (free test)";
        let tokensUsedCount = 0;

        if (isFreeBody || days <= 0.021) {
          tokenType = "free test";
          tokensUsedCount = 0;
        } else if (isDailyBody || (days >= 1 && days < 7)) {
          tokenType = "daily";
          tokensUsedCount = Math.ceil(days);
        } else if (days >= 9999) {
          tokenType = "lifetime";
          tokensUsedCount = 1;
        } else if (days >= 365) {
          tokenType = "annual";
          tokensUsedCount = 1;
        } else if (days >= 30) {
          tokenType = "monthly";
          tokensUsedCount = 1;
        } else if (days >= 7) {
          tokenType = "7d";
          tokensUsedCount = 1;
        }

        const randomStr = Math.random().toString(36).substring(2, 12).toUpperCase() + 
                          Math.random().toString(36).substring(2, 12).toUpperCase();
        
        const licenseKey = (isFreeBody || days <= 0.021) ? `HYPER-FREE-${randomStr.substring(0, 14)}` : `HYPER-${randomStr.substring(0, 20)}`;
        const isLifetime = (days >= 9999 || isLifetimeBody) && !isDailyBody;
        const expiresAt = isLifetime ? null : new Date(Date.now() + days * 86400000).toISOString();

        // Usar o RPC para garantir que a lógica de dedução e auditoria seja centralizada
        // e que as mensagens de erro do banco de dados (trigger) sejam capturadas.
        const { error: genError } = await supabase.rpc("create_license_with_token_service", {
          p_license_key: licenseKey,
          p_user_name: userName,
          p_client_email: body.email || null,
          p_client_phone: body.phone || null,
          p_duration_days: days,
          p_max_sessions: maxSessions,
          p_created_by: reseller.user_id,
          p_is_daily: isDailyBody
        });

        if (genError) {
          console.error("[reseller-api] generate-license error:", genError);
          const errorMsg = genError.message || "Erro desconhecido ao gerar licença";
          responseData = { error: errorMsg.includes("insuficientes") || errorMsg.includes("Trial") ? errorMsg : "Erro ao gerar licença" };
          status = (errorMsg.includes("insuficientes") || errorMsg.includes("Trial")) ? 403 : 400;
          await logAction(path, body, false, errorMsg, 0);
        } else {
          responseData = {
            success: true,
            license_key: licenseKey,
            expires_at: expiresAt,
             token_used: tokenType,
             tokens_count: tokensUsedCount
          };
          await logAction(path, { ...body, license_key: licenseKey, token_used: tokenType }, true, undefined, tokensUsedCount);
        }
        break;
      }

      case "get-license": {
        if (typeof body.license_key !== "string" || body.license_key.length < 8 || body.license_key.length > 100) {
          responseData = { error: "license_key is required" };
          status = 400;
          break;
        }
        const { data: license, error: getError } = await supabase
          .from("licenses")
          .select("id, license_key, user_name, status, created_at, expires_at, device_id, activated_at, duration_days, lifetime")
          .eq("license_key", body.license_key)
          .eq("created_by", reseller.user_id)
          .maybeSingle();

        if (getError) {
          console.error("[reseller-api] get-license error:", getError);
          responseData = { error: "Erro ao consultar licença" };
          status = 400;
        } else if (!license) {
          responseData = { error: "License not found or not owned by you" };
          status = 404;
        } else {
          responseData = { ...license, has_device: !!license.device_id };
        }
        break;
      }

      case "list-licenses": {
        const page = Math.max(1, Math.min(10000, parseInt(String(body.page || "1")) || 1));
        const limit = Math.min(100, Math.max(1, parseInt(String(body.limit || "50")) || 50));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data: licenses, error: listError, count } = await supabase
          .from("licenses")
          .select("id, license_key, user_name, status, created_at, expires_at, device_id, duration_days, lifetime", { count: "exact" })
          .eq("created_by", reseller.user_id)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (listError) {
          console.error("[reseller-api] list-licenses error:", listError);
          responseData = { error: "Erro ao listar licenças" };
          status = 400;
        } else {
          responseData = { 
            licenses: licenses?.map(l => ({ ...l, has_device: !!l.device_id })),
            pagination: { page, limit, total: count }
          };
        }
        break;
      }

      case "reset-hwid":
        if (typeof body.license_key !== "string" || body.license_key.length < 8 || body.license_key.length > 100) {
          responseData = { error: "license_key is required" };
          status = 400;
          break;
        }
        const { error: resetError } = await supabase
          .from("licenses")
          .update({ device_id: null })
          .eq("license_key", body.license_key)
          .eq("created_by", reseller.user_id);

        if (resetError) {
          console.error("[reseller-api] reset-hwid error:", resetError);
          responseData = { error: "Erro ao resetar dispositivo" };
          status = 400;
          await logAction("reset-hwid", body, false, resetError.message, 0);
        } else {
          responseData = { success: true };
          await logAction("reset-hwid", body, true, undefined, 0);
        }
        break;

      case "revoke-license":
        if (typeof body.license_key !== "string" || body.license_key.length < 8 || body.license_key.length > 100) {
          responseData = { error: "license_key is required" };
          status = 400;
          break;
        }
        const { error: revokeError } = await supabase
          .from("licenses")
          .update({ status: "revoked" })
          .eq("license_key", body.license_key)
          .eq("created_by", reseller.user_id);

        if (revokeError) {
          console.error("[reseller-api] revoke-license error:", revokeError);
          responseData = { error: "Erro ao revogar licença" };
          status = 400;
          await logAction("revoke-license", body, false, revokeError.message, 0);
        } else {
          responseData = { success: true };
          await logAction("revoke-license", body, true, undefined, 0);
        }
        break;

      case "delete-license":
        if (typeof body.license_key !== "string" || body.license_key.length < 8 || body.license_key.length > 100) {
          responseData = { error: "license_key is required" };
          status = 400;
          break;
        }
        const { error: delError } = await supabase
          .from("licenses")
          .delete()
          .eq("license_key", body.license_key)
          .eq("created_by", reseller.user_id)
          .or("status.eq.revoked,status.eq.expired");

        if (delError) {
          console.error("[reseller-api] delete-license error:", delError);
          responseData = { error: "Erro ao deletar licença" };
          status = 400;
          await logAction("delete-license", body, false, delError.message, 0);
        } else {
          responseData = { success: true };
          await logAction("delete-license", body, true, undefined, 0);
        }
        break;
    }

    return jsonResponse(responseData, status);
  } catch (error: any) {
    console.error("API Error:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
