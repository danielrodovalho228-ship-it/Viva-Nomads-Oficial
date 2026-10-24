import type { Metadata } from "next";
import { listProperties } from "@/lib/data/properties";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { SearchClient } from "./search-client";
import { JsonLd } from "@/components/seo/json-ld";
import { listaImoveis } from "@/lib/seo/estruturados";
import { isExemplo } from "@/lib/demo-listing";
import { SITE_URL } from "@/lib/site";
import { TituloBusca } from "@/components/busca/titulo-busca";
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
  // Ordem 6a98c68e: o h1 acompanha a busca ("38 imóveis mobiliados em Uberlândia")
  // e muda com os filtros — ver TituloBusca. Este é só o texto antes de hidratar.
  const h1 = "Imóveis mobiliados para locação mensal";
  return (
    <>
      <SearchClient
        properties={properties}
        destinos={destinos.map((d) => ({ slug: d.slug, nome: d.nome, cidade: d.cidade, artigo: d.artigo, lat: d.lat == null ? null : Number(d.lat), lng: d.lng == null ? null : Number(d.lng) }))}
        modos={modosDisponiveis()}
        topo={
          <>
            {/* Topo da busca. Celular (ordem 314f764e): só o título, curto — a busca e os
                filtros vêm logo abaixo. Tablet/computador: banner com foto. Um h1 só. */}
            <div className="relative">
              {/* Computador (lg+): sem banner — a tela dividida começa logo abaixo do título. */}
              <div className="hidden sm:block lg:hidden">
                <BrandImage
                  src={PHOTOS.buscaHero}
                  alt="Casa mobiliada com piscina e área de lazer ao anoitecer"
                  rounded="rounded-none"
                  sizes="100vw"
                  priority
                  treat={false}
                  className="h-56 w-full object-cover"
                />
                {/* Véu escuro liso (sem gradiente, adendo do Prompt 40) para o texto branco ficar sempre legível */}
                <div className="absolute inset-0 bg-night/60" />
              </div>
              <div className="container-page pt-4 sm:absolute sm:inset-0 sm:flex sm:flex-col sm:justify-center sm:pt-0 sm:text-white lg:static lg:max-w-none lg:px-0 lg:pb-2 lg:pt-6 lg:text-ink">
                <TituloBusca
                  padrao={h1}
                  className="font-title text-xl font-semibold tabular-nums text-ink sm:text-[28px] sm:text-white lg:text-2xl lg:text-ink"
                />
                <p className="mt-1 hidden max-w-xl text-white/85 sm:block lg:hidden">
                  Locação mensal de 30 a 180 dias. Filtre por período, preço e o selo Pronto para
                  Morar.
                </p>
              </div>
            </div>
          </>
        }
      />
      <JsonLd dados={listaImoveis(SITE_URL, properties, (id) => isExemplo(id))} />
    </>
  );
}
