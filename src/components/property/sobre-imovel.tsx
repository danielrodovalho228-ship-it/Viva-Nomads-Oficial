"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { descricaoPrecisaMostrarMais } from "@/lib/anuncio/resumos-imovel";

/** "Sobre o imóvel": ~5 linhas e "Mostrar mais" abre o texto completo (sheet no celular, modal no computador). */
export function SobreImovel({ descricao }: { descricao: string }) {
  const [aberto, setAberto] = useState(false);
  const longo = descricaoPrecisaMostrarMais(descricao);
  return (
    <section aria-labelledby="sobre-title" data-testid="sobre-imovel">
      <h2 id="sobre-title" className="font-title text-2xl font-bold text-ink">
        Sobre o imóvel
      </h2>
      <p className={`mt-3 whitespace-pre-line leading-relaxed text-ink/90 ${longo ? "line-clamp-5" : ""}`}>{descricao}</p>
      {longo && (
        <>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="mt-2 min-h-11 text-sm font-semibold text-forest underline underline-offset-4"
          >
            Mostrar mais
          </button>
          <BottomSheet open={aberto} onClose={() => setAberto(false)} title="Sobre o imóvel">
            <p className="whitespace-pre-line leading-relaxed text-ink/90">{descricao}</p>
          </BottomSheet>
        </>
      )}
    </section>
  );
}
