import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Horários" };

export default function Page() {
  return <ComingSoon title="Horários" phase={2} />;
}
