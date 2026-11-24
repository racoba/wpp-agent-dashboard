"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ForbiddenState, FullScreenLoader } from "@/components/feedback/states";
import type { Role } from "@/lib/api/types";
import { homePathFor, loginPathFor } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n";
import { useAuth } from "./auth-provider";

type GuardDecision =
  | { kind: "loading" }
  | { kind: "redirect"; to: string }
  | { kind: "forbidden" }
  | { kind: "allow" };

export interface GuardOptions {
  roles: Role[];
  /** master_admin precisa ter MFA ativado para entrar. */
  requireMfa?: boolean;
  /** Permite o master impersonando uma clínica. */
  allowImpersonation?: boolean;
}

/** Decisão pura (testável) a partir do estado de auth. */
export function decideGuard(
  auth: Pick<ReturnType<typeof useAuth>, "status" | "me" | "impersonation"> &
    Partial<Pick<ReturnType<typeof useAuth>, "impersonationReturnPath" | "endReason">>,
  options: GuardOptions,
  currentPath: string,
): GuardDecision {
  if (auth.status === "loading") return { kind: "loading" };
  if (auth.status === "unauthenticated" || !auth.me) {
    return { kind: "redirect", to: loginPathFor(auth.endReason ?? null, currentPath) };
  }
  const { role, mfaEnabled } = auth.me.user;
  if (options.allowImpersonation && auth.impersonation && role === "master_admin") return { kind: "allow" };
  if (!options.roles.includes(role)) {
    // Master no painel da clínica sem impersonação (ex.: acabou de sair dela): volta ao admin.
    if (role === "master_admin") {
      return { kind: "redirect", to: auth.impersonationReturnPath ?? homePathFor(role) };
    }
    return { kind: "forbidden" };
  }
  if (options.requireMfa && role === "master_admin" && !mfaEnabled) {
    return { kind: "redirect", to: "/configurar-mfa" };
  }
  return { kind: "allow" };
}

export function RouteGuard({ children, ...options }: GuardOptions & { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const currentPath = `${pathname}${qs ? `?${qs}` : ""}`;
  const decision = decideGuard(auth, options, currentPath);
  const redirectTo = decision.kind === "redirect" ? decision.to : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (decision.kind === "allow") return <>{children}</>;
  if (decision.kind === "forbidden") {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-lg items-center p-6">
        <ForbiddenState className="w-full" />
      </main>
    );
  }
  return <FullScreenLoader label={t("auth.bootstrapping")} />;
}
