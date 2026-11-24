import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { authApi, clinicApi, adminApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import { on } from "@/lib/events";
import { readDb, updateDb } from "@/mocks/db";
import { server } from "@/mocks/node";
import { apiPath } from "@/mocks/utils";
import { expireAccessTokens, loginAs, refreshCalls } from "@/test/helpers";
import { bootstrapSession, endImpersonation, logout, startImpersonation } from "./session";
import { tokenStore } from "./token-store";

describe("interceptor e refresh", () => {
  it("envia Bearer nas rotas /clinic e cookie + X-Requested-With nas rotas /auth", async () => {
    const seen: Record<string, { auth: string | null; xrw: string | null }> = {};
    server.events.on("request:start", ({ request }) => {
      const path = new URL(request.url).pathname;
      seen[path] = { auth: request.headers.get("authorization"), xrw: request.headers.get("x-requested-with") };
    });

    await loginAs("admin@sorrisopleno.com.br");
    await clinicApi.readiness();

    expect(seen["/api/auth/login"]).toEqual({ auth: null, xrw: "XMLHttpRequest" });
    expect(seen["/api/clinic/readiness"]?.auth).toMatch(/^Bearer /);
    expect(seen["/api/clinic/readiness"]?.xrw).toBeNull();
    server.events.removeAllListeners();
  });

  it("após TOKEN_EXPIRED faz UM refresh para várias requisições simultâneas e repete cada uma", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    const before = refreshCalls();
    const oldToken = tokenStore.getPrimary()!.accessToken;
    expireAccessTokens();

    const results = await Promise.all([
      clinicApi.readiness(),
      clinicApi.connections(),
      clinicApi.getClinic(),
      clinicApi.readiness(),
      authApi.me(),
    ]);

    expect(results).toHaveLength(5);
    expect(refreshCalls() - before).toBe(1);
    expect(tokenStore.getPrimary()!.accessToken).not.toBe(oldToken);
  });

  it("refresh rotaciona o cookie e o refresh token antigo fica marcado como usado", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    const firstCookie = readDb().cookieJar.refreshToken;
    expireAccessTokens();
    await clinicApi.readiness();
    const db = readDb();
    expect(db.cookieJar.refreshToken).not.toBe(firstCookie);
    expect(db.sessions.some((s) => s.previousRefreshTokens.includes(firstCookie!))).toBe(true);
  });

  it("encerra a sessão quando o refresh falha (reuso detectado → SESSION_REVOKED)", async () => {
    const ended = vi.fn();
    const off = on("session-ended", ended);
    await loginAs("admin@sorrisopleno.com.br");
    expireAccessTokens();
    await clinicApi.readiness(); // primeira rotação
    // Reapresenta o cookie antigo (como faria uma aba concorrente sem lock).
    updateDb((s) => {
      const session = s.sessions.find((x) => x.refreshToken === s.cookieJar.refreshToken)!;
      s.cookieJar.refreshToken = session.previousRefreshTokens[0]!;
    });
    expireAccessTokens();

    await expect(clinicApi.readiness()).rejects.toMatchObject({ code: "SESSION_REVOKED" });
    expect(ended).toHaveBeenCalledWith({ reason: "revoked" });
    expect(tokenStore.getPrimary()).toBeNull();
    off();
  });

  it("TOKEN_INVALID vai direto ao login, sem tentar refresh", async () => {
    const ended = vi.fn();
    const off = on("session-ended", ended);
    await loginAs("admin@sorrisopleno.com.br");
    const before = refreshCalls();
    updateDb((s) => void (s.faults.nextInvalidToken = true));

    await expect(clinicApi.readiness()).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    expect(refreshCalls()).toBe(before);
    expect(ended).toHaveBeenCalledWith({ reason: "invalid" });
    off();
  });

  it("SESSION_REVOKED (revogada no servidor) encerra a sessão", async () => {
    const ended = vi.fn();
    const off = on("session-ended", ended);
    await loginAs("admin@sorrisopleno.com.br");
    updateDb((s) => s.sessions.forEach((x) => (x.revoked = true)));
    await expect(clinicApi.readiness()).rejects.toMatchObject({ code: "SESSION_REVOKED" });
    expect(ended).toHaveBeenCalledWith({ reason: "revoked" });
    off();
  });

  it("falha de rede no refresh NÃO derruba a sessão", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    expireAccessTokens();
    server.use(http.post(apiPath("/auth/refresh"), () => HttpResponse.error()));
    await expect(clinicApi.readiness()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(tokenStore.getPrimary()).not.toBeNull();
  });

  it("propaga 423 CLINIC_SUSPENDED como ApiError", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    updateDb((s) => void (s.clinics.find((c) => c.id === "cli_sorriso")!.status = "suspended"));
    const error = await clinicApi.readiness().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 423, code: "CLINIC_SUSPENDED" });
  });
});

