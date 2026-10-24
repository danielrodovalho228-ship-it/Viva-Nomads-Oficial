"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { distanciaAte } from "@/lib/busca/distancia-destino";
import { lerDestinoDaBusca } from "@/lib/busca/destino-sessao";

interface Linha {
  destino: string;
  slug: string | null;
  daBusca: boolean;
  tempos: string[];
}

/**
 * "Tempo até" (prompt 37): o destino da busca (quando a pessoa veio de uma busca com destino) e os destinos
 * ativos da mesma cidade do anúncio (E31, destinosDoBloco) — de carro e a pé (de ônibus com a chave). Calculado no servidor com o ponto exato; aqui
 * chegam só os textos arredondados. Sem dado, o bloco não aparece.
 */
export function TempoAte({ imovelId, ponto }: { imovelId: string; /** E79: ponto PÚBLICO (aproximado) do anúncio, para a linha reta quando o servidor não traz. */ ponto?: { lat: number; lng: number } | null }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = new URLSearchParams();
    for (const k of ["destino", "modo", "dlat", "dlng", "drot"]) {
      const v = sp.get(k);
      if (v) q.set(k, v);
    }
    // E79: o cartão da busca não leva o destino no link — vale o destino ativo guardado pela busca nesta aba.
    const sessao = q.has("destino") || q.has("dlat") ? null : lerDestinoDaBusca();
    if (sessao) for (const [k, v] of Object.entries(sessao.params)) if (v) q.set(k, v);
    // A linha do destino da busca nunca falta: sem resposta do servidor para ele, a linha reta daqui (ponto público).
    const comDaBusca = (l: Linha[]): Linha[] => {
      if (!sessao?.alvo || l.some((x) => x.daBusca)) return l;
      const d = ponto ? distanciaAte(ponto, sessao.alvo) : null;
      return d ? [{ destino: sessao.alvo.rotulo, slug: null, daBusca: true, tempos: [d.texto] }, ...l] : l;
    };
    let vivo = true;
    fetch(`/api/tempos/imovel/${imovelId}?${q.toString()}`)
      .then((r) => r.json())
      .then((j: { linhas?: Linha[] }) => vivo && setLinhas(comDaBusca(j.linhas ?? [])))
      .catch(() => vivo && setLinhas(comDaBusca([])));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o ponto público do anúncio não muda na página
  }, [imovelId]);

  if (!linhas || linhas.length === 0) return null;
  return (
    <div className="mt-6" data-testid="tempo-ate">
      <h3 className="text-sm font-semibold text-forest">Tempo até</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {linhas.map((l) => (
          <li key={l.destino} className="flex items-start gap-3 rounded-xl border border-sage-200 px-4 py-3" data-testid="tempo-ate-linha" data-busca={l.daBusca ? "1" : "0"}>
            <Clock className="mt-1 h-5 w-5 shrink-0 text-sage" aria-hidden />
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
