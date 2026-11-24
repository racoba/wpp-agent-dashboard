"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { ConnectionStatusBadge } from "@/components/status/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { clinicApi } from "@/lib/api/endpoints";
import type { Connection } from "@/lib/api/types";
import { formatRelative } from "@/lib/format";

function ReadinessCard() {
  const { data, error, isPending, refetch } = useQuery({ queryKey: ["clinic", "readiness"], queryFn: clinicApi.readiness });
  if (isPending) return <Skeleton className="h-36" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const pct = data.total ? Math.round((data.completed / data.total) * 100) : 0;
  const done = data.completed >= data.total;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Primeiros passos</CardTitle>
        <CardDescription>
          {done ? "Tudo pronto. O agente está atendendo." : `${data.completed} de ${data.total} concluídos`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={data.total}
          aria-valuenow={data.completed}
          aria-label="Progresso da configuração"
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {!done ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/app/primeiros-passos">
              Continuar configuração <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function connectionTitle(c: Connection) {
  if (c.type === "whatsapp") return "WhatsApp";
  return c.provider === "google" ? "Google Agenda" : "Agenda";
}

function ConnectionsCard() {
  const { data, error, isPending, refetch } = useQuery({ queryKey: ["clinic", "connections"], queryFn: clinicApi.connections });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexões</CardTitle>
        <CardDescription>Status dos canais e agendas conectados.</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            title="Nenhuma conexão ainda"
            description="Conecte o WhatsApp e a agenda para o agente começar a atender."
            action={
              <Button asChild size="sm">
                <Link href="/app/conexoes">Ir para Conexões</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y">
            {data.map((c) => {
              const Icon = c.type === "whatsapp" ? MessageCircle : CalendarDays;
              return (
                <li key={c.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium">{connectionTitle(c)}</p>
                    {c.lastError ? <p className="text-sm text-muted-foreground">{c.lastError}</p> : null}
                    {c.lastCheckedAt ? (
                      <p className="text-xs text-muted-foreground">Verificado {formatRelative(c.lastCheckedAt)}</p>
                    ) : null}
                  </div>
                  <ConnectionStatusBadge status={c.status} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClinicOverviewPage() {
  const { me, impersonation } = useAuth();
  const firstName = me?.user.name.split(" ")[0];
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={impersonation ? "Modo somente leitura." : firstName ? `Olá, ${firstName}.` : undefined}
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ReadinessCard />
        <ConnectionsCard />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Os indicadores de atendimento chegam na Fase 4.</p>
    </>
  );
}
