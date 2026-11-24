"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, CalendarX2, Clock, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import Link from "next/link";
import { ProfessionalDialog } from "@/components/clinic/professional-dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ReadOnlyNotice } from "@/components/feedback/read-only-notice";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanWrite } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import type { Professional, Service } from "@/lib/api/types";

function NewButton() {
  return (
    <ProfessionalDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Novo profissional
        </Button>
      }
    />
  );
}

function ProfessionalRow({ pro, services, canWrite }: { pro: Professional; services: Map<string, Service>; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => clinicApi.deleteProfessional(pro.id),
    meta: { successMessage: `${pro.name} removido(a).` },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.professionals });
      void queryClient.invalidateQueries({ queryKey: clinicKeys.readiness });
    },
  });
  const linked = pro.serviceIds.map((id) => services.get(id)).filter((s): s is Service => !!s);

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">{pro.name}</h2>
          {pro.specialty ? <span className="text-sm text-muted-foreground">· {pro.specialty}</span> : null}
          {!pro.active ? <StatusBadge tone="neutral" label="Inativo" /> : null}
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Serviços">
          {linked.length ? (
            linked.map((s) => (
              <Badge key={s.id} variant="secondary">
                {s.name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-amber-700 dark:text-amber-400">Nenhum serviço vinculado: o agente não conseguirá agendar.</span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {pro.calendar ? (
            <>
              <CalendarCheck2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> Agenda: {pro.calendar.calendarName}
            </>
          ) : (
            <>
              <CalendarX2 className="size-4" aria-hidden /> Sem agenda conectada ·{" "}
              <Link href="/app/conexoes" className="underline underline-offset-4">
                conectar
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/horarios?profissional=${pro.id}`}>
            <Clock aria-hidden /> Horários
          </Link>
        </Button>
        {canWrite ? (
          <>
            <ProfessionalDialog
              professional={pro}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${pro.name}`}>
                  <Pencil aria-hidden />
                </Button>
              }
            />
            <ConfirmDialog
              title={`Remover ${pro.name}?`}
              description="Os horários e exceções deste profissional serão apagados. Os eventos na agenda externa não são alterados."
              confirmLabel="Remover"
              onConfirm={() => remove.mutateAsync()}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Remover ${pro.name}`}>
                  <Trash2 aria-hidden />
                </Button>
              }
            />
          </>
        ) : null}
      </div>
    </li>
  );
}

export default function ProfessionalsPage() {
  const canWrite = useCanWrite("catalog:write");
  const pros = useQuery({ queryKey: clinicKeys.professionals, queryFn: clinicApi.professionals });
  const services = useQuery({ queryKey: clinicKeys.services, queryFn: clinicApi.services });
  const serviceMap = new Map((services.data ?? []).map((s) => [s.id, s]));

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Quem atende, quais serviços faz e se a agenda está conectada."
        actions={canWrite ? <NewButton /> : undefined}
      />
      <ReadOnlyNotice permission="catalog:write" />
      {pros.isPending ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : pros.error ? (
        <ErrorState error={pros.error} onRetry={() => void pros.refetch()} />
      ) : pros.data.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Nenhum profissional cadastrado"
          description="Cadastre quem atende para o agente poder oferecer horários."
          action={canWrite ? <NewButton /> : undefined}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <ul className="divide-y">
              {pros.data.map((pro) => (
                <ProfessionalRow key={pro.id} pro={pro} services={serviceMap} canWrite={canWrite} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
