import type { Metadata } from "next";
import { listProperties } from "@/lib/data/properties";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Buscar imóveis mobiliados mensais",
  description:
    "Encontre imóveis mobiliados para locação mensal de 30 a 180 dias. Filtre por cidade, preço, quartos e pelo selo Pronto para Trabalho.",
};

export default async function SearchPage() {
  const properties = await listProperties();
  return <SearchClient properties={properties} />;
}
