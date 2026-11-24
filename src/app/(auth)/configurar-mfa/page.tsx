"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { MfaSetupWizard } from "@/components/auth/mfa-setup-wizard";
import { RouteGuard } from "@/components/auth/route-guard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { homePathFor } from "@/lib/auth/permissions";
import { refreshAccessToken } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

function SetupMfa() {
  const { me, reloadMe, logout } = useAuth();
  const router = useRouter();
  const alreadyEnabled = me?.user.mfaEnabled ?? false;

  useEffect(() => {
    if (alreadyEnabled && me) router.replace(homePathFor(me.user.role));
  }, [alreadyEnabled, me, router]);

  if (!me || alreadyEnabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="size-5" aria-hidden />
          <h1>{t("auth.mfaSetup.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {me.user.role === "master_admin" ? (
          <Alert>
            <AlertDescription>{t("auth.mfaSetup.requiredForMaster")}</AlertDescription>
          </Alert>
        ) : null}
        <MfaSetupWizard
          onDone={async () => {
            // Renova o token para que a sessão passe a constar como verificada por MFA.
            await refreshAccessToken();
            const updated = await reloadMe();
            router.replace(homePathFor(updated?.user.role ?? me.user.role));
          }}
        />
        <Button variant="ghost" className="w-full" onClick={() => void logout()}>
          {t("auth.logout")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ConfigureMfaPage() {
  return (
    <Suspense>
      <RouteGuard roles={["master_admin", "clinic_admin", "clinic_staff"]}>
        <SetupMfa />
      </RouteGuard>
    </Suspense>
  );
}
