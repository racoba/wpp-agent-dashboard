"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import { applyServerErrors } from "@/lib/api/form-errors";
import type { Professional } from "@/lib/api/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  specialty: z.string().trim().max(120),
  active: z.boolean(),
  serviceIds: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function ProfessionalDialog({
  professional,
  trigger,
}: {
  professional?: Professional;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{professional ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          <DialogDescription>Quem atende pacientes. A agenda de cada um é conectada na tela de Conexões.</DialogDescription>
        </DialogHeader>
        {open ? <ProfessionalForm professional={professional} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfessionalForm({ professional, onDone }: { professional?: Professional; onDone: () => void }) {
  const queryClient = useQueryClient();
  const services = useQuery({ queryKey: clinicKeys.services, queryFn: clinicApi.services });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: professional?.name ?? "",
      specialty: professional?.specialty ?? "",
      active: professional?.active ?? true,
      serviceIds: professional?.serviceIds ?? [],
    },
  });
  const { errors, isSubmitting } = form.formState;

  const save = useMutation({
    meta: { silentError: true, successMessage: professional ? "Profissional atualizado." : "Profissional cadastrado." },
    mutationFn: async (values: Values) => {
      const input = { name: values.name, specialty: values.specialty || null, active: values.active };
      const saved = professional
        ? await clinicApi.updateProfessional(professional.id, input)
        : await clinicApi.createProfessional(input);
      const changed =
        saved.serviceIds.length !== values.serviceIds.length || saved.serviceIds.some((id) => !values.serviceIds.includes(id));
      return changed ? clinicApi.setProfessionalServices(saved.id, values.serviceIds) : saved;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: clinicKeys.professionals });
      void queryClient.invalidateQueries({ queryKey: clinicKeys.readiness });
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onDone();
    } catch (error) {
      applyServerErrors(error, form.setError, ["name", "specialty", "active", "serviceIds"]);
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
        {(f) => <Input {...f} autoFocus placeholder="Dra. Ana Souza" {...form.register("name")} />}
      </FormField>
      <FormField label="Especialidade (opcional)" error={errors.specialty?.message}>
        {(f) => <Input {...f} placeholder="Ortodontia" {...form.register("specialty")} />}
      </FormField>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Serviços que atende</legend>
        {services.isPending ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !services.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum serviço cadastrado.{" "}
            <Link href="/app/servicos" className="underline underline-offset-4">
              Cadastrar serviços
            </Link>
          </p>
        ) : (
          <Controller
            control={form.control}
            name="serviceIds"
            render={({ field }) => (
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                {services.data.map((s) => {
                  const checked = field.value.includes(s.id);
                  return (
                    <Label key={s.id} className="flex items-center gap-2 font-normal">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          field.onChange(v ? [...field.value, s.id] : field.value.filter((id) => id !== s.id))
                        }
                      />
                      <span className="truncate">{s.name}</span>
                      {!s.active ? <span className="text-xs text-muted-foreground">(inativo)</span> : null}
                    </Label>
                  );
                })}
              </div>
            )}
          />
        )}
      </fieldset>

      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="pro-active">Atende pelo agente</Label>
              <p className="text-xs text-muted-foreground">Desligado, o agente não oferece horários deste profissional.</p>
            </div>
            <Switch id="pro-active" checked={field.value} onCheckedChange={field.onChange} />
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
