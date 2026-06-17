import type { Metadata } from "next";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Buscar imóveis mobiliados mensais",
  description:
    "Encontre imóveis mobiliados para locação mensal de 30 a 180 dias. Filtre por cidade, preço, quartos e pelo selo Pronto para Trabalho.",
};

export default function SearchPage() {
  return <SearchClient properties={SAMPLE_PROPERTIES} />;
}
