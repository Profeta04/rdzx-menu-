/// <reference types="vitest" />
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { createPlanEngine, parsePlan, STORAGE_KEY } from "./plan-engine";

const VALID_PLAN = `[PLAN_START]
[STEP]
title=Setup
description=Inicializa o projeto
prompt=Crie o scaffold inicial
[/STEP]
[STEP]
title=Auth
description=Adiciona login
prompt=Implemente Supabase Auth com Google
[/STEP]
[PLAN_END]`;

function makeDoc() {
  document.body.innerHTML = `
    <div id="sp-tab-content"></div>
    <span id="sp-plan-badge" style="display:none"></span>
    <input id="sp-msg" />
  `;
  return document;
}

function makeStorage() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: (keys: string[], cb: (r: Record<string, unknown>) => void) => {
      const r: Record<string, unknown> = {};
      keys.forEach((k) => { if (k in data) r[k] = data[k]; });
      cb(r);
    },
    set: (obj: Record<string, unknown>) => { Object.assign(data, obj); },
    remove: (keys: string[]) => { keys.forEach((k) => delete data[k]); },
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createPlanEngine>[0]> = {}) {
  const storage = makeStorage();
  return {
    storage,
    base: {
      document: makeDoc(),
      storage,
      showAlert: vi.fn(),
      switchTab: vi.fn(),
      handleSend: vi.fn(async () => {}),
      templates: {
        idle: () => "<div>idle</div>",
        loading: () => "<div>loading</div>",
        result: (steps: any[], goal: string) => `<div>result:${goal}:${steps.length}</div>`,
      },
      escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
      sleep: async () => {},
      interStepDelay: 0,
      ...overrides,
    },
  };
}

describe("PlanEngine — parsePlan", () => {
  it("retorna null sem marcadores", () => {
    expect(parsePlan("nada")).toBeNull();
    expect(parsePlan("[PLAN_START] sem fim")).toBeNull();
    expect(parsePlan("")).toBeNull();
  });
  it("parseia plano válido com 2 steps", () => {
    const steps = parsePlan(VALID_PLAN);
    expect(steps).not.toBeNull();
    expect(steps!).toHaveLength(2);
    expect(steps![0].title).toBe("Setup");
    expect(steps![1].prompt).toContain("Supabase Auth");
    expect(steps![0].done).toBe(false);
  });
});

describe("PlanEngine — orchestration", () => {
  it("generate() chama fetch, persiste plano e renderiza result", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_PLAN } }] }),
    } as unknown as Response));
    const { storage, base } = makeDeps();
    const engine = createPlanEngine({ ...base, fetch: fetchMock as any });
    await engine.generate("construir app de notas");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(engine.getCurrent()?.steps).toHaveLength(2);
    expect(storage.data[STORAGE_KEY]).toBeDefined();
    expect(document.getElementById("sp-tab-content")!.innerHTML).toContain("result:construir app de notas:2");
  });

  it("generate() — fetch !ok mostra mensagem de falha escapada", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "rate <limit>" } }),
    } as unknown as Response));
    const { base } = makeDeps();
    const engine = createPlanEngine({ ...base, fetch: fetchMock as any });
    await engine.generate("x");
    const html = document.getElementById("sp-tab-content")!.innerHTML;
    expect(html).toContain("Falha ao gerar plano");
    expect(html).toContain("rate &lt;limit&gt;"); // escapado
    expect(engine.getCurrent()).toBeNull();
  });

  it("loadFromStorage() restaura plano persistido", () => {
    const { storage, base } = makeDeps();
    storage.data[STORAGE_KEY] = {
      goal: "g",
      steps: [{ title: "t", description: "d", prompt: "p", done: false }],
      executedIndexes: [],
    };
    const engine = createPlanEngine(base as any);
    engine.loadFromStorage();
    expect(engine.getCurrent()?.goal).toBe("g");
  });

  it("executeStep() é idempotente — não duplica executedIndexes", async () => {
    const { storage, base } = makeDeps();
    storage.data[STORAGE_KEY] = {
      goal: "g",
      steps: [
        { title: "a", description: "", prompt: "PA", done: false },
        { title: "b", description: "", prompt: "PB", done: false },
      ],
      executedIndexes: [],
    };
    const engine = createPlanEngine(base as any);
    engine.loadFromStorage();
    const exec = (engine as any)._executeStep as (i: number, p: string) => Promise<void>;
    await exec(0, "PA");
    await exec(0, "PA");
    expect(engine.getCurrent()?.executedIndexes).toEqual([0]);
    expect(base.handleSend).toHaveBeenCalledTimes(2);
    expect(base.switchTab).toHaveBeenCalledWith("prompt");
    expect(base.switchTab).toHaveBeenCalledWith("plan");
  });

  it("runAll() executa só pendentes em ordem", async () => {
    const { storage, base } = makeDeps();
    const order: number[] = [];
    const handleSend = vi.fn(async () => {
      const cur = (engine as any).getCurrent();
      order.push(cur ? cur.executedIndexes.length : -1);
    });
    storage.data[STORAGE_KEY] = {
      goal: "g",
      steps: [
        { title: "a", description: "", prompt: "PA", done: false },
        { title: "b", description: "", prompt: "PB", done: false },
        { title: "c", description: "", prompt: "PC", done: false },
      ],
      executedIndexes: [1],
    };
    const engine = createPlanEngine({ ...base, handleSend } as any);
    engine.loadFromStorage();
    await (engine as any)._runAll();
    expect(handleSend).toHaveBeenCalledTimes(2); // só 0 e 2
    expect(engine.getCurrent()?.executedIndexes.sort()).toEqual([0, 1, 2]);
  });

  it("updateBadge() reflete presença de plano", () => {
    const { storage, base } = makeDeps();
    const engine = createPlanEngine(base as any);
    engine.updateBadge();
    expect((document.getElementById("sp-plan-badge") as HTMLElement).style.display).toBe("none");
    storage.data[STORAGE_KEY] = {
      goal: "g",
      steps: [{ title: "t", description: "", prompt: "p", done: false }],
      executedIndexes: [],
    };
    engine.loadFromStorage();
    engine.updateBadge();
    expect((document.getElementById("sp-plan-badge") as HTMLElement).style.display).toBe("block");
  });
});