"use client";

import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROTULO_ESTADO_PASSO, type PassoIndice } from "@/lib/anuncio/indice-passos";

/**
 * E602: o índice de passos do assistente — os 10 passos clicáveis, cada um com o seu estado (feito, falta algo para
 * publicar, a fazer, atual). Leva a qualquer passo a qualquer hora: as fotos (e o resto) são exigência para PUBLICAR,
 * não para navegar. Os passos QUEBRAM EM LINHAS em toda largura (nada rola de lado): no celular cada passo é só o
 * número (o nome vai no title e para o leitor de tela); a partir de sm, "N. Nome". A 1ª versão era uma faixa que rolava
 * de lado e, no celular, alargava a página em 762 px (t468) — sem elemento largo, não há o que estourar a tela.
 */
export function IndicePassos({ passos, onIr }: { passos: PassoIndice[]; onIr: (pos: number) => void }) {
  return (
    <nav aria-label="Passos do cadastro" className="mt-3" data-testid="indice-passos">
      <ol className="flex flex-wrap gap-2">
        {passos.map((p) => (
          <li key={p.n}>
            <button
              type="button"
              onClick={() => onIr(p.pos)}
              aria-current={p.estado === "atual" ? "step" : undefined}
              title={p.faltam.length ? `Falta: ${p.faltam.join("; ")}` : ROTULO_ESTADO_PASSO[p.estado]}
              data-testid={`indice-passo-${p.n}`}
              data-estado={p.estado}
              className={cn(
                "inline-flex min-h-8 min-w-8 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap",
                p.estado === "atual" && "border-forest bg-forest text-white",
                p.estado === "feito" && "border-sage-200 bg-sage-100 text-forest",
                p.estado === "falta" && "border-amber-300 bg-amber-50 text-amber-900",
                p.estado === "a-fazer" && "border-sage-200 bg-white text-muted",
              )}
            >
              {p.estado === "feito" ? <Check className="h-3.5 w-3.5" aria-hidden /> : p.estado === "falta" ? <CircleAlert className="h-3.5 w-3.5" aria-hidden /> : null}
              <span aria-hidden className="sm:hidden">
                {p.n}
              </span>
              <span className="sr-only sm:not-sr-only">
                {p.n}. {p.titulo}
              </span>
              <span className="sr-only">— {ROTULO_ESTADO_PASSO[p.estado]}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
