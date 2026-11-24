import { http, HttpResponse } from "msw";
import type {
  AgentPreviewRequest,
  AgentPreviewResponse,
  AgentSettings,
  AvailabilityExceptionInput,
  AvailabilityRule,
  ProfessionalInput,
  Readiness,
  ServiceInput,
} from "@/lib/api/types";
import { DEFAULT_AGENT_SETTINGS, randomId, updateDb, type MockState } from "../db";
import { apiError, apiPath, authenticate, latency, noContent, requireWrite, type AuthContext } from "../utils";

// ------------------------------------------------------------------ helpers

export function computeReadiness(state: MockState, clinicId: string): Readiness {
  const professionals = state.professionals.filter((p) => p.clinicId === clinicId && p.active);
  const flags = {
    whatsapp: state.connections.some(
      (c) => c.clinicId === clinicId && c.type === "whatsapp" && (c.status === "active" || c.status === "attention"),
    ),
    hasProfessionalWithCalendar: professionals.some((p) => p.calendar !== null),
    hasAvailability: professionals.some((p) => (state.availability[p.id] ?? []).length > 0),
    agentActive: state.agentActive[clinicId] ?? false,
  };
  const values = Object.values(flags);
  return { ...flags, completed: values.filter(Boolean).length, total: values.length };
}

function validation(fields: Record<string, string>) {
  return apiError(400, "VALIDATION_ERROR", "Confira os campos destacados.", { fields });
}

async function body<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

/** Autentica na área da clínica e (opcionalmente) exige permissão de escrita. */
function clinicCtx(request: Request, write?: Parameters<typeof requireWrite>[1]): AuthContext | Response {
  const ctx = authenticate(request, "clinic");
  if (ctx instanceof Response) return ctx;
  if (!ctx.clinic) return apiError(404, "NOT_FOUND", "Clínica não encontrada.");
  if (write) {
    const denied = requireWrite(ctx, write);
    if (denied) return denied;
  }
  return ctx;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateRules(rules: unknown): string | null {
  if (!Array.isArray(rules)) return "Formato inválido.";
  const byDay = new Map<number, AvailabilityRule[]>();
  for (const r of rules as AvailabilityRule[]) {
    if (!(r.weekday >= 0 && r.weekday <= 6) || !TIME_RE.test(r.start) || !TIME_RE.test(r.end)) return "Horário inválido.";
    if (r.start >= r.end) return "O fim precisa ser depois do início.";
    byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), r]);
  }
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.start < sorted[i - 1]!.end) return "Há faixas sobrepostas no mesmo dia.";
    }
  }
  return null;
}

// ------------------------------------------------------------------ prévia do agente

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function nextSlots(state: MockState, clinicId: string, settings: AgentSettings, count = 3): string[] {
  const pros = state.professionals.filter((p) => p.clinicId === clinicId && p.active);
  const slots: string[] = [];
  const earliest = Date.now() + settings.minAdvanceMinutes * 60_000;
  for (let day = 0; day < 14 && slots.length < count; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    const weekday = date.getDay();
    for (const pro of pros) {
      const exception = state.exceptions.find((e) => {
        const iso = date.toISOString().slice(0, 10);
        return e.clinicId === clinicId && (!e.professionalId || e.professionalId === pro.id) && iso >= e.startsOn && iso <= e.endsOn;
      });
      if (exception) continue;
      for (const rule of state.availability[pro.id] ?? []) {
        if (rule.weekday !== weekday || slots.length >= count) continue;
        const [h, m] = rule.start.split(":").map(Number);
        const slot = new Date(date);
        slot.setHours(h!, m!, 0, 0);
        if (slot.getTime() < earliest) continue;
        slots.push(`${WEEKDAY_NAMES[weekday]} (${slot.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}) às ${rule.start} com ${pro.name}`);
      }
    }
  }
  return slots;
}

