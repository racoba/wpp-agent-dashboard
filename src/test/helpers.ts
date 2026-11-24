import { authApi } from "@/lib/api/endpoints";
import { applyLogin } from "@/lib/auth/session";
import { MOCK_PASSWORD, MOCK_TOTP_CODE, readDb, updateDb } from "@/mocks/db";

/** Faz login real contra o mock (com MFA quando exigido) e guarda o token em memória. */
export async function loginAs(email: string) {
  const res = await authApi.login({ email, password: MOCK_PASSWORD });
  const ok = res.status === "ok" ? res : await authApi.verifyMfa({ mfaToken: res.mfaToken, code: MOCK_TOTP_CODE });
  applyLogin(ok);
  return ok;
}

/** Simula o servidor considerando vencidos todos os tokens de acesso emitidos até agora. */
export function expireAccessTokens() {
  updateDb((s) => {
    s.faults.expireIssuedBefore = Date.now() + 1;
  });
}

export function refreshCalls() {
  return readDb().refreshCalls;
}
