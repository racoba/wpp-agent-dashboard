"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FullScreenLoader } from "@/components/feedback/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, hasErrorCode } from "@/lib/api/errors";
import { endSession } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { newPasswordSchema } from "@/lib/validation";

const schema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: t("validation.passwordMatch") });

/**
 * Lê o token de redefinição do fragmento (#token=…), que não vai para o
 * servidor nem para o Referer, e também aceita ?token=. Em seguida o remove
 * da barra de endereço.
 */
function takeResetToken(): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const token = hash.get("token") ?? query.get("token");
  if (token) window.history.replaceState(null, "", window.location.pathname);
  return token;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    // Lê e limpa a URL só no cliente, depois da hidratação (o servidor não tem o fragmento).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(takeResetToken());
  }, []);

  const onSubmit = form.handleSubmit(async ({ password }) => {
    if (!token) return;
    try {
      await authApi.resetPassword({ token, password });
      // A redefinição revoga todas as sessões: limpa a local e avisa as outras abas.
      endSession("password-reset", { broadcast: true });
      router.replace("/login?motivo=reset");
    } catch (error) {
      form.setError("root", {
        message: hasErrorCode(error, "TOKEN_INVALID", "TOKEN_EXPIRED") ? t("auth.reset.invalidToken") : errorMessage(error),
      });
    }
  });

  if (token === undefined) return <FullScreenLoader />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>{t("auth.reset.title")}</h1>
        </CardTitle>
        <CardDescription>{t("auth.reset.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <Alert variant="destructive">
            <AlertDescription>{t("auth.reset.missingToken")}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {errors.root?.message ? (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            ) : null}
            <FormField label={t("auth.reset.password")} error={errors.password?.message}>
              {(field) => <Input {...field} type="password" autoComplete="new-password" autoFocus {...form.register("password")} />}
            </FormField>
            <FormField label={t("auth.reset.confirm")} error={errors.confirm?.message}>
              {(field) => <Input {...field} type="password" autoComplete="new-password" {...form.register("confirm")} />}
            </FormField>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("auth.reset.submit")}
            </Button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link href={token ? "/login" : "/esqueci-senha"} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {token ? t("auth.forgot.backToLogin") : t("auth.forgot.title")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
