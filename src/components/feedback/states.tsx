import { AlertTriangle, Ban, Inbox, Loader2, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface StateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function StateLayout({ icon: Icon = Inbox, title, description, action, className, role }: StateProps & { role?: string }) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-base font-medium">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateLayout {...props} />;
}

export function ForbiddenState({ className }: { className?: string }) {
  return (
    <StateLayout
      icon={ShieldAlert}
      title={t("errors.forbiddenTitle")}
      description={t("errors.forbiddenDescription")}
      className={className}
    />
  );
}

/** Estado de erro padrão: escolhe texto/ícone pelo código do erro e oferece "Tentar novamente". */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  if (isApiError(error) && error.status === 403 && error.code === "FORBIDDEN") {
    return <ForbiddenState className={className} />;
  }
  const network = isApiError(error) && error.isNetwork;
  return (
    <StateLayout
      role="alert"
      icon={network ? WifiOff : AlertTriangle}
      title={network ? t("errors.network") : t("errors.generic")}
      description={network ? undefined : errorMessage(error)}
      className={className}
      action={
        onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden /> {t("common.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}

export function SuspendedState({ action }: { action?: React.ReactNode }) {
  return (
    <StateLayout
      role="alert"
      icon={Ban}
      title={t("errors.suspendedTitle")}
      description={t("errors.suspendedDescription")}
      action={action}
    />
  );
}

export function FullScreenLoader({ label = t("common.loading") }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={t("common.loading")}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
