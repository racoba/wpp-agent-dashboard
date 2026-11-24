"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, hasErrorCode } from "@/lib/api/errors";
import type { LoginResponse } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { emailSchema } from "@/lib/validation";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, t("validation.required")),
});

type Values = z.infer<typeof schema>;

export function CredentialsForm({ onResult }: { onResult: (res: LoginResponse) => Promise<void> | void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await authApi.login(values);
      await onResult(res);
    } catch (error) {
      form.setError("root", {
        message: hasErrorCode(error, "INVALID_CREDENTIALS") ? t("auth.login.invalidCredentials") : errorMessage(error),
      });
      form.resetField("password", { keepError: false });
      form.setFocus("password");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.message ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      ) : null}
      <FormField label={t("auth.login.email")} error={errors.email?.message}>
        {(field) => (
          <Input {...field} type="email" autoComplete="username" inputMode="email" autoFocus {...form.register("email")} />
        )}
      </FormField>
      <FormField label={t("auth.login.password")} error={errors.password?.message}>
        {(field) => <Input {...field} type="password" autoComplete="current-password" {...form.register("password")} />}
      </FormField>
      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("auth.login.submit")}
      </Button>
      <p className="text-center text-sm">
        <Link href="/esqueci-senha" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t("auth.login.forgot")}
        </Link>
      </p>
    </form>
  );
}
