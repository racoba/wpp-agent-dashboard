import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg items-center p-6">
      <EmptyState
        className="w-full"
        icon={FileQuestion}
        title={t("errors.notFoundTitle")}
        description={t("errors.notFoundDescription")}
        action={
          <Button asChild variant="outline">
            <Link href="/">{t("common.back")}</Link>
          </Button>
        }
      />
    </main>
  );
}
