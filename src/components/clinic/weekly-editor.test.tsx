import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { readDb } from "@/mocks/db";
import { loginAs } from "@/test/helpers";
import { renderWithQuery } from "@/test/render";
import { WeeklyEditor } from "./weekly-editor";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe("WeeklyEditor", () => {
  it("carrega as faixas, acusa sobreposição e não salva enquanto houver erro", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    renderWithQuery(<WeeklyEditor professionalId="pro_marina" readOnly={false} />);

    const start = await screen.findByLabelText("Segunda-feira, faixa 2: início");
    expect(start).toHaveValue("13:30");

    await userEvent.clear(start);
    await userEvent.type(start, "11:00");
    expect(await screen.findByText("Sobrepõe a faixa 08:00–12:00.")).toBeInTheDocument();
    expect(start).toHaveAttribute("aria-invalid", "true");

    await userEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Corrija os horários destacados");
    expect(readDb().availability.pro_marina?.find((r) => r.weekday === 1 && r.start === "11:00")).toBeUndefined();
  });

  it("liga um dia, copia para os dias úteis e salva", async () => {
    await loginAs("nova@clinicaesperanca.com.br");
    const { clinicApi } = await import("@/lib/api/endpoints");
    const pro = await clinicApi.createProfessional({ name: "Dr. Novo", specialty: null, active: true });
    renderWithQuery(<WeeklyEditor professionalId={pro.id} readOnly={false} />);

    await userEvent.click(await screen.findByRole("switch", { name: "Segunda-feira: fechado" }));
    expect(screen.getByLabelText("Segunda-feira, faixa 1: início")).toHaveValue("08:00");

    await userEvent.click(screen.getByRole("button", { name: "Copiar horários de Segunda-feira" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Dias úteis (seg–sex)" }));
    expect(screen.getByLabelText("Sexta-feira, faixa 1: fim")).toHaveValue("12:00");
    expect(screen.getByText(/20 h de atendimento por semana/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Salvar horários" }));
    await waitFor(() => expect(readDb().availability[pro.id]).toHaveLength(5));
    expect(screen.getByRole("button", { name: "Salvar horários" })).toBeDisabled();
  });

  it("modo leitura não mostra controles de edição", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    renderWithQuery(<WeeklyEditor professionalId="pro_marina" readOnly />);
    const fieldset = (await screen.findByLabelText("Segunda-feira, faixa 1: início")).closest("fieldset")!;
    expect(fieldset).toBeDisabled();
    expect(within(fieldset).queryByRole("button", { name: /Remover faixa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar horários" })).toBeNull();
  });
});
