import type { Metadata } from "next";
import { preconnect } from "react-dom";
import { listProperties } from "@/lib/data/properties";
import { SearchClient } from "./search-client";
import { JsonLd } from "@/components/seo/json-ld";
import { listaImoveis } from "@/lib/seo/estruturados";
import { isExemplo } from "@/lib/demo-listing";
import { SITE_URL } from "@/lib/site";
import { destinosAtivos } from "@/lib/data/tempos";
import { modosDisponiveis } from "@/lib/integrations/rotas";
import { buscaComAnunciosDeTeste } from "@/lib/data/busca-teste";

// F9: dados frescos (revalidatePath nas ações + rede de segurança de 60 s).
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/buscar" },
  title: "Buscar imóveis mobiliados mensais",
  description:
    "Encontre imóveis mobiliados para locação mensal de 30 a 180 dias. Filtre por cidade, preço, quartos e pelo selo Pronto para Morar.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // E698: abre a conexão com o servidor dos tiles do mapa já na resposta da página (antes, só depois do JS do mapa).
  preconnect("https://basemaps.cartocdn.com", { crossOrigin: "anonymous" });
  // E571: conta de TESTE logada vê também os anúncios de teste ativos (cartões, filtros e contadores da mesma lista).
  // Visitante e conta real: a lista pública de sempre, sem anúncio de teste.
  const incluirTeste = await buscaComAnunciosDeTeste();
  const [properties, destinos] = await Promise.all([listProperties({ incluirTeste }), destinosAtivos()]);
  // E829: a query da URL vai para o SearchClient, que já NASCE filtrado (a primeira pintura respeita ?preco=, ?pet=…).
  const sp = await searchParams;
  const busca = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") busca.append(k, v);
    else if (Array.isArray(v)) for (const x of v) busca.append(k, x);
  }
  // E82-A + E91: sem banner nem título grande — o h1 é a linha da contagem, dentro do SearchClient.
  return (
    <>
      <SearchClient
        properties={properties}
        destinos={destinos.map((d) => ({ slug: d.slug, nome: d.nome, cidade: d.cidade, artigo: d.artigo, lat: d.lat == null ? null : Number(d.lat), lng: d.lng == null ? null : Number(d.lng) }))}
        modos={modosDisponiveis()}
        buscaInicial={busca.toString()}
      />
      {/* Dado estruturado é público: nunca leva anúncio de teste. */}
      <JsonLd dados={listaImoveis(SITE_URL, properties.filter((p) => !p.deTeste), (id) => isExemplo(id))} />
    </>
  );
}
