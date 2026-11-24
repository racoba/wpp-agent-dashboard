import { env } from "@/config/env";
import { ApiError } from "./errors";
import type { ApiErrorBody } from "./types";

/**
 * Camada HTTP crua: monta URL e cabeçalhos por área, faz o fetch e normaliza
 * erros. Não conhece tokens nem renovação (isso fica em client.ts/session.ts).
 */

export type RequestArea =
  /** /auth/* sem identificação: login, mfa/verify, refresh, forgot, reset. */
  | "auth-public"
  /** Demais /auth/*: me, sessions, logout, mfa/setup… */
  | "auth"
  /** /clinic/* e /admin/*: exigem Bearer. */
  | "protected"
  | "public";

const AUTH_PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/mfa/verify",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
]);

export function classifyPath(path: string): RequestArea {
  if (AUTH_PUBLIC_PATHS.has(path)) return "auth-public";
  if (path.startsWith("/auth/")) return "auth";
  if (path.startsWith("/clinic/") || path.startsWith("/admin/")) return "protected";
  return "public";
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RawRequestInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  bearer?: string | null;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `${env.apiBaseUrl}${path}${qs ? `?${qs}` : ""}`;
}

export async function rawRequest<T>(path: string, init: RawRequestInit = {}): Promise<T> {
  const area = classifyPath(path);
  const headers = new Headers({ Accept: "application/json" });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const isAuthArea = area === "auth" || area === "auth-public";
  if (isAuthArea) {
    // Exigido pelo backend como proteção CSRF nas rotas que usam o cookie.
    headers.set("X-Requested-With", "XMLHttpRequest");
  }
  if (init.bearer && area !== "auth-public") {
    headers.set("Authorization", `Bearer ${init.bearer}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, init.query), {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      // Cookie de refresh só vai nas rotas de auth; o resto é só Bearer.
      credentials: isAuthArea ? "include" : "omit",
      signal: init.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const body = data as Partial<ApiErrorBody> | undefined;
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? (response.status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR"),
      error?.message ?? response.statusText,
      error?.details,
    );
  }

  return data as T;
}
