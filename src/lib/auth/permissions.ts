import type { Permission, Role } from "@/lib/api/types";
import type { SessionEndReason } from "@/lib/events";

/**
 * Permissões por papel. São usadas só como reserva quando /auth/me não
 * devolve `permissions`. A UI esconde o que o papel não pode usar, mas quem
 * decide é sempre o backend (todo 403 continua sendo tratado).
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  master_admin: ["admin:access"],
  clinic_admin: [
    "clinic:read",
    "clinic:write",
    "catalog:write",
    "agent:write",
    "connections:manage",
    "users:manage",
    "conversations:read",
    "contacts:read",
    "contacts:reveal_phone",
  ],
  clinic_staff: ["clinic:read", "catalog:write", "conversations:read", "contacts:read"],
};

/** Durante a impersonação o master só lê. */
export const IMPERSONATION_PERMISSIONS: Permission[] = ["clinic:read", "conversations:read", "contacts:read"];

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export const CLINIC_ROLES: Role[] = ["clinic_admin", "clinic_staff"];

/** Valor de ?motivo= na tela de login para cada forma de encerramento. */
const LOGIN_REASON: Record<SessionEndReason, string> = {
  expired: "expired",
  invalid: "expired",
  revoked: "revoked",
  logout: "logout",
  "remote-logout": "logout",
  "password-reset": "reset",
};

/**
 * URL do login após o fim da sessão. Guarda a rota de retorno, exceto
 * quando a pessoa saiu de propósito (logout).
 */
export function loginPathFor(reason: SessionEndReason | null, currentPath: string | null): string {
  const params = new URLSearchParams();
  if (reason) params.set("motivo", LOGIN_REASON[reason]);
  const voluntary = reason === "logout" || reason === "remote-logout" || reason === "password-reset";
  if (currentPath && !voluntary) params.set("next", currentPath);
  const qs = params.toString();
  return `/login${qs ? `?${qs}` : ""}`;
}

export function homePathFor(role: Role): string {
  return role === "master_admin" ? "/admin" : "/app";
}

/**
 * Valida o parâmetro `next` do login: só caminhos internos conhecidos,
 * evitando redirecionamento aberto (ex.: "//evil.com", "/\\evil.com").
 */
export function sanitizeNextPath(next: string | null | undefined, role?: Role): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  let url: URL;
  try {
    url = new URL(next, "http://local.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://local.invalid") return null;
  const path = url.pathname;
  const isApp = path === "/app" || path.startsWith("/app/");
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  if (!isApp && !isAdmin) return null;
  if (role) {
    if (isAdmin && role !== "master_admin") return null;
    if (isApp && role === "master_admin") return null;
  }
  return `${path}${url.search}`;
}
