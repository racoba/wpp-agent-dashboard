"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import type { Weekday } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import {
  rulesToWeek,
  sameWeek,
  suggestNextRange,
  totalWeeklyMinutes,
  validateDay,
  weekHasErrors,
  WEEK_ORDER,
  WEEKDAY_LABELS,
  weekToRules,
  type WeekSchedule,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

/**
 * Editor semanal de um profissional: várias faixas por dia, copiar um dia
 * para outros, validação inline (fim > início, sem sobreposição).
 */
export function WeeklyEditor({
  professionalId,
  readOnly,
  onDirtyChange,
  onSaved,
}: {
  professionalId: string;
  readOnly: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}) {
  const query = useQuery({
    queryKey: clinicKeys.availability(professionalId),
    queryFn: () => clinicApi.availability(professionalId),
  });

  if (query.isPending) {
    return (
      <div className="space-y-2" aria-busy="true">
        {WEEK_ORDER.map((d) => (
          <Skeleton key={d} className="h-12" />
        ))}
      </div>
    );
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <WeekForm
      key={professionalId}
      professionalId={professionalId}
      initial={rulesToWeek(query.data.rules)}
      readOnly={readOnly}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
    />
  );
}

function WeekForm({
  professionalId,
  initial,
  readOnly,
  onDirtyChange,
  onSaved,
}: {
  professionalId: string;
  initial: WeekSchedule;
  readOnly: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [base, setBase] = useState(initial);
  const [week, setWeek] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const dirty = !sameWeek(base, week);
  const hasErrors = weekHasErrors(week);
  const total = useMemo(() => totalWeeklyMinutes(week), [week]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Aviso do navegador ao sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => clinicApi.setAvailability(professionalId, { rules: weekToRules(week) }),
    meta: { successMessage: "Horários salvos." },
    onSuccess: (saved) => {
      queryClient.setQueryData(clinicKeys.availability(professionalId), saved);
      const next = rulesToWeek(saved.rules);
      setBase(next);
      setWeek(next);
      setShowErrors(false);
      void queryClient.invalidateQueries({ queryKey: clinicKeys.readiness });
      onSaved?.();
    },
  });

  function update(day: Weekday, fn: (ranges: WeekSchedule[Weekday]) => WeekSchedule[Weekday]) {
    setWeek((w) => ({ ...w, [day]: fn(w[day]) }));
  }

  function copyTo(from: Weekday, targets: Weekday[]) {
    setWeek((w) => {
      const next = { ...w };
      for (const d of targets) next[d] = w[from].map((r) => ({ ...r }));
      return next;
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (hasErrors) {
          setShowErrors(true);
          return;
        }
        save.mutate();
      }}
    >
      <fieldset disabled={readOnly || save.isPending} className="divide-y rounded-xl border">
        <legend className="sr-only">Horários semanais</legend>
        {WEEK_ORDER.map((day) => {
          const ranges = week[day];
          const errors = validateDay(ranges);
          const open = ranges.length > 0;
          const label = WEEKDAY_LABELS[day].long;
          return (
            <div key={day} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
              <div className="flex w-44 shrink-0 items-center gap-3 sm:pt-1.5">
                <Switch
                  id={`day-${day}`}
                  checked={open}
                  aria-label={`${label}: ${open ? "atende" : "fechado"}`}
                  onCheckedChange={(on) => update(day, () => (on ? [suggestNextRange([])] : []))}
                />
                <label htmlFor={`day-${day}`} className="text-sm font-medium">
                  {label}
                </label>
              </div>

              <div className="flex-1 space-y-2">
                {!open ? (
                  <p className="text-sm text-muted-foreground sm:pt-1.5">Não atende</p>
                ) : (
                  ranges.map((range, i) => {
                    const error = showErrors || (range.start && range.end) ? errors[i] : null;
                    const errorId = `err-${day}-${i}`;
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            step={300}
                            value={range.start}
                            aria-label={`${label}, faixa ${i + 1}: início`}
                            aria-invalid={!!error}
                            aria-describedby={error ? errorId : undefined}
                            className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                            onChange={(e) => update(day, (rs) => rs.map((r, k) => (k === i ? { ...r, start: e.target.value } : r)))}
                          />
                          <span className="text-sm text-muted-foreground" aria-hidden>
                            até
                          </span>
                          <Input
                            type="time"
                            step={300}
                            value={range.end}
                            aria-label={`${label}, faixa ${i + 1}: fim`}
                            aria-invalid={!!error}
                            aria-describedby={error ? errorId : undefined}
                            className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                            onChange={(e) => update(day, (rs) => rs.map((r, k) => (k === i ? { ...r, end: e.target.value } : r)))}
                          />
                          {!readOnly ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remover faixa ${i + 1} de ${label}`}
                              onClick={() => update(day, (rs) => rs.filter((_, k) => k !== i))}
                            >
                              <X aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                        {error ? (
                          <p id={errorId} className="mt-1 text-xs font-medium text-destructive">
                            {error}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              {!readOnly && open ? (
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => update(day, (rs) => [...rs, suggestNextRange(rs)])}>
                    <Plus aria-hidden /> Faixa
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copiar horários de ${label}`}>
                        <Copy aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Copiar {WEEKDAY_LABELS[day].short} para…</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => copyTo(day, [1, 2, 3, 4, 5].filter((d) => d !== day) as Weekday[])}>
                        Dias úteis (seg–sex)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => copyTo(day, WEEK_ORDER.filter((d) => d !== day))}>Todos os dias</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {WEEK_ORDER.filter((d) => d !== day).map((d) => (
                        <DropdownMenuItem key={d} onSelect={() => copyTo(day, [d])}>
                          {WEEKDAY_LABELS[d].long}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total ? `${formatDuration(total)} de atendimento por semana` : "Nenhum horário de atendimento."}
          {dirty ? <span className="ml-2 font-medium text-foreground">· Alterações não salvas</span> : null}
        </p>
        {!readOnly ? (
          <div className="flex gap-2 sm:ml-auto">
            <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={() => setWeek(base)}>
              Descartar
            </Button>
            <Button type="submit" disabled={!dirty || save.isPending} className={cn(hasErrors && showErrors && "opacity-80")}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Salvar horários
            </Button>
          </div>
        ) : null}
      </div>
      {showErrors && hasErrors ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          Corrija os horários destacados antes de salvar.
        </p>
      ) : null}
    </form>
  );
}
