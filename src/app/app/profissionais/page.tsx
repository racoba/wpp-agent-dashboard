import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Profissionais" };

export default function Page() {
  return <ComingSoon title="Profissionais" phase={2} />;
}
