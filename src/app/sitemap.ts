import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";
import { listProperties } from "@/lib/data/properties";

/** Sitemap dinâmico (vivanomads.com.br) — páginas públicas, cidades e imóveis. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes = [
    "",
    "/home",
    "/buscar",
    "/como-funciona",
    "/para-proprietarios",
    "/precos",
    "/termos",
    "/privacidade",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" || path === "/home" ? 1 : 0.7,
  }));

  const cityRoutes = CITIES.map((c) => ({
    url: `${SITE_URL}/cidades/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const properties = await listProperties();
  const propertyRoutes = properties.map((p) => ({
    url: `${SITE_URL}/imoveis/${p.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...cityRoutes, ...propertyRoutes];
}
