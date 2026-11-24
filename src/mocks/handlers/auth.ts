import { http, HttpResponse } from "msw";
import { permissionsForRole } from "@/lib/auth/permissions";
import { MOCK_TOTP_CODE, randomId, readDb, updateDb, type MockSession } from "../db";
import {
  apiError,
  apiPath,
  authenticate,
  deviceFromRequest,
  issueAccessToken,
  latency,
  noContent,
  publicUser,
} from "../utils";

const MFA_TOKEN_TTL_MS = 5 * 60_000;

function requireCsrfHeader(request: Request) {
  return request.headers.get("x-requested-with") === "XMLHttpRequest"
    ? null
    : apiError(403, "CSRF_REJECTED", "Cabeçalho X-Requested-With ausente.");
}

function createSession(request: Request, userId: string, mfaVerified: boolean): MockSession {
  return updateDb((state) => {
    const session: MockSession = {
      id: randomId("ses"),
      userId,
      refreshToken: randomId("rt"),
      previousRefreshTokens: [],
      revoked: false,
      mfaVerified,
      device: deviceFromRequest(request),
      ip: "127.0.0.1",
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    state.sessions.push(session);
    // Equivale ao Set-Cookie httpOnly do backend.
    state.cookieJar.refreshToken = session.refreshToken;
    return session;
  });
}

function loginOk(userId: string, session: MockSession) {
  const state = readDb();
  const user = state.users.find((u) => u.id === userId)!;
  return HttpResponse.json({ status: "ok", ...issueAccessToken(state, user, session), user: publicUser(user) });
}

export const authHandlers = [
  http.post(apiPath("/auth/login"), async ({ request }) => {
    await latency();
    const csrf = requireCsrfHeader(request);
    if (csrf) return csrf;
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
    const state = readDb();
    const user = state.users.find((u) => u.email.toLowerCase() === body?.email?.trim().toLowerCase());
    if (!user || user.password !== body?.password) {
      return apiError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    }
    if (user.mfaEnabled) {
      const mfaToken = randomId("mfa");
      updateDb((s) => {
        s.mfaTokens.push({ token: mfaToken, userId: user.id, expiresAt: Date.now() + MFA_TOKEN_TTL_MS, used: false });
      });
      return HttpResponse.json({ status: "mfa_required", mfaToken });
    }
    return loginOk(user.id, createSession(request, user.id, false));
  }),

  http.post(apiPath("/auth/mfa/verify"), async ({ request }) => {
    await latency();
    const csrf = requireCsrfHeader(request);
    if (csrf) return csrf;
    const body = (await request.json().catch(() => null)) as { mfaToken?: string; code?: string } | null;
    const state = readDb();
    const entry = state.mfaTokens.find((m) => m.token === body?.mfaToken);
    if (!entry || entry.used) return apiError(401, "TOKEN_INVALID", "Etapa de verificação inválida.");
    if (entry.expiresAt <= Date.now()) return apiError(401, "TOKEN_EXPIRED", "A etapa de verificação expirou.");
    const user = state.users.find((u) => u.id === entry.userId)!;
    const code = (body?.code ?? "").trim().toUpperCase();
    const recoveryIndex = user.recoveryCodes.indexOf(code);
    if (code !== MOCK_TOTP_CODE && recoveryIndex === -1) {
      return apiError(401, "INVALID_MFA_CODE", "Código inválido.");
    }
    updateDb((s) => {
      s.mfaTokens.find((m) => m.token === entry.token)!.used = true;
      if (recoveryIndex !== -1) s.users.find((u) => u.id === user.id)!.recoveryCodes.splice(recoveryIndex, 1);
    });
    return loginOk(user.id, createSession(request, user.id, true));
  }),

  http.post(apiPath("/auth/refresh"), async ({ request }) => {
    await latency(120, 300);
    const csrf = requireCsrfHeader(request);
    if (csrf) return csrf;
    return updateDb((state) => {
      state.refreshCalls += 1;
      const presented = state.cookieJar.refreshToken;
      if (!presented) return apiError(401, "TOKEN_INVALID", "Sem sessão.");

      const session = state.sessions.find((s) => s.refreshToken === presented);
      if (!session) {
        // Token antigo reapresentado: reuso, então revoga a família inteira.
        const reused = state.sessions.find((s) => s.previousRefreshTokens.includes(presented));
        if (reused) reused.revoked = true;
        state.cookieJar.refreshToken = null;
        return apiError(401, "SESSION_REVOKED", reused ? "Reuso de refresh token detectado." : "Sessão encerrada.");
      }
      if (session.revoked) {
        state.cookieJar.refreshToken = null;
        return apiError(401, "SESSION_REVOKED", "Sessão encerrada.");
      }

      session.previousRefreshTokens.push(session.refreshToken);
      session.refreshToken = randomId("rt");
      session.lastUsedAt = new Date().toISOString();
      state.cookieJar.refreshToken = session.refreshToken;

      const user = state.users.find((u) => u.id === session.userId)!;
      return HttpResponse.json(issueAccessToken(state, user, session));
    });
  }),

  http.post(apiPath("/auth/logout"), async () => {
    await latency(100, 250);
    updateDb((state) => {
      const session = state.sessions.find((s) => s.refreshToken === state.cookieJar.refreshToken);
      if (session) session.revoked = true;
      state.cookieJar.refreshToken = null;
    });
    return noContent();
  }),

  http.post(apiPath("/auth/logout-all"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "auth");
    if (ctx instanceof Response) return ctx;
    updateDb((state) => {
      state.sessions.filter((s) => s.userId === ctx.user.id).forEach((s) => (s.revoked = true));
      state.cookieJar.refreshToken = null;
    });
    return noContent();
  }),

  http.get(apiPath("/auth/me"), async ({ request }) => {
    await latency(100, 300);
    const ctx = authenticate(request, "auth");
    if (ctx instanceof Response) return ctx;
    const clinic = ctx.user.clinicId ? ctx.state.clinics.find((c) => c.id === ctx.user.clinicId) : null;
    return HttpResponse.json({
      user: publicUser(ctx.user),
      clinic: clinic ? { id: clinic.id, name: clinic.name, timezone: clinic.timezone, status: clinic.status } : null,
      permissions: permissionsForRole(ctx.user.role),
    });
  }),

  http.get(apiPath("/auth/sessions"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "auth");
    if (ctx instanceof Response) return ctx;
    const sessions = ctx.state.sessions
      .filter((s) => s.userId === ctx.user.id && !s.revoked)
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .map((s) => ({
        id: s.id,
        device: s.device,
        ip: s.ip,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: s.id === ctx.session.id,
      }));
    return HttpResponse.json(sessions);
  }),

  http.delete(apiPath("/auth/sessions/:id"), async ({ request, params }) => {
    await latency();
    const ctx = authenticate(request, "auth");
    if (ctx instanceof Response) return ctx;
    const found = updateDb((state) => {
      const session = state.sessions.find((s) => s.id === params.id && s.userId === ctx.user.id);
      if (!session) return false;
      session.revoked = true;
      if (session.refreshToken === state.cookieJar.refreshToken) state.cookieJar.refreshToken = null;
      return true;
    });
    return found ? noContent() : apiError(404, "NOT_FOUND", "Sessão não encontrada.");
  }),

  http.post(apiPath("/auth/forgot-password"), async ({ request }) => {
    await latency();
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    updateDb((state) => {
      const user = state.users.find((u) => u.email.toLowerCase() === body?.email?.trim().toLowerCase());
      if (user) state.resetTokens.push({ token: "demo-reset-token", userId: user.id, expiresAt: Date.now() + 3_600_000 });
    });
    // Sempre 204, para não revelar se o e-mail existe.
    return noContent();
  }),

  http.post(apiPath("/auth/reset-password"), async ({ request }) => {
    await latency();
    const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
    const result = updateDb((state) => {
      const entry = state.resetTokens.find((r) => r.token === body?.token && r.expiresAt > Date.now());
      if (!entry || !body?.password) return false;
      const user = state.users.find((u) => u.id === entry.userId)!;
      user.password = body.password;
      // Redefinição revoga TODAS as sessões.
      state.sessions.filter((s) => s.userId === user.id).forEach((s) => (s.revoked = true));
      state.resetTokens = state.resetTokens.filter((r) => r !== entry);
      state.cookieJar.refreshToken = null;
      return true;
    });
    return result ? noContent() : apiError(400, "TOKEN_INVALID", "Link inválido ou expirado.");
  }),

  http.post(apiPath("/auth/mfa/setup"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "auth");
    if (ctx instanceof Response) return ctx;
    const secret = "JBSWY3DPEHPK3PXP";
    updateDb((state) => {
      state.users.find((u) => u.id === ctx.user.id)!.pendingMfaSecret = secret;
    });
    const label = encodeURIComponent(`Atende:${ctx.user.email}`);
    return HttpResponse.json({ otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=Atende`, secret });
  }),

  http.post(apiPath("/auth/mfa/enable"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "auth");
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => null)) as { code?: string } | null;
    if (!ctx.user.pendingMfaSecret) return apiError(400, "MFA_SETUP_REQUIRED", "Inicie a configuração novamente.");
    if (body?.code !== MOCK_TOTP_CODE) return apiError(400, "INVALID_MFA_CODE", "Código inválido.");
    const recoveryCodes = Array.from({ length: 8 }, () => {
      const raw = crypto.randomUUID().replace(/-/g, "").toUpperCase();
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    });
    updateDb((state) => {
      const user = state.users.find((u) => u.id === ctx.user.id)!;
      user.mfaEnabled = true;
      user.pendingMfaSecret = null;
      user.recoveryCodes = recoveryCodes;
      state.sessions.find((s) => s.id === ctx.session.id)!.mfaVerified = true;
    });
    return HttpResponse.json({ recoveryCodes });
  }),
];
