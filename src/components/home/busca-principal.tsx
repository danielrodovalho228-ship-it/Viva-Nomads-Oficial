"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CityAutocomplete } from "@/components/city-autocomplete";

/**
 * Busca principal da home (ordem bab1b2aa): UM campo só — "Para onde você vai?".
 * Período, pessoas e orçamento ficam nos filtros da /buscar.
 */
export function BuscaPrincipal() {
  const router = useRouter();
  const [local, setLocal] = useState("");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = local.trim();
    router.push(q ? `/buscar?${new URLSearchParams({ local: q }).toString()}` : "/buscar");
  }

  return (
    <form onSubmit={buscar} role="search" data-testid="busca-principal" className="w-full text-left">
      <label htmlFor="busca-principal-local" className="mb-2 block px-4 font-title text-base font-semibold text-white sm:text-lg">
        Para onde você vai?
      </label>
      {/* Barra de busca em pill com ícone (Prompt 40): campo + botão redondo de buscar. */}
      <div className="flex items-center gap-2 rounded-full border border-line bg-white py-2 pl-4 pr-2" data-testid="barra-busca-home">
        <Search className="h-5 w-5 shrink-0 text-ink" aria-hidden />
        <div className="min-w-0 flex-1">
          <CityAutocomplete
            value={local}
            onChange={setLocal}
            inputId="busca-principal-local"
            placeholder="Cidade, bairro ou endereço"
            semIcone
            pillClassName="flex h-12 items-center"
            inputClassName="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          aria-label="Buscar imóveis"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
