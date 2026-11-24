import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Conversas" };

export default function Page() {
  return <ComingSoon title="Conversas" phase={4} />;
}
