import { delay, HttpResponse } from "msw";
import { env } from "@/config/env";
import type { Permission } from "@/lib/api/types";
import { permissionsForRole } from "@/lib/auth/permissions";
import { readDb, updateDb, type MockClinic, type MockSession, type MockState, type MockUser } from "./db";
import { readMockToken, signMockToken, type MockTokenPayload } from "./jwt";

export const apiPath = (path: string) => `${env.apiBaseUrl}${path}`;

const isTest = process.env.NODE_ENV === "test";

/** Latência realista no navegador; zero nos testes. */
export async function latency(min = 200, max = 550) {
  if (isTest) return;
  await delay(Math.round(min + Math.random() * (max - min)));
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}

export function noContent() {
  return new HttpResponse(null, { status: 204 });
}

export function deviceFromRequest(request: Request): string {
  const ua = request.headers.get("user-agent") ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "dispositivo desconhecido";
  return `${browser} no ${os}`;
}

export function issueAccessToken(state: MockState, user: MockUser, session: MockSession) {
  const accessToken = signMockToken(
    { sub: user.id, sid: session.id, role: user.role, clinicId: user.clinicId },
    state.faults.accessTtlSeconds,
  );
  return { accessToken, expiresIn: state.faults.accessTtlSeconds };
}

export function publicUser(user: MockUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clinicId: user.clinicId,
    mfaEnabled: user.mfaEnabled,
  };
}

export interface AuthContext {
  state: MockState;
  user: MockUser;
  session: MockSession;
  payload: MockTokenPayload;
  impersonating: boolean;
  clinic: MockClinic | null;
}

type Area = "auth" | "clinic" | "admin";

/**
 * Valida o Bearer como o backend faria e devolve o contexto ou a resposta
 * de erro (TOKEN_INVALID, TOKEN_EXPIRED, SESSION_REVOKED, FORBIDDEN,
 * MFA_REQUIRED, CLINIC_SUSPENDED).
 */
export function authenticate(request: Request, area: Area): AuthContext | Response {
  const faults = updateDb((s) => {
    const snapshot = { ...s.faults };
    if (area !== "auth") s.faults.nextServerError = false;
    s.faults.nextInvalidToken = false;
    return snapshot;
  });
  if (area !== "auth" && faults.nextServerError) {
    return apiError(500, "INTERNAL_ERROR", "Erro interno simulado.");
  }

  const state = readDb();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? readMockToken(token) : null;
  if (!payload || faults.nextInvalidToken) return apiError(401, "TOKEN_INVALID", "Token inválido.");

  const session = state.sessions.find((s) => s.id === payload.sid);
  if (!session || session.revoked) return apiError(401, "SESSION_REVOKED", "Sessão encerrada.");

  const issuedAtMs = payload.iat * 1000;
  const expired = payload.exp * 1000 <= Date.now() || (!payload.imp && issuedAtMs < faults.expireIssuedBefore);
  if (expired) return apiError(401, "TOKEN_EXPIRED", "Token expirado.");

  const user = state.users.find((u) => u.id === payload.sub);
  if (!user) return apiError(401, "TOKEN_INVALID", "Usuário não encontrado.");

  if (payload.imp) {
    if (area !== "clinic") return apiError(401, "TOKEN_INVALID", "Token de impersonação só vale no painel da clínica.");
    const clinic = state.clinics.find((c) => c.id === payload.imp!.clinicId) ?? null;
    return { state, user, session, payload, impersonating: true, clinic };
  }

  if (area === "admin") {
    if (user.role !== "master_admin") return apiError(403, "FORBIDDEN", "Acesso restrito ao administrador da plataforma.");
    if (!session.mfaVerified) return apiError(403, "MFA_REQUIRED", "Ative a verificação em duas etapas.");
  }

  let clinic: MockClinic | null = null;
  if (area === "clinic") {
    if (user.role === "master_admin" || !user.clinicId) return apiError(403, "FORBIDDEN", "Acesso restrito à equipe da clínica.");
    clinic = state.clinics.find((c) => c.id === user.clinicId) ?? null;
    if (clinic?.status === "suspended") return apiError(423, "CLINIC_SUSPENDED", "Clínica suspensa.");
  }

  updateDb((s) => {
    const target = s.sessions.find((x) => x.id === session.id);
    if (target) target.lastUsedAt = new Date().toISOString();
  });

  return { state, user, session, payload, impersonating: false, clinic };
}

/** Escrita: bloqueia impersonação e papéis sem a permissão. */
export function requireWrite(ctx: AuthContext, permission: Permission): Response | null {
  if (ctx.impersonating) return apiError(403, "IMPERSONATION_READ_ONLY", "Modo somente leitura.");
  if (!permissionsForRole(ctx.user.role).includes(permission)) {
    return apiError(403, "FORBIDDEN", "Seu papel não permite esta ação.");
  }
  return null;
}

export function encodeCursor(offset: number) {
  return btoa(`o:${offset}`);
}

export function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const [, value] = atob(cursor).split(":");
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
