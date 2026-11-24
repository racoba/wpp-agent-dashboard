"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import { applyServerErrors } from "@/lib/api/form-errors";
import type { Service } from "@/lib/api/types";
import { parseCurrencyToCents } from "@/lib/format";
import { t } from "@/lib/i18n";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço.").max(120),
  durationMinutes: z.coerce
    .number<string>({ message: "Informe a duração em minutos." })
    .int("Use minutos inteiros.")
    .min(5, "Mínimo de 5 minutos.")
    .max(480, "Máximo de 8 horas."),
  price: z.string().refine((v) => !Number.isNaN(parseCurrencyToCents(v) ?? 0), "Valor inválido. Ex.: 150,00"),
  description: z.string().trim().max(500),
  active: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function ServiceDialog({ service, trigger }: { service?: Service; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>A duração define o tamanho do horário que o agente reserva na agenda.</DialogDescription>
        </DialogHeader>
        {open ? <ServiceForm service={service} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ServiceForm({ service, onDone }: { service?: Service; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: service?.name ?? "",
      durationMinutes: String(service?.durationMinutes ?? 30),
      price: service?.priceCents != null ? (service.priceCents / 100).toFixed(2).replace(".", ",") : "",
      description: service?.description ?? "",
      active: service?.active ?? true,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const save = useMutation({
    meta: { silentError: true, successMessage: service ? "Serviço atualizado." : "Serviço cadastrado." },
    mutationFn: (values: Values) => {
      const input = {
        name: values.name,
        durationMinutes: values.durationMinutes,
        priceCents: parseCurrencyToCents(values.price),
        description: values.description || null,
        active: values.active,
      };
      return service ? clinicApi.updateService(service.id, input) : clinicApi.createService(input);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: clinicKeys.services }),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onDone();
    } catch (error) {
      applyServerErrors(error, form.setError, ["name", "durationMinutes", "description", "active"]);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root?.server?.message ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      ) : null}
      <FormField label="Nome" error={errors.name?.message}>
        {(f) => <Input {...f} autoFocus placeholder="Consulta de avaliação" {...form.register("name")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Duração (minutos)" error={errors.durationMinutes?.message}>
          {(f) => <Input {...f} type="number" inputMode="numeric" min={5} max={480} step={5} {...form.register("durationMinutes")} />}
        </FormField>
        <FormField label="Valor (opcional)" error={errors.price?.message} description="O agente só informa se o paciente perguntar.">
          {(f) => <Input {...f} inputMode="decimal" placeholder="150,00" {...form.register("price")} />}
        </FormField>
      </div>
      <FormField label="Descrição (opcional)" error={errors.description?.message} description="Orientações que o agente pode repassar (ex.: preparo).">
        {(f) => <Textarea {...f} rows={3} {...form.register("description")} />}
      </FormField>
      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="svc-active">Disponível para agendamento</Label>
              <p className="text-xs text-muted-foreground">Desligado, o agente não oferece este serviço.</p>
            </div>
            <Switch id="svc-active" checked={field.value} onCheckedChange={field.onChange} />
          </div>
        )}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
