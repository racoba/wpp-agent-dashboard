/**
 * Guarda os tokens de acesso APENAS em memória (variáveis deste módulo).
 * Nada aqui toca localStorage, sessionStorage, IndexedDB ou cookies.
 * Recarregar a página perde o token de propósito: a sessão volta via
 * /auth/refresh (cookie httpOnly que o JS não lê).
 */

export interface PrimaryToken {
  accessToken: string;
  /** Epoch em ms. */
  expiresAt: number;
  /** Dono do token, para detectar troca de usuário entre abas. */
  userId: string | null;
}

export interface ImpersonationToken {
  accessToken: string;
  expiresAt: number;
  clinicId: string;
  clinicName: string;
}

let primary: PrimaryToken | null = null;
let impersonation: ImpersonationToken | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const tokenStore = {
  getPrimary: () => primary,
  setPrimary(token: PrimaryToken) {
    primary = token;
    notify();
  },
  getImpersonation: () => impersonation,
  setImpersonation(token: ImpersonationToken | null) {
    impersonation = token;
    notify();
  },
  clear() {
    primary = null;
    impersonation = null;
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * Lê o payload de um JWT SEM validar a assinatura (quem valida é o backend).
 * Usado só para ler `exp`/`sub`/`imp` e agendar a renovação.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function tokenSubject(token: string): string | null {
  const sub = decodeJwtPayload(token)?.sub;
  return typeof sub === "string" ? sub : null;
}
