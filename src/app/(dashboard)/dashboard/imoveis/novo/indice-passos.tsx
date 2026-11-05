"use client";

import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROTULO_ESTADO_PASSO, type PassoIndice } from "@/lib/anuncio/indice-passos";

/**
 * E602: o índice de passos do assistente — os 10 passos clicáveis, cada um com o seu estado (feito, falta algo para
 * publicar, a fazer, atual). Leva a qualquer passo a qualquer hora: as fotos (e o resto) são exigência para PUBLICAR,
 * não para navegar. No celular é uma faixa que rola de lado; no computador, quebra em linhas.
 */
export function IndicePassos({ passos, onIr }: { passos: PassoIndice[]; onIr: (pos: number) => void }) {
  return (
    <nav aria-label="Passos do cadastro" className="mt-3" data-testid="indice-passos">
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
        {passos.map((p) => (
          <li key={p.n} className="shrink-0">
            <button
              type="button"
              onClick={() => onIr(p.pos)}
              aria-current={p.estado === "atual" ? "step" : undefined}
              title={p.faltam.length ? `Falta: ${p.faltam.join("; ")}` : ROTULO_ESTADO_PASSO[p.estado]}
              data-testid={`indice-passo-${p.n}`}
              data-estado={p.estado}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap",
                p.estado === "atual" && "border-forest bg-forest text-white",
                p.estado === "feito" && "border-sage-200 bg-sage-100 text-forest",
                p.estado === "falta" && "border-amber-300 bg-amber-50 text-amber-900",
                p.estado === "a-fazer" && "border-sage-200 bg-white text-muted",
              )}
            >
              {p.estado === "feito" ? <Check className="h-3.5 w-3.5" aria-hidden /> : p.estado === "falta" ? <CircleAlert className="h-3.5 w-3.5" aria-hidden /> : null}
              <span>
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
