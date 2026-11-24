import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/states";
import { SchedulePage } from "./schedule-page";

export const metadata: Metadata = { title: "Horários" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SchedulePage />
    </Suspense>
  );
}
