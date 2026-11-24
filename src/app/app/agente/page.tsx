"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AgentActivationCard } from "@/components/agent/agent-activation";
import { AgentPreview } from "@/components/agent/agent-preview";
import { AgentSettingsForm } from "@/components/agent/agent-settings-form";
import { ReadOnlyNotice } from "@/components/feedback/read-only-notice";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { useCanWrite } from "@/hooks/use-clinic";
import { clinicApi, clinicKeys } from "@/lib/api/endpoints";
import type { AgentSettings } from "@/lib/api/types";

export default function AgentPage() {
  const canWrite = useCanWrite("agent:write");
  const query = useQuery({ queryKey: clinicKeys.agentSettings, queryFn: clinicApi.agentSettings });
  const [draft, setDraft] = useState<AgentSettings | undefined>(undefined);

  return (
    <>
      <PageHeader title="Agente" description="Como o agente conversa com os pacientes e quando ele atende." />
      <ReadOnlyNotice permission="agent:write" />
      {query.isPending ? (
        <PageSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <AgentSettingsForm settings={query.data} readOnly={!canWrite} onChange={setDraft} />
          <aside className="space-y-6 lg:sticky lg:top-[calc(var(--impersonation-offset,0px)+4.5rem)] lg:self-start">
            <AgentActivationCard />
            <AgentPreview settings={canWrite ? draft : undefined} />
          </aside>
        </div>
      )}
    </>
  );
}
