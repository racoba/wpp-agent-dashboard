import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Meu perfil" };

export default function Page() {
  return <ComingSoon title="Meu perfil" phase={4} />;
}
