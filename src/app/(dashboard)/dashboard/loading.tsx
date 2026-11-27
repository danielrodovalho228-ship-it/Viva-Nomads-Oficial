"use client";

import { usePathname } from "next/navigation";
import { SkeletonLista } from "@/components/ui/skeleton";
import { InicioTopo, MarcadorSecaoInicio, InicioFixo } from "./visao-geral-client";

/**
 * Carregando qualquer tela do painel: esqueleto, não tela branca.
 * E797 (opção b): no Início, nunca o esqueleto de página inteira — o 1º quadro é a CASCA do Início (topo, o marcador do
 * bloco de dados e as partes fixas), na carga e na navegação até ele.
 */
export default function Loading() {
  if (usePathname() === "/dashboard") {
    return (
      <div data-testid="inicio-secoes">
        <InicioTopo />
        <MarcadorSecaoInicio />
        <InicioFixo />
      </div>
    );
  }
  return <SkeletonLista />;
}
