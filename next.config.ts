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
    ];
  },
  async rewrites() {
    return [
      // Simulador (página estática privada): a URL limpa /simulador serve o
      // arquivo public/simulador.html. Não listado em menu/sitemap — só por link.
      { source: "/simulador", destination: "/simulador.html" },
    ];
  },
  async headers() {
    return [
      // noindex/nofollow no header HTTP (independe da meta tag dentro do HTML).
      {
        source: "/simulador",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/simulador.html",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
