"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { PHOTOS } from "@/lib/media";
import { TIPOS_ASSISTENTE } from "@/lib/anuncio/assistente-telas";
import { SELO_ILUSTRATIVA } from "@/components/institucional/foto-cartao";
import { SOMBRA_CARTAO_CADASTRO } from "@/lib/conta/visual-mockup";
import { cn } from "@/lib/utils";

/** A foto de cada cartão (todas 4:3, em PHOTOS.cadastro). Nenhum cartão fica sem foto. */
export const FOTO_TIPO: Record<string, string> = {
  casa: PHOTOS.cadastro.tipoCasa,
  apartamento: PHOTOS.cadastro.tipoApartamento,
  quarto: PHOTOS.cadastro.tipoQuarto,
  studio: PHOTOS.cadastro.tipoStudio,
  loft: PHOTOS.cadastro.tipoLoft,
  cobertura: PHOTOS.cadastro.tipoCobertura,
  casa_condominio: PHOTOS.cadastro.tipoCasaCondominio,
  flat: PHOTOS.cadastro.tipoFlat,
  chacara: PHOTOS.cadastro.tipoChacara,
};

/**
 * Passo 1 do assistente (Cadastro 01-b / E87, mockup cadastro-imovel-01): os nove tipos em cartões-foto numa linha única
 * rolável. No celular, desliza com rolagem por encaixe; no computador, setas à esquerda e à direita (desativadas no
 * início e no fim), também pelo teclado (as setas são botões, e ← → na linha rolam). O cartão marcado leva o selo verde.
 */
export function EtapaTipo({ tipo, onTipo, sugerido }: { tipo: string; onTipo: (v: string) => void; sugerido: boolean }) {
  const linha = useRef<HTMLDivElement>(null);
  const [bordas, setBordas] = useState({ inicio: true, fim: false });

  const medir = () => {
    const el = linha.current;
    if (!el) return;
    setBordas({ inicio: el.scrollLeft <= 1, fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(() => {
    // Abre já com o tipo marcado à vista (rascunho ou sugestão pelas fotos).
    linha.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const rolar = (sentido: 1 | -1) => {
    const el = linha.current;
    if (!el) return;
    const cartao = el.querySelector<HTMLElement>('[role="radio"]');
    el.scrollBy({ left: sentido * ((cartao?.offsetWidth ?? 192) + 16) * 2, behavior: "smooth" });
  };

  const seta = "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-ink shadow-flutuante disabled:cursor-not-allowed disabled:opacity-40 sm:grid";

  return (
    <div className="space-y-4" data-testid="etapa-tipo">
      {sugerido && (
        <p className="flex items-start gap-2 rounded-lg bg-champagne/15 px-3 py-2 text-sm text-forest" data-testid="tipo-sugerido">
          <Sparkles className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          Sugerido pelas fotos · confira.
        </p>
      )}
      <div className="relative sm:px-6">
        <div
          ref={linha}
          role="radiogroup"
          aria-label="Tipo do imóvel"
          onScroll={medir}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" && e.target === e.currentTarget) rolar(1);
            if (e.key === "ArrowLeft" && e.target === e.currentTarget) rolar(-1);
          }}
          tabIndex={-1}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          data-testid="tipos-linha"
        >
          {TIPOS_ASSISTENTE.map((t) => {
            const on = tipo === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onTipo(t.valor)}
                data-testid={`tipo-${t.valor}`}
                className={cn(
                  "relative flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition-colors sm:w-48",
                  SOMBRA_CARTAO_CADASTRO,
                  on ? "border-forest" : "border-transparent hover:border-sage-200",
                )}
              >
                <span className="relative block aspect-[4/3] w-full bg-sage-100">
                  <Image src={FOTO_TIPO[t.valor]} alt={t.alt} fill sizes="192px" className="pointer-events-none object-cover" draggable={false} data-testid={`tipo-${t.valor}-foto`} />
                  <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-night/70 px-2 py-1 text-xs font-semibold text-white" data-testid="selo-ilustrativa">
                    {SELO_ILUSTRATIVA}
                  </span>
                </span>
                <span className="block px-3 py-3 text-base font-semibold text-ink">{t.rotulo}</span>
                {on && <CheckCircle2 className="absolute right-2 top-2 h-7 w-7 fill-forest text-white" aria-hidden data-testid="tipo-marcado" />}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => rolar(-1)} disabled={bordas.inicio} aria-label="Ver tipos anteriores" className={cn(seta, "left-0 -translate-x-1/2")} data-testid="tipos-seta-esquerda">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={() => rolar(1)} disabled={bordas.fim} aria-label="Ver mais tipos" className={cn(seta, "right-0 translate-x-1/2")} data-testid="tipos-seta-direita">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
