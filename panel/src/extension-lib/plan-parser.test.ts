import { describe, it, expect } from "vitest";
import { parsePlan } from "./plan-parser";

const VALID = `texto antes\n[PLAN_START]\n[STEP]\ntitle=Setup\ndescription=Cria base\nprompt=Crie a estrutura inicial do projeto\n[/STEP]\n[STEP]\ntitle=Auth\ndescription=Login\nprompt=Implemente login com email\n[/STEP]\n[PLAN_END]\ndepois`;

describe("parsePlan", () => {
  it("returns null when markers missing", () => {
    expect(parsePlan("nada aqui")).toBeNull();
    expect(parsePlan("[PLAN_START] sem fim")).toBeNull();
    expect(parsePlan("")).toBeNull();
  });

  it("extracts steps with title/description/prompt", () => {
    const steps = parsePlan(VALID);
    expect(steps).not.toBeNull();
    expect(steps).toHaveLength(2);
    expect(steps![0]).toMatchObject({
      title: "Setup",
      description: "Cria base",
      prompt: "Crie a estrutura inicial do projeto",
      done: false,
    });
    expect(steps![1].title).toBe("Auth");
  });

  it("skips steps without title or prompt", () => {
    const txt = `[PLAN_START][STEP]\ndescription=sem titulo\nprompt=p\n[/STEP][STEP]\ntitle=ok\nprompt=valido\n[/STEP][PLAN_END]`;
    const steps = parsePlan(txt);
    expect(steps).toHaveLength(1);
    expect(steps![0].title).toBe("ok");
  });

  it("supports multi-line prompt values", () => {
    const txt = `[PLAN_START][STEP]\ntitle=Multi\ndescription=d\nprompt=linha 1\nlinha 2\nlinha 3\n[/STEP][PLAN_END]`;
    const steps = parsePlan(txt);
    expect(steps![0].prompt).toBe("linha 1\nlinha 2\nlinha 3");
  });

  it("returns null when no valid step inside markers", () => {
    expect(parsePlan("[PLAN_START][PLAN_END]")).toBeNull();
  });
});