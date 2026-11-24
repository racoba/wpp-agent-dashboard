"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Check, MessageCircle, PartyPopper, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AgentActivationCard } from "@/components/agent/agent-activation";
import { AgentPreview } from "@/components/agent/agent-preview";
import { useAuth } from "@/components/auth/auth-provider";
import { ClinicForm, isClinicProfileComplete } from "@/components/clinic/clinic-form";
import { ProfessionalDialog } from "@/components/clinic/professional-dialog";
import { ServiceDialog } from "@/components/clinic/service-dialog";
import { WeeklyEditor } from "@/components/clinic/weekly-editor";
import { ReadOnlyNotice } from "@/components/feedback/read-only-notice";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { ConnectionStatusBadge } from "@/components/status/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanWrite } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import type { Clinic, Connection, Professional, Readiness, Service } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { subscribeAgentTested, wasAgentTested } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

interface StepDef {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

interface Data {
  clinic: Clinic;
  readiness: Readiness;
  professionals: Professional[];
  services: Service[];
  connections: Connection[];
  tested: boolean;
}

function buildSteps(d: Data): StepDef[] {
  const activePros = d.professionals.filter((p) => p.active);
  return [
    { id: "clinica", title: "Dados da clínica", description: "Nome, fuso horário e contato.", done: isClinicProfileComplete(d.clinic) },
    {
      id: "equipe",
      title: "Profissionais e serviços",
      description: "Quem atende e o que é oferecido.",
      done: d.services.some((s) => s.active) && activePros.some((p) => p.serviceIds.length > 0),
    },
    { id: "horarios", title: "Horários", description: "Expediente semanal de cada profissional.", done: d.readiness.hasAvailability },
    { id: "whatsapp", title: "Conectar WhatsApp", description: "O número que vai conversar com os pacientes.", done: d.readiness.whatsapp },
    { id: "agenda", title: "Conectar agendas", description: "A agenda de cada profissional.", done: d.readiness.hasProfessionalWithCalendar },
    { id: "testar", title: "Testar o agente", description: "Uma conversa de simulação.", done: d.tested },
    { id: "ativar", title: "Ativar", description: "Começar a atender pelo WhatsApp.", done: d.readiness.agentActive },
  ];
}

function useAgentTested(clinicId: string | null) {
  return useSyncExternalStore(
    subscribeAgentTested,
    () => wasAgentTested(clinicId),
    () => false,
  );
}

export function OnboardingWizard() {
  const { me, impersonation } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const clinicQ = useQuery({ queryKey: clinicKeys.clinic, queryFn: clinicApi.getClinic });
  const readinessQ = useQuery({ queryKey: clinicKeys.readiness, queryFn: clinicApi.readiness });
  const prosQ = useQuery({ queryKey: clinicKeys.professionals, queryFn: clinicApi.professionals });
  const servicesQ = useQuery({ queryKey: clinicKeys.services, queryFn: clinicApi.services });
  const connectionsQ = useQuery({ queryKey: clinicKeys.connections, queryFn: clinicApi.connections });
  const tested = useAgentTested(impersonation ? null : (me?.clinic?.id ?? null));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [moved, setMoved] = useState(false);

  const queries = [clinicQ, readinessQ, prosQ, servicesQ, connectionsQ];
  const failed = queries.find((q) => q.error);
  const ready = clinicQ.data && readinessQ.data && prosQ.data && servicesQ.data && connectionsQ.data;

  const steps = ready
    ? buildSteps({
        clinic: clinicQ.data!,
        readiness: readinessQ.data!,
        professionals: prosQ.data!,
        services: servicesQ.data!,
        connections: connectionsQ.data!,
        tested,
      })
    : [];
  const completed = steps.filter((s) => s.done).length;
  const firstPending = Math.max(0, steps.findIndex((s) => !s.done));
  const requested = steps.findIndex((s) => s.id === params.get("passo"));
  const current = requested >= 0 ? requested : firstPending;

  // Foco no título ao trocar de etapa (leitores de tela e teclado).
  useEffect(() => {
    if (moved) headingRef.current?.focus();
  }, [current, moved]);

  if (failed) return <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => void q.refetch())} />;
  if (!ready) return <PageSkeleton />;

  function goTo(index: number) {
    const step = steps[index];
    if (!step) return;
    setMoved(true);
    router.replace(`${pathname}?passo=${step.id}`, { scroll: false });
  }

  const step = steps[current]!;
  const allDone = completed === steps.length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <>
      <PageHeader
        title="Primeiros passos"
        description="Configure a clínica para o agente começar a atender pelo WhatsApp."
      />
      <ReadOnlyNotice permission="catalog:write" />

      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium" aria-live="polite">
            {completed} de {steps.length} concluídos
          </span>
          <span className="text-muted-foreground tabular-nums">{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso da configuração"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {allDone ? (
        <EmptyState
          icon={PartyPopper}
          title="Tudo pronto!"
          description="O agente está ativo e atendendo seus pacientes pelo WhatsApp."
          className="mb-6"
          action={
            <Button asChild>
              <Link href="/app">Ir para a visão geral</Link>
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Etapas">
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {steps.map((s, i) => {
              const active = i === current;
              return (
                <li key={s.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-muted font-medium" : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                        s.done && "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
                        !s.done && active && "border-primary",
                      )}
                    >
                      {s.done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">
                      {s.title}
                      <span className="sr-only">{s.done ? " (concluída)" : " (pendente)"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <Card>
          <CardHeader>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Etapa {current + 1} de {steps.length}
            </p>
            <CardTitle>
              <h2 ref={headingRef} tabIndex={-1} className="text-lg outline-none">
                {step.title}
              </h2>
            </CardTitle>
            <CardDescription>{step.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <StepContent
              id={step.id}
              professionals={prosQ.data!}
              services={servicesQ.data!}
              connections={connectionsQ.data!}
              onNext={() => goTo(current + 1)}
            />
            <div className="flex justify-between border-t pt-4">
              <Button variant="ghost" onClick={() => goTo(current - 1)} disabled={current === 0}>
                <ArrowLeft aria-hidden /> Anterior
              </Button>
              {current < steps.length - 1 ? (
                <Button variant={step.done ? "default" : "outline"} onClick={() => goTo(current + 1)}>
                  {step.done ? "Próxima etapa" : "Pular por enquanto"} <ArrowRight aria-hidden />
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ conteúdo de cada etapa

function StepContent({
  id,
  professionals,
  services,
  connections,
  onNext,
}: {
  id: string;
  professionals: Professional[];
  services: Service[];
  connections: Connection[];
  onNext: () => void;
}) {
  switch (id) {
    case "clinica":
      return <ClinicForm onSaved={onNext} submitLabel="Salvar e continuar" />;
    case "equipe":
      return <TeamStep professionals={professionals} services={services} />;
    case "horarios":
      return <HoursStep professionals={professionals} />;
    case "whatsapp":
      return <WhatsAppStep connections={connections} />;
    case "agenda":
      return <CalendarStep professionals={professionals} />;
    case "testar":
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Faça de conta que é um paciente. Teste agendar, remarcar e uma situação de urgência. Para ajustar o tom e as
            mensagens, vá para a tela{" "}
            <Link href="/app/agente" className="text-foreground underline underline-offset-4">
              Agente
            </Link>
            .
          </p>
          <AgentPreview className="max-w-xl" />
        </div>
      );
    case "ativar":
      return (
        <div className="max-w-md">
          <AgentActivationCard />
        </div>
      );
    default:
      return null;
  }
}

function TeamStep({ professionals, services }: { professionals: Professional[]; services: Service[] }) {
  const canWrite = useCanWrite("catalog:write");
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3" aria-labelledby="ob-services">
        <div className="flex items-center justify-between">
          <h3 id="ob-services" className="font-medium">
            Serviços ({services.length})
          </h3>
          {canWrite ? (
            <ServiceDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Plus aria-hidden /> Serviço
                </Button>
              }
            />
          ) : null}
        </div>
        {services.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {services.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 px-3 py-2">
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatDuration(s.durationMinutes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Comece pelos serviços: consulta, avaliação, retorno…
          </p>
        )}
      </section>
      <section className="space-y-3" aria-labelledby="ob-pros">
        <div className="flex items-center justify-between">
          <h3 id="ob-pros" className="font-medium">
            Profissionais ({professionals.length})
          </h3>
          {canWrite ? (
            <ProfessionalDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Plus aria-hidden /> Profissional
                </Button>
              }
            />
          ) : null}
        </div>
        {professionals.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {professionals.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate">{p.name}</span>
                {p.serviceIds.length ? (
                  <Badge variant="secondary">{p.serviceIds.length} serviço(s)</Badge>
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-400">sem serviços</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Cadastre quem atende e marque os serviços de cada um.
          </p>
        )}
      </section>
    </div>
  );
}

function HoursStep({ professionals }: { professionals: Professional[] }) {
  const canWrite = useCanWrite("catalog:write");
  const [selected, setSelected] = useState(professionals[0]?.id ?? null);
  if (!professionals.length) {
    return <p className="text-sm text-muted-foreground">Cadastre um profissional na etapa anterior para definir os horários.</p>;
  }
  return (
    <div className="space-y-4">
      <Select value={selected ?? undefined} onValueChange={setSelected}>
        <SelectTrigger className="w-full sm:w-72" aria-label="Profissional">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {professionals.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected ? <WeeklyEditor professionalId={selected} readOnly={!canWrite} /> : null}
      <p className="text-xs text-muted-foreground">
        Feriados e férias ficam em{" "}
        <Link href="/app/horarios" className="underline underline-offset-4">
          Horários → Exceções
        </Link>
        .
      </p>
    </div>
  );
}

function WhatsAppStep({ connections }: { connections: Connection[] }) {
  const wa = connections.find((c) => c.type === "whatsapp");
  const phone = typeof wa?.summary.displayPhoneNumber === "string" ? wa.summary.displayPhoneNumber : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <MessageCircle className="size-5 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{phone ?? "WhatsApp Business"}</p>
          <p className="text-xs text-muted-foreground">
            {wa ? "Número conectado pela API oficial da Meta." : "Você vai entrar com a conta do Facebook da clínica e escolher o número."}
          </p>
        </div>
        <ConnectionStatusBadge status={wa?.status ?? "not_connected"} />
      </div>
      <p className="text-sm text-muted-foreground">
        A clínica usa o próprio número e paga as conversas diretamente à Meta. O assistente de conexão fica na tela de Conexões.
      </p>
      <Button asChild variant={wa ? "outline" : "default"}>
        <Link href="/app/conexoes">{wa ? "Ver conexão" : "Conectar WhatsApp"}</Link>
      </Button>
    </div>
  );
}

function CalendarStep({ professionals }: { professionals: Professional[] }) {
  const active = professionals.filter((p) => p.active);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A agenda conectada é a fonte da verdade: o agente só oferece horários livres nela e cria os eventos lá.
      </p>
      {active.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {active.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <ConnectionStatusBadge status={p.calendar ? "active" : "not_connected"} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum profissional ativo ainda.</p>
      )}
      <Button asChild>
        <Link href="/app/conexoes">Conectar agendas</Link>
      </Button>
    </div>
  );
}
