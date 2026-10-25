import type { Metadata } from "next";
import { listProperties } from "@/lib/data/properties";
import { SearchClient } from "./search-client";
import { JsonLd } from "@/components/seo/json-ld";
import { listaImoveis } from "@/lib/seo/estruturados";
import { isExemplo } from "@/lib/demo-listing";
import { SITE_URL } from "@/lib/site";
import { destinosAtivos } from "@/lib/data/tempos";
import { modosDisponiveis } from "@/lib/integrations/rotas";

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
  const [properties, destinos] = await Promise.all([listProperties(), destinosAtivos()]);
  // Lê a URL para a página seguir dinâmica por busca (como antes).
  await searchParams;
  // E82-A + E91: sem banner nem título grande — o h1 é a linha da contagem, dentro do SearchClient.
  return (
    <>
      <SearchClient
        properties={properties}
        destinos={destinos.map((d) => ({ slug: d.slug, nome: d.nome, cidade: d.cidade, artigo: d.artigo, lat: d.lat == null ? null : Number(d.lat), lng: d.lng == null ? null : Number(d.lng) }))}
        modos={modosDisponiveis()}
      />
      <JsonLd dados={listaImoveis(SITE_URL, properties, (id) => isExemplo(id))} />
    </>
  );
}
