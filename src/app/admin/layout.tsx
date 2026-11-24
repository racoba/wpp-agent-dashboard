import { Suspense } from "react";
import { RouteGuard } from "@/components/auth/route-guard";
import { FullScreenLoader } from "@/components/feedback/states";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <RouteGuard roles={["master_admin"]} requireMfa>
        <AppShell area="admin" contextLabel="Administração da plataforma">
          {children}
        </AppShell>
      </RouteGuard>
    </Suspense>
  );
}
