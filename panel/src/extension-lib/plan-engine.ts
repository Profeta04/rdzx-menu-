/**
 * Plan Engine — TS port com dependency injection, espelhando
 * `public/ext_build_v62/services/plan-engine.js`.
 *
 * Aqui ficam apenas as partes testáveis fora do Chrome: parser de plano,
 * orquestração de generate(), executeStep() e runAll(). O ciclo de DOM/render
 * delega aos templates injetados — testes usam um DOM fake (jsdom via vitest)
 * ou um document stub minimal.
 */

export interface PlanStep {
  title: string;
  description: string;
  prompt: string;
  done: boolean;
}

export interface PlanState {
  goal: string;
  steps: PlanStep[];
  executedIndexes: number[];
}

export interface PlanStorage {
  get(keys: string[], cb: (res: Record<string, unknown>) => void): void;
  set(obj: Record<string, unknown>, cb?: () => void): void;
  remove(keys: string[], cb?: () => void): void;
}

export interface PlanTemplates {
  idle: () => string;
  loading: () => string;
  result: (steps: PlanStep[], goal: string) => string;
}

export interface PlanEngineDeps {
  document: Document;
  storage: PlanStorage;
  showAlert: (title: string, message: string) => void;
  switchTab: (tab: string) => void;
  handleSend: () => Promise<void> | void;
  templates: PlanTemplates;
  escapeHtml: (s: string) => string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  interStepDelay?: number;
}

export interface PlanEngine {
  renderTab: () => void;
  loadFromStorage: (cb?: () => void) => void;
  updateBadge: () => void;
  getCurrent: () => PlanState | null;
  generate: (goal: string) => Promise<void>;
  parsePlan: typeof parsePlan;
}

export const STORAGE_KEY = "ql_plan_current";

function getField(block: string, key: string): string {
  const lines = block.split("\n");
  let result = "";
  let collecting = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.indexOf(key + "=") === 0) {
      result = trimmed.substring(key.length + 1);
      collecting = true;
    } else if (collecting) {
      if (/^(title|description|prompt)=/.test(trimmed)) break;
      result += "\n" + raw;
    }
  }
  return result.trim();
}

export function parsePlan(text: string | null | undefined): PlanStep[] | null {
  if (!text) return null;
  const iStart = text.indexOf("[PLAN_START]");
  const iEnd = text.indexOf("[PLAN_END]");
  if (iStart === -1 || iEnd === -1 || iEnd <= iStart) return null;
  const planBlock = text.substring(iStart + "[PLAN_START]".length, iEnd);
  const parts = planBlock.split("[STEP]");
  const steps: PlanStep[] = [];
  for (let pi = 1; pi < parts.length; pi++) {
    let block = parts[pi];
    const iClose = block.indexOf("[/STEP]");
    if (iClose !== -1) block = block.substring(0, iClose);
    const title = getField(block, "title");
    const description = getField(block, "description");
    const prompt = getField(block, "prompt");
    if (title && prompt) steps.push({ title, description, prompt, done: false });
  }
  return steps.length > 0 ? steps : null;
}

export function createPlanEngine(deps: PlanEngineDeps): PlanEngine {
  const {
    document: doc,
    storage,
    showAlert,
    switchTab,
    handleSend,
    templates,
    escapeHtml,
  } = deps;
  const fetchFn = deps.fetch ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const interStepDelay = deps.interStepDelay ?? 3000;
  if (!fetchFn) throw new Error("[PlanEngine] no fetch available");

  let currentPlan: PlanState | null = null;
  let isRunningAll = false;

  async function generate(goal: string): Promise<void> {
    const container = doc.getElementById("sp-tab-content");
    if (!container) return;
    container.innerHTML = templates.loading();
    try {
      const response = await fetchFn!("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer __obfuscated__" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.6,
          max_tokens: 2048,
          stream: false,
          messages: [
            { role: "system", content: "system" },
            { role: "user", content: goal },
          ],
        }),
      });
      if (!response.ok) {
        let ed: any = {};
        try { ed = await response.json(); } catch (_) { /* ignore */ }
        throw new Error(ed?.error?.message ?? `Groq API error ${response.status}`);
      }
      const data: any = await response.json();
      const raw: string = data?.choices?.[0]?.message?.content ?? "";
      const steps = parsePlan(raw);
      if (!steps) throw new Error("Formato de resposta invalido. Tente novamente.");
      currentPlan = { goal, steps, executedIndexes: [] };
      storage.set({ [STORAGE_KEY]: currentPlan });
      renderResult();
      updateBadge();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      container.innerHTML =
        `<div class="tab-panel active"><div>Falha ao gerar plano</div><div>${escapeHtml(msg)}</div></div>`;
    }
  }

  function renderTab(): void {
    const container = doc.getElementById("sp-tab-content");
    if (!container) return;
    if (currentPlan && currentPlan.steps.length > 0) { renderResult(); return; }
    container.innerHTML = templates.idle();
  }

  function renderResult(): void {
    const container = doc.getElementById("sp-tab-content");
    if (!container || !currentPlan) return;
    container.innerHTML = templates.result(currentPlan.steps, currentPlan.goal);
  }

  async function executeStep(idx: number, prompt: string): Promise<void> {
    try {
      switchTab("prompt");
      await sleep(0);
      const msgInput = doc.getElementById("sp-msg") as HTMLInputElement | null;
      if (msgInput) msgInput.value = prompt;
      await handleSend();
      if (currentPlan && currentPlan.executedIndexes.indexOf(idx) === -1) {
        currentPlan.executedIndexes.push(idx);
        storage.set({ [STORAGE_KEY]: currentPlan });
      }
      if (currentPlan && currentPlan.steps[idx]) currentPlan.steps[idx].done = true;
      await sleep(0);
      switchTab("plan");
    } catch (err) {
      switchTab("plan");
      showAlert("Erro", "Falha ao executar etapa: " + (err instanceof Error ? err.message : ""));
      throw err;
    }
  }

  async function runAll(): Promise<void> {
    if (!currentPlan) return;
    isRunningAll = true;
    const pending = currentPlan.steps
      .map((s, i) => ({ idx: i, prompt: s.prompt, done: currentPlan!.executedIndexes.indexOf(i) !== -1 }))
      .filter((s) => !s.done);
    for (let si = 0; si < pending.length; si++) {
      await executeStep(pending[si].idx, pending[si].prompt);
      if (si < pending.length - 1) await sleep(interStepDelay);
    }
    isRunningAll = false;
  }

  function updateBadge(): void {
    const badge = doc.getElementById("sp-plan-badge");
    if (badge) (badge as HTMLElement).style.display =
      currentPlan && currentPlan.steps.length > 0 ? "block" : "none";
  }

  function loadFromStorage(cb?: () => void): void {
    storage.get([STORAGE_KEY], (res) => {
      const raw = res?.[STORAGE_KEY] as PlanState | undefined;
      if (raw && raw.steps && raw.steps.length > 0) currentPlan = raw;
      cb?.();
    });
  }

  return {
    renderTab,
    loadFromStorage,
    updateBadge,
    getCurrent: () => currentPlan,
    generate,
    parsePlan,
    // exposed for tests
    ...({ _runAll: runAll, _executeStep: executeStep, _isRunningAll: () => isRunningAll } as any),
  } as PlanEngine;
}