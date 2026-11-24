/** JWT falso do mock: mesmo formato (header.payload.assinatura), sem criptografia. */

export interface MockTokenPayload {
  sub: string;
  sid: string;
  role: string;
  clinicId: string | null;
  iat: number;
  exp: number;
  imp?: { clinicId: string; by: string };
}

function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

export function signMockToken(payload: Omit<MockTokenPayload, "iat" | "exp">, ttlSeconds: number): string {
  const iatMs = Date.now();
  const full: MockTokenPayload = {
    ...payload,
    iat: iatMs / 1000,
    exp: Math.floor(iatMs / 1000) + ttlSeconds,
  };
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  return `${header}.${base64url(JSON.stringify(full))}.mock-signature`;
}

export function readMockToken(token: string): MockTokenPayload | null {
  const [, payload, signature] = token.split(".");
  if (!payload || signature !== "mock-signature") return null;
  try {
    return JSON.parse(fromBase64url(payload)) as MockTokenPayload;
  } catch {
    return null;
  }
}
