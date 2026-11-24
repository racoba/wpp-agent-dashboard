"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { FullScreenLoader } from "@/components/feedback/states";
import { env } from "@/config/env";

const MockWorkerStarter = env.apiMocking ? dynamic(() => import("@/mocks/worker-starter"), { ssr: false }) : null;
const MockDevtools = env.apiMocking ? dynamic(() => import("@/mocks/devtools"), { ssr: false }) : null;

/**
 * Com o mock ligado, só renderiza o app depois que o Service Worker do MSW
 * estiver ativo; assim o /auth/refresh do bootstrap já é interceptado.
 */
export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!env.apiMocking);
  const onReady = useCallback(() => setReady(true), []);

  if (!MockWorkerStarter) return <>{children}</>;
  return (
    <>
      <MockWorkerStarter onReady={onReady} />
      {ready ? (
        <>
          {children}
          {MockDevtools ? <MockDevtools /> : null}
        </>
      ) : (
        <FullScreenLoader />
      )}
    </>
  );
}
