"use client";

import { usePathname } from "next/navigation";
import { SkeletonLista } from "@/components/ui/skeleton";
import { InicioTopo, MarcadorSecaoInicio } from "./visao-geral-client";

/**
 * Carregando qualquer tela do painel: esqueleto, não tela branca.
 * E797 (opção b): no Início, nunca o esqueleto de página inteira — a navegação até ele mostra a MESMA casca da página
 * (topo + marcador do bloco de dados), que é o que o servidor manda no 1º quadro.
 */
export default function Loading() {
  if (usePathname() === "/dashboard") {
    return (
      <div data-testid="inicio-secoes">
        <InicioTopo />
        <MarcadorSecaoInicio />
      </div>
    );
  }
  return <SkeletonLista />;
}
