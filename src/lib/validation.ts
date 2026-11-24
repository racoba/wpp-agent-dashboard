import { z } from "zod";
import { t } from "@/lib/i18n";

export const PASSWORD_MIN = 10;

export const emailSchema = z
  .string()
  .trim()
  .min(1, t("validation.required"))
  .pipe(z.email(t("validation.email")));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, t("validation.passwordMin", { min: PASSWORD_MIN }))
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), t("validation.passwordStrength"));

export const otpSchema = z.string().regex(/^\d{6}$/, t("validation.otp"));
