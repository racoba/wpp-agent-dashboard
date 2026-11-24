import { Suspense } from "react";
import { RouteGuard } from "@/components/auth/route-guard";
import { FullScreenLoader } from "@/components/feedback/states";
import { ClinicShell } from "./clinic-shell";

export default function ClinicLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <RouteGuard roles={["clinic_admin", "clinic_staff"]} allowImpersonation>
        <ClinicShell>{children}</ClinicShell>
      </RouteGuard>
    </Suspense>
  );
}
