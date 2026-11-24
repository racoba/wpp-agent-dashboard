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