describe("bootstrap e logout", () => {
  it("ao recarregar (sem token em memória) recupera a sessão via cookie de refresh", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    tokenStore.clear(); // simula F5
    await expect(bootstrapSession()).resolves.toBe(true);
    expect(tokenStore.getPrimary()).not.toBeNull();
    await expect(authApi.me()).resolves.toMatchObject({ user: { email: "admin@sorrisopleno.com.br" } });
  });

  it("sem cookie, o bootstrap resolve false", async () => {
    await expect(bootstrapSession()).resolves.toBe(false);
  });

  it("logout revoga a sessão no servidor e limpa a memória", async () => {
    const ended = vi.fn();
    const off = on("session-ended", ended);
    await loginAs("admin@sorrisopleno.com.br");
    await logout();
    expect(tokenStore.getPrimary()).toBeNull();
    expect(readDb().cookieJar.refreshToken).toBeNull();
    expect(ended).toHaveBeenCalledWith({ reason: "logout" });
    await expect(bootstrapSession()).resolves.toBe(false);
    off();
  });
});

describe("MFA e papéis", () => {
  it("master sem MFA recebe 403 MFA_REQUIRED no /admin", async () => {
    await loginAs("novo.master@atende.app");
    await expect(adminApi.clinics()).rejects.toMatchObject({ status: 403, code: "MFA_REQUIRED" });
  });

  it("master com MFA verificado acessa /admin", async () => {
    await loginAs("master@atende.app");
    await expect(adminApi.clinics()).resolves.toMatchObject({ items: expect.any(Array) });
  });

  it("equipe da clínica recebe 403 FORBIDDEN no /admin", async () => {
    await loginAs("recepcao@sorrisopleno.com.br");
    await expect(adminApi.clinics()).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});

describe("impersonação", () => {
  it("usa o token de impersonação só em /clinic e mantém o do master em /admin", async () => {
    await loginAs("master@atende.app");
    const masterToken = tokenStore.getPrimary()!.accessToken;
    const { accessToken } = await adminApi.impersonate("cli_sorriso");
    startImpersonation(accessToken, { id: "cli_sorriso", name: "Clínica Sorriso Pleno" });

    const seen: string[] = [];
    server.events.on("request:start", ({ request }) => {
      seen.push(`${new URL(request.url).pathname} ${request.headers.get("authorization")}`);
    });
    await clinicApi.readiness();
    await adminApi.clinics();
    server.events.removeAllListeners();

    expect(seen[0]).toBe(`/api/clinic/readiness Bearer ${accessToken}`);
    expect(seen[1]).toBe(`/api/admin/clinics Bearer ${masterToken}`);
    endImpersonation("exit");
    expect(tokenStore.getImpersonation()).toBeNull();
    expect(tokenStore.getPrimary()!.accessToken).toBe(masterToken);
  });

  it("token de impersonação expirado volta ao admin sem refresh", async () => {
    const ended = vi.fn();
    const off = on("impersonation-ended", ended);
    await loginAs("master@atende.app");
    updateDb((s) => void (s.faults.impersonationTtlSeconds = -1));
    const { accessToken } = await adminApi.impersonate("cli_sorriso");
    // Força o caminho do 401 (o timer local também encerraria).
    tokenStore.setImpersonation({ accessToken, expiresAt: Date.now() + 60_000, clinicId: "cli_sorriso", clinicName: "X" });
    const before = refreshCalls();

    await expect(clinicApi.readiness()).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
    expect(ended).toHaveBeenCalledWith({ reason: "expired" });
    expect(refreshCalls()).toBe(before);
    expect(tokenStore.getPrimary()).not.toBeNull();
    off();
  });
});
