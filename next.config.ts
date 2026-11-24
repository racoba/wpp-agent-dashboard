import type { NextConfig } from "next";

/**
 * O painel é um app de cliente: o accessToken vive só em memória no navegador,
 * então não há nada autenticado para renderizar no servidor. Cache Components
 * fica desligado de propósito (a navegação com <Activity> manteria telas
 * "escondidas" montadas com dados de outra sessão após logout/troca de papel).
 */
const apiProxyTarget = process.env.API_PROXY_TARGET;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * Com API_PROXY_TARGET definido, /api/* é repassado ao backend pelo próprio
   * Next. Assim API e painel ficam na mesma origem e o cookie de refresh
   * (httpOnly, SameSite=Strict) funciona sem CORS.
   */
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
