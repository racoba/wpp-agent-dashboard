import { http, HttpResponse } from "msw";
import { apiError, apiPath, authenticate, latency } from "../utils";

export const clinicHandlers = [
  http.get(apiPath("/clinic/clinic"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "clinic");
    if (ctx instanceof Response) return ctx;
    const clinic = ctx.clinic;
    if (!clinic) return apiError(404, "NOT_FOUND", "Clínica não encontrada.");
    return HttpResponse.json({
      id: clinic.id,
      name: clinic.name,
      timezone: clinic.timezone,
      phone: clinic.phone,
      email: clinic.email,
      address: clinic.address,
    });
  }),

  http.get(apiPath("/clinic/readiness"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "clinic");
    if (ctx instanceof Response) return ctx;
    const flags = ctx.state.readiness[ctx.clinic?.id ?? ""] ?? {
      whatsapp: false,
      hasProfessionalWithCalendar: false,
      hasAvailability: false,
      agentActive: false,
    };
    const values = Object.values(flags);
    return HttpResponse.json({ ...flags, completed: values.filter(Boolean).length, total: values.length });
  }),

  http.get(apiPath("/clinic/connections"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "clinic");
    if (ctx instanceof Response) return ctx;
    const connections = ctx.state.connections
      .filter((c) => c.clinicId === ctx.clinic?.id)
      .map((c) => ({
        id: c.id,
        type: c.type,
        provider: c.provider,
        status: c.status,
        lastCheckedAt: c.lastCheckedAt,
        lastError: c.lastError,
        summary: c.summary,
      }));
    return HttpResponse.json(connections);
  }),
];
