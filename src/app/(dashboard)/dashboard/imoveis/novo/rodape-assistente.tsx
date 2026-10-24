"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { progressoPasso, textoPasso } from "@/lib/anuncio/assistente-telas";

export interface PrimarioRodape {
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  testid: string;
  /** "Continuar" leva a seta; "Publicar anúncio" não. */
  seta?: boolean;
  title?: string;
}

/**
 * CADASTRO-MOLDURA (E89): o rodapé é do FLUXO e é igual nos passos 1 a 10 — "Passo N de 10" com a barra de progresso,
 * "Voltar" à esquerda (secundário; não existe no Passo 1) e um só primário à direita ("Continuar"; no Passo 10,
 * "Publicar anúncio"). Fica preso no fim da tela, dentro do fluxo da página (sticky): ocupa o próprio espaço e nunca
 * cobre o conteúdo. No passo Fotos, sobe acima da barra das fotos do celular (--altura-barra-fotos).
 */
export function RodapeAssistente(p: { pos: number; total: number; onVoltar: (() => void) | null; primario: PrimarioRodape }) {
  const pct = progressoPasso(p.pos, p.total);
  return (
    <div className="sticky bottom-[var(--altura-barra-fotos,0px)] z-20 -mx-4 mt-8 border-t border-line bg-white sm:-mx-8 print:hidden" data-testid="assistente-rodape">
      <div className="h-1 w-full bg-surface-2" role="progressbar" aria-label="Progresso do cadastro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full bg-forest transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {p.onVoltar && (
            <button type="button" onClick={p.onVoltar} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink hover:bg-surface-2" data-testid="cadastro-voltar">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
            </button>
          )}
          <p className="truncate text-sm text-muted" aria-live="polite" data-testid="passo-texto">
            {textoPasso(p.pos, p.total)}
          </p>
        </div>
        <Button
          size="lg"
          onClick={p.primario.onClick}
          disabled={p.primario.disabled}
          title={p.primario.title}
          className={cn("shrink-0 sm:min-w-40", p.primario.disabled && "cursor-not-allowed opacity-60")}
          data-testid={p.primario.testid}
        >
          {p.primario.rotulo} {p.primario.seta && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
