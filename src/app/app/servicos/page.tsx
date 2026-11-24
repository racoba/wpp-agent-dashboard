"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ServiceDialog } from "@/components/clinic/service-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ReadOnlyNotice } from "@/components/feedback/read-only-notice";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status/status-badge";
import { Button } from "@/components/ui/button";
import { useCanWrite } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import type { Service } from "@/lib/api/types";
import { formatCurrencyCents, formatDuration } from "@/lib/format";

function RowActions({ service }: { service: Service }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => clinicApi.deleteService(service.id),
    meta: { successMessage: "Serviço removido." },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.services });
      void queryClient.invalidateQueries({ queryKey: clinicKeys.professionals });
    },
  });
  return (
    <div className="flex justify-end gap-1">
      <ServiceDialog
        service={service}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${service.name}`}>
            <Pencil aria-hidden />
          </Button>
        }
      />
      <ConfirmDialog
        title={`Remover “${service.name}”?`}
        description="O serviço deixa de ser oferecido e é desvinculado de todos os profissionais. Agendamentos já feitos não mudam."
        confirmLabel="Remover"
        onConfirm={() => remove.mutateAsync()}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Remover ${service.name}`}>
            <Trash2 aria-hidden />
          </Button>
        }
      />
    </div>
  );
}

export default function ServicesPage() {
  const canWrite = useCanWrite("catalog:write");
  const services = useQuery({ queryKey: clinicKeys.services, queryFn: clinicApi.services });
  const pros = useQuery({ queryKey: clinicKeys.professionals, queryFn: clinicApi.professionals });

  const countByService = new Map<string, number>();
  for (const p of pros.data ?? []) for (const id of p.serviceIds) countByService.set(id, (countByService.get(id) ?? 0) + 1);

  const columns: DataTableColumn<Service>[] = [
    {
      id: "name",
      header: "Serviço",
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="min-w-40">
          <p className="font-medium">{s.name}</p>
          {s.description ? <p className="line-clamp-1 text-xs text-muted-foreground">{s.description}</p> : null}
        </div>
      ),
    },
    { id: "duration", header: "Duração", sortValue: (s) => s.durationMinutes, cell: (s) => formatDuration(s.durationMinutes) },
    {
      id: "price",
      header: "Valor",
      sortValue: (s) => s.priceCents,
      cell: (s) => (s.priceCents != null ? formatCurrencyCents(s.priceCents) : <span className="text-muted-foreground">—</span>),
      headerClassName: "hidden sm:table-cell",
      className: "hidden sm:table-cell tabular-nums",
    },
    {
      id: "pros",
      header: "Profissionais",
      sortValue: (s) => countByService.get(s.id) ?? 0,
      cell: (s) => {
        const n = countByService.get(s.id) ?? 0;
        return n ? n : <span className="text-amber-700 dark:text-amber-400">Nenhum</span>;
      },
      headerClassName: "hidden md:table-cell",
      className: "hidden md:table-cell",
    },
    {
      id: "status",
      header: "Status",
      sortValue: (s) => (s.active ? 0 : 1),
      cell: (s) => <StatusBadge tone={s.active ? "success" : "neutral"} label={s.active ? "Ativo" : "Inativo"} />,
    },
    ...(canWrite
      ? [{ id: "actions", header: "Ações", cell: (s: Service) => <RowActions service={s} />, headerClassName: "text-right" }]
      : []),
  ];

  const newButton = (
    <ServiceDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Novo serviço
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que a clínica oferece para agendamento pelo WhatsApp."
        actions={canWrite ? newButton : undefined}
      />
      <ReadOnlyNotice permission="catalog:write" />
      <DataTable
        caption="Serviços da clínica"
        columns={columns}
        rows={services.data}
        getRowId={(s) => s.id}
        isLoading={services.isPending}
        error={services.error}
        onRetry={() => void services.refetch()}
        empty={{
          title: "Nenhum serviço cadastrado",
          description: "Cadastre consultas e procedimentos com a duração de cada um.",
          action: canWrite ? newButton : undefined,
        }}
      />
    </>
  );
}
