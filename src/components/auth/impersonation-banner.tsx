"use client";

import { Eye, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCountdown } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAuth } from "./auth-provider";

const BANNER_HEIGHT = "2.75rem";

/**
 * Faixa fixa e sempre visível durante a impersonação. Desloca o layout
 * (inclusive a sidebar fixa) pela variável CSS --impersonation-offset.
 */
export function ImpersonationBanner() {
  const { impersonation, exitImpersonation } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!impersonation) return;
    const root = document.documentElement;
    root.style.setProperty("--impersonation-offset", BANNER_HEIGHT);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      root.style.removeProperty("--impersonation-offset");
    };
  }, [impersonation]);

  if (!impersonation) return null;
  const remaining = Math.max(0, (impersonation.expiresAt - now) / 1000);

  return (
    <div
      role="region"
      aria-label="Modo de visualização como clínica"
      className="fixed inset-x-0 top-0 z-50 flex h-(--impersonation-offset) items-center gap-3 bg-amber-400 px-4 text-sm text-amber-950 shadow-sm"
    >
      <Eye className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate font-medium">
        {t("impersonation.banner", { clinic: impersonation.clinicName })}
      </p>
      <span className="hidden tabular-nums sm:inline" aria-label="Tempo restante">
        {formatCountdown(remaining)}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-950/30 bg-amber-50 text-amber-950 hover:bg-amber-100"
        onClick={exitImpersonation}
      >
        <LogOut aria-hidden /> {t("impersonation.exit")}
      </Button>
    </div>
  );
}
