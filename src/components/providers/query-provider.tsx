"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage, isApiError } from "@/lib/api/errors";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** A tela trata o erro sozinha (sem toast global). */
      silentError?: boolean;
      successMessage?: string;
    };
  }
}

function shouldRetry(failureCount: number, error: unknown) {
  // Só rede/5xx valem nova tentativa; 4xx é definitivo.
  if (isApiError(error) && (error.isNetwork || error.isServer)) return failureCount < 2;
  return false;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _vars, _ctx, mutation) => {
        if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage);
      },
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silentError) return;
        // 401 já leva ao login; não precisa de toast.
        if (isApiError(error) && error.status === 401) return;
        toast.error(errorMessage(error));
      },
    }),
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
