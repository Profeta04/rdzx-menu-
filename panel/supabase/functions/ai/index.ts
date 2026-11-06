import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  corsHeaders,
  getClientIp,
  isRateLimitedByIp,
  isRateLimitedByLicense,
  jsonResponse,
} from "../_shared/security.ts";

// =========================================================================
// Hyper RB · Edge Function /ai
// -------------------------------------------------------------------------
// Proxy seguro para o Lovable AI Gateway. NUNCA é chamado direto pelo
// frontend — o background da extensão faz a chamada após sanitizar o
// payload (Bearer/Cookie/license_key mascarados em burp_ai_client.js).
//
// Ações suportadas (Fase 2):
//   - explain_lovable_request : explica em PT-BR uma request capturada
//                               (método, propósito, headers chave, riscos)
//
// Segurança:
//   - Rate limit por IP (30 req/min) via RPC check_rate_limit_ip
//   - Rate limit por license key (60 req/min)
//   - Requer x-license-key válida e ativa
//   - Payload máximo 32 KB (já sanitizado pelo client)
//   - Whitelist de campos no body
//   - System prompt fixo server-side (não trustamos prompt do client)
//   - Resposta truncada para 4 KB
// =========================================================================

const MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_RESPONSE_CHARS = 4000;
const RATE_LIMIT_PER_MIN = 30;
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const ALLOWED_ACTIONS = new Set([
  "explain_lovable_request",
  "convert_to_composer_recipe",
  "analyze_network_traffic",
  "suggest_mutations",
  "diagnose_failed_replay",
  "classify_action_ptbr",
]);

