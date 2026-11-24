import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Senha@123";
export const TOTP = "123456";

export async function login(page: Page, email: string, opts: { mfa?: boolean } = {}) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  if (opts.mfa) {
    await expect(page.getByRole("heading", { name: "Verificação em duas etapas" })).toBeVisible();
    await page.getByLabel("Código de verificação").fill(TOTP);
  }
}

/** Mexe no "servidor" simulado (estado do mock no localStorage). */
export async function mockState(page: Page, mutate: string) {
  await page.evaluate((code) => {
    const key = "__wpp_mock_backend__";
    const state = JSON.parse(localStorage.getItem(key) ?? "{}");
    new Function("state", code)(state);
    localStorage.setItem(key, JSON.stringify(state));
  }, mutate);
}

export async function refreshCalls(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("__wpp_mock_backend__") ?? "{}").refreshCalls ?? 0);
}
