import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { makeQueryClient } from "@/components/providers/query-provider";

/** Renderiza com um QueryClient novo (sem retries, para os testes não esperarem). */
export function renderWithQuery(ui: React.ReactElement) {
  const client = makeQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}