const SYSTEM_PROMPTS: Record<string, string> = {
  explain_lovable_request: [
    "Você é um engenheiro sênior especialista em API reverse-engineering da plataforma Lovable.",
    "Sua tarefa: analisar UMA request HTTP capturada e explicar em PT-BR, de forma objetiva, técnica e curta:",
    "  1. Qual endpoint é (rota interna Lovable, edge function Supabase, asset, etc).",
    "  2. O que ela faz no fluxo da Lovable (criar projeto, chat, upload, websocket etc).",
    "  3. Headers/body relevantes (sem repetir valores mascarados).",
    "  4. Riscos/observações (rate-limit conhecido, retry, idempotência, anti-bot).",
    "Responda em markdown enxuto, no máximo 12 linhas. Não invente endpoints que você não viu.",
    "Os campos sensíveis (Bearer, Cookie, license_key) já vêm mascarados como '***' — não tente decodificar.",
  ].join("\n"),
  convert_to_composer_recipe: [
    "Você converte UMA request HTTP capturada em um 'preset' editável para o Composer da extensão Hyper RB.",
    "Regras CRÍTICAS:",
    " - Substitua valores sensíveis por placeholders padronizados:",
    "     license_key            => {{LICENSE_KEY}}",
    "     device_id              => {{DEVICE_ID}}",
    "     session_id             => {{SESSION_ID}}",
    "     lovable_token / Bearer => {{LOVABLE_TOKEN}}",
    "     projeto_id / project_id (path ou body) => {{PROJECT_ID}}",
    "     workspace_id           => {{WORKSPACE_ID}}",
    " - Remova headers: Authorization, Cookie, Set-Cookie, X-Api-Key, ApiKey (serão injetados em runtime).",
    " - Preserve Content-Type e headers funcionais.",
    " - NÃO invente campos. Use apenas o que existe no body original.",
    " - Se a URL tiver um ID de projeto, substitua por {{PROJECT_ID}}.",
    " - 'name' deve ser curto (≤ 60 chars) descrevendo a ação em PT-BR.",
    " - 'description' deve ser uma frase em PT-BR explicando o uso.",
    "Responda EXCLUSIVAMENTE chamando a função suggest_recipe. Nada de markdown, nada de texto extra.",
  ].join("\n"),
  analyze_network_traffic: [
    "Você é um analista sênior de tráfego HTTP da plataforma Lovable.",
    "Recebe um RESUMO sanitizado (sem tokens) de até 50 requests capturadas:",
    " - lista de entries com method, url, status, timingMs",
    " - métricas pré-calculadas: total, errorRate, endpoints agregados (count, avgMs, p95Ms, errorCount)",
    "Sua tarefa: em PT-BR, em markdown enxuto (≤ 20 linhas), produzir:",
    "  1. Visão geral (volume, taxa de erro, throughput observado).",
    "  2. Endpoints mais quentes (top 3 por volume e por latência).",
    "  3. Padrões detectados (retries, auth refresh, polling, websockets, anti-bot/captcha).",
    "  4. Riscos / alertas (5xx repetidos, 401/403, latência fora do normal).",
    "  5. Sugestão acionável (ex.: 'cachear X', 'reduzir polling de Y', 'investigar 429 em Z').",
    "Não invente endpoints fora do resumo. Não tente desmascarar valores '***'.",
  ].join("\n"),
  suggest_mutations: [
    "Você é um pentester sênior especialista em fuzzing/mutação de requests HTTP da Lovable.",
    "Recebe UMA request sanitizada (sem tokens). Sua tarefa: sugerir entre 3 e 6 MUTAÇÕES seguras",
    "que ajudariam a entender o comportamento do endpoint (validação, idempotência, rate-limit, side-effects).",
    "Cada mutação deve ter:",
    "  - title: nome curto em PT-BR",
    "  - risk: 'low' | 'medium' | 'high'",
    "  - change: descrição da alteração (campo X removido, valor Y trocado por Z, etc.)",
    "  - expected: o que se espera observar (status, mensagem de erro, latência, etc.)",
    "Regras críticas:",
    "  - NÃO sugerir nada destrutivo (DELETE em produção, dropar projeto, etc.).",
    "  - NÃO inventar campos que não existem no body original.",
    "  - Placeholders {{...}} permanecem inalterados.",
    "Responda em markdown enxuto (≤ 18 linhas).",
  ].join("\n"),
  diagnose_failed_replay: [
    "Você é um SRE sênior. Recebe UMA request que falhou (status 0/4xx/5xx) com response body sanitizado.",
    "Sua tarefa em PT-BR, markdown enxuto (≤ 12 linhas):",
    "  1. Causa provável (auth, rate-limit, payload inválido, captcha, rede, downtime).",
    "  2. Evidência (qual header/body/status sustenta o diagnóstico).",
    "  3. Próxima ação recomendada (reautenticar, esperar X seg, ajustar campo Y, etc.).",
    "  4. Se for retryable, sugira backoff (ex.: '5s, 15s, 45s').",
    "Não invente endpoints. Não desmascare valores '***'.",
  ].join("\n"),
  classify_action_ptbr: [
    "Classifique a request em UMA categoria curta em PT-BR (≤ 4 palavras),",
    "ex.: 'Enviar chat', 'Criar projeto', 'Upload arquivo', 'Listar workspaces',",
    "'Heartbeat sessão', 'Validar licença', 'Remover watermark', 'Asset estático'.",
    "Responda APENAS com a categoria, sem markdown, sem aspas, sem ponto final.",
  ].join("\n"),
};