function previewReply(state: MockState, clinicId: string, req: AgentPreviewRequest): AgentPreviewResponse {
  const settings = req.settings ?? state.agentSettings[clinicId] ?? DEFAULT_AGENT_SETTINGS;
  const last = [...req.messages].reverse().find((m) => m.role === "patient")?.text.toLowerCase() ?? "";
  const isFirst = req.messages.filter((m) => m.role === "agent").length === 0;
  const formal = settings.tone === "formal";
  const you = formal ? "o(a) senhor(a)" : "você";

  if (/urg|emerg|dor forte|sangr|desmai|acidente/.test(last)) {
    return {
      reply: settings.urgencyMessage,
      actions: [{ type: "handoff", description: "Transferiria a conversa para a equipe e enviaria a notificação de urgência." }],
    };
  }
  if (/cancel/.test(last)) {
    return {
      reply: `Certo. Encontrei uma consulta em seu nome na próxima quinta às 09:00. Confirma que deseja cancelar?`,
      actions: [{ type: "would_cancel", description: "Cancelaria o evento na agenda do profissional após a confirmação." }],
    };
  }
  if (/remarc|mudar|trocar/.test(last)) {
    const slots = nextSlots(state, clinicId, settings);
    return {
      reply: slots.length
        ? `Claro! Tenho estes horários disponíveis:\n${slots.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nQual prefere?`
        : "No momento não encontrei horários livres nas próximas duas semanas. Vou pedir para a equipe entrar em contato.",
      actions: slots.length
        ? [{ type: "would_reschedule", description: "Moveria o evento na agenda após a escolha do horário." }]
        : [{ type: "handoff", description: "Transferiria para a equipe por falta de horários." }],
    };
  }
  if (/^\s*[123]\s*$/.test(last) || /primeir|segund|terceir/.test(last)) {
    return {
      reply: `Perfeito, ${formal ? "seu horário está" : "tá"} reservado! Vou enviar um lembrete um dia antes. Posso ajudar em algo mais?`,
      actions: [{ type: "would_book", description: "Criaria o evento na agenda do profissional (não criado: é uma simulação)." }],
    };
  }
  if (/agend|marc|consult|horár|vaga|avalia/.test(last)) {
    const slots = nextSlots(state, clinicId, settings);
    if (!slots.length) {
      return {
        reply: "Ainda não encontrei horários disponíveis. Confira se os profissionais têm horários de atendimento cadastrados.",
        actions: [{ type: "handoff", description: "Sem horários livres: transferiria para a equipe." }],
      };
    }
    return {
      reply: `Posso agendar para ${you}! Os próximos horários livres são:\n${slots.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nResponda com o número da opção.`,
      actions: [{ type: "suggest_slots", description: `Consultaria a agenda e ofereceria ${slots.length} horários.` }],
    };
  }
  if (isFirst) {
    return { reply: settings.welcomeMessage, actions: [] };
  }
  return {
    reply: formal
      ? "Compreendo. Posso auxiliá-lo(a) a agendar, remarcar ou cancelar uma consulta. O que deseja fazer?"
      : "Entendi! Posso te ajudar a agendar, remarcar ou cancelar uma consulta. O que você precisa?",
    actions: [],
  };
}

// ------------------------------------------------------------------ handlers

