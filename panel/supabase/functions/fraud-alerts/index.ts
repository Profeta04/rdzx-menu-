import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Janela de análise (minutos) e thresholds por tipo de evento
const WINDOW_MINUTES = 5;
const THRESHOLDS: Record<string, number> = {
  missing_device_id: 5,
  suspicious_device_id: 3,
};
// Cooldown entre alertas do mesmo tipo (minutos)
const COOLDOWN_MINUTES = 15;

async function sendTelegram(botToken: string, chatId: string, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      console.error("[fraud-alerts] telegram failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[fraud-alerts] telegram error", e);
    return false;
  }
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!botToken) {
      console.error("[fraud-alerts] TELEGRAM_BOT_TOKEN ausente");
      return new Response(JSON.stringify({ ok: false, error: "no_bot_token" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const now = new Date();
    const triggered: Array<{ event_type: string; count: number }> = [];

    // Carrega admins + cooldown states uma única vez em paralelo.
    const [{ data: admins }, { data: states }] = await Promise.all([
      supabase.from("admin_telegram").select("chat_id"),
      supabase
        .from("fraud_alert_state")
        .select("event_type, cooldown_until")
        .in("event_type", Object.keys(THRESHOLDS)),
    ]);
    const cooldownMap = new Map<string, string | null>();
    for (const s of states ?? []) cooldownMap.set(s.event_type, s.cooldown_until);

    // Processa cada tipo em paralelo.
    await Promise.all(Object.entries(THRESHOLDS).map(async ([eventType, threshold]) => {
      const cu = cooldownMap.get(eventType);
      if (cu && new Date(cu) > now) return;

      const [{ count, error: countErr }, sampleResp] = await Promise.all([
        supabase
          .from("fraud_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", eventType)
          .gte("created_at", since),
        supabase
          .from("fraud_events")
          .select("license_key, ip_address, endpoint, user_agent, created_at")
          .eq("event_type", eventType)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (countErr) {
        console.error("[fraud-alerts] count error", eventType, countErr);
        return;
      }
      const total = count ?? 0;
      if (total < threshold) return;
      const sample = sampleResp.data;

      const licenseSet = new Set<string>();
      const ipSet = new Set<string>();
      for (const e of sample ?? []) {
        if (e.license_key) licenseSet.add(e.license_key);
        if (e.ip_address) ipSet.add(e.ip_address);
      }

      const lines = [
        `🚨 <b>HyperBuild Fraud Alert</b>`,
        ``,
        `<b>Tipo:</b> <code>${eventType}</code>`,
        `<b>Volume:</b> ${total} eventos em ${WINDOW_MINUTES} min (limite: ${threshold})`,
        `<b>Licenças únicas (amostra):</b> ${licenseSet.size}`,
        `<b>IPs únicos (amostra):</b> ${ipSet.size}`,
      ];
      if (licenseSet.size > 0) {
        lines.push(``, `<b>Licenças:</b>`);
        for (const lk of licenseSet) lines.push(`• <code>${lk}</code>`);
      }
      if (ipSet.size > 0) {
        lines.push(``, `<b>IPs:</b>`);
        for (const ip of ipSet) lines.push(`• <code>${ip}</code>`);
      }
      lines.push(``, `<i>${now.toISOString()}</i>`);
      const text = lines.join("\n");

      // Envia telegrams + grava estado em paralelo.
      const cooldownUntil = new Date(Date.now() + COOLDOWN_MINUTES * 60_000).toISOString();
      await Promise.all([
        ...(admins ?? [])
          .filter((a) => !!a.chat_id)
          .map((a) => sendTelegram(botToken, a.chat_id as string, text)),
        supabase.from("fraud_alert_state").upsert({
          event_type: eventType,
          last_alert_at: now.toISOString(),
          last_count: total,
          cooldown_until: cooldownUntil,
          updated_at: now.toISOString(),
        }, { onConflict: "event_type" }),
      ]);

      triggered.push({ event_type: eventType, count: total });
    }));

    return new Response(JSON.stringify({ ok: true, triggered, window_minutes: WINDOW_MINUTES }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fraud-alerts] error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});