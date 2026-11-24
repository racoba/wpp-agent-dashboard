import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Uso e custos" };

export default function Page() {
  return <ComingSoon title="Uso e custos" phase={5} />;
}
