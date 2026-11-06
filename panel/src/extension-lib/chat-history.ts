/**
 * chat-history — TS port dos formatadores puros de
 * public/ext_build_v62/services/chat-history.js.
 *
 * Mantém paridade exata. Atualize os DOIS lados quando mudar uma função.
 */

function pad2(n: number): string {
  const s = String(n);
  return s.length === 1 ? "0" + s : s;
}

const WEEKDAYS_PT_BR = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
] as const;

export function formatChatDate(dateStr: string | number | Date, now?: Date): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const ref = now instanceof Date ? now : new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff > 1 && diff < 7) return WEEKDAYS_PT_BR[d.getDay()];
  return d.toLocaleDateString("pt-BR");
}

export function formatChatTime(dateStr: string | number | Date): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}