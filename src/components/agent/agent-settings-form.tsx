"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import { applyServerErrors } from "@/lib/api/form-errors";
import type { AgentSettings, AgentTone, Weekday } from "@/lib/api/types";
import { WEEK_ORDER, WEEKDAY_LABELS } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const TONES: Array<{ value: AgentTone; label: string; example: string }> = [
  { value: "friendly", label: "Acolhedor", example: "Oi, Maria! Que bom falar com você 😊 Vamos marcar sua consulta?" },
  { value: "neutral", label: "Neutro", example: "Olá, Maria. Posso ajudar a marcar sua consulta." },
  { value: "formal", label: "Formal", example: "Bom dia, Sra. Maria. Em que posso auxiliá-la?" },
];

const ADVANCE_OPTIONS = [
  { value: 0, label: "Sem antecedência mínima" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "1 dia" },
  { value: 2880, label: "2 dias" },
];

const message = (label: string, max: number) =>
  z.string().trim().min(1, `Informe ${label}.`).max(max, `Máximo de ${max} caracteres.`);

const schema = z
  .object({
    tone: z.enum(["friendly", "neutral", "formal"]),
    welcomeMessage: message("a mensagem de boas-vindas", 600),
    urgencyMessage: message("a mensagem de urgência", 600),
    consentMessage: message("o texto de consentimento", 800),
    extraRules: z.string().trim().max(2000, "Máximo de 2000 caracteres."),
    always: z.boolean(),
    hoursStart: z.string(),
    hoursEnd: z.string(),
    weekdays: z.array(z.number()),
    minAdvanceMinutes: z.number().int().min(0),
  })
  .superRefine((v, ctx) => {
    if (v.always) return;
    if (!v.hoursStart || !v.hoursEnd || v.hoursEnd <= v.hoursStart) {
      ctx.addIssue({ code: "custom", path: ["hoursEnd"], message: "O fim precisa ser depois do início." });
    }
    if (!v.weekdays.length) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Escolha pelo menos um dia." });
  });

export type AgentFormValues = z.infer<typeof schema>;

function toValues(s: AgentSettings): AgentFormValues {
  return {
    tone: s.tone,
    welcomeMessage: s.welcomeMessage,
    urgencyMessage: s.urgencyMessage,
    consentMessage: s.consentMessage,
    extraRules: s.extraRules,
    always: s.activeHours === null,
    hoursStart: s.activeHours?.start ?? "07:00",
    hoursEnd: s.activeHours?.end ?? "21:00",
    weekdays: s.activeHours?.weekdays ?? [1, 2, 3, 4, 5, 6],
    minAdvanceMinutes: s.minAdvanceMinutes,
  };
}

export function toSettings(v: AgentFormValues): AgentSettings {
  return {
    tone: v.tone,
    welcomeMessage: v.welcomeMessage.trim(),
    urgencyMessage: v.urgencyMessage.trim(),
    consentMessage: v.consentMessage.trim(),
    extraRules: v.extraRules.trim(),
    activeHours: v.always
      ? null
      : { start: v.hoursStart, end: v.hoursEnd, weekdays: [...v.weekdays].sort() as Weekday[] },
    minAdvanceMinutes: v.minAdvanceMinutes,
  };
}

