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
      // noindex/nofollow no header HTTP (independe da meta tag dentro do HTML).
      {
        source: "/simulacao",
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
