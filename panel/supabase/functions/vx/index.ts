import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getClientIp,
  isRateLimitedByIp,
  validateExtensionRequest,
  logFraud,
  isValidString,
  isBanned,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Helpers locais — escrevem em fire-and-forget para não bloquear o hot-path.
  const recordAttempt = (
    supabase: any,
    payload: { license_key?: string | null; device_id?: string | null; ip: string | null; user_agent: string | null; success: boolean; reason?: string | null },
  ) => {
    try {
      supabase.from("license_validation_attempts").insert({
        license_key: payload.license_key ?? null,
        device_id: payload.device_id ?? null,
        ip_address: payload.ip ?? null,
        user_agent: payload.user_agent ?? null,
        success: payload.success,
        reason: payload.reason ?? null,
      }).then(() => {}, () => {});
    } catch { /* ignore */ }
  };

  const recordHeartbeat = (
    supabase: any,
    payload: { device_id?: string | null; license_key?: string | null; ip: string | null; user_agent: string | null },
  ) => {
    if (!payload.device_id) return;
    try {
      supabase.from("heartbeats").upsert(
        {
          device_id: String(payload.device_id).slice(0, 200),
          license_key: payload.license_key ? String(payload.license_key).slice(0, 120) : null,
          ip_address: payload.ip,
          user_agent: payload.user_agent,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      ).then(() => {}, () => {});
    } catch { /* ignore */ }
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Hard ban check (security_bans) — corta IPs/HWIDs conhecidos antes de qualquer trabalho.
    const banCheck = await isBanned(supabase, { ip });
    if (banCheck.banned) {
      return jsonResponse({
        valid: false,
        message: "Acesso negado.",
        reason: "banned",
      }, 403);
    }

    // Rate limit por IP — protege contra brute force de licenças
    if (await isRateLimitedByIp(supabase, ip, "validate_license", 30, 1)) {
      return jsonResponse({
        valid: false,
        message: "Muitas tentativas em curto período. Aguarde 1 minuto e tente novamente.",
        reason: "rate_limited",
      }, 429);
    }

    const rawText = await req.text();
    if (rawText.length > 64 * 1024) return genericError(413, "Payload muito grande");

    const ext = await validateExtensionRequest(supabase, req, rawText);
    if (ext) return ext;

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawText); } catch { return jsonResponse({ valid: false, message: "JSON inválido" }, 400); }

    const allowedFields = new Set(["license_key", "device_id", "session_id", "heartbeat"]);
    const unknownFields = Object.keys(body).filter((k) => !allowedFields.has(k));
    if (unknownFields.length > 0) {
      return jsonResponse({ valid: false, message: "Payload inválido" }, 400);
    }

    const { license_key, device_id, session_id, heartbeat } = body as any;

    // Block specific suspicious keys with custom message
    const suspiciousKeys = ["HYPER-SKU76ELMIZRFKBHMHDR9", "HYPER-7X741ESCWS3KTH6IN4RI"];
    if (typeof license_key === "string" && suspiciousKeys.includes(license_key)) {
      await logFraud(supabase, {
        event_type: "blacklisted_key",
        severity: "error",
        license_key, device_id, ip, user_agent: userAgent, endpoint: "/vx",
      });
      return jsonResponse({
        valid: false, 
        message: "Você está tentando entrar com uma extensão não oficial. Contate: 11 94889-6514 para adquirir a extensão oficial"
      }, 200);
    }

    if (!isValidString(license_key, 8, 100)) {
      return jsonResponse({
        valid: false,
        message: "Informe sua chave de licença para continuar.",
        reason: "missing_key",
      }, 200);
    }
    if (device_id !== undefined && device_id !== null && !isValidString(device_id, 32, 256)) {
      await logFraud(supabase, {
        event_type: "suspicious_device_id",
        severity: "warn",
        license_key, ip, user_agent: userAgent, endpoint: "/vx",
      });
      return jsonResponse({ valid: false, message: "Dispositivo não reconhecido. Use a extensão oficial." }, 200);
    }
    if (session_id !== undefined && session_id !== null && !isValidString(session_id, 8, 128)) {
      return jsonResponse({ valid: false, message: "session_id inválido" }, 200);
    }

    // Find the license — projeção de colunas (evita SELECT *).
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select(
        "id, status, device_id, max_sessions, expires_at, activated_at, user_name, last_device_change, device_change_count, device_history, force_logout_at",
      )
      .eq("license_key", license_key)
      .single();

    if (licenseError || !license) {
      await logFraud(supabase, {
        event_type: "license_not_found",
        severity: "info",
        license_key, ip, user_agent: userAgent, endpoint: "/vx",
      });
      return jsonResponse({
        valid: false,
        message: "Licença não encontrada. Verifique se digitou a chave corretamente.",
        reason: "not_found",
      }, 200);
    }

    // Check if revoked
    if (license.status === "revoked") {
      return jsonResponse({
        valid: false,
        message: "Esta licença foi bloqueada. Entre em contato com o suporte para mais informações.",
        reason: "revoked",
      }, 200);
    }

    // Check expiration
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
      const expDate = new Date(license.expires_at).toLocaleDateString("pt-BR");
      return jsonResponse({
        valid: false,
        message: `Sua licença expirou em ${expDate}. Renove para continuar utilizando a extensão.`,
        reason: "expired",
      }, 200);
    }

    let existingSession: any = null;
    if (heartbeat) {
      if (!session_id) {
        return jsonResponse({
          valid: false,
          message: "Sessão inválida. Faça login novamente.",
          reason: "device_conflict",
        }, 200);
      }

      const { data: sessionRow } = await supabase
        .from("sessions")
        .select("id, is_revoked, last_heartbeat")
        .eq("session_id", session_id)
        .eq("license_id", license.id)
        .maybeSingle();

      existingSession = sessionRow;

      if (!existingSession || existingSession.is_revoked) {
        await logFraud(supabase, {
          event_type: "revoked_or_missing_session_heartbeat",
          severity: "info",
          license_key, device_id, ip, user_agent: userAgent, endpoint: "/vx",
          details: { has_session: Boolean(existingSession), is_revoked: Boolean(existingSession?.is_revoked) },
        });
        return jsonResponse({
          valid: false,
          message: "Sua sessão foi encerrada por segurança. Faça login novamente.",
          reason: "device_conflict",
        }, 200);
      }
    }

    // --- HARDWARE LOCK com TAKEOVER automático ---
    // Regra: a licença pode rodar em apenas 1 dispositivo por vez, porém o
    // último login sempre vence. O dispositivo anterior é desconectado.
    // Evitamos ping-pong com um cooldown curto baseado em last_device_change.
    let didTakeover = false;
    if (license.device_id && device_id && license.device_id !== device_id) {
      // AUTO-LOGOUT: heartbeats vindos do dispositivo antigo NUNCA fazem takeover.
      // Apenas validações de login (heartbeat=false) podem assumir a licença.
      if (heartbeat) {
        await logFraud(supabase, {
          event_type: "device_conflict_heartbeat",
          severity: "info",
          license_key, device_id, ip, user_agent: userAgent, endpoint: "/vx",
          details: { current_device: license.device_id },
        });
        return jsonResponse({
          valid: false,
          reason: "device_conflict",
          message: "Sua licença foi acessada em outro dispositivo. Você foi desconectado por segurança.",
        }, 200);
      }

      const lastChange = license.last_device_change ? new Date(license.last_device_change).getTime() : 0;
      const elapsedMs = Date.now() - lastChange;
      const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos entre takeovers por licença

      if (lastChange && elapsedMs < COOLDOWN_MS) {
        // Outro dispositivo acabou de assumir — provavelmente uso simultâneo
        await logFraud(supabase, {
          event_type: "hwid_takeover_blocked",
          severity: "warn",
          license_key, device_id, ip, user_agent: userAgent, endpoint: "/vx",
          details: { previous_device: license.device_id, seconds_since_change: Math.floor(elapsedMs / 1000) },
        });
        const remainingMs = COOLDOWN_MS - elapsedMs;
        const remainingMin = Math.floor(remainingMs / 60000);
        const remainingSec = Math.ceil((remainingMs % 60000) / 1000);
        const waitLabel = remainingMin > 0
          ? `${remainingMin}min${remainingSec > 0 ? ` ${remainingSec}s` : ""}`
          : `${remainingSec}s`;
        return jsonResponse({
          valid: false,
          message: `Esta licença já foi transferida para outro dispositivo recentemente. Por segurança, só é permitido 1 takeover a cada 10 minutos. Aguarde ${waitLabel} e tente novamente.`,
          reason: "takeover_cooldown",
          retry_after_seconds: Math.ceil(remainingMs / 1000),
        }, 200);
      }

      // Realiza o takeover: o novo dispositivo passa a ser o dono ativo
      const previousDeviceId = license.device_id;
      const history = Array.isArray(license.device_history) ? license.device_history : [];
      history.unshift({
        device_id: previousDeviceId,
        replaced_at: new Date().toISOString(),
        replaced_by: device_id,
        ip,
      });

      await supabase
        .from("licenses")
        .update({
          device_id,
          activated_at: new Date().toISOString(),
          last_device_change: new Date().toISOString(),
          device_change_count: (license.device_change_count || 0) + 1,
          device_history: history.slice(0, 20),
          last_ip: ip,
          status: "active",
          updated_at: new Date().toISOString(),
          force_logout_at: null,
        })
        .eq("id", license.id);

      // Revoga todas as sessões do dispositivo anterior — o cliente antigo
      // receberá device_conflict no próximo heartbeat e fará logout.
      await supabase
        .from("sessions")
        .update({ is_active: false, is_revoked: true })
        .eq("license_id", license.id)
        .eq("is_active", true);

      await logFraud(supabase, {
        event_type: "hwid_takeover",
        severity: "info",
        license_key, device_id, ip, user_agent: userAgent, endpoint: "/vx",
        details: { previous_device: previousDeviceId },
      });

      didTakeover = true;
      // Atualiza o objeto em memória para o restante do fluxo
      license.device_id = device_id;
    } else if (license.device_id && !device_id) {
      // Cliente sem device_id em licença travada — bloqueia
      await logFraud(supabase, {
        event_type: "hwid_missing",
        severity: "warn",
        license_key, ip, user_agent: userAgent, endpoint: "/vx",
      });
      return jsonResponse({
        valid: false,
        message: "Não foi possível identificar este dispositivo. Recarregue a página (Ctrl+Shift+R) e tente novamente.",
        reason: "device_unknown",
      }, 200);
    } else if (device_id && !heartbeat) {
      // First activation: bind permanently
      const { error: updateError } = await supabase
        .from("licenses")
        .update({ 
          device_id, 
          activated_at: new Date().toISOString(),
          status: 'active',
          force_logout_at: null,
        })
        .eq("id", license.id);
      
      if (updateError) {
        console.error("[HW-LOCK] Failed to bind device:", updateError);
      } else {
        console.log(`[HW-LOCK] License ${license_key} bound to device ${device_id}`);
      }
    }
    // --- END HARDWARE LOCK ---

    // Limpeza de sessões antigas foi movida para cron (cleanup-stale-sessions-2min).
    // No hot-path apenas debounce do heartbeat para reduzir escritas.
    if (heartbeat && session_id && existingSession) {
      const lastHeartbeat = new Date(existingSession.last_heartbeat).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((now - lastHeartbeat) / 1000));

      // Debounce: se o último heartbeat foi há menos de 90s, apenas atualiza o
      // timestamp (1 UPDATE) e pula o RPC de editing_time + creação de sessão.
      if (diffSeconds < 90) {
        await supabase
          .from("sessions")
          .update({ last_heartbeat: new Date().toISOString() })
          .eq("id", existingSession.id);
        recordHeartbeat(supabase, { device_id, license_key, ip, user_agent: userAgent });
        return jsonResponse({
          valid: true,
          session_id,
          user_name: license.user_name,
          expires_at: license.expires_at,
          activated_at: license.activated_at,
          status: license.status,
          takeover: false,
        }, 200);
      }

      if (diffSeconds > 0 && diffSeconds < 300) {
        await supabase.rpc('increment_license_editing_time', {
          l_key: license_key,
          seconds: diffSeconds,
        });
      }

      await supabase
        .from("sessions")
        .update({ last_heartbeat: new Date().toISOString(), is_active: true })
        .eq("id", existingSession.id);
    }

    // Create new session if needed
    let currentSessionId = session_id;
    if (!session_id) {
      currentSessionId = crypto.randomUUID();

      // Check active session count
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("license_id", license.id)
        .eq("is_active", true);

      if ((count || 0) >= license.max_sessions) {
        // Deactivate oldest session
        const { data: oldest } = await supabase
          .from("sessions")
          .select("id")
          .eq("license_id", license.id)
          .eq("is_active", true)
          .order("last_heartbeat", { ascending: true })
          .limit(1);

        if (oldest && oldest.length > 0) {
          await supabase.from("sessions").update({ is_active: false }).eq("id", oldest[0].id);
        }
      }

      await supabase.from("sessions").insert({
        license_id: license.id,
        session_id: currentSessionId,
        device_id: device_id || null,
        last_heartbeat: new Date().toISOString(),
        is_active: true,
      });
    }

    // Count online sessions (apenas no caminho de validação inicial — heartbeats
    // debounçados já retornaram antes).
    const { count: onlineCount } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("license_id", license.id)
      .eq("is_active", true);

    const successMessage = didTakeover
      ? "Licença transferida para este dispositivo. O acesso no outro computador foi encerrado automaticamente."
      : "Licença validada com sucesso!";

    recordAttempt(supabase, { license_key, device_id, ip, user_agent: userAgent, success: true, reason: didTakeover ? "takeover" : "ok" });
    recordHeartbeat(supabase, { device_id, license_key, ip, user_agent: userAgent });

    return jsonResponse({
      valid: true,
      session_id: currentSessionId,
      user_name: license.user_name,
      expires_at: license.expires_at,
      activated_at: license.activated_at,
      status: license.status,
      online_count: onlineCount || 0,
      takeover: didTakeover,
      message: successMessage,
    }, 200);
  } catch (error) {
    console.error("validate-license error:", error);
    return jsonResponse({ valid: false, message: "Erro interno do servidor" }, 500);
  }
});
