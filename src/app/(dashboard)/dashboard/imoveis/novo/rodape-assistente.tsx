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
  /**
   * E135: falta algo no passo — o botão aparece esmaecido (nunca "verde cheio" com o passo incompleto), mas continua
   * clicável: o clique mostra no passo o que falta.
   */
  pendente?: boolean;
}

/**
 * CADASTRO-MOLDURA (E89): o rodapé é do FLUXO e é igual nos passos 1 a 10 — "Passo N de 10" com a barra de progresso,
 * "Voltar" à esquerda (secundário; não existe no Passo 1) e um só primário à direita ("Continuar"; no Passo 10,
 * "Publicar anúncio"). Fica preso no fim da tela na largura toda (fixed); um espaçador da mesma altura no fim da página
 * reserva o lugar dele, então nunca cobre o conteúdo.
 */
export function RodapeAssistente(p: {
  pos: number;
  total: number;
  onVoltar: (() => void) | null;
  primario: PrimarioRodape;
  /** E194: a Qualificação usa o mesmo rodapé com o seu texto ("Antes do Passo 1 · …") e a barra contínua. */
  texto?: string;
  pct?: number;
}) {
  const pct = p.pct ?? progressoPasso(p.pos, p.total);
  return (
    <>
      <div aria-hidden className="h-32" data-testid="assistente-rodape-espaco" />
      <div className="vn-rodape-fluxo fixed inset-x-0 z-20 border-t border-line bg-white print:hidden" data-testid="assistente-rodape">
        <div className="h-1 w-full bg-surface-2" role="progressbar" aria-label="Progresso do cadastro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full bg-forest transition-all" style={{ width: `${pct}%` }} />
        </div>
        {/* No computador, os botões alinham com a coluna do conteúdo (a mesma largura máxima da moldura, 72rem). */}
        <div className="flex w-full items-center justify-between gap-3 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-8" data-rodape-linha>
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            {p.onVoltar && (
              <button type="button" onClick={p.onVoltar} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink hover:bg-surface-2" data-testid="cadastro-voltar">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
              </button>
            )}
            {/* No celular, ao lado do "Publicar anúncio", o passo cabe inteiro em texto menor (nunca cortado). */}
            <p className="whitespace-nowrap text-xs text-muted sm:text-sm" aria-live="polite" data-testid="passo-texto">
              {p.texto ?? textoPasso(p.pos, p.total)}
            </p>
          </div>
          <Button
            size="lg"
            // E135: com o teclado aberto (celular), o 1º toque só tirava o foco do campo, a tela pulava e o clique se
            // perdia. Sem roubar o foco no pressionar, o mesmo toque já vale.
            onMouseDown={(e) => e.preventDefault()}
            onClick={p.primario.onClick}
            disabled={p.primario.disabled}
            title={p.primario.title}
            // E135: "não pronto" sem aria-disabled — o clique continua valendo e diz o que falta (aria-disabled faria o botão
            // parecer desligado e o toque seria ignorado por quem segue o atributo). O motivo vai no title e na caixa.
            data-pendente={p.primario.pendente ? "1" : undefined}
            className={cn("shrink-0 sm:min-w-40", p.primario.disabled && "cursor-not-allowed opacity-60", p.primario.pendente && !p.primario.disabled && "opacity-60")}
            data-testid={p.primario.testid}
          >
            {p.primario.rotulo} {p.primario.seta && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  );
}
