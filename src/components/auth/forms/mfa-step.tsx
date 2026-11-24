"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, hasErrorCode } from "@/lib/api/errors";
import type { LoginOkResponse } from "@/lib/api/types";
import { formatCountdown } from "@/lib/format";
import { t } from "@/lib/i18n";

const MFA_TOKEN_TTL_MS = 5 * 60_000;

/**
 * Segunda etapa do login. O mfaToken fica só no estado deste componente
 * e vale 5 minutos; ao expirar, volta para e-mail/senha.
 */
export function MfaStep({
  mfaToken,
  startedAt,
  onSuccess,
  onExpired,
}: {
  mfaToken: string;
  startedAt: number;
  onSuccess: (res: LoginOkResponse) => Promise<void> | void;
  onExpired: () => void;
}) {
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const recoveryRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const remainingSeconds = Math.max(0, (startedAt + MFA_TOKEN_TTL_MS - now) / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remainingSeconds <= 0) onExpired();
  }, [remainingSeconds, onExpired]);

  async function submit(value: string) {
    if (submittingRef.current) return;
    const normalized = value.trim();
    if (mode === "totp" && !/^\d{6}$/.test(normalized)) {
      setError(t("validation.otp"));
      return;
    }
    if (mode === "recovery" && normalized.length < 6) {
      setError(t("validation.required"));
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.verifyMfa({ mfaToken, code: normalized });
      await onSuccess(res);
    } catch (err) {
      if (hasErrorCode(err, "TOKEN_EXPIRED", "TOKEN_INVALID")) {
        onExpired();
        return;
      }
      setError(hasErrorCode(err, "INVALID_MFA_CODE") ? t("auth.mfa.invalidCode") : errorMessage(err));
      setCode("");
      if (mode === "recovery") recoveryRef.current?.focus();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode((m) => (m === "totp" ? "recovery" : "totp"));
    setCode("");
    setError(null);
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(code);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {mode === "totp" ? t("auth.mfa.description") : t("auth.mfa.recoveryDescription")}
      </p>

      {mode === "totp" ? (
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">{t("auth.mfa.code")}</Label>
          <InputOTP
            id="mfa-code"
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            onComplete={(value: string) => void submit(value)}
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            disabled={submitting}
            aria-invalid={!!error}
            aria-describedby={error ? "mfa-error" : undefined}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} className="size-11 text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      ) : (
        <FormField label={t("auth.mfa.recoveryCode")}>
          {(field) => (
            <Input
              {...field}
              ref={recoveryRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              aria-invalid={!!error}
              aria-describedby={error ? "mfa-error" : undefined}
            />
          )}
        </FormField>
      )}

      {error ? (
        <Alert variant="destructive" id="mfa-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("auth.mfa.submit")}
      </Button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <Button type="button" variant="link" size="sm" onClick={switchMode}>
          {mode === "totp" ? t("auth.mfa.useRecovery") : t("auth.mfa.useTotp")}
        </Button>
        <p className="text-xs text-muted-foreground" aria-live="off">
          {t("auth.mfa.expiresIn", { time: formatCountdown(remainingSeconds) })}
        </p>
      </div>
    </form>
  );
}
