import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * reseller-login
 *
 * Fluxo seguro de login do revendedor:
 * 1. Recebe { email, license_key } do Painel do Revendedor.
 * 2. Valida o par na tabela `resellers`.
 * 3. Garante que existe um usuário em `auth.users` para esse e-mail
 *    (cria com senha = license_key se não existir, ou atualiza a senha
 *    se já existir mas a senha não corresponde).
 * 4. Vincula o `user_id` ao registro do reseller (caso ainda não vinculado).
 * 5. Retorna sucesso para o client fazer signInWithPassword(email, license_key).
 *
 * Toda lógica sensível (criação de usuário, vínculo, service role) fica no servidor.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, license_key } = await req.json();

    if (!email || !license_key) {
      return new Response(
        JSON.stringify({ success: false, message: "E-mail e chave são obrigatórios." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedKey = String(license_key).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Verifica reseller na tabela
    const { data: reseller, error: resellerErr } = await admin
      .from("resellers")
      .select("id, user_id, email, license_key")
      .ilike("email", normalizedEmail)
      .eq("license_key", normalizedKey)
      .maybeSingle();

    if (resellerErr) {
      console.error("[reseller-login] db error:", resellerErr);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao consultar revendedor." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!reseller) {
      return new Response(
        JSON.stringify({ success: false, message: "E-mail ou chave inválidos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 2. Garante que existe um usuário em auth.users com essa senha
    let userId: string | null = reseller.user_id;

    // Procura usuário existente pelo e-mail
    const { data: usersList, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      console.error("[reseller-login] listUsers error:", listErr);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao verificar usuário." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const existing = usersList.users.find(
      (u) => (u.email || "").toLowerCase() === normalizedEmail
    );

    if (existing) {
      userId = existing.id;
      // Always derive password from the license key — never accept caller-supplied password
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password: normalizedKey,
        email_confirm: true,
      });
      if (updErr) {
        console.error("[reseller-login] updateUserById error:", updErr);
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: normalizedKey,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        console.error("[reseller-login] createUser error:", createErr);
        return new Response(
          JSON.stringify({ success: false, message: "Erro ao criar conta de acesso." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      userId = created.user.id;
    }

    // 3. Garante que existe um perfil (FK do resellers.user_id -> profiles.id)
    if (userId) {
      await admin
        .from("profiles")
        .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
    }

    // 4. Vincula reseller ao user_id se ainda não vinculado
    if (userId && reseller.user_id !== userId) {
      const { error: linkErr } = await admin
        .from("resellers")
        .update({ user_id: userId })
        .eq("id", reseller.id);
      if (linkErr) {
        console.error("[reseller-login] link error:", linkErr);
      }
    }

    // 5. Garante que o usuário tem a role 'reseller'
    if (userId) {
      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "reseller" },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );
      if (roleErr) {
        console.error("[reseller-login] role error:", roleErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Credenciais válidas. Iniciando sessão...",
        email: normalizedEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("[reseller-login] unexpected:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno do servidor." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
