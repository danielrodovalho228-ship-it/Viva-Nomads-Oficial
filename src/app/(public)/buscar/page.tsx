import type { Metadata } from "next";
import { listProperties } from "@/lib/data/properties";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { SearchClient } from "./search-client";
import { JsonLd } from "@/components/seo/json-ld";
import { listaImoveis } from "@/lib/seo/estruturados";
import { isExemplo } from "@/lib/demo-listing";
import { SITE_URL } from "@/lib/site";

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
  const properties = await listProperties();
  // Lê a URL para a página seguir dinâmica por busca (como antes).
  await searchParams;
  // Ordem d15ef6bf: o título fica fixo; a cidade buscada aparece na contagem logo
  // abaixo ("15 imóveis em Uberlândia").
  const h1 = "Imóveis mobiliados para sua estadia";
  return (
    <>
      <SearchClient
        properties={properties}
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
                {/* Overlay em gradiente para o texto branco ficar sempre legível */}
                <div className="absolute inset-0 bg-gradient-to-r from-night/85 via-night/60 to-night/25" />
              </div>
              <div className="container-page pt-4 sm:absolute sm:inset-0 sm:flex sm:flex-col sm:justify-center sm:pt-0 sm:text-white lg:static lg:max-w-none lg:px-0 lg:pb-2 lg:pt-6 lg:text-ink">
                <h1 className="font-title text-xl font-bold text-ink sm:text-4xl sm:text-white lg:text-2xl lg:text-ink">{h1}</h1>
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
