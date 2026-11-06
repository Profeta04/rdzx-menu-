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
    const licenseKey = req.headers.get("x-license-key")?.trim();
    const { device_id } = await req.json();

    if (!licenseKey) {
      return new Response(JSON.stringify({ error: "Licença obrigatória" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // HARD-VALIDATION
    const { data: license } = await supabase
      .from("licenses")
      .select("status, device_id, created_by")
      .eq("license_key", licenseKey)
      .single();

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

    // Only return role for the license owner — never accept arbitrary user_id from caller
    if (!license.created_by) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", license.created_by);

    if (error) {
      console.error("[get-user-role] db error:", error);
      return new Response(JSON.stringify({ error: "Erro interno" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[get-user-role] error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