const RECIPE_TOOL = {
  type: "function",
  function: {
    name: "suggest_recipe",
    description: "Retorna um preset editável para o Composer.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome curto em PT-BR." },
        description: { type: "string", description: "Descrição curta em PT-BR." },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
        url: { type: "string", description: "URL com placeholders quando aplicável." },
        headers: {
          type: "object",
          description: "Headers extras (sem Authorization/Cookie).",
          additionalProperties: { type: "string" },
        },
        body: {
          description: "Body JSON com placeholders OU string vazia para GET.",
        },
      },
      required: ["name", "method", "url"],
      additionalProperties: false,
    },
  },
} as const;

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "ai_gateway_not_configured" }, 500);
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const ip = getClientIp(req);

    // Auth: requer licença ativa. Sem isso, qualquer um na internet poderia
    // consumir o LOVABLE_API_KEY (AI Gateway).
    const licenseKey = req.headers.get("x-license-key")?.trim() || "";
    if (!licenseKey) {
      return jsonResponse({ error: "license_required" }, 401);
    }
    const { data: lic } = await service
      .from("licenses")
      .select("status, expires_at")
      .eq("license_key", licenseKey)
      .maybeSingle();
    if (!lic || lic.status !== "active" || (lic.expires_at && new Date(lic.expires_at as string) < new Date())) {
      return jsonResponse({ error: "invalid_license" }, 403);
    }

    // Rate limit via RPCs corretas (substitui o helper antigo que escrevia
    // colunas inexistentes em security_logs).
    if (await isRateLimitedByIp(service, ip, "ai_request", RATE_LIMIT_PER_MIN, 1)) {
      return jsonResponse({ error: "rate_limited", retry_after_seconds: 60 }, 429);
    }
    if (await isRateLimitedByLicense(service, licenseKey, "ai_request", RATE_LIMIT_PER_MIN, 1)) {
      return jsonResponse({ error: "rate_limited", retry_after_seconds: 60 }, 429);
    }

    const raw = await req.text();
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const allowed = new Set(["action", "model", "request"]);
    for (const k of Object.keys(body)) {
      if (!allowed.has(k)) return jsonResponse({ error: `unknown_field:${k}` }, 400);
    }

    const action = String(body.action || "");
    if (!ALLOWED_ACTIONS.has(action)) {
      return jsonResponse({ error: "unknown_action" }, 400);
    }

    const model = typeof body.model === "string" && body.model.startsWith("google/")
      ? body.model
      : DEFAULT_MODEL;

    const request = body.request;
    if (!request || typeof request !== "object") {
      return jsonResponse({ error: "missing_request" }, 400);
    }

    const userPayload = truncate(JSON.stringify(request, null, 2), 16_000);
    const systemPrompt = SYSTEM_PROMPTS[action];

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Request capturada:\n\n\`\`\`json\n${userPayload}\n\`\`\`` },
          ],
          stream: false,
          ...(action === "convert_to_composer_recipe"
            ? {
                tools: [RECIPE_TOOL],
                tool_choice: { type: "function", function: { name: "suggest_recipe" } },
              }
            : {}),
        }),
      },
    );

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return jsonResponse({ error: "ai_rate_limited", message: "Limite do AI Gateway atingido. Tente em alguns segundos." }, 429);
      }
      if (upstream.status === 402) {
        return jsonResponse({ error: "ai_credits_exhausted", message: "Créditos do AI Gateway esgotados." }, 402);
      }
      const text = await upstream.text();
      console.error("[ai] upstream error:", upstream.status, text.slice(0, 300));
      return jsonResponse({ error: "ai_upstream_error", status: upstream.status }, 502);
    }

    const data = await upstream.json();
    const choice = data?.choices?.[0]?.message;
    const usage = data?.usage ?? null;

    // Telemetria best-effort (não bloqueia) — sampling 1:5
    if (Math.random() < 0.2) {
      service.from("ai_usage_logs").insert({
        action,
        model,
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        latency_ms: 0,
        status: "ok",
        ip,
      }).then(() => {}).catch(() => {});
    }

    if (action === "convert_to_composer_recipe") {
      const toolCall = choice?.tool_calls?.[0];
      const argsStr = toolCall?.function?.arguments;
      if (!argsStr) {
        return jsonResponse({ error: "ai_no_tool_call", message: "IA não retornou recipe estruturado." }, 502);
      }
      let recipe: unknown;
      try { recipe = JSON.parse(argsStr); }
      catch { return jsonResponse({ error: "ai_invalid_recipe_json" }, 502); }
      return jsonResponse({ ok: true, action, model, recipe, usage });
    }

    const content: string = choice?.content ?? "";
    return jsonResponse({
      ok: true,
      action,
      model,
      content: truncate(content, MAX_RESPONSE_CHARS),
      usage,
    });
  } catch (e) {
    console.error("[ai] error:", e);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});