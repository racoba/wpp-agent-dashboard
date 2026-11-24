"use client";

import { useQuery } from "@tanstack/react-query";
import { Globe, Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ExceptionsSection } from "@/components/clinic/exceptions-section";
import { WeeklyEditor } from "@/components/clinic/weekly-editor";
import { ReadOnlyNotice } from "@/components/feedback/read-only-notice";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCanWrite, useClinicTimezone } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";

export function SchedulePage() {
  const canWrite = useCanWrite("catalog:write");
  const timeZone = useClinicTimezone();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pros = useQuery({ queryKey: clinicKeys.professionals, queryFn: clinicApi.professionals });
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  if (pros.isPending) return <PageSkeleton />;
  if (pros.error) return <ErrorState error={pros.error} onRetry={() => void pros.refetch()} />;

  const list = pros.data;
  const selectedId = list.find((p) => p.id === params.get("profissional"))?.id ?? list[0]?.id ?? null;
  const selected = list.find((p) => p.id === selectedId) ?? null;

  function go(id: string) {
    setDirty(false);
    router.replace(`${pathname}?profissional=${id}`, { scroll: false });
  }

  return (
    <>
      <PageHeader
        title="Horários"
        description={
          <span>
            <Globe className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden /> Expediente de cada profissional, no fuso da clínica ({timeZone}). Os
            horários ocupados vêm da agenda conectada.
          </span>
        }
      />
      <ReadOnlyNotice permission="catalog:write" />

      {list.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Cadastre um profissional primeiro"
          description="Os horários de atendimento são definidos por profissional."
          action={
            <Button asChild>
              <Link href="/app/profissionais">Ir para Profissionais</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="weekly-title" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="weekly-title" className="text-lg font-semibold">
                  Expediente semanal
                </h2>
                <p className="text-sm text-muted-foreground">Adicione várias faixas no mesmo dia para intervalos (ex.: almoço).</p>
              </div>
              <Select
                value={selectedId ?? undefined}
                onValueChange={(id) => (dirty ? setPending(id) : go(id))}
              >
                <SelectTrigger className="sm:w-72" aria-label="Profissional">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {list.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {!p.active ? " (inativo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedId ? <WeeklyEditor professionalId={selectedId} readOnly={!canWrite} onDirtyChange={setDirty} /> : null}
          </section>

          <Separator />

          <ExceptionsSection professional={selected} professionals={list} readOnly={!canWrite} timeZone={timeZone} />
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>Os horários editados deste profissional ainda não foram salvos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) go(pending);
                setPending(null);
              }}
            >
              Descartar e trocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
