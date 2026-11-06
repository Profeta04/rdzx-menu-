import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { license_key = null, device_id, version = null, url = null, metadata = {} } = body || {};

    if (!device_id || typeof device_id !== "string") {
      return new Response(JSON.stringify({ error: "device_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Upsert: incrementa pings, atualiza last_seen e metadados leves
    const { data: existing } = await supabase
      .from("heartbeats")
      .select("device_id, pings_today, pings_total, last_seen")
      .eq("device_id", device_id)
      .maybeSingle();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastSeenIsToday = existing?.last_seen && new Date(existing.last_seen) >= startOfToday;

    const payload = {
      device_id: String(device_id).slice(0, 200),
      license_key: license_key ? String(license_key).slice(0, 120) : null,
      version: version ? String(version).slice(0, 40) : null,
      url: url ? String(url).slice(0, 500) : null,
      user_agent: ua,
      ip_address: ip,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      pings_today: existing ? (lastSeenIsToday ? (existing.pings_today || 0) + 1 : 1) : 1,
      pings_total: existing ? (existing.pings_total || 0) + 1 : 1,
      last_seen: now.toISOString(),
    };

    const { error } = await supabase.from("heartbeats").upsert(payload, { onConflict: "device_id" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});