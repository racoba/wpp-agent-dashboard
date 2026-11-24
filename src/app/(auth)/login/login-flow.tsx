"use client";

import { ArrowLeft, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CredentialsForm } from "@/components/auth/forms/credentials-form";
import { MfaStep } from "@/components/auth/forms/mfa-step";
import { FullScreenLoader } from "@/components/feedback/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoginOkResponse, LoginResponse, MeResponse } from "@/lib/api/types";
import { homePathFor, sanitizeNextPath } from "@/lib/auth/permissions";
import { t, type MessageKey } from "@/lib/i18n";

type Step = { kind: "credentials" } | { kind: "mfa"; mfaToken: string; startedAt: number };

const REASON_MESSAGES: Record<string, MessageKey> = {
  expired: "auth.login.sessionEnded",
  revoked: "auth.login.sessionRevoked",
  logout: "auth.login.loggedOut",
  reset: "auth.login.passwordReset",
  mfa: "auth.mfa.expired",
};

export function destinationAfterLogin(me: MeResponse, next: string | null): string {
  if (me.user.role === "master_admin" && !me.user.mfaEnabled) return "/configurar-mfa";
  return sanitizeNextPath(next, me.user.role) ?? homePathFor(me.user.role);
}

export function LoginFlow() {
  const { status, me, impersonation, completeLogin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [reason, setReason] = useState<string | null>(searchParams.get("motivo"));
  const [step, setStep] = useState<Step>({ kind: "credentials" });

  // Já autenticado (inclusive por login em outra aba): segue para o painel.
  useEffect(() => {
    if (status === "authenticated" && me) {
      router.replace(impersonation ? "/app" : destinationAfterLogin(me, next));
    }
  }, [status, me, impersonation, next, router]);

  const finish = useCallback(
    async (res: LoginOkResponse) => {
      await completeLogin(res);
      // O efeito acima faz o redirecionamento.
    },
    [completeLogin],
  );

  const handleCredentials = useCallback(
    async (res: LoginResponse) => {
      if (res.status === "mfa_required") {
        setReason(null);
        setStep({ kind: "mfa", mfaToken: res.mfaToken, startedAt: Date.now() });
        return;
      }
      await finish(res);
    },
    [finish],
  );

  const handleMfaExpired = useCallback(() => {
    setStep({ kind: "credentials" });
    setReason("mfa");
  }, []);

  if (status !== "unauthenticated") return <FullScreenLoader label={t("auth.bootstrapping")} />;

  const reasonKey = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <Card>
      <CardHeader>
        {step.kind === "mfa" ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit"
            onClick={() => setStep({ kind: "credentials" })}
          >
            <ArrowLeft aria-hidden /> {t("common.back")}
          </Button>
        ) : null}
        <CardTitle className="text-xl">
          <h1>{step.kind === "mfa" ? t("auth.mfa.title") : t("auth.login.title")}</h1>
        </CardTitle>
        {step.kind === "credentials" ? <CardDescription>{t("auth.login.description")}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {reasonKey && step.kind === "credentials" ? (
          <Alert role="status">
            <Info aria-hidden />
            <AlertDescription>{t(reasonKey)}</AlertDescription>
          </Alert>
        ) : null}
        {step.kind === "credentials" ? (
          <CredentialsForm onResult={handleCredentials} />
        ) : (
          <MfaStep
            key={step.mfaToken}
            mfaToken={step.mfaToken}
            startedAt={step.startedAt}
            onSuccess={finish}
            onExpired={handleMfaExpired}
          />
        )}
      </CardContent>
    </Card>
  );
}
