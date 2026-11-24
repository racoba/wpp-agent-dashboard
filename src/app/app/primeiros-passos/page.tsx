import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Primeiros passos" };

export default function Page() {
  return <ComingSoon title="Primeiros passos" phase={2} />;
}
