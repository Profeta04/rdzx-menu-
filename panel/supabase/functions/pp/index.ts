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
    if (!licenseKey) {
      return new Response(JSON.stringify({ success: false, error: "Licença obrigatória" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = await req.json();
    console.log("Receiving payment data:", body);

    const {
      customer_name, 
      customer_number, 
      customer_email, 
      plan_name,
      device_id,
      // Supporting old format just in case
      packageId,
      numero,
      metodo
    } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // HARD-VALIDATION
    const { data: license } = await supabase
      .from("licenses")
      .select("status, device_id")
      .eq("license_key", licenseKey)
      .maybeSingle();
    if (!license || license.status !== "active") {
      return new Response(JSON.stringify({ success: false, error: "Licença inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
      });
    }
    if (license.device_id) {
      if (!device_id || license.device_id !== device_id) {
        return new Response(JSON.stringify({ success: false, error: "Dispositivo não autorizado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
        });
      }
    }

    // Prepare the data for insertion
    const paymentData = {
      customer_name: customer_name || "Cliente",
      customer_number: customer_number || numero || "Não informado",
      customer_email: customer_email || "Não informado",
      plan_name: plan_name || packageId || "Plano",
      payment_status: "pending",
      license_key: licenseKey,
    };

    const { data, error } = await supabase
      .from("payments")
      .insert([paymentData])
      .select();

    if (error) {
      console.error("Error inserting payment:", error);
      return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Pagamento registrado.",
      data: data[0]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[process-payment] error:", error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});