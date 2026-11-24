"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatusBadge } from "@/components/status/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanWrite } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import { errorMessage, hasErrorCode } from "@/lib/api/errors";
import type { Readiness } from "@/lib/api/types";

export const PREREQUISITES: Array<{ key: keyof Pick<Readiness, "whatsapp" | "hasProfessionalWithCalendar" | "hasAvailability">; label: string; href: string }> = [
  { key: "whatsapp", label: "WhatsApp conectado", href: "/app/conexoes" },
  { key: "hasProfessionalWithCalendar", label: "Pelo menos um profissional com agenda conectada", href: "/app/conexoes" },
  { key: "hasAvailability", label: "Horários de atendimento cadastrados", href: "/app/horarios" },
];

export function useAgentActivation() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: clinicKeys.readiness });
  const activate = useMutation({
    mutationFn: clinicApi.activateAgent,
    meta: { silentError: true },
    onSuccess: () => toast.success("Agente ativado. Ele já está respondendo no WhatsApp."),
    onError: (error) => {
      if (hasErrorCode(error, "AGENT_NOT_READY")) toast.error("Ainda faltam pré-requisitos. Confira a lista acima.");
      else toast.error(errorMessage(error));
    },
    onSettled: invalidate,
  });
  const deactivate = useMutation({
    mutationFn: clinicApi.deactivateAgent,
    meta: { successMessage: "Agente desativado. Mensagens novas não serão respondidas automaticamente." },
    onSettled: invalidate,
  });
  return { activate, deactivate };
}

export function AgentActivationCard() {
  const canWrite = useCanWrite("agent:write");
  const readiness = useQuery({ queryKey: clinicKeys.readiness, queryFn: clinicApi.readiness });
  const { activate, deactivate } = useAgentActivation();

  if (readiness.isPending) return <Skeleton className="h-48" />;
  if (readiness.error) return null;

  const r = readiness.data;
  const ready = PREREQUISITES.every((p) => r[p.key]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Status do agente</CardTitle>
          <StatusBadge tone={r.agentActive ? "success" : "neutral"} label={r.agentActive ? "Atendendo" : "Desativado"} />
        </div>
        <CardDescription>
          {r.agentActive
            ? "O agente responde automaticamente às mensagens no WhatsApp."
            : "Enquanto desativado, as mensagens recebidas não são respondidas pelo agente."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2" aria-label="Pré-requisitos">
          {PREREQUISITES.map((p) => (
            <li key={p.key} className="flex items-start gap-2 text-sm">
              {r[p.key] ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className={r[p.key] ? "" : "text-muted-foreground"}>
                <span className="sr-only">{r[p.key] ? "Concluído: " : "Pendente: "}</span>
                {p.label}
                {!r[p.key] ? (
                  <>
                    {" · "}
                    <Link href={p.href} className="text-foreground underline underline-offset-4">
                      resolver
                    </Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {canWrite ? (
          r.agentActive ? (
            <ConfirmDialog
              title="Desativar o agente?"
              description="Os pacientes que escreverem não receberão resposta automática até você ativar de novo."
              confirmLabel="Desativar"
              onConfirm={() => deactivate.mutateAsync()}
              trigger={
                <Button variant="outline" className="w-full">
                  <PowerOff aria-hidden /> Desativar agente
                </Button>
              }
            />
          ) : (
            <Button className="w-full" disabled={!ready || activate.isPending} onClick={() => activate.mutate()}>
              {activate.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Power aria-hidden />}
              Ativar agente
            </Button>
          )
        ) : null}
        {!ready && !r.agentActive && canWrite ? (
          <p className="text-xs text-muted-foreground">O botão libera quando todos os itens estiverem concluídos.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
