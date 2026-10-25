"use client";

import { useRouter } from "next/navigation";
import { MedirInternet } from "@/components/anuncio/medir-internet";

/**
 * NIVEIS-MEDIR-B (E25b): a medição da internet por ponto na página do nível — é onde o link do celular chega
 * (`?medir=quarto_principal|trabalho`). Vale para rascunho e publicado, com as mesmas validações; validada, o nível
 * já foi recalculado no servidor e a página relê.
 */
export function MedirNoNivel({ propertyId, ponto }: { propertyId: string; ponto: "quarto_principal" | "trabalho" }) {
  const router = useRouter();
  return <MedirInternet imovelId={propertyId} origem="edicao" pontoInicial={ponto} onMedida={(validada) => validada && router.refresh()} />;
}
