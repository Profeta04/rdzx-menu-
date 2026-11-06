import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-license-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { license_key, device_id } = await req.json();
    const headerLicense = req.headers.get("x-license-key")?.trim();
    if (!license_key || !headerLicense || headerLicense !== license_key) {
      return new Response(JSON.stringify({ error: "Licença obrigatória" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: license } = await supabase
      .from("licenses")
      .select("user_id, status, device_id")
      .eq("license_key", license_key)
      .maybeSingle();

    if (!license || license.status !== "active") {
      return new Response(JSON.stringify({ error: "Licença inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    if (license.device_id) {
      if (!device_id || license.device_id !== device_id) {
        return new Response(JSON.stringify({ error: "Dispositivo não autorizado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
    }

    return new Response(JSON.stringify([{ user_id: license.user_id }]), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[get-license-user] error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});