export const clinicHandlers = [
  http.get(apiPath("/clinic/clinic"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    const c = ctx.clinic!;
    return HttpResponse.json({ id: c.id, name: c.name, timezone: c.timezone, phone: c.phone, email: c.email, address: c.address });
  }),

  http.patch(apiPath("/clinic/clinic"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request, "clinic:write");
    if (ctx instanceof Response) return ctx;
    const input = (await body<Record<string, string | null>>(request)) ?? {};
    if (input.name !== undefined && !input.name?.trim()) return validation({ name: "Informe o nome da clínica." });
    if (input.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: input.timezone ?? "" });
      } catch {
        return validation({ timezone: "Fuso horário inválido." });
      }
    }
    const clinic = updateDb((s) => {
      const c = s.clinics.find((x) => x.id === ctx.clinic!.id)!;
      for (const key of ["name", "timezone", "phone", "email", "address"] as const) {
        if (key in input) (c as unknown as Record<string, unknown>)[key] = input[key] === "" ? null : input[key];
      }
      return c;
    });
    return HttpResponse.json({ id: clinic.id, name: clinic.name, timezone: clinic.timezone, phone: clinic.phone, email: clinic.email, address: clinic.address });
  }),

  http.get(apiPath("/clinic/readiness"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(computeReadiness(ctx.state, ctx.clinic!.id));
  }),

  http.get(apiPath("/clinic/connections"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(
      ctx.state.connections
        .filter((c) => c.clinicId === ctx.clinic!.id)
        .map((c) => ({ id: c.id, type: c.type, provider: c.provider, status: c.status, lastCheckedAt: c.lastCheckedAt, lastError: c.lastError, summary: c.summary })),
    );
  }),

  // ---- profissionais
  http.get(apiPath("/clinic/professionals"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(
      ctx.state.professionals
        .filter((p) => p.clinicId === ctx.clinic!.id)
        .map(({ clinicId: _c, ...p }) => p)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
  }),

  http.post(apiPath("/clinic/professionals"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const input = await body<ProfessionalInput>(request);
    if (!input?.name?.trim()) return validation({ name: "Informe o nome." });
    const created = updateDb((s) => {
      const p = { clinicId: ctx.clinic!.id, id: randomId("pro"), name: input.name.trim(), specialty: input.specialty?.trim() || null, active: input.active ?? true, serviceIds: [], calendar: null };
      s.professionals.push(p);
      s.availability[p.id] = [];
      return p;
    });
    const { clinicId: _c, ...rest } = created;
    return HttpResponse.json(rest, { status: 201 });
  }),

  http.patch(apiPath("/clinic/professionals/:id"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const input = (await body<Partial<ProfessionalInput>>(request)) ?? {};
    if (input.name !== undefined && !input.name.trim()) return validation({ name: "Informe o nome." });
    const updated = updateDb((s) => {
      const p = s.professionals.find((x) => x.id === params.id && x.clinicId === ctx.clinic!.id);
      if (!p) return null;
      if (input.name !== undefined) p.name = input.name.trim();
      if (input.specialty !== undefined) p.specialty = input.specialty?.trim() || null;
      if (input.active !== undefined) p.active = input.active;
      return p;
    });
    if (!updated) return apiError(404, "NOT_FOUND", "Profissional não encontrado.");
    const { clinicId: _c, ...rest } = updated;
    return HttpResponse.json(rest);
  }),

  http.delete(apiPath("/clinic/professionals/:id"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const ok = updateDb((s) => {
      const before = s.professionals.length;
      s.professionals = s.professionals.filter((x) => !(x.id === params.id && x.clinicId === ctx.clinic!.id));
      delete s.availability[params.id as string];
      s.exceptions = s.exceptions.filter((e) => e.professionalId !== params.id);
      return s.professionals.length < before;
    });
    return ok ? noContent() : apiError(404, "NOT_FOUND", "Profissional não encontrado.");
  }),

  http.put(apiPath("/clinic/professionals/:id/services"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const input = await body<{ serviceIds?: string[] }>(request);
    const valid = new Set(ctx.state.services.filter((x) => x.clinicId === ctx.clinic!.id).map((x) => x.id));
    if (!Array.isArray(input?.serviceIds) || input.serviceIds.some((sid) => !valid.has(sid))) {
      return validation({ serviceIds: "Serviço inválido." });
    }
    const updated = updateDb((s) => {
      const p = s.professionals.find((x) => x.id === params.id && x.clinicId === ctx.clinic!.id);
      if (p) p.serviceIds = [...new Set(input.serviceIds)];
      return p;
    });
    if (!updated) return apiError(404, "NOT_FOUND", "Profissional não encontrado.");
    const { clinicId: _c, ...rest } = updated;
    return HttpResponse.json(rest);
  }),

  // ---- serviços
  http.get(apiPath("/clinic/services"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(
      ctx.state.services
        .filter((x) => x.clinicId === ctx.clinic!.id)
        .map(({ clinicId: _c, ...x }) => x)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
  }),

  http.post(apiPath("/clinic/services"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const input = await body<ServiceInput>(request);
    if (!input?.name?.trim()) return validation({ name: "Informe o nome do serviço." });
    if (!(input.durationMinutes >= 5 && input.durationMinutes <= 480)) return validation({ durationMinutes: "Duração entre 5 e 480 minutos." });
    const created = updateDb((s) => {
      const x = {
        clinicId: ctx.clinic!.id,
        id: randomId("svc"),
        name: input.name.trim(),
        durationMinutes: input.durationMinutes,
        priceCents: input.priceCents ?? null,
        description: input.description?.trim() || null,
        active: input.active ?? true,
      };
      s.services.push(x);
      return x;
    });
    const { clinicId: _c, ...rest } = created;
    return HttpResponse.json(rest, { status: 201 });
  }),

  http.patch(apiPath("/clinic/services/:id"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const input = (await body<Partial<ServiceInput>>(request)) ?? {};
    if (input.name !== undefined && !input.name.trim()) return validation({ name: "Informe o nome do serviço." });
    const updated = updateDb((s) => {
      const x = s.services.find((y) => y.id === params.id && y.clinicId === ctx.clinic!.id);
      if (!x) return null;
      Object.assign(x, input, input.name ? { name: input.name.trim() } : {});
      return x;
    });
    if (!updated) return apiError(404, "NOT_FOUND", "Serviço não encontrado.");
    const { clinicId: _c, ...rest } = updated;
    return HttpResponse.json(rest);
  }),

  http.delete(apiPath("/clinic/services/:id"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const ok = updateDb((s) => {
      const before = s.services.length;
      s.services = s.services.filter((x) => !(x.id === params.id && x.clinicId === ctx.clinic!.id));
      s.professionals.forEach((p) => (p.serviceIds = p.serviceIds.filter((sid) => sid !== params.id)));
      return s.services.length < before;
    });
    return ok ? noContent() : apiError(404, "NOT_FOUND", "Serviço não encontrado.");
  }),

  // ---- horários
  http.get(apiPath("/clinic/professionals/:id/availability"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    const pro = ctx.state.professionals.find((p) => p.id === params.id && p.clinicId === ctx.clinic!.id);
    if (!pro) return apiError(404, "NOT_FOUND", "Profissional não encontrado.");
    return HttpResponse.json({ rules: ctx.state.availability[pro.id] ?? [] });
  }),

  http.put(apiPath("/clinic/professionals/:id/availability"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const pro = ctx.state.professionals.find((p) => p.id === params.id && p.clinicId === ctx.clinic!.id);
    if (!pro) return apiError(404, "NOT_FOUND", "Profissional não encontrado.");
    const input = await body<{ rules?: AvailabilityRule[] }>(request);
    const problem = validateRules(input?.rules);
    if (problem) return validation({ rules: problem });
    const rules = [...input!.rules!].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
    updateDb((s) => void (s.availability[pro.id] = rules));
    return HttpResponse.json({ rules });
  }),

  http.get(apiPath("/clinic/availability-exceptions"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(
      ctx.state.exceptions
        .filter((e) => e.clinicId === ctx.clinic!.id)
        .map(({ clinicId: _c, ...e }) => e)
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn)),
    );
  }),

  ...(["post", "patch"] as const).map((method) =>
    http[method](apiPath(method === "post" ? "/clinic/availability-exceptions" : "/clinic/availability-exceptions/:id"), async ({ request, params }) => {
      await latency();
      const ctx = clinicCtx(request, "catalog:write");
      if (ctx instanceof Response) return ctx;
      const input = await body<AvailabilityExceptionInput>(request);
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!input || !dateRe.test(input.startsOn) || !dateRe.test(input.endsOn)) return validation({ startsOn: "Data inválida." });
      if (input.endsOn < input.startsOn) return validation({ endsOn: "O fim precisa ser no mesmo dia ou depois do início." });
      if (!input.reason?.trim()) return validation({ reason: "Informe o motivo." });
      const result = updateDb((s) => {
        if (method === "post") {
          const e = { clinicId: ctx.clinic!.id, id: randomId("exc"), ...input, reason: input.reason.trim() };
          s.exceptions.push(e);
          return e;
        }
        const e = s.exceptions.find((x) => x.id === params.id && x.clinicId === ctx.clinic!.id);
        if (e) Object.assign(e, input, { reason: input.reason.trim() });
        return e ?? null;
      });
      if (!result) return apiError(404, "NOT_FOUND", "Exceção não encontrada.");
      const { clinicId: _c, ...rest } = result;
      return HttpResponse.json(rest, { status: method === "post" ? 201 : 200 });
    }),
  ),

  http.delete(apiPath("/clinic/availability-exceptions/:id"), async ({ request, params }) => {
    await latency();
    const ctx = clinicCtx(request, "catalog:write");
    if (ctx instanceof Response) return ctx;
    const ok = updateDb((s) => {
      const before = s.exceptions.length;
      s.exceptions = s.exceptions.filter((x) => !(x.id === params.id && x.clinicId === ctx.clinic!.id));
      return s.exceptions.length < before;
    });
    return ok ? noContent() : apiError(404, "NOT_FOUND", "Exceção não encontrada.");
  }),

  // ---- agente
  http.get(apiPath("/clinic/agent-settings"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    return HttpResponse.json(ctx.state.agentSettings[ctx.clinic!.id] ?? DEFAULT_AGENT_SETTINGS);
  }),

  http.put(apiPath("/clinic/agent-settings"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request, "agent:write");
    if (ctx instanceof Response) return ctx;
    const input = await body<AgentSettings>(request);
    if (!input?.welcomeMessage?.trim()) return validation({ welcomeMessage: "Informe a mensagem de boas-vindas." });
    if (!input.consentMessage?.trim()) return validation({ consentMessage: "Informe o texto de consentimento." });
    if (input.activeHours && input.activeHours.start >= input.activeHours.end) {
      return validation({ "activeHours.end": "O fim precisa ser depois do início." });
    }
    updateDb((s) => void (s.agentSettings[ctx.clinic!.id] = input));
    return HttpResponse.json(input);
  }),

  http.post(apiPath("/clinic/agent/preview"), async ({ request }) => {
    await latency(500, 1100);
    // Prévia é leitura: liberada também na impersonação e para a equipe.
    const ctx = clinicCtx(request);
    if (ctx instanceof Response) return ctx;
    const input = await body<AgentPreviewRequest>(request);
    if (!input || !Array.isArray(input.messages)) return validation({ messages: "Formato inválido." });
    return HttpResponse.json(previewReply(ctx.state, ctx.clinic!.id, input));
  }),

  http.post(apiPath("/clinic/agent/activate"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request, "agent:write");
    if (ctx instanceof Response) return ctx;
    const r = computeReadiness(ctx.state, ctx.clinic!.id);
    const missing = (["whatsapp", "hasProfessionalWithCalendar", "hasAvailability"] as const).filter((k) => !r[k]);
    if (missing.length) {
      return apiError(409, "AGENT_NOT_READY", "Conclua os pré-requisitos antes de ativar o agente.", { missing });
    }
    updateDb((s) => void (s.agentActive[ctx.clinic!.id] = true));
    return noContent();
  }),

  http.post(apiPath("/clinic/agent/deactivate"), async ({ request }) => {
    await latency();
    const ctx = clinicCtx(request, "agent:write");
    if (ctx instanceof Response) return ctx;
    updateDb((s) => void (s.agentActive[ctx.clinic!.id] = false));
    return noContent();
  }),
];
