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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const properties = await listProperties();
  // H1 dinâmico (A4 do E2E): usa a cidade buscada; sem cidade, texto genérico.
  const sp = await searchParams;
  const local = typeof sp.local === "string" ? sp.local.trim() : "";
  const h1 = local ? `Imóveis mobiliados em ${local}` : "Imóveis mobiliados para sua estadia";
  return (
    <>
      {/* Banner do topo da busca — casa mobiliada com área de lazer (padrão premium) */}
      <div className="relative">
        <BrandImage
          src={PHOTOS.buscaHero}
          alt="Casa mobiliada com piscina e área de lazer ao anoitecer"
          rounded="rounded-none"
          sizes="100vw"
          priority
          treat={false}
          className="h-44 w-full object-cover sm:h-56"
        />
        {/* Overlay em gradiente para o texto branco ficar sempre legível */}
        <div className="absolute inset-0 bg-gradient-to-r from-night/85 via-night/60 to-night/25" />
        <div className="container-page absolute inset-0 flex flex-col justify-center text-white">
          <h1 className="font-title text-3xl font-bold sm:text-4xl">{h1}</h1>
          <p className="mt-1 max-w-xl text-white/85">
            Locação mensal de 30 a 180 dias. Filtre por período, preço e o selo Pronto para
            Morar.
          </p>
        </div>
      </div>
      <SearchClient properties={properties} />
    </>
  );
}
