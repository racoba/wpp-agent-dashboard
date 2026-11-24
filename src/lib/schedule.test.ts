import { describe, expect, it } from "vitest";
import { rulesToWeek, suggestNextRange, totalWeeklyMinutes, validateDay, weekToRules } from "./schedule";

describe("validateDay", () => {
  it("aceita faixas válidas e não sobrepostas", () => {
    expect(validateDay([{ start: "08:00", end: "12:00" }, { start: "13:00", end: "18:00" }])).toEqual([null, null]);
  });

  it("acusa fim antes do início", () => {
    expect(validateDay([{ start: "12:00", end: "08:00" }])).toEqual(["O fim precisa ser depois do início."]);
  });

  it("acusa sobreposição na faixa que começa depois, mesmo fora de ordem", () => {
    const errors = validateDay([{ start: "11:00", end: "14:00" }, { start: "08:00", end: "12:00" }]);
    expect(errors[0]).toMatch(/Sobrepõe a faixa 08:00–12:00/);
    expect(errors[1]).toBeNull();
  });

  it("faixas encostadas (12:00 → 12:00) não sobrepõem", () => {
    expect(validateDay([{ start: "08:00", end: "12:00" }, { start: "12:00", end: "13:00" }])).toEqual([null, null]);
  });

  it("acusa campo vazio", () => {
    expect(validateDay([{ start: "", end: "10:00" }])).toEqual(["Preencha início e fim."]);
  });
});

describe("conversões", () => {
  it("ida e volta entre regras e semana preserva os dados e ordena", () => {
    const rules = [
      { weekday: 2 as const, start: "13:00", end: "18:00" },
      { weekday: 2 as const, start: "08:00", end: "12:00" },
      { weekday: 0 as const, start: "09:00", end: "11:00" },
    ];
    expect(weekToRules(rulesToWeek(rules))).toEqual([
      { weekday: 2, start: "08:00", end: "12:00" },
      { weekday: 2, start: "13:00", end: "18:00" },
      { weekday: 0, start: "09:00", end: "11:00" },
    ]);
  });

  it("soma minutos da semana", () => {
    expect(totalWeeklyMinutes(rulesToWeek([{ weekday: 1, start: "08:00", end: "12:30" }]))).toBe(270);
  });

  it("sugere a próxima faixa depois da última", () => {
    expect(suggestNextRange([])).toEqual({ start: "08:00", end: "12:00" });
    expect(suggestNextRange([{ start: "08:00", end: "12:00" }])).toEqual({ start: "13:00", end: "17:00" });
  });
});
