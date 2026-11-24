/**
 * Variáveis públicas. NEXT_PUBLIC_* são substituídas em tempo de build, então
 * quando o mock está desligado o código de src/mocks nem entra no bundle.
 */
export const env = {
  /** "enabled" liga o MSW no navegador; qualquer outro valor usa a API real. */
  apiMocking: process.env.NEXT_PUBLIC_API_MOCKING === "enabled",
  /** Prefixo da API. Padrão "/api" (mesma origem, ver rewrites em next.config.ts). */
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, ""),
} as const;

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
