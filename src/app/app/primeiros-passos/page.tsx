import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/states";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Primeiros passos" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OnboardingWizard />
    </Suspense>
  );
}
