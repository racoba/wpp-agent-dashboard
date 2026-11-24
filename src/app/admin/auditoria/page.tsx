import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Auditoria" };

export default function Page() {
  return <ComingSoon title="Auditoria" phase={5} />;
}
