import { http, HttpResponse } from "msw";
import { randomId, updateDb } from "../db";
import { signMockToken } from "../jwt";
import { apiError, apiPath, authenticate, decodeCursor, encodeCursor, latency } from "../utils";

const PAGE_SIZE = 10;

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export const adminHandlers = [
  http.get(apiPath("/admin/clinics"), async ({ request }) => {
    await latency();
    const ctx = authenticate(request, "admin");
    if (ctx instanceof Response) return ctx;
    const url = new URL(request.url);
    const q = normalize(url.searchParams.get("q") ?? "");
    const status = url.searchParams.get("status");
    const offset = decodeCursor(url.searchParams.get("cursor"));

    const filtered = ctx.state.clinics
      .filter((c) => !q || normalize(c.name).includes(q))
      .filter((c) => !status || c.status === status)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const page = filtered.slice(offset, offset + PAGE_SIZE);

    return HttpResponse.json({
      items: page.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        plan: c.plan,
        messagesThisMonth: c.messagesThisMonth,
        monthlyMessageCap: c.monthlyMessageCap,
        connectionHealth: c.connectionHealth,
        createdAt: c.createdAt,
      })),
      nextCursor: offset + PAGE_SIZE < filtered.length ? encodeCursor(offset + PAGE_SIZE) : null,
    });
  }),

  http.post(apiPath("/admin/clinics/:id/impersonate"), async ({ request, params }) => {
    await latency();
    const ctx = authenticate(request, "admin");
    if (ctx instanceof Response) return ctx;
    const clinic = ctx.state.clinics.find((c) => c.id === params.id);
    if (!clinic) return apiError(404, "NOT_FOUND", "Clínica não encontrada.");
    const accessToken = signMockToken(
      {
        sub: ctx.user.id,
        sid: ctx.session.id,
        role: ctx.user.role,
        clinicId: clinic.id,
        imp: { clinicId: clinic.id, by: ctx.user.id },
      },
      ctx.state.faults.impersonationTtlSeconds,
    );
    updateDb((state) => {
      state.auditLog.unshift({
        id: randomId("aud"),
        at: new Date().toISOString(),
        actorId: ctx.user.id,
        action: "clinic.impersonate",
        clinicId: clinic.id,
      });
    });
    return HttpResponse.json({ accessToken });
  }),
];
