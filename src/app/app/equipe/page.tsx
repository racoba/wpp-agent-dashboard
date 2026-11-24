"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { ForbiddenState } from "@/components/feedback/states";
import { ComingSoon } from "@/components/layout/page-header";

export default function TeamPage() {
  const { can } = useAuth();
  // A UI esconde o menu, mas o acesso direto pela URL também precisa ser barrado.
  if (!can("users:manage")) return <ForbiddenState />;
  return <ComingSoon title="Equipe" phase={4} />;
}
