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
    <form
      onSubmit={buscar}
      role="search"
      data-testid="busca-principal"
      className="w-full rounded-2xl bg-white p-3 text-left shadow-2xl shadow-night/30 sm:p-5"
    >
      <label htmlFor="busca-principal-local" className="mb-2 block font-title text-base font-bold text-ink sm:text-lg">
        Para onde você vai?
      </label>
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <CityAutocomplete
            value={local}
            onChange={setLocal}
            inputId="busca-principal-local"
            placeholder="Cidade, bairro ou endereço"
            pillClassName="flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-3.5 focus-within:border-forest"
            inputClassName="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          aria-label="Buscar imóveis"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 text-sm font-bold text-night transition-colors hover:bg-green-300 sm:px-6"
        >
          <Search className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Buscar</span>
        </button>
      </div>
    </form>
  );
}
