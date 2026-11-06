// Bulk admin operations on licenses (revoke / delete / extend / force-logout)
// Auth: requires admin JWT + recent OTP token (admin_otp_codes).
// Every action is recorded in admin_audit_log via DB triggers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "revoke" | "delete" | "extend_days" | "force_logout";

interface Body {
  action: Action;
  license_ids: string[];
  days?: number; // for extend_days
}

const MAX_IDS = 500;

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "Método não permitido");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return bad(401, "Token ausente");

  // 1) Validate caller is admin
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return bad(401, "Não autenticado");
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return bad(403, "Acesso negado: admin requerido");

  // 2) Validate recent OTP (last 5 minutes) — defense-in-depth for destructive ops
  const { data: otpRow } = await admin
    .from("admin_otp_codes")
    .select("id, created_at, used")
    .eq("user_id", userId).eq("used", true)
    .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!otpRow) return bad(403, "Sessão sensível expirada. Reautentique com OTP nos últimos 5 minutos.");

  // 3) Parse + validate body
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return bad(400, "JSON inválido"); }
  if (!body?.action || !Array.isArray(body.license_ids) || body.license_ids.length === 0) {
    return bad(400, "Parâmetros inválidos");
  }
  if (body.license_ids.length > MAX_IDS) return bad(400, `Limite de ${MAX_IDS} licenças por chamada`);
  for (const id of body.license_ids) {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return bad(400, `UUID inválido: ${id}`);
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  switch (body.action) {
    case "revoke": {
      const { error } = await admin.from("licenses")
        .update({ status: "revoked", active: false, updated_at: new Date().toISOString() })
        .in("id", body.license_ids);
      if (error) return bad(500, error.message);
      for (const id of body.license_ids) results.push({ id, ok: true });
      break;
    }
    case "delete": {
      const { error } = await admin.from("licenses").delete().in("id", body.license_ids);
      if (error) return bad(500, error.message);
      for (const id of body.license_ids) results.push({ id, ok: true });
      break;
    }
    case "force_logout": {
      // Paraleliza em chunks de 50 para evitar burst sem limite no DB.
      const chunkSize = 50;
      for (let i = 0; i < body.license_ids.length; i += chunkSize) {
        const chunk = body.license_ids.slice(i, i + chunkSize);
        const settled = await Promise.all(
          chunk.map(async (id) => {
            const { error } = await admin.rpc("force_remote_logout", { p_license_id: id });
            return { id, ok: !error, error: error?.message };
          }),
        );
        results.push(...settled);
      }
      break;
    }
    case "extend_days": {
      const days = Number(body.days);
      if (!Number.isFinite(days) || days <= 0 || days > 3650) return bad(400, "Days inválido");
      const { data: rows, error } = await admin.from("licenses")
        .select("id, expires_at, lifetime").in("id", body.license_ids);
      if (error) return bad(500, error.message);
      // Paraleliza updates em chunks de 50.
      const updatable = (rows || []).filter((r) => {
        if (r.lifetime) { results.push({ id: r.id, ok: false, error: "lifetime" }); return false; }
        return true;
      });
      const chunkSize = 50;
      for (let i = 0; i < updatable.length; i += chunkSize) {
        const chunk = updatable.slice(i, i + chunkSize);
        const settled = await Promise.all(
          chunk.map(async (r) => {
            const base = r.expires_at ? new Date(r.expires_at) : new Date();
            const next = new Date(base.getTime() + days * 86400_000);
            const { error: uErr } = await admin.from("licenses")
              .update({ expires_at: next.toISOString(), status: "active", updated_at: new Date().toISOString() })
              .eq("id", r.id);
            return { id: r.id, ok: !uErr, error: uErr?.message };
          }),
        );
        results.push(...settled);
      }
      break;
    }
    default:
      return bad(400, "Ação desconhecida");
  }

  // 4) Manual audit (covers cases where trigger diff lacks context)
  await admin.from("admin_audit_log").insert({
    admin_user_id: userId,
    admin_email: userData.user.email,
    action: `BULK_${body.action.toUpperCase()}`,
    target_table: "licenses",
    target_id: body.license_ids.join(","),
    diff: { count: body.license_ids.length, days: body.days, results },
    ip_address: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
