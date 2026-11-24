import { expect, test } from "@playwright/test";
import { login, mockState, refreshCalls } from "./helpers";

test.describe("login", () => {
  test("sem MFA leva ao painel da clínica @mobile", async ({ page }) => {
    await login(page, "admin@sorrisopleno.com.br");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByText("Clínica Sorriso Pleno").first()).toBeVisible();
  });

  test("com MFA pede o código e entra", async ({ page }) => {
    await login(page, "gestora@vidaesaude.com.br", { mfa: true });
    await expect(page).toHaveURL(/\/app$/);
  });

  test("master sem MFA é forçado a configurar antes do painel", async ({ page }) => {
    await login(page, "novo.master@atende.app");
    await expect(page).toHaveURL(/\/configurar-mfa$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/configurar-mfa$/);
    await page.getByLabel(/Digite o código/).fill("123456");
    await expect(page.getByText("Guarde seus códigos de recuperação")).toBeVisible();
    await page.getByRole("button", { name: /Guardei os códigos/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("preserva a rota de retorno", async ({ page }) => {
    await page.goto("/app/conexoes");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fconexoes/);
    await page.getByLabel("E-mail").fill("admin@sorrisopleno.com.br");
    await page.getByLabel("Senha").fill("Senha@123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/app\/conexoes$/);
  });
});

test.describe("sessão", () => {
  test("recarregar a página recupera a sessão pelo cookie de refresh", async ({ page }) => {
    await login(page, "admin@sorrisopleno.com.br");
    await expect(page).toHaveURL(/\/app$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    // O token nunca vai para o storage do navegador.
    const leaked = await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage), document.cookie].some((v) =>
        /eyJ[\w-]+\.eyJ/.test(v.replace(/"cookieJar".*$/, "")),
      ),
    );
    expect(leaked).toBe(false);
  });

  test("token expirado com duas abas ativas: um único refresh no total", async ({ context }) => {
    const a = await context.newPage();
    await login(a, "master@atende.app", { mfa: true });
    await expect(a).toHaveURL(/\/admin$/);
    await a.goto("/admin/clinicas");
    const b = await context.newPage();
    await b.goto("/admin/clinicas");
    for (const page of [a, b]) await expect(page.getByRole("cell", { name: "Aurora Dermatologia", exact: true })).toBeVisible();

    const before = await refreshCalls(a);
    await mockState(a, "state.faults.expireIssuedBefore = Date.now() + 1");
    // Requisições simultâneas nas duas abas, ambas com token vencido.
    await Promise.all([a.getByLabel("Buscar clínica por nome").fill("Clínica"), b.getByLabel("Buscar clínica por nome").fill("Odonto")]);

    await expect(a.getByRole("cell", { name: "Clínica Sorriso Pleno", exact: true })).toBeVisible();
    await expect(b.getByRole("cell", { name: "Odonto Prime Centro", exact: true })).toBeVisible();
    expect((await refreshCalls(a)) - before).toBe(1);
  });

  test("sessão revogada no servidor volta ao login com aviso", async ({ page }) => {
    await login(page, "master@atende.app", { mfa: true });
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Clínicas" }).click();
    await expect(page.getByRole("cell", { name: "Aurora Dermatologia", exact: true })).toBeVisible();
    await mockState(page, "state.sessions.forEach(s => s.revoked = true)");
    await page.getByLabel("Buscar clínica por nome").fill("Vida");
    await expect(page).toHaveURL(/\/login\?motivo=revoked/);
    await expect(page.getByText(/sessão foi encerrada/)).toBeVisible();
  });

  test("logout propaga entre abas", async ({ context }) => {
    const a = await context.newPage();
    await login(a, "admin@sorrisopleno.com.br");
    await expect(a).toHaveURL(/\/app$/);
    const b = await context.newPage();
    await b.goto("/app");
    await expect(b.getByRole("heading", { name: "Visão geral" })).toBeVisible();

    await a.getByRole("button", { name: /Menu do usuário/ }).click();
    await a.getByRole("menuitem", { name: "Sair" }).click();
    await expect(a).toHaveURL(/\/login/);
    await expect(b).toHaveURL(/\/login/);
  });
});

test.describe("guardas por papel", () => {
  test("equipe não vê Equipe no menu e recebe 'sem permissão' pela URL", async ({ page }) => {
    await login(page, "recepcao@sorrisopleno.com.br");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("link", { name: "Equipe" })).toHaveCount(0);
    await page.goto("/app/equipe");
    await expect(page.getByText("Você não tem permissão")).toBeVisible();
  });

  test("clínica no /admin vê 'sem permissão'", async ({ page }) => {
    await login(page, "admin@sorrisopleno.com.br");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/admin");
    await expect(page.getByText("Você não tem permissão")).toBeVisible();
  });

  test("clínica suspensa vê o aviso 423", async ({ page }) => {
    await login(page, "contato@auroraderm.com.br");
    await expect(page.getByText("Clínica suspensa")).toBeVisible();
  });
});

test("master entra como clínica em modo leitura e sai", async ({ page }) => {
  await login(page, "master@atende.app", { mfa: true });
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Clínicas" }).click();
  await page.getByRole("button", { name: /Entrar como a clínica: Clínica Sorriso Pleno/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  const banner = page.getByRole("region", { name: "Modo de visualização como clínica" });
  await expect(banner).toContainText("Você está visualizando como Clínica Sorriso Pleno, modo somente leitura.");
  await banner.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/admin\/clinicas$/);
  await expect(banner).toHaveCount(0);
});
