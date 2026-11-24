"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { DEFAULT_TIMEZONE } from "@/config/env";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import type { Permission } from "@/lib/api/types";

/**
 * Pode escrever? Exige a permissão E não estar em impersonação (somente leitura).
 * A UI só esconde/desabilita; o backend continua decidindo (403 é tratado).
 */
export function useCanWrite(permission: Permission): boolean {
  const { can, readOnly } = useAuth();
  return can(permission) && !readOnly;
}

/** Fuso da clínica (do /auth/me ou, na impersonação, do GET /clinic). */
export function useClinicTimezone(): string {
  const { me, impersonation } = useAuth();
  const { data } = useQuery({
    queryKey: clinicKeys.clinic,
    queryFn: clinicApi.getClinic,
    enabled: !!impersonation,
  });
  if (impersonation) return data?.timezone ?? DEFAULT_TIMEZONE;
  return me?.clinic?.timezone ?? DEFAULT_TIMEZONE;
}
