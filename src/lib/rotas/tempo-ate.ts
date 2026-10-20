/*
  Bloco "Tempo até" da página do imóvel (Prompt 37) — PURO. Uma linha por destino: o rótulo, o tempo por meio
  ("~15 min de carro") e, sem tempo, a linha reta (da coordenada APROXIMADA). Meio sem dado não aparece.
*/
import { ROTULO_MODO, ateODestino, rotuloLinhaReta, textoMinutos, type Modo } from "./tempo.ts";
import { distanciaKm, temCoordenada, type Ponto } from "./selecao.ts";

export interface LinhaTempoAte {
  /** "até o HC-UFU" */
  titulo: string;
  slug: string | null;
  tempos: { modo: Modo; rotuloModo: string; texto: string }[];
  /** "≈ 3,2 km em linha reta" — aparece quando nenhum meio tem tempo. */
  linhaReta: string;
}

export function blocoTempoAte(o: {
  destino: { rotulo: string; artigo: "o" | "a" | null; ponto: Ponto; destino?: { slug: string } };
  imovelAproximado: { lat?: number | null; lng?: number | null };
  modos: Modo[];
  minutos: Partial<Record<Modo, number | null>>;
}): LinhaTempoAte {
  const tempos = o.modos
    .map((modo) => ({ modo, m: o.minutos[modo] }))
    .filter((x): x is { modo: Modo; m: number } => typeof x.m === "number" && Number.isFinite(x.m))
    .map(({ modo, m }) => ({ modo, rotuloModo: ROTULO_MODO[modo], texto: textoMinutos(m) }));
  return {
    titulo: ateODestino(o.destino.rotulo, o.destino.artigo),
    slug: o.destino.destino?.slug ?? null,
    tempos,
    linhaReta: tempos.length === 0 && temCoordenada(o.imovelAproximado) ? rotuloLinhaReta(distanciaKm(o.destino.ponto, o.imovelAproximado)) : "",
  };
}
