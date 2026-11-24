import { describe, expect, it } from "vitest";
import type { MeResponse, Role } from "@/lib/api/types";
import { decideGuard } from "./route-guard";

function me(role: Role, mfaEnabled = true): MeResponse {
  return {
    user: { id: "u1", name: "Teste", email: "t@x.com", role, clinicId: role === "master_admin" ? null : "c1", mfaEnabled },
    clinic: null,
    permissions: [],
  };
}

const clinicGuard = { roles: ["clinic_admin", "clinic_staff"] as Role[], allowImpersonation: true };
const adminGuard = { roles: ["master_admin"] as Role[], requireMfa: true };
const imp = { clinicId: "c1", clinicName: "Clínica", expiresAt: Date.now() + 60_000 };

describe("decideGuard", () => {
  it("espera enquanto a sessão carrega", () => {
    expect(decideGuard({ status: "loading", me: null, impersonation: null }, clinicGuard, "/app")).toEqual({ kind: "loading" });
  });

  it("sem sessão, vai ao login preservando a rota", () => {
    expect(decideGuard({ status: "unauthenticated", me: null, impersonation: null }, clinicGuard, "/app/conexoes?x=1")).toEqual({
      kind: "redirect",
      to: "/login?next=%2Fapp%2Fconexoes%3Fx%3D1",
    });
  });

  it("libera clinic_admin e clinic_staff no /app", () => {
    for (const role of ["clinic_admin", "clinic_staff"] as Role[]) {
      expect(decideGuard({ status: "authenticated", me: me(role), impersonation: null }, clinicGuard, "/app").kind).toBe("allow");
    }
  });

  it("clinic_staff no /admin vê 'sem permissão'", () => {
    expect(decideGuard({ status: "authenticated", me: me("clinic_staff"), impersonation: null }, adminGuard, "/admin")).toEqual({
      kind: "forbidden",
    });
  });

  it("master no /app sem impersonação volta ao /admin", () => {
    expect(decideGuard({ status: "authenticated", me: me("master_admin"), impersonation: null }, clinicGuard, "/app")).toEqual({
      kind: "redirect",
      to: "/admin",
    });
  });

  it("master impersonando pode ver o /app", () => {
    expect(decideGuard({ status: "authenticated", me: me("master_admin"), impersonation: imp }, clinicGuard, "/app").kind).toBe("allow");
  });

  it("master sem MFA é levado ao assistente de configuração", () => {
    expect(decideGuard({ status: "authenticated", me: me("master_admin", false), impersonation: null }, adminGuard, "/admin")).toEqual({
      kind: "redirect",
      to: "/configurar-mfa",
    });
  });
});
