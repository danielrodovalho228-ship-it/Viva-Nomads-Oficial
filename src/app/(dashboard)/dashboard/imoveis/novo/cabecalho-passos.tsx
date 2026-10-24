"use client";

import { progressoPasso, textoPasso } from "@/lib/anuncio/assistente-telas";

/**
 * Topo do assistente (mockups cadastro-imovel-01..10): a barra de progresso e a pílula "Passo X de 10". No celular, o
 * texto em cima e a barra embaixo, como no desenho.
 */
export function CabecalhoPassos({ pos, total }: { pos: number; total: number }) {
  const pct = progressoPasso(pos, total);
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-start sm:gap-4" data-testid="cabecalho-passos">
      <p className="text-sm font-medium text-ink sm:shrink-0 sm:rounded-full sm:bg-forest sm:px-4 sm:py-2 sm:text-base sm:font-semibold sm:text-white" aria-live="polite" data-testid="passo-texto">
        {textoPasso(pos, total)}
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2 sm:max-w-xs"
        role="progressbar"
        aria-label="Progresso do cadastro"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
