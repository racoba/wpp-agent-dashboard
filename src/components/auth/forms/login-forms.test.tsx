import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MOCK_PASSWORD, MOCK_TOTP_CODE } from "@/mocks/db";
import { CredentialsForm } from "./credentials-form";
import { MfaStep } from "./mfa-step";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("CredentialsForm", () => {
  it("valida os campos antes de enviar", async () => {
    const onResult = vi.fn();
    render(<CredentialsForm onResult={onResult} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "nao-e-email");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(screen.getByText("Campo obrigatório.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
    expect(onResult).not.toHaveBeenCalled();
  });

  it("mostra erro de credenciais e limpa a senha", async () => {
    render(<CredentialsForm onResult={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "admin@sorrisopleno.com.br");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("login sem MFA devolve status ok", async () => {
    const onResult = vi.fn();
    render(<CredentialsForm onResult={onResult} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "admin@sorrisopleno.com.br");
    await userEvent.type(screen.getByLabelText("Senha"), MOCK_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" })));
  });

  it("login com MFA devolve mfa_required", async () => {
    const onResult = vi.fn();
    render(<CredentialsForm onResult={onResult} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "gestora@vidaesaude.com.br");
    await userEvent.type(screen.getByLabelText("Senha"), MOCK_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: "mfa_required", mfaToken: expect.any(String) })),
    );
  });
});

describe("MfaStep", () => {
  async function getMfaToken() {
    const { authApi } = await import("@/lib/api/endpoints");
    const res = await authApi.login({ email: "gestora@vidaesaude.com.br", password: MOCK_PASSWORD });
    if (res.status !== "mfa_required") throw new Error("esperava MFA");
    return res.mfaToken;
  }

  it("código errado mostra erro; código certo conclui", async () => {
    const mfaToken = await getMfaToken();
    const onSuccess = vi.fn();
    render(<MfaStep mfaToken={mfaToken} startedAt={Date.now()} onSuccess={onSuccess} onExpired={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Código de verificação"), "000000");
    expect(await screen.findByText("Código inválido. Confira e tente de novo.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Código de verificação"), MOCK_TOTP_CODE);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: "ok" })));
  });

  it("aceita código de recuperação", async () => {
    const mfaToken = await getMfaToken();
    const onSuccess = vi.fn();
    render(<MfaStep mfaToken={mfaToken} startedAt={Date.now()} onSuccess={onSuccess} onExpired={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usar um código de recuperação" }));
    await userEvent.type(screen.getByLabelText("Código de recuperação"), "abcd-efgh");
    await userEvent.click(screen.getByRole("button", { name: "Verificar" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("volta ao início quando a etapa expira", async () => {
    const onExpired = vi.fn();
    render(<MfaStep mfaToken="qualquer" startedAt={Date.now() - 6 * 60_000} onSuccess={vi.fn()} onExpired={onExpired} />);
    await waitFor(() => expect(onExpired).toHaveBeenCalled());
  });
});
