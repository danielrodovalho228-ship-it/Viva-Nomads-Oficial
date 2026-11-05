"use client";

import { useState } from "react";
import { Lightbox } from "@/components/property-gallery";

/**
 * E466 (ii): a galeria da página pública do parceiro — cada foto abre a visualização ampliada (a mesma da galeria do
 * imóvel: setas, contador "1 / N", Esc e deslizar no celular; clicar no fundo fecha).
 */
export function GaleriaPublica({ itens, nome }: { itens: { id: string; url: string; legenda: string | null }[]; nome: string }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const fotos = itens.map((g) => g.url);
  return (
    <>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="parceiro-galeria">
        {itens.map((g, i) => (
          <li key={g.id} className="min-w-0">
            <figure>
              <button type="button" onClick={() => setAberta(i)} className="block w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" aria-label={`Ampliar foto ${i + 1} de ${itens.length}${g.legenda ? `: ${g.legenda}` : ""}`} data-testid="parceiro-galeria-foto">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio */}
                <img src={g.url} alt={g.legenda ?? `Trabalho de ${nome}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-[1.02]" />
              </button>
              {g.legenda && <figcaption className="mt-1 text-xs text-muted">{g.legenda}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>
      {aberta !== null && <Lightbox photos={fotos} title={nome} index={aberta} setIndex={setAberta} onClose={() => setAberta(null)} />}
    </>
  );
}
