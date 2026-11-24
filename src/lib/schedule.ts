import type { AvailabilityRule, Weekday } from "@/lib/api/types";

/** Ordem de exibição (semana começando na segunda). */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<Weekday, { long: string; short: string }> = {
  0: { long: "Domingo", short: "Dom" },
  1: { long: "Segunda-feira", short: "Seg" },
  2: { long: "Terça-feira", short: "Ter" },
  3: { long: "Quarta-feira", short: "Qua" },
  4: { long: "Quinta-feira", short: "Qui" },
  5: { long: "Sexta-feira", short: "Sex" },
  6: { long: "Sábado", short: "Sáb" },
};

export interface TimeRange {
  start: string;
  end: string;
}

export type WeekSchedule = Record<Weekday, TimeRange[]>;

export function emptyWeek(): WeekSchedule {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

export function rulesToWeek(rules: AvailabilityRule[]): WeekSchedule {
  const week = emptyWeek();
  for (const r of rules) week[r.weekday].push({ start: r.start, end: r.end });
  for (const day of WEEK_ORDER) week[day].sort((a, b) => a.start.localeCompare(b.start));
  return week;
}

export function weekToRules(week: WeekSchedule): AvailabilityRule[] {
  return WEEK_ORDER.flatMap((weekday) =>
    [...week[weekday]].sort((a, b) => a.start.localeCompare(b.start)).map((r) => ({ weekday, start: r.start, end: r.end })),
  );
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Valida as faixas de um dia. Devolve um erro por índice da faixa
 * (mesma ordem recebida) ou null se estiver tudo certo.
 */
export function validateDay(ranges: TimeRange[]): Array<string | null> {
  const errors: Array<string | null> = ranges.map((r) => {
    if (!TIME_RE.test(r.start) || !TIME_RE.test(r.end)) return "Preencha início e fim.";
    if (toMinutes(r.end) <= toMinutes(r.start)) return "O fim precisa ser depois do início.";
    return null;
  });
  const order = ranges.map((r, i) => ({ r, i })).filter(({ i }) => errors[i] === null);
  order.sort((a, b) => toMinutes(a.r.start) - toMinutes(b.r.start));
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1]!;
    const cur = order[k]!;
    if (toMinutes(cur.r.start) < toMinutes(prev.r.end)) {
      errors[cur.i] = `Sobrepõe a faixa ${prev.r.start}–${prev.r.end}.`;
    }
  }
  return errors;
}

export function weekHasErrors(week: WeekSchedule): boolean {
  return WEEK_ORDER.some((d) => validateDay(week[d]).some(Boolean));
}

export function totalWeeklyMinutes(week: WeekSchedule): number {
  return WEEK_ORDER.reduce<number>(
    (sum, d) => sum + week[d].reduce((s, r) => s + Math.max(0, toMinutes(r.end) - toMinutes(r.start)), 0),
    0,
  );
}

export function sameWeek(a: WeekSchedule, b: WeekSchedule): boolean {
  return JSON.stringify(weekToRules(a)) === JSON.stringify(weekToRules(b));
}

/** Sugere a próxima faixa de um dia: começa onde a última termina (1 h). */
export function suggestNextRange(ranges: TimeRange[]): TimeRange {
  if (!ranges.length) return { start: "08:00", end: "12:00" };
  const last = [...ranges].sort((a, b) => toMinutes(a.end) - toMinutes(b.end)).at(-1)!;
  const start = Math.min(toMinutes(last.end) + 60, 22 * 60);
  const end = Math.min(start + 4 * 60, 23 * 60 + 59);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}
