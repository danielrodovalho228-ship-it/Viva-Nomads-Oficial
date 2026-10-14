"use client";

import { createContext, useContext } from "react";
import { tituloDaBusca, type TituloBuscaEntrada } from "@/lib/busca/titulo-busca";

/**
 * h1 da /buscar que acompanha a busca (ordem 6a98c68e). A página (servidor)
 * posiciona o título; o estado da busca chega pelo contexto do SearchClient.
 */
export const TituloBuscaContexto = createContext<TituloBuscaEntrada | null>(null);

export function TituloBusca({ className, padrao }: { className?: string; padrao: string }) {
  const busca = useContext(TituloBuscaContexto);
  return (
    <h1 className={className} data-testid="titulo-busca">
      {busca ? tituloDaBusca(busca) : padrao}
    </h1>
  );
}
