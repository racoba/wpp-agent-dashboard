import { describe, expect, it } from "vitest";
import { loginPathFor, sanitizeNextPath } from "./permissions";

describe("loginPathFor", () => {
  it("sessão revogada leva o motivo e a rota de retorno", () => {
    expect(loginPathFor("revoked", "/app/conexoes")).toBe("/login?motivo=revoked&next=%2Fapp%2Fconexoes");
  });

  it("logout voluntário não guarda rota de retorno", () => {
    expect(loginPathFor("logout", "/app/conexoes")).toBe("/login?motivo=logout");
    expect(loginPathFor("remote-logout", "/admin")).toBe("/login?motivo=logout");
  });

  it("sem motivo (primeiro acesso) só guarda a rota", () => {
    expect(loginPathFor(null, "/app")).toBe("/login?next=%2Fapp");
  });
});

describe("sanitizeNextPath", () => {
  it.each([
    ["/app/conexoes", "clinic_admin", "/app/conexoes"],
    ["/app?x=1", "clinic_staff", "/app?x=1"],
    ["/admin/clinicas", "master_admin", "/admin/clinicas"],
  ] as const)("aceita %s para %s", (next, role, expected) => {
    expect(sanitizeNextPath(next, role)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "//evil.com/app",
    "/\\evil.com",
    "/login",
    "javascript:alert(1)",
    "app",
    "",
  ])("rejeita %s", (next) => {
    expect(sanitizeNextPath(next, "clinic_admin")).toBeNull();
  });

  it("não manda o papel para o painel do outro", () => {
    expect(sanitizeNextPath("/admin", "clinic_admin")).toBeNull();
    expect(sanitizeNextPath("/app", "master_admin")).toBeNull();
  });
});
