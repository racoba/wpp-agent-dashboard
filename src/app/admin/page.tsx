import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Visão geral" };

export default function Page() {
  return <ComingSoon title="Visão geral" phase={5} />;
}
