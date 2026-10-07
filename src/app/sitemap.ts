import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";
import { listProperties } from "@/lib/data/properties";
import { isExemplo } from "@/lib/demo-listing";

/** Sitemap dinâmico (vivanomads.com.br) — páginas públicas, cidades e imóveis. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // UMA URL só para a home: "/" (o antigo "/home" faz 301 para cá, então não
  // entra no sitemap — evita conteúdo duplicado).
  const staticRoutes = [
    "",
    "/buscar",
    "/como-funciona",
    "/para-proprietarios",
    "/empresas",
    "/precos",
    "/seguranca",
    "/ajuda",
    "/termos",
    "/privacidade",
  ].map((path) => ({
    // Sem lastmod inventado: "agora" a cada geração dizia ao Google que tudo
    // mudou o tempo todo. Só os imóveis levam data (a de criação, que é real).
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const cityRoutes = CITIES.map((c) => ({
    url: `${SITE_URL}/cidades/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Só imóveis REAIS no sitemap — os de exemplo (ilustrativos) ficam de fora.
  const properties = (await listProperties()).filter((p) => !isExemplo(p));
  const propertyRoutes = properties.map((p) => ({
    url: `${SITE_URL}/imoveis/${p.id}`,
    ...(p.createdAt ? { lastModified: new Date(p.createdAt) } : {}),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...cityRoutes, ...propertyRoutes];
}
