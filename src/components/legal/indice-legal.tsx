"use client";

import { useEffect, useState } from "react";
import { rotuloDoIndice } from "@/lib/ajuda/indice-legal";

/**
 * Índice das seções, lido dos próprios títulos da página (h2 com id dentro de [data-legal-corpo]): nenhum texto é
 * repetido no código. Computador: coluna fixa ao lado do texto. Celular: recolhido no topo ("Índice").
 */
export function IndiceLegal() {
  const [itens, setItens] = useState<{ id: string; rotulo: string }[]>([]);
  useEffect(() => {
    const h2s = Array.from(document.querySelectorAll<HTMLHeadingElement>("[data-legal-corpo] h2[id]"));
    // Lê os títulos já na página só no cliente (nenhum texto jurídico repetido no código).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItens(h2s.map((h) => ({ id: h.id, rotulo: rotuloDoIndice(h.textContent ?? "") })));
  }, []);

  const lista = (
    <ol className="mt-3 grid gap-1 text-sm">
      {itens.map((i, n) => (
        <li key={i.id}>
          <a href={`#${i.id}`} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-ink hover:bg-sage-50 hover:text-forest">
            <span className="w-5 shrink-0 text-muted">{n + 1}</span>
            <span>{i.rotulo}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav aria-label="Índice" data-testid="indice-legal" className="min-w-0">
      <details className="rounded-xl border border-line bg-white p-4 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center font-title text-lg font-semibold text-ink">Índice</summary>
        {lista}
      </details>
      <div className="sticky top-24 hidden rounded-xl border border-line bg-white p-4 lg:block">
        <p className="font-title text-lg font-semibold text-ink">Índice</p>
        {lista}
      </div>
    </nav>
  );
}
