import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectPromptInjection } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-license-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const licenseKey = req.headers.get("x-license-key") || "";
    const { prompt, device_id } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "Prompt muito longo (máx. 4000 caracteres)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Anti prompt-injection: bloqueia clones que enviam payloads de sequestro
    const injection = detectPromptInjection(prompt);
    if (injection.matched) {
      console.error(`[op] prompt_injection_detected license=${licenseKey} pattern=${injection.pattern} sample=${injection.sample}`);
      return new Response(JSON.stringify({ error: "Conteúdo do prompt rejeitado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate license
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!licenseKey) {
      return new Response(JSON.stringify({ error: "Licença obrigatória" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { data: license } = await supabase
      .from("licenses")
      .select("status, device_id")
      .eq("license_key", licenseKey)
      .single();

    if (!license) {
      return new Response(JSON.stringify({ error: "Licença inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    if (license.status !== 'active') {
      return new Response(JSON.stringify({ error: `Licença com status: ${license.status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // HARD-VALIDATION: Anti-Piracy / Hardware Lock
    if (device_id && device_id.length < 32) {
      console.error(`[HARD-VALIDATION] Suspicious device_id: ${device_id}`);
      return new Response(JSON.stringify({ error: "Dispositivo não reconhecido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    if (license.device_id) {
      if (!device_id || license.device_id !== device_id) {
        return new Response(JSON.stringify({ error: "Licença em uso em outro dispositivo" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
    }

    // Use Groq or OpenAI API to optimize the prompt
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!groqKey && !openaiKey) {
      // Fallback: simple optimization without AI
      const optimized = `Você é um desenvolvedor web especialista. ${prompt}\n\nRequisitos:\n- Código limpo e bem estruturado\n- Tratamento de erros adequado\n- Responsivo e acessível\n- Seguir boas práticas`;
      
      return new Response(JSON.stringify({ optimized_prompt: optimized }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let response;
    if (groqKey) {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em otimização de prompts para desenvolvimento web com Lovable. Receba o prompt do usuário e retorne uma versão aprimorada, mais detalhada e eficaz. Mantenha o idioma original. Retorne APENAS o prompt otimizado, sem explicações."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
    } else {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em otimização de prompts para desenvolvimento web com Lovable. Receba o prompt do usuário e retorne uma versão aprimorada, mais detalhada e eficaz. Mantenha o idioma original. Retorne APENAS o prompt otimizado, sem explicações."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
    }

    const data = await response.json();
    const optimized = data.choices?.[0]?.message?.content || prompt;

    return new Response(JSON.stringify({ optimized_prompt: optimized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("optimize-prompt error:", error);
    return new Response(JSON.stringify({ error: "Erro ao otimizar prompt" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});