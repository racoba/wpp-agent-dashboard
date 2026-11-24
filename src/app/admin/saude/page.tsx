import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Saúde do sistema" };

export default function Page() {
  return <ComingSoon title="Saúde do sistema" phase={5} />;
}
