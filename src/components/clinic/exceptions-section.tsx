"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import { applyServerErrors } from "@/lib/api/form-errors";
import type { AvailabilityException, Professional } from "@/lib/api/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------- datas (sem fuso: "YYYY-MM-DD")

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatIso(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" }).format(Date.UTC(y!, m! - 1, d!));
}

function formatRange(e: Pick<AvailabilityException, "startsOn" | "endsOn">) {
  return e.startsOn === e.endsOn ? formatIso(e.startsOn) : `${formatIso(e.startsOn)} – ${formatIso(e.endsOn)}`;
}

function todayIso(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

// --------------------------------------------------------------- calendário do mês

function MonthCalendar({ exceptions, timeZone }: { exceptions: AvailabilityException[]; timeZone: string }) {
  const today = todayIso(timeZone);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y: y!, m: m! - 1 };
  });
  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // semana começando na segunda
  const rawTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  const cells = Array.from({ length: offset + daysInMonth }, (_, i) => (i < offset ? null : i - offset + 1));

  function move(delta: number) {
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  return (
    <div className="w-full max-w-xs rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" onClick={() => move(-1)} aria-label="Mês anterior">
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-sm font-medium" aria-live="polite">
          {title}
        </p>
        <Button variant="ghost" size="icon-sm" onClick={() => move(1)} aria-label="Próximo mês">
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div role="grid" aria-label={`Calendário de ${title}`} className="grid grid-cols-7 gap-1 text-center text-xs">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
          <div key={i} role="columnheader" className="py-1 font-medium text-muted-foreground" aria-hidden>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} role="gridcell" aria-hidden />;
          const iso = isoDate(cursor.y, cursor.m, day);
          const hits = exceptions.filter((e) => iso >= e.startsOn && iso <= e.endsOn);
          const label = `${formatIso(iso, { day: "numeric", month: "long" })}${hits.length ? `: ${hits.map((h) => h.reason).join(", ")}` : ""}`;
          return (
            <div
              key={iso}
              role="gridcell"
              aria-label={label}
              title={hits.map((h) => h.reason).join(", ") || undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md tabular-nums",
                hits.length && "bg-amber-100 font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
                iso === today && "ring-2 ring-primary ring-inset",
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block size-3 rounded-sm bg-amber-100 dark:bg-amber-500/20" aria-hidden /> Dia com exceção
      </p>
    </div>
  );
}

// --------------------------------------------------------------- formulário

const schema = z
  .object({
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    reason: z.string().trim().min(2, "Informe o motivo (ex.: Feriado, Férias).").max(120),
    scope: z.enum(["clinic", "professional"]),
  })
  .refine((v) => v.endsOn >= v.startsOn, { path: ["endsOn"], message: "O fim precisa ser no mesmo dia ou depois do início." });
type Values = z.infer<typeof schema>;

function ExceptionDialog({
  exception,
  professional,
  trigger,
  timeZone,
}: {
  exception?: AvailabilityException;
  professional: Professional | null;
  trigger: React.ReactNode;
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const today = todayIso(timeZone);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      startsOn: exception?.startsOn ?? today,
      endsOn: exception?.endsOn ?? today,
      reason: exception?.reason ?? "",
      scope: exception ? (exception.professionalId ? "professional" : "clinic") : professional ? "professional" : "clinic",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const save = useMutation({
    meta: { silentError: true, successMessage: exception ? "Exceção atualizada." : "Exceção adicionada." },
    mutationFn: (v: Values) => {
      const input = {
        startsOn: v.startsOn,
        endsOn: v.endsOn,
        reason: v.reason,
        professionalId: v.scope === "professional" ? (exception?.professionalId ?? professional?.id ?? null) : null,
      };
      return exception ? clinicApi.updateException(exception.id, input) : clinicApi.createException(input);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: clinicKeys.exceptions }),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      setOpen(false);
      form.reset();
    } catch (error) {
      applyServerErrors(error, form.setError, ["startsOn", "endsOn", "reason"]);
    }
  });

  const proName = exception?.professionalId ? undefined : professional?.name;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{exception ? "Editar exceção" : "Nova exceção"}</DialogTitle>
          <DialogDescription>Dias em que o agente não oferece horários (feriados, férias, congressos…).</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {errors.root?.server?.message ? (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.server.message}</AlertDescription>
            </Alert>
          ) : null}
          <FormField label="Motivo" error={errors.reason?.message}>
            {(f) => <Input {...f} autoFocus placeholder="Feriado municipal" {...form.register("reason")} />}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="De" error={errors.startsOn?.message}>
              {(f) => <Input {...f} type="date" {...form.register("startsOn")} />}
            </FormField>
            <FormField label="Até" error={errors.endsOn?.message}>
              {(f) => <Input {...f} type="date" {...form.register("endsOn")} />}
            </FormField>
          </div>
          {!exception && professional ? (
            <Controller
              control={form.control}
              name="scope"
              render={({ field }) => (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Vale para</legend>
                  <RadioGroup value={field.value} onValueChange={field.onChange}>
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="professional" /> Só {proName}
                    </Label>
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="clinic" /> A clínica toda
                    </Label>
                  </RadioGroup>
                </fieldset>
              )}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- seção

export function ExceptionsSection({
  professional,
  professionals,
  readOnly,
  timeZone,
}: {
  professional: Professional | null;
  professionals: Professional[];
  readOnly: boolean;
  timeZone: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: clinicKeys.exceptions, queryFn: clinicApi.exceptions });
  const remove = useMutation({
    mutationFn: (id: string) => clinicApi.deleteException(id),
    meta: { successMessage: "Exceção removida." },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: clinicKeys.exceptions }),
  });
  const names = useMemo(() => new Map(professionals.map((p) => [p.id, p.name])), [professionals]);
  const today = todayIso(timeZone);

  const relevant = (query.data ?? []).filter((e) => !e.professionalId || e.professionalId === professional?.id);
  const upcoming = relevant.filter((e) => e.endsOn >= today);
  const past = relevant.filter((e) => e.endsOn < today);

  const addButton = !readOnly ? (
    <ExceptionDialog
      professional={professional}
      timeZone={timeZone}
      trigger={
        <Button variant="outline" size="sm">
          <Plus aria-hidden /> Nova exceção
        </Button>
      }
    />
  ) : null;

  return (
    <section aria-labelledby="exceptions-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="exceptions-title" className="text-lg font-semibold">
            Exceções
          </h2>
          <p className="text-sm text-muted-foreground">
            Feriados e ausências {professional ? `que afetam ${professional.name}` : "da clínica"}.
          </p>
        </div>
        {addButton}
      </div>

      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <MonthCalendar exceptions={relevant} timeZone={timeZone} />
          <div className="min-w-0 flex-1">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarOff}
                title="Nenhuma exceção futura"
                description="Cadastre feriados e férias para o agente não oferecer esses dias."
                className="h-full py-8"
              />
            ) : (
              <ul className="divide-y rounded-xl border">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRange(e)} · {e.professionalId ? (names.get(e.professionalId) ?? "Profissional") : "Clínica toda"}
                      </p>
                    </div>
                    {!readOnly ? (
                      <div className="flex gap-1">
                        <ExceptionDialog
                          exception={e}
                          professional={professional}
                          timeZone={timeZone}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Editar exceção ${e.reason}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          title={`Remover “${e.reason}”?`}
                          description={`O agente voltará a oferecer horários em ${formatRange(e)}.`}
                          confirmLabel="Remover"
                          onConfirm={() => remove.mutateAsync(e.id)}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Remover exceção ${e.reason}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          }
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {past.length ? (
              <p className="mt-2 text-xs text-muted-foreground">{past.length} exceção(ões) passada(s) oculta(s).</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
