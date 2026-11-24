"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { ErrorState } from "@/components/feedback/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanWrite } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import { applyServerErrors } from "@/lib/api/form-errors";
import type { Clinic } from "@/lib/api/types";
import { t } from "@/lib/i18n";

export const BR_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, GO, DF…)" },
  { value: "America/Bahia", label: "Bahia" },
  { value: "America/Recife", label: "Pernambuco" },
  { value: "America/Fortaleza", label: "Ceará, RN, PB, PI, MA" },
  { value: "America/Maceio", label: "Alagoas e Sergipe" },
  { value: "America/Belem", label: "Pará e Amapá" },
  { value: "America/Araguaina", label: "Tocantins" },
  { value: "America/Cuiaba", label: "Mato Grosso" },
  { value: "America/Campo_Grande", label: "Mato Grosso do Sul" },
  { value: "America/Manaus", label: "Amazonas" },
  { value: "America/Porto_Velho", label: "Rondônia" },
  { value: "America/Boa_Vista", label: "Roraima" },
  { value: "America/Rio_Branco", label: "Acre" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
] as const;

const optionalText = z.string().trim().max(200);

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome da clínica.").max(120),
  timezone: z.string().min(1, t("validation.required")),
  phone: optionalText.refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Telefone com DDD (10 ou 11 dígitos)."),
  email: optionalText.refine((v) => !v || z.email().safeParse(v).success, t("validation.email")),
  address: optionalText,
});

type Values = z.infer<typeof schema>;
const FIELDS = ["name", "timezone", "phone", "email", "address"] as const;

function toValues(c: Clinic): Values {
  return { name: c.name, timezone: c.timezone, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "" };
}

export function isClinicProfileComplete(c: Clinic | undefined) {
  return !!c && !!c.name && !!c.timezone && !!c.phone;
}

export function ClinicForm({ onSaved, submitLabel = t("common.save") }: { onSaved?: () => void; submitLabel?: string }) {
  const query = useQuery({ queryKey: clinicKeys.clinic, queryFn: clinicApi.getClinic });
  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <ClinicFormInner clinic={query.data} onSaved={onSaved} submitLabel={submitLabel} />;
}

function ClinicFormInner({ clinic, onSaved, submitLabel }: { clinic: Clinic; onSaved?: () => void; submitLabel: string }) {
  const queryClient = useQueryClient();
  const { reloadMe } = useAuth();
  const canWrite = useCanWrite("clinic:write");
  const form = useForm<Values>({ resolver: zodResolver(schema), values: toValues(clinic) });
  const { errors, isSubmitting, isDirty } = form.formState;

  const mutation = useMutation({
    mutationFn: clinicApi.updateClinic,
    meta: { silentError: true, successMessage: "Dados da clínica salvos." },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await mutation.mutateAsync({
        ...values,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
      });
      queryClient.setQueryData(clinicKeys.clinic, saved);
      if (saved.timezone !== clinic.timezone || saved.name !== clinic.name) void reloadMe();
      onSaved?.();
    } catch (error) {
      applyServerErrors(error, form.setError, FIELDS);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.server?.message ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      ) : null}
      <fieldset disabled={!canWrite || isSubmitting} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nome da clínica" error={errors.name?.message} className="sm:col-span-2">
          {(f) => <Input {...f} autoComplete="organization" {...form.register("name")} />}
        </FormField>
        <FormField
          label="Fuso horário"
          error={errors.timezone?.message}
          description="Usado nos horários de atendimento e em todas as datas do painel."
          className="sm:col-span-2"
        >
          {(f) => (
            <Controller
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite}>
                  <SelectTrigger id={f.id} aria-invalid={f["aria-invalid"]} aria-describedby={f["aria-describedby"]} className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BR_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField label="Telefone de contato" error={errors.phone?.message} description="Informado ao paciente quando ele pede para falar com a clínica.">
          {(f) => <Input {...f} type="tel" autoComplete="tel" placeholder="(11) 3456-7890" {...form.register("phone")} />}
        </FormField>
        <FormField label="E-mail de contato" error={errors.email?.message}>
          {(f) => <Input {...f} type="email" autoComplete="email" {...form.register("email")} />}
        </FormField>
        <FormField label="Endereço" error={errors.address?.message} className="sm:col-span-2" description="O agente envia o endereço quando o paciente pergunta.">
          {(f) => <Input {...f} autoComplete="street-address" {...form.register("address")} />}
        </FormField>
      </fieldset>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || (!isDirty && !onSaved)}>
            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
