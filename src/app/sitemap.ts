import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";
import { POLOS } from "@/lib/polos";
import { caminhosDeBairros } from "@/lib/bairros";
import { listProperties } from "@/lib/data/properties";
import { isExemplo, ehAnuncioDeTeste } from "@/lib/demo-listing";
import { GUIAS } from "@/lib/guias/guias";
import { createAdminClient } from "@/lib/supabase/admin";
import { chaveCidade } from "@/lib/cidades";

// F9: lista de imóveis sempre fresca (revalidatePath nas ações + 60 s de rede de segurança).
export const revalidate = 60;

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
    "/parceiros",
    "/parceiros/fotografos",
    "/parceiros/avaliadores",
    "/guia-fotos",
    "/precos",
    "/seguranca",
    "/ajuda",
    "/guias",
    ...GUIAS.map((g) => `/guias/${g.slug}`),
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

  const poloRoutes = POLOS.map((p) => ({
    url: `${SITE_URL}/cidades/${p.cidade}/${p.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Só imóveis REAIS no sitemap — os de exemplo (ilustrativos) ficam de fora.
  const properties = (await listProperties()).filter((p) => !isExemplo(p) && !ehAnuncioDeTeste(p.title));
  const propertyRoutes = properties.map((p) => ({
    url: `${SITE_URL}/imoveis/${p.id}`,
    ...(p.createdAt ? { lastModified: new Date(p.createdAt) } : {}),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const poloCaminhos = new Set(POLOS.map((p) => `/cidades/${p.cidade}/${p.slug}`));
  const bairroRoutes = caminhosDeBairros(CITIES, properties, (id) => isExemplo(id))
    .filter((c) => !poloCaminhos.has(c))
    .map((c) => ({ url: `${SITE_URL}${c}`, changeFrequency: "weekly" as const, priority: 0.6 }));

  // Prompt 37: "Imóveis perto de…" por destino ativo — só os que já têm imóvel (sem imóvel a página é noindex).
  const admin = createAdminClient();
  const { data: destinos } = admin ? await admin.from("destinos").select("slug, cidade").eq("ativo", true) : { data: [] };
  const cidadesComImovel = new Set(properties.map((p) => chaveCidade(p.city ?? "")));
  const destinoRoutes = ((destinos ?? []) as { slug: string; cidade: string }[])
    .filter((d) => cidadesComImovel.has(chaveCidade(d.cidade)))
    .map((d) => ({ url: `${SITE_URL}/imoveis-perto-de/${d.slug}`, changeFrequency: "weekly" as const, priority: 0.7 }));

  return [...staticRoutes, ...cityRoutes, ...poloRoutes, ...bairroRoutes, ...destinoRoutes, ...propertyRoutes];
}
