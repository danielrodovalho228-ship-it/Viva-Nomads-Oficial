"use client";

import { Fragment, useState } from "react";
import { idealParaComMotivo, SUGESTAO_DA_VIVA } from "@/lib/ideal-para";
import type { Property } from "@/lib/types";

/**
 * Linha "Sugestão da Viva: …" derivada dos dados do anúncio (ordem 507074ce; E1049, decisão do coordenador). Some
 * quando não há nenhum. Cada rótulo mostra o motivo: ao passar o rato (title), ao leitor de tela (aria-label) e ao
 * tocar (abre a frase logo abaixo). O cálculo segue em src/lib/ideal-para.ts.
 */
export function IdealPara({ property, className = "" }: { property: Property; className?: string }) {
  const itens = idealParaComMotivo(property);
  const [aberto, setAberto] = useState<string | null>(null);
  if (itens.length === 0) return null;
  const motivo = itens.find((i) => i.id === aberto);
  return (
    <div className={`text-xs text-muted ${className}`}>
      <p data-testid="ideal-para">
        <span className="font-semibold text-ink">{SUGESTAO_DA_VIVA}:</span>{" "}
        {itens.map((i, n) => (
          <Fragment key={i.id}>
            {n > 0 ? " · " : null}
            <button
              type="button"
              className="cursor-help underline decoration-dotted underline-offset-2"
              title={i.motivo}
              aria-label={`${i.nome}: ${i.motivo}`}
              aria-expanded={aberto === i.id}
              onClick={() => setAberto(aberto === i.id ? null : i.id)}
            >
              {i.nome}
            </button>
          </Fragment>
        ))}
      </p>
      {motivo ? (
        <p className="mt-1" data-testid="sugestao-motivo">
          {motivo.nome}: {motivo.motivo}
        </p>
      ) : null}
    </div>
  );
}
