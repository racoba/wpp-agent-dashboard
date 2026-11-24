import { t } from "@/lib/i18n";
import type { ApiErrorCode } from "./types";

/**
 * Erro normalizado da API. A mensagem vem do backend ou é genérica, e nunca
 * inclui cabeçalhos, tokens ou o corpo da requisição.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork() {
    return this.status === 0;
  }

  get isServer() {
    return this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasErrorCode(error: unknown, ...codes: ApiErrorCode[]): boolean {
  return isApiError(error) && codes.includes(error.code);
}

/** Texto amigável para toasts e estados de erro. */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return t("errors.generic");
  if (error.isNetwork) return t("errors.network");
  if (error.isServer) return t("errors.server");
  switch (error.code) {
    case "FORBIDDEN":
      return t("errors.forbiddenDescription");
    case "IMPERSONATION_READ_ONLY":
      return t("errors.readOnly");
    case "CLINIC_SUSPENDED":
      return t("errors.suspendedDescription");
    case "MFA_REQUIRED":
      return t("errors.mfaRequired");
    case "RATE_LIMITED":
      return t("errors.rateLimited");
    default:
      return error.message || t("errors.generic");
  }
}
