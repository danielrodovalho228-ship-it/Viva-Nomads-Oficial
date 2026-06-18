import type { Metadata } from "next";
import { listProperties } from "@/lib/data/properties";
import { BrandImage } from "@/components/brand-image";
import { PHOTOS } from "@/lib/media";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Buscar imóveis mobiliados mensais",
  description:
    "Encontre imóveis mobiliados para locação mensal de 30 a 180 dias. Filtre por cidade, preço, quartos e pelo selo Pronto para Morar.",
};

export default async function SearchPage() {
  const properties = await listProperties();
  return (
    <>
      {/* Banner do topo da busca (plano B2) */}
      <div className="relative">
        <BrandImage
          src={PHOTOS.buscaHero}
          alt="Bairro residencial arborizado de Uberlândia ao entardecer"
          rounded="rounded-none"
          sizes="100vw"
          priority
          treat={false}
          className="h-44 w-full sm:h-56"
        />
        <div className="absolute inset-0 bg-night/55" />
        <div className="container-page absolute inset-0 flex flex-col justify-center text-white">
          <h1 className="font-title text-3xl font-bold sm:text-4xl">
            Imóveis mobiliados em Uberlândia
          </h1>
          <p className="mt-1 max-w-xl text-white/75">
            Locação mensal de 30 a 180 dias. Filtre por período, preço e o selo Pronto para
            Trabalho.
          </p>
        </div>
      </div>
      <SearchClient properties={properties} />
    </>
  );
}
