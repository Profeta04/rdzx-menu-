/// <reference types="vitest" />
import { describe, it, expect } from "vitest";
import { formatChatDate, formatChatTime } from "./chat-history";

const NOON = new Date(2026, 5, 10, 12, 0, 0); // 10 Jun 2026, quarta-feira, meio-dia (local)

describe("chat-history — formatChatDate", () => {
  it("retorna 'Hoje' para datas do mesmo dia", () => {
    const sameDay = new Date(2026, 5, 10, 8, 30, 0);
    expect(formatChatDate(sameDay, NOON)).toBe("Hoje");
  });
  it("retorna 'Ontem' para D-1", () => {
    const yesterday = new Date(2026, 5, 9, 23, 0, 0);
    expect(formatChatDate(yesterday, NOON)).toBe("Ontem");
  });
  it("retorna nome do dia da semana para D-2..D-6", () => {
    const fiveDaysAgo = new Date(2026, 5, 5, 10, 0, 0); // sexta-feira
    expect(formatChatDate(fiveDaysAgo, NOON)).toBe("Sexta");
    const threeDaysAgo = new Date(2026, 5, 7, 10, 0, 0); // domingo
    expect(formatChatDate(threeDaysAgo, NOON)).toBe("Domingo");
  });
  it("retorna data formatada pt-BR para >= 7 dias", () => {
    const tenDaysAgo = new Date(2026, 4, 31, 10, 0, 0);
    const out = formatChatDate(tenDaysAgo, NOON);
    // Locale node retorna "31/05/2026"
    expect(out).toMatch(/^31[/]05[/]2026$/);
  });
  it("retorna '' para input inválido", () => {
    expect(formatChatDate("not a date", NOON)).toBe("");
  });
});

describe("chat-history — formatChatTime", () => {
  it("zero-pad em horas e minutos", () => {
    expect(formatChatTime(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
    expect(formatChatTime(new Date(2026, 0, 1, 0, 0))).toBe("00:00");
    expect(formatChatTime(new Date(2026, 0, 1, 23, 59))).toBe("23:59");
  });
  it("retorna '' para input inválido", () => {
    expect(formatChatTime("garbage")).toBe("");
  });
});