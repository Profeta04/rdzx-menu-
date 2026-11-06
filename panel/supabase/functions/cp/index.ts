import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, jsonResponse, genericError, getClientIp,
  isRateLimitedByIp, validateExtensionRequest, isValidString, isBanned,
} from "../_shared/security.ts";
import {
  assertAllowedUpstream, buildRotatedHeaders, fetchWithRetry,
  mapLovableError, maskToken,
} from "../_shared/lovable.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405, "Method not allowed");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const ip = getClientIp(req);

    const banCheck = await isBanned(supabase, { ip });
    if (banCheck.banned) return genericError(403, "Acesso negado");

    if (await isRateLimitedByIp(supabase, ip, "create_project", 10, 1)) {
      return genericError(429, "Muitas requisições. Aguarde alguns segundos.");
    }

    const rawText = await req.text();
    if (rawText.length > 64 * 1024) return genericError(413, "Payload muito grande");

    const ext = await validateExtensionRequest(supabase, req, rawText);
    if (ext) return ext;

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawText); } catch { return genericError(400, "JSON inválido"); }

    const allowed = new Set([
      "license_key",
      "device_id",
      "token_lovable",
      "workspace_id",
      "name",
      "nome",
      "castle_request_token",
      "browser_session_id",
      "client_git_sha",
      "validate_only",
    ]);
    const unknown = Object.keys(body).filter((k) => !allowed.has(k));
    if (unknown.length) return genericError(400, "Campos inválidos no payload");

    const licenseKey = req.headers.get("x-license-key")?.trim() || (body.license_key as string);
    const token_lovable = body.token_lovable as string;
    const workspace_id = body.workspace_id as string | undefined;
    const device_id = body.device_id as string | undefined;
    const validate_only = body.validate_only === true;
    const castle_request_token = (body.castle_request_token as string | undefined)?.trim();
    const browser_session_id = (body.browser_session_id as string | undefined)?.trim();
    const client_git_sha = (body.client_git_sha as string | undefined)?.trim();
    let name = (body.name || body.nome) as string | undefined;

    if (!licenseKey) return genericError(403, "Licença obrigatória");

    // License validation
    const { data: license } = await supabase
      .from("licenses")
      .select("status, device_id")
      .eq("license_key", licenseKey)
      .maybeSingle();
    if (!license || license.status !== "active") return genericError(403, "Licença inválida");
    if (license.device_id && device_id && license.device_id !== device_id) {
      return genericError(403, "Dispositivo não autorizado");
    }

    // Lightweight license validation only — used by the extension before delegating
    // the actual project creation to the user's browser (so Castle.io fingerprint
    // matches the real client IP/UA/cookies).
    if (validate_only) {
      return jsonResponse({ success: true, validated: true }, 200);
    }

    // Token: accept from body (legacy compat) or env fallback
    const envToken = Deno.env.get("LOVABLE_API_KEY");
    const activeToken = token_lovable || envToken;
    if (!activeToken) return genericError(400, "Token Lovable necessário");

    const bearer = activeToken.startsWith("Bearer ") ? activeToken.slice(7) : activeToken;
    const upstreamHeaders: Record<string, string> = buildRotatedHeaders(bearer);
    if (browser_session_id) upstreamHeaders["X-Browser-Session-ID"] = browser_session_id;
    if (client_git_sha) upstreamHeaders["X-Client-Git-SHA"] = client_git_sha;

    // Random name fallback
    if (!name) {
      const adj = ["Epic","Hyper","Elite","Swift","Ultra","Mega","Alpha","Super","Prime","Dynamic"];
      const noun = ["Build","App","Project","System","Flow","Core","Hub","Lab","Space","Nova"];
      name = adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)] + "-" + Math.random().toString(36).substring(2,6).toUpperCase();
    }

    // Resolve workspace
    let wsId = workspace_id;
    if (!wsId) {
      const wsUrl = "https://api.lovable.dev/user/workspaces";
      assertAllowedUpstream(wsUrl, "lovable");
      const wsResp = await fetchWithRetry(wsUrl, { method: "GET", headers: upstreamHeaders }, 3);
      if (!wsResp.ok) {
        const errText = await wsResp.text();
        return jsonResponse(mapLovableError(wsResp.status, errText), wsResp.status >= 500 ? 502 : wsResp.status);
      }
      const wsData = await wsResp.json();
      wsId = Array.isArray(wsData) ? wsData[0]?.id : (wsData?.id || wsData?.workspaces?.[0]?.id);
    }
    if (!wsId) return genericError(400, "Nenhum workspace encontrado");

    // Create project — Lovable now requires a Castle.io request token captured from
    // the user's lovable.dev session for bot detection (HTTP 403 without it).
    const createUrl = `https://api.lovable.dev/workspaces/${wsId}/projects`;
    assertAllowedUpstream(createUrl, "lovable");
    const createBody: Record<string, unknown> = { name };
    if (castle_request_token) createBody.castle_request_token = castle_request_token;
    const createResp = await fetchWithRetry(createUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(createBody),
    }, 3);

    const projectText = await createResp.text();
    console.log(`[cp] event=upstream status=${createResp.status} license=${maskToken(licenseKey)} workspace=${wsId}`);

    if (!createResp.ok) {
      const mapped = mapLovableError(createResp.status, projectText);
      return jsonResponse({ success: false, ...mapped }, createResp.status >= 500 ? 502 : createResp.status);
    }

    let projectData: unknown;
    try { projectData = JSON.parse(projectText); } catch { projectData = { raw: projectText }; }

    return jsonResponse({ success: true, project: projectData }, 200);
  } catch (error) {
    console.error("[cp] error:", (error as Error).message);
    return genericError(500, "Erro interno");
  }
});