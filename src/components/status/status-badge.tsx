import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, PauseCircle, XCircle, FlaskConical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ClinicStatus, ConnectionStatus } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Selo de status com ícone + texto (a cor nunca é a única pista).
 * Cores escolhidas para contraste AA nos dois temas.
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info" | "progress";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
  warning: "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
  danger: "bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25",
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25",
  progress: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25",
};

const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: CircleDashed,
  info: FlaskConical,
  progress: Loader2,
};

export function StatusBadge({
  tone,
  label,
  icon,
  className,
}: {
  tone: StatusTone;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? TONE_ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className={cn("size-3.5", tone === "progress" && "animate-spin motion-reduce:animate-none")} aria-hidden />
      {label}
    </span>
  );
}

const CONNECTION_TONES: Record<ConnectionStatus, StatusTone> = {
  not_connected: "neutral",
  connecting: "progress",
  active: "success",
  attention: "warning",
  error: "danger",
};

export function ConnectionStatusBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  return <StatusBadge tone={CONNECTION_TONES[status]} label={t(`connectionStatus.${status}`)} className={className} />;
}

const CLINIC_TONES: Record<ClinicStatus, StatusTone> = { active: "success", trial: "info", suspended: "danger" };

export function ClinicStatusBadge({ status, className }: { status: ClinicStatus; className?: string }) {
  return (
    <StatusBadge
      tone={CLINIC_TONES[status]}
      label={t(`clinicStatus.${status}`)}
      icon={status === "suspended" ? PauseCircle : undefined}
      className={className}
    />
  );
}

export type HealthStatus = "ok" | "attention" | "error";
const HEALTH_TONES: Record<HealthStatus, StatusTone> = { ok: "success", attention: "warning", error: "danger" };

export function HealthBadge({ status, className }: { status: HealthStatus; className?: string }) {
  return <StatusBadge tone={HEALTH_TONES[status]} label={t(`healthStatus.${status}`)} className={className} />;
}
