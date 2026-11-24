"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { authApi, adminApi } from "@/lib/api/endpoints";
import type { LoginOkResponse, MeResponse, Permission, Role } from "@/lib/api/types";
import { IMPERSONATION_PERMISSIONS, loginPathFor, permissionsForRole } from "@/lib/auth/permissions";
import * as session from "@/lib/auth/session";
import { tokenStore } from "@/lib/auth/token-store";
import { on, type SessionEndReason } from "@/lib/events";
import { t } from "@/lib/i18n";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface ImpersonationInfo {
  clinicId: string;
  clinicName: string;
  expiresAt: number;
}

interface AuthContextValue {
  status: AuthStatus;
  me: MeResponse | null;
  role: Role | null;
  impersonation: ImpersonationInfo | null;
  /** Sem permissão de escrita (impersonação). */
  readOnly: boolean;
  clinicSuspended: boolean;
  /** Para onde o master volta ao sair (ou expirar) a impersonação. */
  impersonationReturnPath: string;
  /** Por que a última sessão terminou (vira o aviso na tela de login). */
  endReason: SessionEndReason | null;
  can: (permission: Permission) => boolean;
  completeLogin: (res: LoginOkResponse) => Promise<MeResponse>;
  reloadMe: () => Promise<MeResponse | null>;
  logout: () => Promise<void>;
  startImpersonation: (clinic: { id: string; name: string }) => Promise<void>;
  exitImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function useImpersonation(): ImpersonationInfo | null {
  const snapshot = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.getImpersonation(),
    () => null,
  );
  return useMemo(
    () =>
      snapshot
        ? { clinicId: snapshot.clinicId, clinicName: snapshot.clinicName, expiresAt: snapshot.expiresAt }
        : null,
    [snapshot],
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const statusRef = useRef<AuthStatus>("loading");
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [clinicSuspended, setClinicSuspended] = useState(false);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  const [impersonationReturnPath, setImpersonationReturnPath] = useState("/admin/clinicas");
  const impersonation = useImpersonation();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const applyMe = useCallback((next: MeResponse | null) => {
    setMe(next);
    session.setActiveUser(next?.user.id ?? null);
    const nextStatus: AuthStatus = next ? "authenticated" : "unauthenticated";
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setClinicSuspended(next?.clinic?.status === "suspended");
    if (next) setEndReason(null);
  }, []);

  const reloadMe = useCallback(async () => {
    try {
      const next = await authApi.me();
      applyMe(next);
      return next;
    } catch {
      return null;
    }
  }, [applyMe]);

  // Bootstrap: recarregar a página perde o token em memória.
  useEffect(() => {
    let cancelled = false;
    void session.bootstrapSession().then(async (ok) => {
      if (cancelled) return;
      if (!ok) return applyMe(null);
      const loaded = await authApi.me().catch(() => null);
      if (!cancelled) applyMe(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [applyMe]);

  // Eventos vindos do cliente HTTP / outras abas.
  useEffect(() => {
    const offEnded = on("session-ended", ({ reason }) => {
      queryClient.clear();
      setEndReason(reason);
      applyMe(null);
      // As guardas de rota redirecionam (com motivo e rota de retorno).
      // Fora delas (ex.: "/"), vai direto ao login.
      if (!/^\/(app|admin|configurar-mfa)(\/|$)/.test(pathnameRef.current)) {
        router.replace(loginPathFor(reason, null));
      }
    });
    const offRemoteLogin = on("remote-login", () => {
      if (statusRef.current === "unauthenticated") void reloadMe();
    });
    const offUserSwitch = on("user-switched", () => {
      // Outra aba entrou com outro usuário: recarrega do zero (estado e cache limpos).
      queryClient.clear();
      window.location.replace(new URL("/", window.location.origin).href);
    });
    const offImpEnded = on("impersonation-ended", ({ reason }) => {
      queryClient.removeQueries({ queryKey: ["clinic"] });
      if (reason === "expired") toast.info(t("impersonation.expired"));
      // Quem está no /app é levado de volta pela guarda (impersonationReturnPath).
    });
    const offSuspended = on("clinic-suspended", () => setClinicSuspended(true));
    const offMfa = on("mfa-required", () => router.replace("/configurar-mfa"));
    return () => {
      offEnded();
      offRemoteLogin();
      offUserSwitch();
      offImpEnded();
      offSuspended();
      offMfa();
    };
  }, [applyMe, queryClient, reloadMe, router]);

  const completeLogin = useCallback(
    async (res: LoginOkResponse) => {
      queryClient.clear();
      session.applyLogin(res);
      const loaded = await authApi.me();
      applyMe(loaded);
      return loaded;
    },
    [applyMe, queryClient],
  );

  const logout = useCallback(async () => {
    await session.logout();
  }, []);

  const startImpersonation = useCallback(
    async (clinic: { id: string; name: string }) => {
      const { accessToken } = await adminApi.impersonate(clinic.id);
      const current = pathnameRef.current;
      const returnPath = current.startsWith("/admin") ? current : "/admin/clinicas";
      setImpersonationReturnPath(returnPath);
      queryClient.removeQueries({ queryKey: ["clinic"] });
      session.startImpersonation(accessToken, clinic);
      toast.success(t("impersonation.started", { clinic: clinic.name }));
      router.push("/app");
    },
    [queryClient, router],
  );

  const exitImpersonation = useCallback(() => session.endImpersonation("exit"), []);

  const value = useMemo<AuthContextValue>(() => {
    const role = me?.user.role ?? null;
    const permissions: Permission[] = impersonation
      ? IMPERSONATION_PERMISSIONS
      : me
        ? me.permissions?.length
          ? me.permissions
          : permissionsForRole(me.user.role)
        : [];
    return {
      status,
      me,
      role,
      impersonation,
      readOnly: impersonation !== null,
      clinicSuspended: impersonation ? false : clinicSuspended,
      impersonationReturnPath,
      endReason,
      can: (permission) => permissions.includes(permission),
      completeLogin,
      reloadMe,
      logout,
      startImpersonation,
      exitImpersonation,
    };
  }, [status, me, impersonation, clinicSuspended, impersonationReturnPath, endReason, completeLogin, reloadMe, logout, startImpersonation, exitImpersonation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
