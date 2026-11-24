import { ApiError, isApiError } from "@/lib/api/errors";
import { rawRequest } from "@/lib/api/http";
import type { LoginOkResponse, RefreshResponse } from "@/lib/api/types";
import { emit, type ImpersonationEndReason, type SessionEndReason } from "@/lib/events";
import { withRefreshLock } from "./refresh-lock";
import { tabSync } from "./tab-sync";
import { decodeJwtPayload, tokenStore, tokenSubject, type PrimaryToken } from "./token-store";

/**
 * Ciclo de vida da sessão: refresh single-flight, renovação proativa,
 * bootstrap ao recarregar a página, logout (local e entre abas) e
 * impersonação.
 */

/** Renovar este tanto antes do exp. */
const PROACTIVE_MARGIN_MS = 60_000;
/** Um token com menos validade que isso é tratado como vencido. */
const MIN_VALIDITY_MS = 10_000;
/** Quanto esperar outra aba responder com um token ao abrir a página. */
const PEER_TOKEN_TIMEOUT_MS = 150;
const IMPERSONATION_FALLBACK_TTL_MS = 30 * 60_000;

let inflightRefresh: Promise<string> | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;
let impersonationTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let bootstrapPromise: Promise<boolean> | null = null;
/** userId do usuário cuja interface esta aba está mostrando. */
let activeUserId: string | null = null;

function isFresh(token: PrimaryToken | null): token is PrimaryToken {
  return !!token && token.expiresAt - Date.now() > MIN_VALIDITY_MS;
}

function storePrimary(accessToken: string, expiresInSeconds: number, broadcast: boolean) {
  const token: PrimaryToken = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    userId: tokenSubject(accessToken),
  };
  tokenStore.setPrimary(token);
  if (broadcast) tabSync.post({ type: "token", ...token });
  scheduleProactiveRefresh();
}

// ------------------------------------------------------------------ refresh

async function callRefreshEndpoint(): Promise<RefreshResponse> {
  return rawRequest<RefreshResponse>("/auth/refresh", { method: "POST" });
}

function reasonFromError(error: ApiError): SessionEndReason {
  if (error.code === "SESSION_REVOKED") return "revoked";
  if (error.code === "TOKEN_INVALID") return "invalid";
  return "expired";
}

async function performRefresh(staleToken: string | null): Promise<string> {
  return withRefreshLock(async () => {
    // Outra aba pode ter renovado enquanto esperávamos o lock.
    const current = tokenStore.getPrimary();
    if (isFresh(current) && current.accessToken !== staleToken) return current.accessToken;

    try {
      const res = await callRefreshEndpoint();
      storePrimary(res.accessToken, res.expiresIn, true);
      return res.accessToken;
    } catch (error) {
      // Falha de rede ou 5xx: não derruba a sessão por instabilidade.
      if (isApiError(error) && (error.status === 401 || error.status === 403)) {
        endSession(reasonFromError(error), { broadcast: false });
      }
      throw error;
    }
  });
}

/**
 * Single-flight: chamadas simultâneas recebem a MESMA promessa e geram uma
 * única chamada a /auth/refresh nesta aba (e, pelo lock, entre abas).
 */
export function refreshAccessToken(): Promise<string> {
  if (!inflightRefresh) {
    const stale = tokenStore.getPrimary()?.accessToken ?? null;
    inflightRefresh = performRefresh(stale).finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

/** Token válido para uso imediato, renovando se estiver perto de vencer. */
export async function getValidAccessToken(): Promise<string> {
  const current = tokenStore.getPrimary();
  if (isFresh(current)) return current.accessToken;
  return refreshAccessToken();
}

// --------------------------------------------------------- renovação proativa

function scheduleProactiveRefresh() {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  proactiveTimer = null;
  const token = tokenStore.getPrimary();
  if (!token || typeof window === "undefined") return;
  // Jitter para as abas não dispararem juntas.
  const jitter = Math.random() * 5_000;
  const delay = Math.max(0, token.expiresAt - Date.now() - PROACTIVE_MARGIN_MS - jitter);
  proactiveTimer = setTimeout(() => {
    if (document.visibilityState === "visible") void refreshAccessToken().catch(() => {});
  }, delay);
}

function onVisible() {
  if (document.visibilityState !== "visible") return;
  const token = tokenStore.getPrimary();
  if (token && token.expiresAt - Date.now() < PROACTIVE_MARGIN_MS) {
    void refreshAccessToken().catch(() => {});
  }
  const imp = tokenStore.getImpersonation();
  if (imp && imp.expiresAt <= Date.now()) endImpersonation("expired");
}

// ------------------------------------------------------------ entre abas

function requestTokenFromPeers(): Promise<PrimaryToken | null> {
  if (!tabSync.available) return Promise.resolve(null);
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, PEER_TOKEN_TIMEOUT_MS);
    const unsubscribe = tabSync.subscribe((message) => {
      if (message.type === "token-response" && message.requestId === requestId) {
        clearTimeout(timer);
        unsubscribe();
        resolve({ accessToken: message.accessToken, expiresAt: message.expiresAt, userId: message.userId });
      }
    });
    tabSync.post({ type: "token-request", requestId });
  });
}

