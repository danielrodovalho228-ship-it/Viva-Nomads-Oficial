"use client";

import Image from "next/image";
import { CheckCircle2, Home, Sparkles } from "lucide-react";
import { PHOTOS } from "@/lib/media";
import { propertyTypeLabel } from "@/lib/amenities";
import { OUTROS_TIPOS, TIPOS_PRINCIPAIS, cartaoDoTipo } from "@/lib/anuncio/assistente-telas";
import { SOMBRA_CARTAO_CADASTRO } from "@/lib/conta/visual-mockup";
import { cn } from "@/lib/utils";

const FOTO: Record<string, string | null> = { casa: null, apartamento: PHOTOS.cadastro.tipoApartamento, quarto: PHOTOS.cadastro.tipoQuarto };

/**
 * Passo 1 do assistente (mockup cadastro-imovel-01): três cartões grandes — Casa, Apartamento, Quarto — com foto e o
 * selo de marcado; os outros tipos do catálogo (studio, loft, cobertura, casa de condomínio, flat) em "Outros tipos".
 * No computador os cartões ficam lado a lado (foto em cima); no celular, um por linha (foto à esquerda e a linha de apoio).
 */
export function EtapaTipo({ tipo, onTipo, sugerido }: { tipo: string; onTipo: (v: string) => void; sugerido: boolean }) {
  const marcado = cartaoDoTipo(tipo);
  return (
    <div className="space-y-6" data-testid="etapa-tipo">
      {sugerido && (
        <p className="flex items-start gap-2 rounded-lg bg-champagne/15 px-3 py-2 text-sm text-forest" data-testid="tipo-sugerido">
          <Sparkles className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          Sugerido pelas fotos · confira.
        </p>
      )}
      <div role="radiogroup" aria-label="Tipo do imóvel" className="grid gap-4 sm:grid-cols-3">
        {TIPOS_PRINCIPAIS.map((t) => {
          const on = marcado === t.valor;
          const foto = FOTO[t.valor];
          return (
            <button
              key={t.valor}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onTipo(t.valor)}
              data-testid={`tipo-${t.valor}`}
              className={cn(
                "relative flex min-w-0 items-center gap-4 rounded-xl border-2 bg-white p-4 text-left transition-colors sm:flex-col sm:items-stretch sm:text-center",
                SOMBRA_CARTAO_CADASTRO,
                on ? "border-forest" : "border-transparent hover:border-sage-200",
              )}
            >
              <span className="relative block aspect-square w-28 shrink-0 overflow-hidden rounded-lg bg-sage-100 sm:aspect-[4/3] sm:w-full">
                {foto ? (
                  <Image src={foto} alt="" fill sizes="(min-width: 640px) 280px, 112px" className="object-cover" data-testid={`tipo-${t.valor}-foto`} />
                ) : (
                  <span className="grid h-full w-full place-items-center text-forest" aria-hidden>
                    <Home className="h-12 w-12" />
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-title text-2xl font-semibold text-ink">{t.rotulo}</span>
                <span className="mt-1 block text-sm text-muted sm:hidden">{t.apoio}</span>
              </span>
              {on && <CheckCircle2 className="absolute right-3 top-3 h-7 w-7 fill-forest text-white" aria-hidden data-testid="tipo-marcado" />}
            </button>
          );
        })}
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Outros tipos</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Outros tipos">
          {OUTROS_TIPOS.map((v) => {
            const on = tipo === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onTipo(v)}
                data-testid={`tipo-${v}`}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-sage-200",
                )}
              >
                {propertyTypeLabel(v)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
