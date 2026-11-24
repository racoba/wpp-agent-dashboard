"use client";

import { Lock } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Permission } from "@/lib/api/types";
import { t } from "@/lib/i18n";

/** Explica por que os botões de edição estão desabilitados. */
export function ReadOnlyNotice({ permission }: { permission: Permission }) {
  const { can, readOnly } = useAuth();
  if (!readOnly && can(permission)) return null;
  return (
    <Alert className="mb-4">
      <Lock aria-hidden />
      <AlertDescription>
        {readOnly ? t("errors.readOnly") : "Seu papel permite apenas visualizar esta área. Fale com o administrador da clínica para alterar."}
      </AlertDescription>
    </Alert>
  );
}
