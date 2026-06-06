import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled: React StrictMode double-mounts effects in dev, which breaks the
  // Supabase auth lock (navigator.locks) — leaving a lock dangling and freezing
  // every query. Production never double-mounts, so this only affects dev.
  reactStrictMode: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control',     value: 'on' },
          // microfone liberado p/ o próprio site (gravação de áudio no cadastro);
          // câmera/geolocalização só para o próprio site.
          { key: 'Permissions-Policy',         value: 'camera=(self), microphone=(self), geolocation=(self)' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },

  // Telas legadas (liam a tabela `profiles`, agora privada) → redirecionam
  // para o fluxo atual, evitando 403/becos sem saída.
  async redirects() {
    return [
      { source: '/criar-pedido',     destination: '/nova-demanda', permanent: false },
      { source: '/criar-perfil',     destination: '/prestador',    permanent: false },
      { source: '/resultados',       destination: '/feed',         permanent: false },
      { source: '/profissional/:id', destination: '/feed',         permanent: false },
    ]
  },
};

export default nextConfig;
