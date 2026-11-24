"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FullScreenLoader } from "@/components/feedback/states";
import { homePathFor } from "@/lib/auth/permissions";
import { t } from "@/lib/i18n";

/** "/" só decide para onde ir: painel do papel ou login. */
export default function HomePage() {
  const { status, role, impersonation } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "authenticated" && role) router.replace(impersonation ? "/app" : homePathFor(role));
  }, [status, role, impersonation, router]);

  return <FullScreenLoader label={t("auth.bootstrapping")} />;
}
