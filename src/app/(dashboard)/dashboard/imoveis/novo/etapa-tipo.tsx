"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { PHOTOS } from "@/lib/media";
import { TIPOS_ASSISTENTE } from "@/lib/anuncio/assistente-telas";
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

/** E607: quantos tipos aparecem antes do "Ver mais tipos" (os três do mockup: Casa, Apartamento, Quarto). */
export const TIPOS_A_VISTA = 3;
/** O tipo marcado está fora dos que aparecem de início? Então a grade já abre completa. */
export function tipoForaDaVista(tipo: string): boolean {
  const i = TIPOS_ASSISTENTE.findIndex((t) => t.valor === tipo);
  return i >= TIPOS_A_VISTA;
}

/**
 * Passo 1 do assistente (Cadastro 01-b / E87, mockup cadastro-imovel-01): os tipos em cartões-foto, numa GRADE como no
 * desenho — três à vista (Casa, Apartamento, Quarto) e "Ver mais tipos" abre a grade completa dos nove (3 por linha no
 * computador; no celular, uma lista com a foto à esquerda). E607: antes era um carrossel — o último cartão à vista saía
 * cortado na borda da coluna, as setas ficavam por cima das fotos e "Ver mais tipos" só rolava a linha. O cartão marcado
 * leva o selo verde.
 */
export function EtapaTipo({ tipo, onTipo, sugerido }: { tipo: string; onTipo: (v: string) => void; sugerido: boolean }) {
  // Sem escolha da pessoa, a grade abre completa quando o tipo marcado está fora dos três primeiros (rascunho ou sugestão
  // pelas fotos que chega depois); "Ver mais/menos tipos" passa a mandar.
  const [aberto, setAberto] = useState<boolean | null>(null);
  const todos = aberto ?? tipoForaDaVista(tipo);
  const visiveis = todos ? TIPOS_ASSISTENTE : TIPOS_ASSISTENTE.slice(0, TIPOS_A_VISTA);
  const escondidos = TIPOS_ASSISTENTE.length - TIPOS_A_VISTA;

  return (
    <div className="space-y-4" data-testid="etapa-tipo">
      {sugerido && (
        <p className="flex items-start gap-2 rounded-lg bg-champagne/15 px-3 py-2 text-sm text-forest" data-testid="tipo-sugerido">
          <Sparkles className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          Sugerido pelas fotos · confira.
        </p>
      )}
      <div role="radiogroup" aria-label="Tipo do imóvel" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" data-testid="tipos-grade">
        {visiveis.map((t) => {
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
                "relative flex min-w-0 items-center overflow-hidden rounded-xl border-2 bg-white text-left transition-colors sm:flex-col sm:items-stretch",
                SOMBRA_CARTAO_CADASTRO,
                on ? "border-forest" : "border-transparent hover:border-sage-200",
              )}
            >
              <span className="relative block aspect-[4/3] w-28 shrink-0 bg-sage-100 sm:w-full">
                {/* E259 (5): as fotos são pequenas — carregam já, sem esperar entrar na tela. */}
                <Image src={FOTO_TIPO[t.valor]} alt={t.alt} fill sizes="(min-width: 640px) 33vw, 112px" loading="eager" className="pointer-events-none object-cover" draggable={false} data-testid={`tipo-${t.valor}-foto`} />
              </span>
              {/* Conformidade fina (01/11, mockup cadastro-imovel-01): o nome do tipo centrado no computador; no celular, ao lado da foto. */}
              <span className="block min-w-0 px-4 py-3 text-lg font-semibold text-ink sm:px-3 sm:text-center">{t.rotulo}</span>
              {on && <CheckCircle2 className="absolute right-2 top-2 h-7 w-7 fill-forest text-white" aria-hidden data-testid="tipo-marcado" />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setAberto(!todos)}
        aria-expanded={todos}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest underline underline-offset-4"
        data-testid="tipos-ver-mais"
      >
        {todos ? (
          <>
            Ver menos tipos <ChevronUp className="h-4 w-4" aria-hidden />
          </>
        ) : (
          <>
            Ver mais tipos ({escondidos}) <ChevronDown className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}
