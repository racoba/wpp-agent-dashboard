import { emit } from "@/lib/events";
import { endImpersonation, endSession, getValidAccessToken, refreshAccessToken } from "@/lib/auth/session";
import { tokenStore } from "@/lib/auth/token-store";
import { ApiError, isApiError } from "./errors";
import { classifyPath, rawRequest, type RawRequestInit } from "./http";

/**
 * Cliente da API com interceptor de autenticação.
 *
 * - /clinic/* e /admin/*: Authorization: Bearer <accessToken>.
 *   Durante a impersonação, /clinic/* usa o token de impersonação; /admin/*
 *   continua com o token do master.
 * - /auth/*: credentials 'include' + X-Requested-With (ver http.ts).
 * - 401 TOKEN_EXPIRED: um único refresh (single-flight) e uma nova tentativa.
 * - 401 TOKEN_INVALID / SESSION_REVOKED: encerra a sessão (vai ao login).
 */
export type ApiRequestInit = Omit<RawRequestInit, "bearer">;

function pickToken(path: string): { token: string | null; impersonating: boolean } {
  const imp = tokenStore.getImpersonation();
  if (imp && path.startsWith("/clinic/")) return { token: imp.accessToken, impersonating: true };
  return { token: tokenStore.getPrimary()?.accessToken ?? null, impersonating: false };
}

function emitGlobalSignals(error: ApiError) {
  if (error.status === 423 && error.code === "CLINIC_SUSPENDED") emit("clinic-suspended", {});
  if (error.status === 403 && error.code === "MFA_REQUIRED") emit("mfa-required", {});
}

export async function api<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const area = classifyPath(path);
  if (area === "auth-public" || area === "public") return rawRequest<T>(path, init);

  const picked = pickToken(path);
  const impersonating = picked.impersonating;
  let token = picked.token;
  if (!token && !impersonating) {
    // Ex.: requisição disparada logo após recarregar, antes do bootstrap.
    token = await getValidAccessToken();
  }

  try {
    return await rawRequest<T>(path, { ...init, bearer: token });
  } catch (error) {
    if (!isApiError(error)) throw error;

    if (error.status === 401) {
      if (impersonating) {
        endImpersonation(error.code === "TOKEN_EXPIRED" ? "expired" : "invalid");
        throw error;
      }
      if (error.code === "TOKEN_EXPIRED") {
        const fresh = await refreshAccessToken();
        try {
          return await rawRequest<T>(path, { ...init, bearer: fresh });
        } catch (retryError) {
          if (isApiError(retryError)) {
            if (retryError.status === 401) {
              endSession(retryError.code === "SESSION_REVOKED" ? "revoked" : "invalid", { broadcast: false });
            } else {
              emitGlobalSignals(retryError);
            }
          }
          throw retryError;
        }
      }
      if (error.code === "SESSION_REVOKED") endSession("revoked", { broadcast: false });
      else endSession("invalid", { broadcast: false });
      throw error;
    }

    emitGlobalSignals(error);
    throw error;
  }
}
