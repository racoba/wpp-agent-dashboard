"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SuspendedState } from "@/components/feedback/states";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function ClinicShell({ children }: { children: React.ReactNode }) {
  const { me, impersonation, clinicSuspended, logout } = useAuth();
  const clinicName = impersonation?.clinicName ?? me?.clinic?.name;

  return (
    <AppShell area="clinic" contextLabel={clinicName}>
      {clinicSuspended ? (
        <SuspendedState
          action={
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut aria-hidden /> {t("auth.logout")}
            </Button>
          }
        />
      ) : (
        children
      )}
    </AppShell>
  );
}
