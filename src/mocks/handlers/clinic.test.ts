import { describe, expect, it } from "vitest";
import { adminApi, clinicApi } from "@/lib/api/endpoints";
import { startImpersonation } from "@/lib/auth/session";
import { DEFAULT_AGENT_SETTINGS } from "@/mocks/db";
import { loginAs } from "@/test/helpers";

describe("regras de escrita do painel da clínica", () => {
  it("clinic_staff edita catálogo, mas não o agente nem os dados da clínica", async () => {
    await loginAs("recepcao@sorrisopleno.com.br");
    await expect(clinicApi.createService({ name: "Retorno", durationMinutes: 20, priceCents: null, description: null, active: true })).resolves.toMatchObject({ name: "Retorno" });
    await expect(clinicApi.updateAgentSettings(DEFAULT_AGENT_SETTINGS)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(clinicApi.updateClinic({ name: "X" })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("impersonação lê tudo e recebe IMPERSONATION_READ_ONLY ao escrever", async () => {
    await loginAs("master@atende.app");
    const { accessToken } = await adminApi.impersonate("cli_sorriso");
    startImpersonation(accessToken, { id: "cli_sorriso", name: "Clínica Sorriso Pleno" });
    await expect(clinicApi.professionals()).resolves.toHaveLength(3);
    await expect(clinicApi.deleteService("svc_limpeza")).rejects.toMatchObject({ status: 403, code: "IMPERSONATION_READ_ONLY" });
    // A prévia é uma simulação: liberada mesmo em modo leitura.
    await expect(clinicApi.agentPreview({ messages: [{ role: "patient", text: "oi" }] })).resolves.toHaveProperty("reply");
  });

  it("não ativa o agente sem os pré-requisitos (409 AGENT_NOT_READY)", async () => {
    await loginAs("nova@clinicaesperanca.com.br");
    await expect(clinicApi.activateAgent()).rejects.toMatchObject({
      status: 409,
      code: "AGENT_NOT_READY",
      details: { missing: ["whatsapp", "hasProfessionalWithCalendar", "hasAvailability"] },
    });
  });

  it("readiness reflete os horários salvos", async () => {
    await loginAs("nova@clinicaesperanca.com.br");
    expect((await clinicApi.readiness()).hasAvailability).toBe(false);
    const pro = await clinicApi.createProfessional({ name: "Dra. Teste", specialty: null, active: true });
    await clinicApi.setAvailability(pro.id, { rules: [{ weekday: 1, start: "08:00", end: "12:00" }] });
    expect((await clinicApi.readiness()).hasAvailability).toBe(true);
  });

  it("rejeita faixas sobrepostas com VALIDATION_ERROR por campo", async () => {
    await loginAs("admin@sorrisopleno.com.br");
    await expect(
      clinicApi.setAvailability("pro_marina", {
        rules: [
          { weekday: 1, start: "08:00", end: "12:00" },
          { weekday: 1, start: "11:00", end: "13:00" },
        ],
      }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR", details: { fields: { rules: expect.any(String) } } });
  });
});
