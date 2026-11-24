/**
 * Comunicação entre abas da mesma origem via BroadcastChannel.
 * Usado para: compartilhar o token novo após um refresh, responder a uma aba
 * recém-aberta que pede o token (evita um refresh/rotação a mais) e propagar
 * o logout.
 */

export type TabMessage =
  | { type: "token"; accessToken: string; expiresAt: number; userId: string | null }
  | { type: "token-request"; requestId: string }
  | { type: "token-response"; requestId: string; accessToken: string; expiresAt: number; userId: string | null }
  | { type: "refreshing"; until: number }
  | { type: "logout" };

const CHANNEL_NAME = "wpp-agent-auth";

let channel: BroadcastChannel | null = null;
const listeners = new Set<(message: TabMessage) => void>();

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      listeners.forEach((listener) => listener(event.data));
    };
  }
  return channel;
}

export const tabSync = {
  post(message: TabMessage) {
    getChannel()?.postMessage(message);
  },
  subscribe(listener: (message: TabMessage) => void) {
    getChannel();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get available() {
    return getChannel() !== null;
  },
  /** Só para testes. */
  _reset() {
    channel?.close();
    channel = null;
    listeners.clear();
  },
};
