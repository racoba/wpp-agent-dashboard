"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Search } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { DataTable, useCursorPagination, type DataTableColumn } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicStatusBadge, HealthBadge } from "@/components/status/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import type { AdminClinicListItem, ClinicStatus } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";

type StatusFilter = ClinicStatus | "all";

function ImpersonateButton({ clinic }: { clinic: AdminClinicListItem }) {
  const { startImpersonation } = useAuth();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`${t("impersonation.enter")}: ${clinic.name}`}
      onClick={async () => {
        setPending(true);
        try {
          await startImpersonation({ id: clinic.id, name: clinic.name });
        } catch (error) {
          toast.error(errorMessage(error));
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
      <span className="hidden lg:inline">{t("impersonation.enter")}</span>
    </Button>
  );
}

const columns: DataTableColumn<AdminClinicListItem>[] = [
  {
    id: "name",
    header: "Clínica",
    sortValue: (c) => c.name,
    cell: (c) => <span className="font-medium">{c.name}</span>,
  },
  { id: "status", header: "Status", sortValue: (c) => c.status, cell: (c) => <ClinicStatusBadge status={c.status} /> },
  { id: "plan", header: "Plano", sortValue: (c) => c.plan, cell: (c) => c.plan, headerClassName: "hidden md:table-cell", className: "hidden md:table-cell" },
  {
    id: "usage",
    header: "Mensagens no mês",
    sortValue: (c) => c.messagesThisMonth,
    cell: (c) => (
      <span className="tabular-nums">
        {formatNumber(c.messagesThisMonth)}
        {c.monthlyMessageCap ? <span className="text-muted-foreground"> / {formatNumber(c.monthlyMessageCap)}</span> : null}
      </span>
    ),
  },
  {
    id: "health",
    header: "Conexões",
    sortValue: (c) => ({ error: 0, attention: 1, ok: 2 })[c.connectionHealth],
    cell: (c) => <HealthBadge status={c.connectionHealth} />,
  },
  { id: "actions", header: t("common.actions"), cell: (c) => <ImpersonateButton clinic={c} />, className: "text-right", headerClassName: "text-right" },
];

export default function AdminClinicsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const q = useDeferredValue(search.trim());
  const { cursor, controls, reset } = useCursorPagination();

  useEffect(() => {
    reset();
  }, [q, status, reset]);

  const query = useQuery({
    queryKey: ["admin", "clinics", { q, status, cursor }],
    queryFn: () => adminApi.clinics({ q, status: status === "all" ? undefined : status, cursor }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Clínicas"
        description="Todas as clínicas da plataforma. A tela completa (criação, filtros de saúde e ações em massa) chega na Fase 5."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome"
            aria-label="Buscar clínica por nome"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="sm:w-44" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">{t("clinicStatus.active")}</SelectItem>
            <SelectItem value="trial">{t("clinicStatus.trial")}</SelectItem>
            <SelectItem value="suspended">{t("clinicStatus.suspended")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        caption="Lista de clínicas"
        columns={columns}
        rows={query.data?.items}
        getRowId={(c) => c.id}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={
          q || status !== "all"
            ? { title: t("table.noResults"), description: "Tente outro nome ou remova o filtro de status." }
            : { title: "Nenhuma clínica cadastrada", description: "As clínicas criadas aparecerão aqui." }
        }
        pagination={controls(query.data?.nextCursor)}
      />
    </>
  );
}
