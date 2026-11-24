/**
 * Barramento de eventos interno (sem React) para que o cliente HTTP e o módulo
 * de auth avisem a interface sem depender dela.
 */
export type SessionEndReason =
  | "logout"
  | "remote-logout"
  | "expired"
  | "revoked"
  | "invalid"
  | "password-reset";

export type ImpersonationEndReason = "exit" | "expired" | "invalid";

export interface AppEvents {
  /** A sessão principal acabou: limpar cache e ir ao login. */
  "session-ended": { reason: SessionEndReason };
  /** Outra aba entrou enquanto esta estava sem sessão. */
  "remote-login": { userId: string };
  /** Outra aba entrou com um usuário diferente do desta aba. */
  "user-switched": { userId: string };
  "impersonation-ended": { reason: ImpersonationEndReason };
  "clinic-suspended": Record<string, never>;
  "mfa-required": Record<string, never>;
}

type AnyHandler = (payload: never) => void;

const handlers = new Map<keyof AppEvents, Set<AnyHandler>>();

export function on<K extends keyof AppEvents>(event: K, handler: (payload: AppEvents[K]) => void): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler as AnyHandler);
  return () => {
    set.delete(handler as AnyHandler);
  };
}

export function emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
  handlers.get(event)?.forEach((handler) => (handler as (p: AppEvents[K]) => void)(payload));
}
