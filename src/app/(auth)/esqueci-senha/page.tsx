"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { t } from "@/lib/i18n";
import { emailSchema } from "@/lib/validation";

const schema = z.object({ email: emailSchema });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>{t("auth.forgot.title")}</h1>
        </CardTitle>
        {!sent ? <CardDescription>{t("auth.forgot.description")}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <Alert role="status">
            <CheckCircle2 aria-hidden />
            <AlertDescription>{t("auth.forgot.sent")}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {errors.root?.message ? (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            ) : null}
            <FormField label={t("auth.login.email")} error={errors.email?.message}>
              {(field) => <Input {...field} type="email" autoComplete="email" autoFocus {...form.register("email")} />}
            </FormField>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("auth.forgot.submit")}
            </Button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t("auth.forgot.backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
