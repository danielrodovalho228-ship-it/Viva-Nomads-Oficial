"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface Linha {
  destino: string;
  slug: string | null;
  daBusca: boolean;
  tempos: string[];
}

/**
 * "Tempo até" (prompt 37): o destino da busca (quando a pessoa veio de uma busca com destino) e os 3 destinos
 * cadastrados mais próximos — de carro e a pé (de ônibus com a chave). Calculado no servidor com o ponto exato; aqui
 * chegam só os textos arredondados. Sem dado, o bloco não aparece.
 */
export function TempoAte({ imovelId }: { imovelId: string }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = new URLSearchParams();
    for (const k of ["destino", "modo", "dlat", "dlng", "drot"]) {
      const v = sp.get(k);
      if (v) q.set(k, v);
    }
    let vivo = true;
    fetch(`/api/tempos/imovel/${imovelId}?${q.toString()}`)
      .then((r) => r.json())
      .then((j: { linhas?: Linha[] }) => vivo && setLinhas(j.linhas ?? []))
      .catch(() => vivo && setLinhas([]));
    return () => {
      vivo = false;
    };
  }, [imovelId]);

  if (!linhas || linhas.length === 0) return null;
  return (
    <div className="mt-6" data-testid="tempo-ate">
      <h3 className="text-sm font-bold text-forest">Tempo até</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {linhas.map((l) => (
          <li key={l.destino} className="flex items-start gap-3 rounded-xl border border-sage-200 px-4 py-3" data-testid="tempo-ate-linha" data-busca={l.daBusca ? "1" : "0"}>
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden />
            <span className="min-w-0 text-sm text-ink">
              {l.tempos.map((t) => (
                <span key={t} className="block">
                  {t}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
