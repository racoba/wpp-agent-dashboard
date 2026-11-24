/**
 * Marca "o agente já foi testado" (passo 6 do onboarding). O contrato não tem
 * esse dado, então fica no navegador. É só um booleano, sem dado sensível.
 */
const key = (clinicId: string) => `atende:agent-tested:${clinicId}`;
const listeners = new Set<() => void>();

export function wasAgentTested(clinicId: string | null | undefined): boolean {
  if (!clinicId || typeof localStorage === "undefined") return false;
  return localStorage.getItem(key(clinicId)) === "1";
}

export function markAgentTested(clinicId: string | null | undefined) {
  if (!clinicId || typeof localStorage === "undefined" || wasAgentTested(clinicId)) return;
  localStorage.setItem(key(clinicId), "1");
  listeners.forEach((l) => l());
}

export function subscribeAgentTested(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key?.startsWith("atende:agent-tested:") && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
