import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Agente" };

export default function Page() {
  return <ComingSoon title="Agente" phase={2} />;
}
