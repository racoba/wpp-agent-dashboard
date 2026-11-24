import { DEFAULT_TIMEZONE } from "@/config/env";
import { locale } from "@/lib/i18n";

/** Datas sempre no fuso da clínica (nunca no fuso do navegador). */
export function formatDateTime(value: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatDate(value: string | Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(value));
}

export function formatRelative(value: string | Date, now = Date.now()): string {
  const diffSeconds = Math.round((new Date(value).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  return rtf.format(Math.round(diffSeconds / 86400), "day");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatCurrencyCents(cents: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** "150,00" / "R$ 1.234,5" → centavos; vazio → null; inválido → NaN. */
export function parseCurrencyToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  // "150.5" / "150.50" sem vírgula: ponto é decimal. Com vírgula: ponto é milhar.
  const dotIsDecimal = !cleaned.includes(",") && /^\d+\.\d{1,2}$/.test(cleaned);
  const normalized = dotIsDecimal ? cleaned : cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
