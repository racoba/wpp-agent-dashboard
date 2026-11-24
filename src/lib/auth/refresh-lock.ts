import { tabSync } from "./tab-sync";

/**
 * Garante que só UMA aba chama /auth/refresh por vez. Como o refresh token
 * rotaciona, duas abas enviando o mesmo cookie ao mesmo tempo seriam
 * vistas pelo backend como reuso (e a sessão seria revogada). Em sequência,
 * a segunda aba já envia o cookie novo, gravado pela resposta da primeira.
 *
 * Preferência: Web Locks API. Sem ela, um aviso por BroadcastChannel
 * ("estou renovando") faz as outras abas esperarem um pouco.
 */

const LOCK_NAME = "wpp-agent-auth-refresh";
const FALLBACK_WAIT_MS = 5_000;

let peerRefreshingUntil = 0;
let fallbackWaiters: Array<() => void> = [];

if (typeof window !== "undefined") {
  tabSync.subscribe((message) => {
    if (message.type === "refreshing") {
      peerRefreshingUntil = Math.min(message.until, Date.now() + FALLBACK_WAIT_MS);
    } else if (message.type === "token") {
      peerRefreshingUntil = 0;
      const waiters = fallbackWaiters;
      fallbackWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  });
}

function waitForPeer(): Promise<void> {
  const remaining = peerRefreshingUntil - Date.now();
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, remaining);
    function done() {
      clearTimeout(timer);
      resolve();
    }
    fallbackWaiters.push(done);
  });
}

export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, { mode: "exclusive" }, task) as Promise<T>;
  }
  await waitForPeer();
  tabSync.post({ type: "refreshing", until: Date.now() + FALLBACK_WAIT_MS });
  return task();
}
