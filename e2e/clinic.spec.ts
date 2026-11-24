import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("onboarding de clínica nova: dados → serviços/profissionais → horários → teste → ativar bloqueado", async ({ page }) => {
  await login(page, "nova@clinicaesperanca.com.br");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: "Continuar configuração" }).click();
  await expect(page.getByText("0 de 7 concluídos")).toBeVisible();

  // 1. Dados da clínica
  await expect(page.getByRole("heading", { name: "Dados da clínica", level: 2 })).toBeVisible();
  await page.getByLabel("Telefone de contato").fill("(11) 3333-4444");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText("1 de 7 concluídos")).toBeVisible();

  // 2. Serviços e profissionais
  await expect(page.getByRole("heading", { name: "Profissionais e serviços", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Serviço", exact: true }).click();
  const svc = page.getByRole("dialog", { name: "Novo serviço" });
  await svc.getByLabel("Nome").fill("Consulta de avaliação");
  await svc.getByLabel("Duração (minutos)").fill("40");
  await svc.getByLabel("Valor (opcional)").fill("180,00");
  await svc.getByRole("button", { name: "Salvar" }).click();
  await expect(svc).toBeHidden();

  await page.getByRole("button", { name: "Profissional", exact: true }).click();
  const pro = page.getByRole("dialog", { name: "Novo profissional" });
  await pro.getByLabel("Nome").fill("Dra. Beatriz Lima");
  await pro.getByLabel("Consulta de avaliação").check();
  await pro.getByRole("button", { name: "Salvar" }).click();
  await expect(pro).toBeHidden();
  await expect(page.getByText("2 de 7 concluídos")).toBeVisible();

  // 3. Horários
  await page.getByRole("button", { name: "Próxima etapa" }).click();
  await page.getByRole("switch", { name: "Segunda-feira: fechado" }).click();
  await page.getByRole("button", { name: "Salvar horários" }).click();
  await expect(page.getByText("3 de 7 concluídos")).toBeVisible();

  // 6. Testar o agente
  await page.getByRole("button", { name: /Testar o agente/ }).click();
  await page.getByRole("button", { name: "Oi, quero agendar uma consulta" }).click();
  await expect(page.getByText(/Ação simulada/)).toBeVisible();
  await expect(page.getByText("4 de 7 concluídos")).toBeVisible();

  // 7. Ativar: bloqueado sem WhatsApp e agenda (Fase 3)
  await page.getByRole("button", { name: /^7 Ativar/ }).click();
  await expect(page.getByRole("button", { name: "Ativar agente" })).toBeDisabled();
  await expect(page.getByText("WhatsApp conectado")).toBeVisible();
});

test("agente: prévia usa as configurações ainda não salvas", async ({ page }) => {
  await login(page, "admin@sorrisopleno.com.br");
  await page.getByRole("link", { name: "Agente" }).click();
  const welcome = page.getByLabel("Boas-vindas");
  await welcome.fill("Olá! Aqui é a Sol, da Sorriso Pleno.");
  await expect(page.getByText("Alterações não salvas")).toBeVisible();
  await page.getByLabel("Mensagem de teste").fill("oi");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("log").getByText("Olá! Aqui é a Sol, da Sorriso Pleno.")).toBeVisible();
});

test("equipe vê o agente só para leitura e edita horários", async ({ page }) => {
  await login(page, "recepcao@sorrisopleno.com.br");
  await page.getByRole("link", { name: "Agente" }).click();
  await expect(page.getByText(/Seu papel permite apenas visualizar/)).toBeVisible();
  await expect(page.getByLabel("Boas-vindas")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Salvar configurações" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Desativar agente|Ativar agente/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Horários" }).click();
  await expect(page.getByLabel("Terça-feira, faixa 1: início")).toBeEnabled();
});

test("impersonação: telas de edição ficam somente leitura", async ({ page }) => {
  await login(page, "master@atende.app", { mfa: true });
  await page.getByRole("link", { name: "Clínicas" }).click();
  await page.getByLabel("Buscar clínica por nome").fill("Sorriso Pleno");
  await page.getByRole("button", { name: /Entrar como a clínica: Clínica Sorriso Pleno/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: "Profissionais" }).click();
  await expect(page.getByText(/Modo somente leitura/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo profissional" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Editar Dra. Marina/ })).toHaveCount(0);
});
