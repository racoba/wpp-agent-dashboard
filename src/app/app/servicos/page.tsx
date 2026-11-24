import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Serviços" };

export default function Page() {
  return <ComingSoon title="Serviços" phase={2} />;
}
