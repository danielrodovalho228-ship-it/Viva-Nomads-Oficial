import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";
import { listProperties } from "@/lib/data/properties";
import { isExemplo } from "@/lib/demo-listing";

/** Sitemap dinâmico (vivanomads.com.br) — páginas públicas, cidades e imóveis. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

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
    "/termos",
    "/privacidade",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const cityRoutes = CITIES.map((c) => ({
    url: `${SITE_URL}/cidades/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Só imóveis REAIS no sitemap — os de exemplo (ilustrativos) ficam de fora.
  const properties = (await listProperties()).filter((p) => !isExemplo(p));
  const propertyRoutes = properties.map((p) => ({
    url: `${SITE_URL}/imoveis/${p.id}`,
    lastModified: p.createdAt ? new Date(p.createdAt) : now,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...cityRoutes, ...propertyRoutes];
}