function handleTabMessage(message: Parameters<Parameters<typeof tabSync.subscribe>[0]>[0]) {
  switch (message.type) {
    case "token": {
      const current = tokenStore.getPrimary();
      if (current && current.expiresAt >= message.expiresAt) return;
      tokenStore.setPrimary({ accessToken: message.accessToken, expiresAt: message.expiresAt, userId: message.userId });
      scheduleProactiveRefresh();
      if (!activeUserId) {
        if (message.userId) emit("remote-login", { userId: message.userId });
      } else if (message.userId && message.userId !== activeUserId) {
        emit("user-switched", { userId: message.userId });
      }
      return;
    }
    case "token-request": {
      const current = tokenStore.getPrimary();
      if (isFresh(current)) {
        tabSync.post({ type: "token-response", requestId: message.requestId, ...current });
      }
      return;
    }
    case "logout":
      endSession("remote-logout", { broadcast: false });
      return;
  }
}

// ------------------------------------------------------------- ciclo de vida

/** Liga listeners globais uma única vez (idempotente, seguro no StrictMode). */
export function initSession() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  tabSync.subscribe(handleTabMessage);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
}

/**
 * Ao carregar a página não há token em memória. Tenta pegar de outra aba e,
 * se nenhuma responder, chama /auth/refresh (cookie httpOnly).
 * Resolve `true` se há sessão.
 */
export function bootstrapSession(): Promise<boolean> {
  initSession();
  bootstrapPromise ??= (async () => {
    if (isFresh(tokenStore.getPrimary())) return true;
    const fromPeer = await requestTokenFromPeers();
    if (isFresh(fromPeer)) {
      tokenStore.setPrimary(fromPeer);
      scheduleProactiveRefresh();
      return true;
    }
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}

/** Chamado após login 'ok' ou MFA verificado. */
export function applyLogin(res: Pick<LoginOkResponse, "accessToken" | "expiresIn">) {
  initSession();
  storePrimary(res.accessToken, res.expiresIn, true);
}

export function setActiveUser(userId: string | null) {
  activeUserId = userId;
}

export function endSession(reason: SessionEndReason, { broadcast }: { broadcast: boolean }) {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  if (impersonationTimer) clearTimeout(impersonationTimer);
  proactiveTimer = null;
  impersonationTimer = null;
  const hadSession = tokenStore.getPrimary() !== null || activeUserId !== null;
  tokenStore.clear();
  activeUserId = null;
  if (broadcast) tabSync.post({ type: "logout" });
  if (hadSession || reason === "logout") emit("session-ended", { reason });
}

export async function logout(): Promise<void> {
  const token = tokenStore.getPrimary()?.accessToken ?? null;
  try {
    await rawRequest("/auth/logout", { method: "POST", bearer: token });
  } catch {
    // Mesmo se a chamada falhar, a sessão local é encerrada.
  }
  endSession("logout", { broadcast: true });
}

// --------------------------------------------------------------- impersonação

export function startImpersonation(accessToken: string, clinic: { id: string; name: string }) {
  const exp = decodeJwtPayload(accessToken)?.exp;
  const expiresAt = typeof exp === "number" ? exp * 1000 : Date.now() + IMPERSONATION_FALLBACK_TTL_MS;
  tokenStore.setImpersonation({ accessToken, expiresAt, clinicId: clinic.id, clinicName: clinic.name });
  if (impersonationTimer) clearTimeout(impersonationTimer);
  impersonationTimer = setTimeout(() => endImpersonation("expired"), Math.max(0, expiresAt - Date.now()));
}

/** Descarta o token de impersonação (sem refresh: ele nunca é renovado). */
export function endImpersonation(reason: ImpersonationEndReason) {
  if (!tokenStore.getImpersonation()) return;
  if (impersonationTimer) clearTimeout(impersonationTimer);
  impersonationTimer = null;
  tokenStore.setImpersonation(null);
  emit("impersonation-ended", { reason });
}

/** Só para testes. */
export function _resetSessionForTests() {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  if (impersonationTimer) clearTimeout(impersonationTimer);
  proactiveTimer = null;
  impersonationTimer = null;
  inflightRefresh = null;
  bootstrapPromise = null;
  activeUserId = null;
  initialized = false;
  tokenStore.clear();
}
