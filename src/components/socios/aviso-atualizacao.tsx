import { TriangleAlert } from "lucide-react";

import { TEXTO_AVISO_ATUALIZACAO } from "@/lib/socios/aviso-atualizacao";

/**
 * E597 — aviso fixo no topo de /socios e /decisao enquanto as páginas não são revisadas com a decisão de 04/11
 * (Caminho B). Só o aviso: o conteúdo das páginas segue como está até a reescrita validada. Fica preso ao topo ao rolar
 * (sticky), em computador e celular.
 */
export function AvisoEmAtualizacao() {
  return (
    <div role="alert" className="sticky top-0 z-50 border-b-2 border-red-700 bg-red-50 px-4 py-3 sm:px-8" data-testid="aviso-em-atualizacao">
      <p className="mx-auto flex max-w-6xl items-start gap-2 text-sm font-semibold text-red-800 sm:text-base">
        <TriangleAlert className="mt-px h-5 w-5 shrink-0" aria-hidden />
        <span>{TEXTO_AVISO_ATUALIZACAO}</span>
      </p>
    </div>
  );
}
