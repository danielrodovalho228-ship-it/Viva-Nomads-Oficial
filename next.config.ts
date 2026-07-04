import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Fotografia interina (carrega em produção; substituir por fotos reais do cliente)
      { protocol: "https", hostname: "images.unsplash.com" },
      // Fotos reais enviadas ao Supabase Storage
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async redirects() {
    return [
      // /planos é natural de digitar e pode ter links antigos; a página canônica
      // é /precos (o rótulo "Planos" no menu/rodapé já aponta para /precos).
      { source: "/planos", destination: "/precos", permanent: true },
      // O simulador agora é uma rota React em /simulacao (URL principal divulgada).
      // Links antigos para /simulador e a página estática apontam para ela.
      { source: "/simulador", destination: "/simulacao", permanent: true },
      { source: "/simulador.html", destination: "/simulacao", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // Apresentação (slideshow privado das telas). URL limpa /apresentacao.
      { source: "/apresentacao", destination: "/apresentacao.html" },
    ];
  },
  async headers() {
    return [
      // Cabeçalhos de segurança em TODAS as rotas (defesa em profundidade).
      // CSP entra como Report-Only primeiro: observa violações sem quebrar nada.
      {
        source: "/:path*",
        headers: [
          // Força HTTPS no navegador (1 ano). Sem `preload` de propósito — é um
          // compromisso difícil de reverter; adicione depois se desejar.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Anti-clickjacking (F4): o site não é embarcável em iframe.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              // 'unsafe-inline'/'unsafe-eval' cobrem o bootstrap do Next e o
              // mapbox-gl; endurecer com nonce é um próximo passo.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "worker-src 'self' blob:",
              "connect-src 'self' https://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://viacep.com.br",
              "frame-src 'self' https://player.vimeo.com https://www.youtube.com",
            ].join("; "),
          },
        ],
      },
      // noindex/nofollow no header HTTP (independe da meta tag dentro do HTML).
      {
        source: "/simulacao",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/modelodenegocio",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/roi",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/socios",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/decisao",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/apresentacao",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/apresentacao.html",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
