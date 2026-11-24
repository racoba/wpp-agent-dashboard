"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Check, Copy, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { ErrorState } from "@/components/feedback/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, hasErrorCode } from "@/lib/api/errors";
import type { MfaSetupResponse } from "@/lib/api/types";
import { t } from "@/lib/i18n";

type State =
  | { kind: "loading" }
  | { kind: "error"; error: unknown }
  | { kind: "scan"; setup: MfaSetupResponse }
  | { kind: "codes"; recoveryCodes: string[] };

/**
 * Assistente de ativação do TOTP: QR code → confirmação do código →
 * códigos de recuperação. O segredo só fica no estado do componente.
 */
export function MfaSetupWizard({ onDone }: { onDone: () => Promise<void> | void }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  async function start() {
    setState({ kind: "loading" });
    try {
      setState({ kind: "scan", setup: await authApi.mfaSetup() });
    } catch (err) {
      setState({ kind: "error", error: err });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, []);

  async function enable(value: string) {
    if (!/^\d{6}$/.test(value) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.mfaEnable({ code: value });
      setState({ kind: "codes", recoveryCodes: res.recoveryCodes });
    } catch (err) {
      setError(hasErrorCode(err, "INVALID_MFA_CODE") ? t("auth.mfa.invalidCode") : errorMessage(err));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="mx-auto size-44" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state.kind === "error") return <ErrorState error={state.error} onRetry={() => void start()} />;

  if (state.kind === "codes") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-medium">{t("auth.mfaSetup.recoveryTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("auth.mfaSetup.recoveryDescription")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm" aria-label="Códigos de recuperação">
          {state.recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await navigator.clipboard.writeText(state.recoveryCodes.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("auth.mfaSetup.copied") : t("auth.mfaSetup.copy")}
        </Button>
        <Button
          className="w-full"
          size="lg"
          disabled={finishing}
          onClick={async () => {
            setFinishing(true);
            try {
              await onDone();
            } finally {
              setFinishing(false);
            }
          }}
        >
          {finishing ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("auth.mfaSetup.done")}
        </Button>
      </div>
    );
  }

  const secretGroups = state.setup.secret.match(/.{1,4}/g)?.join(" ") ?? state.setup.secret;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void enable(code);
      }}
    >
      <ol className="space-y-5 text-sm">
        <li className="space-y-3">
          <p>
            <span className="font-medium">1.</span> {t("auth.mfaSetup.step1")}
          </p>
          <div className="mx-auto w-fit rounded-lg bg-white p-3">
            <QRCodeSVG value={state.setup.otpauthUrl} size={168} title="QR code para o aplicativo autenticador" />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("auth.mfaSetup.manualKey")}{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono break-all select-all">{secretGroups}</code>
          </p>
        </li>
        <li className="space-y-2">
          <Label htmlFor="mfa-setup-code">
            <span className="font-medium">2.</span> {t("auth.mfaSetup.step2")}
          </Label>
          <InputOTP
            id="mfa-setup-code"
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            onComplete={(v: string) => void enable(v)}
            autoComplete="one-time-code"
            inputMode="numeric"
            disabled={submitting}
            aria-invalid={!!error}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} className="size-11 text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </li>
      </ol>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={submitting || code.length !== 6}>
        {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("auth.mfaSetup.enable")}
      </Button>
    </form>
  );
}
