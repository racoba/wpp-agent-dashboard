"use client";

import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { MOCK_ACCOUNTS, MOCK_PASSWORD, MOCK_TOTP_CODE, readDb, resetDb, updateDb } from "./db";

/**
 * Painel flutuante do modo mock para simular os cenários de autenticação.
 * Só é carregado quando NEXT_PUBLIC_API_MOCKING=enabled.
 */
export default function MockDevtools() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(rerender, 1000);
    return () => clearInterval(id);
  }, [open]);

  const state = open ? readDb() : null;
  const sorriso = state?.clinics.find((c) => c.id === "cli_sorriso");

  function act(label: string, fn: () => void) {
    fn();
    rerender();
    toast.message(`Simulação: ${label}`);
  }

  return (
    <div className="fixed bottom-3 left-3 z-[60] print:hidden">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="shadow-md" aria-label="Abrir simulador da API (mock)">
            <FlaskConical aria-hidden /> Mock
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-80 space-y-3 text-sm">
          <div>
            <p className="font-medium">Simulador da API</p>
            <p className="text-xs text-muted-foreground">
              Senha de todas as contas: <code>{MOCK_PASSWORD}</code>. Código MFA: <code>{MOCK_TOTP_CODE}</code>.
            </p>
          </div>

          <Section title="Sessão">
            <Action onClick={() => act("tokens de acesso expirados", () => updateDb((s) => void (s.faults.expireIssuedBefore = Date.now())))}>
              Expirar token de acesso agora
            </Action>
            <Action onClick={() => act("próximo token inválido", () => updateDb((s) => void (s.faults.nextInvalidToken = true)))}>
              TOKEN_INVALID na próxima chamada
            </Action>
            <Action
              onClick={() =>
                act("sessão revogada no servidor", () =>
                  updateDb((s) => {
                    const session = s.sessions.find((x) => x.refreshToken === s.cookieJar.refreshToken);
                    if (session) session.revoked = true;
                  }),
                )
              }
            >
              Revogar sessão atual (SESSION_REVOKED)
            </Action>
            <Action
              onClick={() =>
                act("cookie antigo reapresentado", () =>
                  updateDb((s) => {
                    const session = s.sessions.find((x) => x.refreshToken === s.cookieJar.refreshToken);
                    const previous = session?.previousRefreshTokens.at(-1);
                    if (previous) s.cookieJar.refreshToken = previous;
                  }),
                )
              }
            >
              Simular reuso do refresh token
            </Action>
            <Action onClick={() => act("erro 500 na próxima chamada", () => updateDb((s) => void (s.faults.nextServerError = true)))}>
              Erro 500 na próxima chamada
            </Action>
          </Section>

          <Section title="Durações">
            <div className="flex gap-2">
              <Action onClick={() => act("token de 30 s", () => updateDb((s) => void (s.faults.accessTtlSeconds = 30)))}>
                Token 30 s
              </Action>
              <Action onClick={() => act("token de 15 min", () => updateDb((s) => void (s.faults.accessTtlSeconds = 900)))}>
                Token 15 min
              </Action>
            </div>
            <div className="flex gap-2">
              <Action onClick={() => act("impersonação de 1 min", () => updateDb((s) => void (s.faults.impersonationTtlSeconds = 60)))}>
                Imperson. 1 min
              </Action>
              <Action onClick={() => act("impersonação de 30 min", () => updateDb((s) => void (s.faults.impersonationTtlSeconds = 1800)))}>
                Imperson. 30 min
              </Action>
            </div>
            {state ? (
              <p className="text-xs text-muted-foreground">
                Token: {state.faults.accessTtlSeconds} s · Impersonação: {state.faults.impersonationTtlSeconds} s · Chamadas a
                /auth/refresh: {state.refreshCalls}
              </p>
            ) : null}
          </Section>

          <Section title="Clínica Sorriso Pleno">
            <Action
              onClick={() =>
                act(sorriso?.status === "suspended" ? "clínica reativada" : "clínica suspensa", () =>
                  updateDb((s) => {
                    const c = s.clinics.find((x) => x.id === "cli_sorriso")!;
                    c.status = c.status === "suspended" ? "active" : "suspended";
                  }),
                )
              }
            >
              {sorriso?.status === "suspended" ? "Reativar clínica" : "Suspender clínica (423)"}
            </Action>
          </Section>

          <Section title="Outros">
            <p className="text-xs text-muted-foreground">
              Após “Esqueci minha senha”, o link de redefinição é{" "}
              <a className="underline" href="/redefinir-senha#token=demo-reset-token">
                /redefinir-senha#token=demo-reset-token
              </a>
              .
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Contas de teste</summary>
              <ul className="mt-1 space-y-0.5">
                {MOCK_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <code>{a.email}</code>: {a.label}
                  </li>
                ))}
              </ul>
            </details>
            <Action
              variant="destructive"
              onClick={() => {
                resetDb();
                window.location.replace(new URL("/login", window.location.origin).href);
              }}
            >
              Resetar dados do mock
            </Action>
          </Section>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Separator />
      <p className="pt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Action({
  children,
  onClick,
  variant = "outline",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "outline" | "destructive";
}) {
  return (
    <Button size="sm" variant={variant} className="w-full justify-start" onClick={onClick}>
      {children}
    </Button>
  );
}
