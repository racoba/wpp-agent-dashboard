"use client";

import { useMutation } from "@tanstack/react-query";
import { FlaskConical, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clinicApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import type { AgentPreviewResponse, AgentSettings, PreviewMessage } from "@/lib/api/types";
import { markAgentTested } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type ChatItem = PreviewMessage & { id: number; actions?: AgentPreviewResponse["actions"] };

const SUGGESTIONS = [
  "Oi, quero agendar uma consulta",
  "Preciso remarcar meu horário",
  "Quero cancelar minha consulta",
  "Estou com muita dor, é urgente",
];

/**
 * Conversa de teste com o agente (POST /agent/preview). Deixa claro que é
 * simulação: nada vai para o WhatsApp e nenhum evento é criado.
 */
export function AgentPreview({ settings, className }: { settings?: AgentSettings; className?: string }) {
  const { me, impersonation } = useAuth();
  const clinicId = impersonation ? null : (me?.clinic?.id ?? null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMutation({
    mutationFn: clinicApi.agentPreview,
    meta: { silentError: true },
  });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [items, preview.isPending]);

  async function send(text: string, history = items) {
    const trimmed = text.trim();
    if (!trimmed || preview.isPending) return;
    const patient: ChatItem = { id: nextId.current++, role: "patient", text: trimmed };
    const nextItems = [...history, patient];
    setItems(nextItems);
    setDraft("");
    setError(null);
    try {
      const res = await preview.mutateAsync({
        messages: nextItems.map(({ role, text: t }) => ({ role, text: t })),
        settings,
      });
      setItems((cur) => [...cur, { id: nextId.current++, role: "agent", text: res.reply, actions: res.actions }]);
      markAgentTested(clinicId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inputRef.current?.focus();
    }
  }

  function retry() {
    const lastPatient = [...items].reverse().find((i) => i.role === "patient");
    if (!lastPatient) return;
    const history = items.slice(0, items.lastIndexOf(lastPatient));
    void send(lastPatient.text, history);
  }

  return (
    <Card className={cn("flex flex-col gap-0 py-0", className)}>
      <CardHeader className="border-b py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-4" aria-hidden /> Testar o agente
            </CardTitle>
            <CardDescription>Converse como se fosse um paciente.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Recomeçar conversa de teste"
            disabled={!items.length || preview.isPending}
            onClick={() => {
              setItems([]);
              setError(null);
            }}
          >
            <RotateCcw aria-hidden />
          </Button>
        </div>
        <p className="mt-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-900 dark:bg-sky-500/15 dark:text-sky-200">
          <strong>Simulação.</strong> Nenhuma mensagem é enviada pelo WhatsApp e nenhum horário é reservado na agenda.
          {settings ? " Usa as configurações do formulário, mesmo sem salvar." : null}
        </p>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Conversa de teste"
          className="h-96 space-y-3 overflow-y-auto bg-muted/30 p-4"
        >
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Escolha um exemplo ou escreva uma mensagem.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-auto py-1.5 whitespace-normal" onClick={() => void send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={cn("flex flex-col gap-1", item.role === "patient" ? "items-end" : "items-start")}>
                <span className="sr-only">{item.role === "patient" ? "Paciente:" : "Agente:"}</span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line",
                    item.role === "patient"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border bg-background",
                  )}
                >
                  {item.text}
                </div>
                {item.actions?.map((a, i) => (
                  <p
                    key={i}
                    className="max-w-[85%] rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground"
                  >
                    <span className="font-medium">Ação simulada:</span> {a.description}
                  </p>
                ))}
              </div>
            ))
          )}
          {preview.isPending ? (
            <div className="flex items-center gap-1 pl-1" role="status" aria-label="O agente está digitando">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${d}ms` }}
                  aria-hidden
                />
              ))}
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
              {error}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>

        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva como paciente…"
            aria-label="Mensagem de teste"
            maxLength={1000}
            disabled={preview.isPending}
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={!draft.trim() || preview.isPending}>
            <Send aria-hidden />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
