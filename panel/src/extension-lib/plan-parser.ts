/**
 * Parser do formato [PLAN_START]...[PLAN_END] usado pelo PlanEngine da HyperBuild PRO.
 * Espelha public/ext_build_v62/sidepanel.js (PlanEngine.parsePlan) como TypeScript puro
 * para que seja testável fora do Chrome. Qualquer mudança aqui DEVE ser refletida na
 * extensão (e vice-versa) até a refatoração mover ambos para uma única fonte.
 */

export interface PlanStep {
  title: string;
  description: string;
  prompt: string;
  done: boolean;
}

const FIELD_RE = /^(title|description|prompt)=/;

function getField(block: string, key: string): string {
  const lines = block.split("\n");
  let result = "";
  let collecting = false;
  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      result = trimmed.substring(key.length + 1);
      collecting = true;
    } else if (collecting) {
      if (FIELD_RE.test(trimmed)) break;
      result += "\n" + line;
    }
  }
  return result.trim();
}

export function parsePlan(text: string): PlanStep[] | null {
  if (!text || text.indexOf("[PLAN_START]") === -1 || text.indexOf("[PLAN_END]") === -1) {
    return null;
  }
  const planBlock = text.substring(
    text.indexOf("[PLAN_START]") + "[PLAN_START]".length,
    text.indexOf("[PLAN_END]"),
  );
  const parts = planBlock.split("[STEP]");
  const steps: PlanStep[] = [];
  for (let pi = 1; pi < parts.length; pi++) {
    let block = parts[pi];
    const endIdx = block.indexOf("[/STEP]");
    if (endIdx !== -1) block = block.substring(0, endIdx);
    const title = getField(block, "title");
    const description = getField(block, "description");
    const prompt = getField(block, "prompt");
    if (title && prompt) {
      steps.push({ title, description, prompt, done: false });
    }
  }
  return steps.length > 0 ? steps : null;
}