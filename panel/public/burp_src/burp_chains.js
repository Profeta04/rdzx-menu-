// ============================================================================
//  Hyper RB — Chains (Composer Sequence Mode)
// ----------------------------------------------------------------------------
//  Encadeia N requests com passagem de dados via template `{{stepId.path}}`,
//  `{{vars.x}}`, `{{ctx.token}}`, `{{ctx.projectId}}`.
//
//  Wave 2 fixes & additions:
//   - validateChain: erros de step propagados corretamente, sem acesso a
//     step.id quando step é inválido
//   - runChain: executor completo com AbortSignal, stopOnError, extract,
//     retry por step, deadline global, propagação de erro tipado
//   - Novo tipo ChainError para distinguir de erros genéricos
// ============================================================================
(function (root) {
  "use strict";

  const HARD_LIMITS = Object.freeze({
    MAX_STEPS: 10,
    MAX_TOTAL_BYTES: 5 * 1024 * 1024,
    DEFAULT_STEP_TIMEOUT_MS: 30_000,
    GLOBAL_DEADLINE_MS: 60_000,
    MAX_RETRY: 3,
  });

  // --------------------------------------------------------------------------
  // ChainError — typed error for chain/step failures
  // --------------------------------------------------------------------------
  class ChainError extends Error {
    constructor(message, { stepId = null, stepIndex = null, cause = null, code = "CHAIN_ERROR" } = {}) {
      super(message);
      this.name = "ChainError";
      this.stepId = stepId;
      this.stepIndex = stepIndex;
      this.code = code;
      if (cause) this.cause = cause;
    }
  }

  // --------------------------------------------------------------------------
  // JSONPath subset: $.a.b[0].c — sem libs externas.
  // --------------------------------------------------------------------------
  function jsonPath(obj, path) {
    if (obj == null || !path || typeof path !== "string") return undefined;
    let p = path.trim();
    if (p.startsWith("$")) p = p.slice(1);
    if (p.startsWith(".")) p = p.slice(1);
    if (!p) return obj;
    const tokens = [];
    let buf = "";
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === ".") {
        if (buf) { tokens.push(buf); buf = ""; }
      } else if (c === "[") {
        if (buf) { tokens.push(buf); buf = ""; }
        const end = p.indexOf("]", i);
        if (end === -1) return undefined;
        tokens.push(p.slice(i + 1, end).replace(/^["']|["']$/g, ""));
        i = end;
      } else {
        buf += c;
      }
    }
    if (buf) tokens.push(buf);
    let cur = obj;
    for (const tok of tokens) {
      if (cur == null) return undefined;
      cur = cur[tok];
    }
    return cur;
  }

  // --------------------------------------------------------------------------
  // Template engine
  // --------------------------------------------------------------------------
  function resolveTemplate(input, context, missing) {
    if (input == null) return input;
    if (typeof input === "string") {
      return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, expr) => {
        const v = jsonPath(context, expr);
        if (v === undefined || v === null) {
          if (missing && !missing.includes(expr)) missing.push(expr);
          return "";
        }
        return typeof v === "object" ? JSON.stringify(v) : String(v);
      });
    }
    if (Array.isArray(input)) {
      return input.map((v) => resolveTemplate(v, context, missing));
    }
    if (typeof input === "object") {
      const out = {};
      for (const k of Object.keys(input)) out[k] = resolveTemplate(input[k], context, missing);
      return out;
    }
    return input;
  }

  // --------------------------------------------------------------------------
  // Validação estrutural da chain. Retorna `{ valid, errors[] }`.
  // Fixed: guard against invalid step object before accessing step.id
  // --------------------------------------------------------------------------
  function validateChain(chain) {
    const errors = [];
    if (!chain || typeof chain !== "object") {
      return { valid: false, errors: ["Chain inválida (não é objeto)."] };
    }
    if (!Array.isArray(chain.steps) || chain.steps.length === 0) {
      errors.push("Chain precisa ter pelo menos 1 step.");
    }
    if (chain.steps && chain.steps.length > HARD_LIMITS.MAX_STEPS) {
      errors.push(`Limite máximo de ${HARD_LIMITS.MAX_STEPS} steps por chain.`);
    }
    const ids = new Set();
    (chain.steps || []).forEach((step, idx) => {
      const label = `Step #${idx + 1}`;
      if (!step || typeof step !== "object") {
        errors.push(`${label} inválido (não é objeto).`);
        return; // can't inspect further — guard against accessing .id on null/undefined
      }
      const stepLabel = step.id ? `"${step.id}"` : label;
      if (!step.id || typeof step.id !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(step.id)) {
        errors.push(`${label}: 'id' obrigatório (letras/números/underscore, começar com letra).`);
      } else if (ids.has(step.id)) {
        errors.push(`${label}: id duplicado "${step.id}".`);
      } else {
        ids.add(step.id);
      }
      if (!step.url || typeof step.url !== "string") {
        errors.push(`Step ${stepLabel}: 'url' obrigatória.`);
      }
      if (step.method != null && typeof step.method !== "string") {
        errors.push(`Step ${stepLabel}: 'method' deve ser string.`);
      }
      if (step.retry != null && (typeof step.retry !== "number" || step.retry < 0 || step.retry > HARD_LIMITS.MAX_RETRY)) {
        errors.push(`Step ${stepLabel}: 'retry' precisa ser 0..${HARD_LIMITS.MAX_RETRY}.`);
      }
      if (step.timeoutMs != null && (typeof step.timeoutMs !== "number" || step.timeoutMs <= 0)) {
        errors.push(`Step ${stepLabel}: 'timeoutMs' deve ser número positivo.`);
      }
      if (step.extract != null && (typeof step.extract !== "object" || Array.isArray(step.extract))) {
        errors.push(`Step ${stepLabel}: 'extract' deve ser objeto { alias: jsonpath }.`);
      }
    });
    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // Helpers: prepareStep, extractFromResponse
  // --------------------------------------------------------------------------
  function prepareStep(step, context) {
    const missing = [];
    const headers = step.headers ? resolveTemplate(step.headers, context, missing) : {};
    const url = resolveTemplate(String(step.url || ""), context, missing);
    const method = String(step.method || "GET").toUpperCase();
    let body = step.body !== undefined ? step.body : null;
    if (body !== null) {
      body = resolveTemplate(body, context, missing);
    }
    return { url, method, headers, body, missing };
  }

  function extractFromResponse(extract, responseJson) {
    const out = {};
    if (!extract || typeof extract !== "object" || responseJson == null) return out;
    for (const [alias, path] of Object.entries(extract)) {
      out[alias] = jsonPath(responseJson, String(path));
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // runChain — full executor with AbortSignal, per-step retry, deadline,
  //            error propagation via ChainError.
  //
  //  opts = {
  //    signal?:    AbortSignal           // external abort (e.g. cancelAll)
  //    fetchFn?:   typeof fetch          // injectable for testing
  //    vars?:      Record<string,any>    // override chain.vars
  //    ctx?:       Record<string,any>    // e.g. { token, projectId }
  //    onStepStart?(stepId, idx): void
  //    onStepDone?(stepId, idx, result): void
  //    onStepError?(stepId, idx, error): void
  //  }
  //
  //  Returns: { ok, steps: StepResult[], aborted, error? }
  // --------------------------------------------------------------------------
  async function runChain(chain, opts = {}) {
    const validation = validateChain(chain);
    if (!validation.valid) {
      return { ok: false, aborted: false, steps: [], error: validation.errors.join(" | ") };
    }

    const fetchFn = opts.fetchFn || (typeof fetch !== "undefined" ? fetch : null);
    if (!fetchFn) {
      return { ok: false, aborted: false, steps: [], error: "fetch não disponível neste contexto." };
    }

    const externalSignal = opts.signal || null;
    const globalDeadline = chain.globalDeadlineMs || HARD_LIMITS.GLOBAL_DEADLINE_MS;
    const stopOnError = chain.stopOnError !== false;

    // Global deadline controller
    const deadlineCtrl = new AbortController();
    const deadlineTimer = setTimeout(() => deadlineCtrl.abort("deadline"), globalDeadline);

    // Combined abort: fires if either external or deadline aborts
    function isAborted() {
      return deadlineCtrl.signal.aborted || (externalSignal && externalSignal.aborted);
    }

    // Context accumulates step results
    const context = {
      vars: { ...(chain.vars || {}), ...(opts.vars || {}) },
      ctx: { ...(opts.ctx || {}) },
    };

    const stepResults = [];
    let chainAborted = false;

    try {
      for (let idx = 0; idx < chain.steps.length; idx++) {
        const step = chain.steps[idx];

        if (isAborted()) {
          chainAborted = true;
          break;
        }

        opts.onStepStart?.(step.id, idx);

        const maxRetry = typeof step.retry === "number" ? step.retry : 0;
        const stepTimeout = typeof step.timeoutMs === "number" ? step.timeoutMs : HARD_LIMITS.DEFAULT_STEP_TIMEOUT_MS;

        let stepResult = null;
        let stepError = null;

        for (let attempt = 0; attempt <= maxRetry; attempt++) {
          if (isAborted()) { chainAborted = true; break; }

          // Per-step AbortController (timeout)
          const stepCtrl = new AbortController();
          const stepTimer = setTimeout(() => stepCtrl.abort("step-timeout"), stepTimeout);

          // Propagate external/deadline abort to step
          const abortStep = () => stepCtrl.abort("external");
          deadlineCtrl.signal.addEventListener("abort", abortStep, { once: true });
          externalSignal?.addEventListener("abort", abortStep, { once: true });

          let prepared;
          try {
            prepared = prepareStep(step, context);
          } catch (prepErr) {
            clearTimeout(stepTimer);
            stepError = new ChainError(`Step "${step.id}" falhou na preparação: ${prepErr?.message}`, {
              stepId: step.id, stepIndex: idx, cause: prepErr, code: "PREPARE_ERROR",
            });
            break; // no point retrying a template resolution error
          }

          // Warn about unresolved templates but continue
          if (prepared.missing.length > 0) {
            console.warn(`[HyperRB Chains] Step "${step.id}": templates não resolvidos: ${prepared.missing.join(", ")}`);
          }

          let reqBody = null;
          if (prepared.body !== null && prepared.method !== "GET" && prepared.method !== "HEAD") {
            reqBody = typeof prepared.body === "string" ? prepared.body : JSON.stringify(prepared.body);
          }

          try {
            const stepPerfStart = typeof performance !== "undefined" ? performance.now() : Date.now();
            const res = await fetchFn(prepared.url, {
              method: prepared.method,
              headers: prepared.headers || {},
              body: reqBody,
              signal: stepCtrl.signal,
            });
            clearTimeout(stepTimer);
            deadlineCtrl.signal.removeEventListener("abort", abortStep);
            externalSignal?.removeEventListener("abort", abortStep);

            let responseText = "";
            let responseJson = null;
            try { responseText = await res.text(); } catch {}
            try { responseJson = JSON.parse(responseText); } catch {}

            const extracted = extractFromResponse(step.extract, responseJson);

            stepResult = {
              stepId: step.id,
              attempt,
              status: res.status,
              statusText: res.statusText,
              ok: res.ok,
              body: responseText,
              json: responseJson,
              headers: Object.fromEntries(res.headers.entries()),
              extracted,
              timingMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - stepPerfStart),
            };

            // Store in context for downstream steps
            context[step.id] = {
              status: res.status,
              body: responseText,
              json: responseJson,
              headers: stepResult.headers,
              extracted,
            };

            // retryableStatuses: if step defines retryableStatuses and status matches, retry
            const retryableStatuses = Array.isArray(step.retryableStatuses) ? step.retryableStatuses : [];
            if (!res.ok && retryableStatuses.includes(res.status) && attempt < maxRetry) {
              // Don't break — let the retry loop continue
              stepError = new ChainError(
                `Step "${step.id}" retornou HTTP ${res.status} (retryable)`,
                { stepId: step.id, stepIndex: idx, code: "HTTP_RETRYABLE" }
              );
              const backoffBase = 300 * Math.pow(2, attempt);
              const jitter = Math.random() * 300;
              await new Promise((r) => setTimeout(r, backoffBase + jitter));
              continue;
            }

            if (!res.ok && stopOnError) {
              stepError = new ChainError(
                `Step "${step.id}" retornou HTTP ${res.status}`,
                { stepId: step.id, stepIndex: idx, code: "HTTP_ERROR" }
              );
              stepResult.error = stepError.message;
            }
            break; // success (or non-retriable error handled above)

          } catch (fetchErr) {
            clearTimeout(stepTimer);
            deadlineCtrl.signal.removeEventListener("abort", abortStep);
            externalSignal?.removeEventListener("abort", abortStep);

            if (stepCtrl.signal.aborted) {
              const reason = stepCtrl.signal.reason;
              if (reason === "step-timeout") {
                stepError = new ChainError(`Step "${step.id}" excedeu timeout (${stepTimeout}ms)`, {
                  stepId: step.id, stepIndex: idx, cause: fetchErr, code: "STEP_TIMEOUT",
                });
              } else {
                // external/deadline abort — stop everything
                chainAborted = true;
                stepError = new ChainError(`Step "${step.id}" abortado externamente`, {
                  stepId: step.id, stepIndex: idx, code: "ABORTED",
                });
              }
              break; // no retry on abort
            }
            stepError = new ChainError(`Step "${step.id}" falhou: ${fetchErr?.message}`, {
              stepId: step.id, stepIndex: idx, cause: fetchErr, code: "FETCH_ERROR",
            });
            if (attempt < maxRetry) {
              // Simple backoff between retries
              // Backoff with jitter: base * 2^attempt + random(0..base)
              const backoffBase = 300 * Math.pow(2, attempt);
              const jitter = Math.random() * 300;
              await new Promise((r) => setTimeout(r, backoffBase + jitter));
              continue;
            }
            break;
          }
        } // end retry loop

        if (stepResult) stepResults.push(stepResult);

        if (stepError) {
          opts.onStepError?.(step.id, idx, stepError);
          if (stopOnError || chainAborted) {
            // Record failed step result if not already
            if (!stepResult) {
              stepResults.push({ stepId: step.id, ok: false, error: stepError.message });
            }
            clearTimeout(deadlineTimer);
            return {
              ok: false,
              aborted: chainAborted,
              steps: stepResults,
              error: stepError.message,
              failedStep: step.id,
            };
          }
          // stopOnError=false: continue with next step, but record error
          if (stepResult) stepResult.error = stepError.message;
          else stepResults.push({ stepId: step.id, ok: false, error: stepError.message });
        } else {
          opts.onStepDone?.(step.id, idx, stepResult);
        }
      } // end steps loop
    } finally {
      clearTimeout(deadlineTimer);
    }

    if (chainAborted) {
      return { ok: false, aborted: true, steps: stepResults, error: "Chain abortada." };
    }

    const allOk = stepResults.every((s) => s.ok !== false || !stopOnError);
    return { ok: allOk, aborted: false, steps: stepResults };
  }


  // --------------------------------------------------------------------------
  // Chain registry — maps chainId → AbortController for cancelChain() support.
  // --------------------------------------------------------------------------
  const _chainRegistry = new Map();

  /**
   * cancelChain(chainId)
   * Aborts the in-flight chain identified by `chainId`.
   * Returns true if a running chain was found and aborted, false otherwise.
   */
  function cancelChain(chainId) {
    if (!chainId || !_chainRegistry.has(chainId)) return false;
    try { _chainRegistry.get(chainId).abort("cancelChain"); } catch {}
    _chainRegistry.delete(chainId);
    return true;
  }

  /**
   * cancelAllChains()
   * Aborts every currently running chain.
   */
  function cancelAllChains() {
    for (const [, ctrl] of _chainRegistry) {
      try { ctrl.abort("cancelAllChains"); } catch {}
    }
    _chainRegistry.clear();
  }

  /**
   * runChainTracked(chainId, chain, opts)
   * Wraps runChain() with automatic registration in _chainRegistry so that
   * the caller can cancel via cancelChain(chainId) at any time.
   *
   * @param {string} chainId - Unique identifier for this execution (caller-defined).
   * @param {object} chain   - Chain definition (same as runChain's first arg).
   * @param {object} [opts]  - Same opts as runChain; do NOT pass opts.signal —
   *                           it is managed internally and merged with any
   *                           existing signal the caller provides via opts._signal.
   * @returns {Promise<{ok, aborted, steps, error?, failedStep?}>}
   */
  async function runChainTracked(chainId, chain, opts = {}) {
    if (!chainId || typeof chainId !== "string") {
      return { ok: false, aborted: false, steps: [], error: "chainId inválido." };
    }
    // If there's already a chain with this id running, cancel it first.
    cancelChain(chainId);

    const ctrl = new AbortController();
    _chainRegistry.set(chainId, ctrl);

    // Merge caller's external signal (opts._signal) with our registry signal
    const externalSignal = opts._signal || null;
    if (externalSignal) {
      externalSignal.addEventListener("abort", () => ctrl.abort("external"), { once: true });
    }

    const mergedOpts = { ...opts, signal: ctrl.signal };
    delete mergedOpts._signal; // clean up internal key

    try {
      const result = await runChain(chain, mergedOpts);
      return result;
    } finally {
      _chainRegistry.delete(chainId);
    }
  }

  // --------------------------------------------------------------------------
  // Templates embutidos
  // --------------------------------------------------------------------------
  const BUILTIN_TEMPLATES = [
    {
      id: "hb-upload-file",
      name: "Upload de arquivo (HyperBuild Pro)",
      description: "Fluxo de 3 steps: gera signed URL → PUT no storage → registra o arquivo.",
      chain: {
        name: "Upload arquivo HyperBuild Pro",
        vars: { filename: "exemplo.png", contentType: "image/png" },
        stopOnError: true,
        steps: [
          {
            id: "s1", name: "Gerar URL de upload", method: "POST",
            url: "https://api.lovable.dev/projects/{{ctx.projectId}}/files/generate-upload-url",
            headers: { "Content-Type": "application/json" },
            body: { filename: "{{vars.filename}}", content_type: "{{vars.contentType}}" },
            extract: { uploadUrl: "$.upload_url", fileId: "$.id" },
          },
          {
            id: "s2", name: "PUT no signed URL", method: "PUT",
            url: "{{s1.extracted.uploadUrl}}",
            headers: { "Content-Type": "{{vars.contentType}}" },
            body: null, bodySource: "raw",
          },
          {
            id: "s3", name: "Registrar arquivo", method: "POST",
            url: "https://api.lovable.dev/files/{{s1.extracted.fileId}}/register",
            headers: { "Content-Type": "application/json" },
            body: { uploaded: true },
          },
        ],
      },
    },
    {
      id: "hb-create-project",
      name: "Criar projeto Lovable",
      description: "Lista workspaces → cria projeto no primeiro workspace retornado.",
      chain: {
        name: "Criar projeto Lovable",
        vars: { projectName: "Novo projeto Hyper RB" },
        stopOnError: true,
        steps: [
          {
            id: "ws", name: "Listar workspaces", method: "GET",
            url: "https://api.lovable.dev/user/workspaces",
            extract: { workspaceId: "$.workspaces[0].id" },
          },
          {
            id: "create", name: "Criar projeto", method: "POST",
            url: "https://api.lovable.dev/workspaces/{{ws.extracted.workspaceId}}/projects",
            headers: { "Content-Type": "application/json" },
            body: { name: "{{vars.projectName}}" },
          },
        ],
      },
    },
    {
      id: "hb-heartbeat-ping",
      name: "Heartbeat → ping",
      description: "Heartbeat + ping de telemetria (exemplo simples de 2 steps).",
      chain: {
        name: "Heartbeat + ping",
        stopOnError: false,
        steps: [
          {
            id: "hb", name: "Heartbeat", method: "POST",
            url: "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/heartbeat",
            headers: { "Content-Type": "application/json" },
            body: { ping: true },
          },
          {
            id: "vx", name: "Validate (info-only)", method: "POST",
            url: "https://cvbgrjauqjawrsyknhyj.supabase.co/functions/v1/vx",
            headers: { "Content-Type": "application/json" },
            body: { license_key: "", device_id: "", heartbeat: true },
          },
        ],
      },
    },
  ];

  /**
   * getBuiltinTemplate(id) — returns a single built-in chain template by id, or null.
   */
  function getBuiltinTemplate(id) {
    return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
  }

  const api = {
    HARD_LIMITS,
    ChainError,
    jsonPath,
    resolveTemplate,
    validateChain,
    prepareStep,
    extractFromResponse,
    runChain,
    runChainTracked,
    cancelChain,
    cancelAllChains,
    BUILTIN_TEMPLATES,
    getBuiltinTemplate,
  };

  root.HyperRBChains = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