function CharCount({ control, name, max }: { control: Control<AgentFormValues>; name: "welcomeMessage" | "urgencyMessage" | "consentMessage" | "extraRules"; max: number }) {
  const value = useWatch({ control, name }) ?? "";
  return (
    <span className={cn("text-xs tabular-nums", value.length > max ? "text-destructive" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

export function AgentSettingsForm({
  settings,
  readOnly,
  onChange,
}: {
  settings: AgentSettings;
  readOnly: boolean;
  /** Valores atuais (válidos) para a prévia testar sem salvar. */
  onChange?: (settings: AgentSettings) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<AgentFormValues>({ resolver: zodResolver(schema), values: toValues(settings) });
  const { errors, isSubmitting, isDirty } = form.formState;
  const watched = useWatch({ control: form.control });
  const always = watched.always;

  const lastEmitted = useRef<string | null>(null);
  useEffect(() => {
    const parsed = schema.safeParse(watched);
    if (!parsed.success) return;
    const next = toSettings(parsed.data);
    const serialized = JSON.stringify(next);
    if (serialized === lastEmitted.current) return;
    lastEmitted.current = serialized;
    onChange?.(next);
  }, [watched, onChange]);

  const save = useMutation({
    mutationFn: clinicApi.updateAgentSettings,
    meta: { silentError: true, successMessage: "Configurações do agente salvas." },
    onSuccess: (saved) => queryClient.setQueryData(clinicKeys.agentSettings, saved),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toSettings(values));
    } catch (error) {
      applyServerErrors(error, form.setError, ["welcomeMessage", "urgencyMessage", "consentMessage", "extraRules"]);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {errors.root?.server?.message ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      ) : null}
      <fieldset disabled={readOnly || isSubmitting} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tom de voz</CardTitle>
            <CardDescription>Como o agente escreve para os pacientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="tone"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-3" aria-label="Tom de voz">
                  {TONES.map((tone) => (
                    <Label
                      key={tone.value}
                      className="flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <RadioGroupItem value={tone.value} /> {tone.label}
                      </span>
                      <span className="text-xs text-muted-foreground">“{tone.example}”</span>
                    </Label>
                  ))}
                </RadioGroup>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
            <CardDescription>Textos usados em momentos específicos da conversa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Boas-vindas" error={errors.welcomeMessage?.message} description="Primeira resposta a um paciente novo.">
              {(f) => <Textarea {...f} rows={3} {...form.register("welcomeMessage")} />}
            </FormField>
            <div className="-mt-3 flex justify-end">
              <CharCount control={form.control} name="welcomeMessage" max={600} />
            </div>
            <FormField
              label="Consentimento (LGPD)"
              error={errors.consentMessage?.message}
              description="Enviado antes de coletar dados. O agente só segue depois do aceite."
            >
              {(f) => <Textarea {...f} rows={3} {...form.register("consentMessage")} />}
            </FormField>
            <div className="-mt-3 flex justify-end">
              <CharCount control={form.control} name="consentMessage" max={800} />
            </div>
            <FormField
              label="Urgência"
              error={errors.urgencyMessage?.message}
              description="Quando o paciente relata uma urgência. A conversa também é transferida para a equipe."
            >
              {(f) => <Textarea {...f} rows={3} {...form.register("urgencyMessage")} />}
            </FormField>
            <div className="-mt-3 flex justify-end">
              <CharCount control={form.control} name="urgencyMessage" max={600} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regras de agendamento</CardTitle>
            <CardDescription>Quando o agente atende e o que ele pode oferecer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Controller
              control={form.control}
              name="always"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="agent-always">Atender 24 horas</Label>
                    <p className="text-xs text-muted-foreground">
                      Fora da janela, o agente avisa quando volta a atender e não agenda.
                    </p>
                  </div>
                  <Switch id="agent-always" checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
            {!always ? (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <FormField label="Das" className="w-32">
                    {(f) => <Input {...f} type="time" {...form.register("hoursStart")} />}
                  </FormField>
                  <FormField label="Até" className="w-32" error={errors.hoursEnd?.message}>
                    {(f) => <Input {...f} type="time" {...form.register("hoursEnd")} />}
                  </FormField>
                </div>
                <Controller
                  control={form.control}
                  name="weekdays"
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium" id="agent-days-label">
                        Dias
                      </p>
                      <ToggleGroup
                        type="multiple"
                        variant="outline"
                        aria-labelledby="agent-days-label"
                        value={field.value.map(String)}
                        onValueChange={(v) => field.onChange(v.map(Number))}
                        className="flex-wrap"
                      >
                        {WEEK_ORDER.map((d) => (
                          <ToggleGroupItem key={d} value={String(d)} aria-label={WEEKDAY_LABELS[d].long}>
                            {WEEKDAY_LABELS[d].short}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      {errors.weekdays?.message ? (
                        <p className="text-xs font-medium text-destructive" role="alert">
                          {errors.weekdays.message}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              </div>
            ) : null}

            <FormField
              label="Antecedência mínima para agendar"
              description="O agente não oferece horários mais próximos que isso."
            >
              {(f) => (
                <Controller
                  control={form.control}
                  name="minAdvanceMinutes"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} disabled={readOnly}>
                      <SelectTrigger id={f.id} aria-describedby={f["aria-describedby"]} className="w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADVANCE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>

            <FormField
              label="Regras extras (opcional)"
              error={errors.extraRules?.message}
              description="Instruções em texto livre. Ex.: “Menores de 12 anos só com responsável”, “Não informar valores de canal”."
            >
              {(f) => <Textarea {...f} rows={4} {...form.register("extraRules")} />}
            </FormField>
            <div className="-mt-4 flex justify-end">
              <CharCount control={form.control} name="extraRules" max={2000} />
            </div>
          </CardContent>
        </Card>
      </fieldset>

      {!readOnly ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          {isDirty ? <span className="mr-auto text-sm text-muted-foreground">Alterações não salvas</span> : null}
          <Button type="button" variant="outline" disabled={!isDirty || isSubmitting} onClick={() => form.reset(toValues(settings))}>
            Descartar
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Salvar configurações
          </Button>
        </div>
      ) : null}
    </form>
  );
}
